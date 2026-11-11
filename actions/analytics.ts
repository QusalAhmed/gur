"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";

export type AnalyticsTimeRange = "ytd" | "mtd" | "last30" | "last90";

export interface AnalyticsData {
  kpis: {
    totalRevenue: number;
    totalRevenueDelta: string;
    totalOrders: number;
    totalOrdersDelta: string;
    avgOrderValue: number;
    avgOrderValueDelta: string;
    uniqueCustomers: number;
    uniqueCustomersDelta: string;
  };
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
    newCustomers: number;
  }>;
  channelData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  paymentMethodData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  productPerformance: Array<{
    product: string;
    revenue: number;
    units: number;
  }>;
  retentionData: Array<{
    month: string;
    new: number;
    returning: number;
  }>;
}

const CHANNEL_COLORS: Record<string, string> = {
  web: "#3b82f6",
  phone: "#8b5cf6",
  whatsapp: "#22c55e",
  admin: "#d97706",
  facebook: "#ef4444",
  walk_in: "#06b6d4",
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cod: "#64748b",
  bkash: "#e11d48",
  nagad: "#f97316",
  bank_transfer: "#0ea5e9",
  card: "#8b5cf6",
};

export async function getAdminAnalyticsAction(
  timeRange: AnalyticsTimeRange = "ytd"
): Promise<{
  success: boolean;
  data: AnalyticsData;
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    let startDate: Date;

    if (timeRange === "mtd") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === "last30") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "last90") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else {
      // ytd
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const [ordersRes, itemsRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, grand_total, status, payment_method, channel, customer_phone, placed_at, user_id")
        .gte("placed_at", startDate.toISOString())
        .order("placed_at", { ascending: true }),

      supabaseAdmin
        .from("order_items")
        .select("product_name, quantity, unit_price, line_total, created_at")
        .gte("created_at", startDate.toISOString()),

      supabaseAdmin
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", startDate.toISOString()),
    ]);

    const orders = ordersRes.data || [];
    const items = itemsRes.data || [];
    const profiles = profilesRes.data || [];

    const validOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
    const totalRevenue = validOrders.reduce((acc, o) => acc + Number(o.grand_total || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Unique customers by phone or user_id
    const customerIds = new Set(orders.map((o) => o.customer_phone || o.user_id || o.id));
    const uniqueCustomers = customerIds.size;

    // Monthly aggregation
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap = new Map<string, { month: string; revenue: number; orders: number; newCustomers: number }>();

    // Initialise last 6 or 10 months
    const monthCount = timeRange === "mtd" ? 1 : timeRange === "last30" ? 2 : timeRange === "last90" ? 3 : 10;
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap.set(key, { month: monthNames[d.getMonth()], revenue: 0, orders: 0, newCustomers: 0 });
    }

    orders.forEach((o) => {
      const d = new Date(o.placed_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.orders += 1;
        if (o.status !== "cancelled" && o.status !== "returned") {
          entry.revenue += Number(o.grand_total || 0);
        }
      }
    });

    profiles.forEach((p) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.newCustomers += 1;
      }
    });

    const monthlyRevenue = Array.from(monthlyMap.values());

    // Channels
    const channelCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const ch = o.channel || "web";
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    });

    const channelData = Object.entries(channelCounts).map(([name, count]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: count,
      color: CHANNEL_COLORS[name] || "#94a3b8",
    }));

    // Payment methods
    const methodCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const m = o.payment_method || "cod";
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });

    const paymentMethodData = Object.entries(methodCounts).map(([name, count]) => ({
      name: name === "cod" ? "Cash on Delivery" : name === "bkash" ? "bKash" : name === "bank_transfer" ? "Bank Transfer" : name.toUpperCase(),
      value: count,
      color: PAYMENT_METHOD_COLORS[name] || "#94a3b8",
    }));

    // Product performance
    const productStatsMap = new Map<string, { revenue: number; units: number }>();
    items.forEach((item) => {
      const name = item.product_name || "Unknown Product";
      const existing = productStatsMap.get(name) || { revenue: 0, units: 0 };
      existing.units += Number(item.quantity || 0);
      existing.revenue += Number(item.line_total || item.unit_price * item.quantity || 0);
      productStatsMap.set(name, existing);
    });

    const productPerformance = Array.from(productStatsMap.entries())
      .map(([product, stats]) => ({
        product,
        revenue: Math.round(stats.revenue),
        units: Math.round(stats.units),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Retention (new vs returning)
    const phoneOrderCount = new Map<string, number>();
    orders.forEach((o) => {
      if (o.customer_phone) {
        phoneOrderCount.set(o.customer_phone, (phoneOrderCount.get(o.customer_phone) || 0) + 1);
      }
    });

    const retentionMap = new Map<string, { month: string; new: number; returning: number }>();
    monthlyMap.forEach((val, key) => {
      retentionMap.set(key, { month: val.month, new: 0, returning: 0 });
    });

    orders.forEach((o) => {
      const d = new Date(o.placed_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const entry = retentionMap.get(key);
      if (entry) {
        const count = phoneOrderCount.get(o.customer_phone || "") || 1;
        if (count > 1) {
          entry.returning += 1;
        } else {
          entry.new += 1;
        }
      }
    });

    const retentionData = Array.from(retentionMap.values());

    return {
      success: true,
      data: {
        kpis: {
          totalRevenue,
          totalRevenueDelta: "+0%",
          totalOrders,
          totalOrdersDelta: "+0%",
          avgOrderValue,
          avgOrderValueDelta: "+0%",
          uniqueCustomers,
          uniqueCustomersDelta: "+0%",
        },
        monthlyRevenue,
        channelData,
        paymentMethodData,
        productPerformance,
        retentionData,
      },
    };
  } catch (error: any) {
    console.error("getAdminAnalyticsAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch analytics",
      data: {
        kpis: {
          totalRevenue: 0,
          totalRevenueDelta: "0%",
          totalOrders: 0,
          totalOrdersDelta: "0%",
          avgOrderValue: 0,
          avgOrderValueDelta: "0%",
          uniqueCustomers: 0,
          uniqueCustomersDelta: "0%",
        },
        monthlyRevenue: [],
        channelData: [],
        paymentMethodData: [],
        productPerformance: [],
        retentionData: [],
      },
    };
  }
}

