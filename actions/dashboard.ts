"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";

export interface DashboardStats {
  kpis: {
    monthlyRevenue: number;
    monthlyRevenueDelta: string;
    monthlyOrders: number;
    monthlyOrdersDelta: string;
    activeProducts: number;
    activeProductsDelta: string;
    newCustomers: number;
    newCustomersDelta: string;
    pendingOrders: number;
    pendingOrdersDelta: string;
    quoteRequests: number;
    quoteRequestsDelta: string;
    b2bAccounts: number;
    b2bAccountsDelta: string;
    pendingReviews: number;
    pendingReviewsDelta: string;
  };
  alerts: {
    lowStockCount: number;
    pendingQuotesCount: number;
    pendingB2bCount: number;
  };
  revenueTrends: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
  orderStatusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  weeklyDispatch: Array<{
    day: string;
    orders: number;
  }>;
  recentOrders: Array<{
    id: string;
    customer: string;
    status: string;
    payment: string;
    amount: string;
    time: string;
    channel: string;
  }>;
  topProducts: Array<{
    name: string;
    sales: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "#22c55e",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  confirmed: "#06b6d4",
  pending: "#f59e0b",
  incomplete_order: "#94a3b8",
  cancelled: "#ef4444",
  returned: "#f97316",
  partially_delivered: "#14b8a6",
};

export async function getAdminDashboardStatsAction(): Promise<{
  success: boolean;
  data: DashboardStats;
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Start of current month & previous month for delta calculations
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
    const endOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).toISOString();

    // Start of 6 months ago
    const startOfSixMonthsAgo = new Date(currentYear, currentMonth - 5, 1).toISOString();

    // Run parallel queries across tables
    const [
      ordersRes,
      prevOrdersRes,
      productsCountRes,
      prevProductsCountRes,
      customersRes,
      prevCustomersRes,
      pendingOrdersRes,
      quotesRes,
      b2bRes,
      reviewsRes,
      allOrdersForStatusRes,
      recentOrdersRes,
      topItemsRes,
      lowStockRes,
    ] = await Promise.all([
      // Current month orders
      supabaseAdmin
        .from("orders")
        .select("id, grand_total, status, placed_at")
        .gte("placed_at", startOfCurrentMonth),

      // Previous month orders for delta
      supabaseAdmin
        .from("orders")
        .select("id, grand_total, status, placed_at")
        .gte("placed_at", startOfPrevMonth)
        .lte("placed_at", endOfPrevMonth),

      // Products count (active)
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      // Total products created before this month
      supabaseAdmin
        .from("products")
        .select("id", { count: "exact", head: true })
        .lt("created_at", startOfCurrentMonth),

      // Current month new customers
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfCurrentMonth),

      // Previous month new customers
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfPrevMonth)
        .lte("created_at", endOfPrevMonth),

      // Pending orders
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // Pending quotes
      supabaseAdmin
        .from("quote_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // Pending B2B accounts
      supabaseAdmin
        .from("business_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // Pending reviews
      supabaseAdmin
        .from("product_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // All orders for status distribution & 6-month trends
      supabaseAdmin
        .from("orders")
        .select("id, grand_total, status, placed_at")
        .gte("placed_at", startOfSixMonthsAgo)
        .order("placed_at", { ascending: true }),

      // Recent 5 orders
      supabaseAdmin
        .from("orders")
        .select("id, order_number, customer_name, status, payment_status, grand_total, placed_at, channel")
        .order("placed_at", { ascending: false })
        .limit(5),

      // Order items for top products
      supabaseAdmin
        .from("order_items")
        .select("product_name, quantity")
        .order("quantity", { ascending: false })
        .limit(100),

      // Low stock inventory items
      supabaseAdmin
        .from("inventory_levels")
        .select("id", { count: "exact", head: true })
        .lte("available_quantity", 10),
    ]);

    // Current month revenue & orders
    const curOrders = ordersRes.data || [];
    const prevOrders = prevOrdersRes.data || [];

    const curRevenue = curOrders
      .filter((o) => o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

    const prevRevenue = prevOrders
      .filter((o) => o.status !== "cancelled" && o.status !== "returned")
      .reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

    const calcDelta = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? `+100%` : `0%`;
      const diff = ((cur - prev) / prev) * 100;
      return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
    };

    const monthlyRevenueDelta = calcDelta(curRevenue, prevRevenue);
    const monthlyOrdersDelta = calcDelta(curOrders.length, prevOrders.length);

    const activeProducts = productsCountRes.count ?? 0;
    const prevActiveProducts = prevProductsCountRes.count ?? 0;
    const activeProductsDelta =
      activeProducts - prevActiveProducts >= 0
        ? `+${activeProducts - prevActiveProducts}`
        : `${activeProducts - prevActiveProducts}`;

    const newCustomers = customersRes.count ?? 0;
    const prevCustomers = prevCustomersRes.count ?? 0;
    const newCustomersDelta = calcDelta(newCustomers, prevCustomers);

    const pendingOrders = pendingOrdersRes.count ?? 0;
    const quoteRequests = quotesRes.count ?? 0;
    const b2bAccounts = b2bRes.count ?? 0;
    const pendingReviews = reviewsRes.count ?? 0;

    // 6-Month Revenue & Orders Trend
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendMap = new Map<string, { month: string; revenue: number; orders: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mName = months[d.getMonth()];
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      trendMap.set(key, { month: mName, revenue: 0, orders: 0 });
    }

    const sixMonthsOrders = allOrdersForStatusRes.data || [];
    sixMonthsOrders.forEach((o) => {
      const d = new Date(o.placed_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const entry = trendMap.get(key);
      if (entry) {
        entry.orders += 1;
        if (o.status !== "cancelled" && o.status !== "returned") {
          entry.revenue += Number(o.grand_total || 0);
        }
      }
    });

    const revenueTrends = Array.from(trendMap.values());

    // Order Status Distribution
    const statusCounts: Record<string, number> = {};
    sixMonthsOrders.forEach((o) => {
      const s = o.status || "pending";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const orderStatusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: count,
      color: STATUS_COLORS[status] || "#94a3b8",
    }));

    // Weekly Dispatch & Order Volume for the current week (Mon-Sun)
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyDataMap = new Map<string, number>([
      ["Mon", 0],
      ["Tue", 0],
      ["Wed", 0],
      ["Thu", 0],
      ["Fri", 0],
      ["Sat", 0],
      ["Sun", 0],
    ]);

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    sixMonthsOrders.forEach((o) => {
      const pDate = new Date(o.placed_at);
      if (pDate >= startOfWeek) {
        const dName = dayNames[pDate.getDay()];
        if (weeklyDataMap.has(dName)) {
          weeklyDataMap.set(dName, (weeklyDataMap.get(dName) || 0) + 1);
        }
      }
    });

    const weeklyDispatch = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
      day: d,
      orders: weeklyDataMap.get(d) || 0,
    }));

    // Recent Orders
    const recentOrders = (recentOrdersRes.data || []).map((o) => ({
      id: o.order_number || o.id,
      customer: o.customer_name || "Guest Customer",
      status: o.status || "pending",
      payment: o.payment_status || "unpaid",
      amount: `৳ ${Number(o.grand_total || 0).toLocaleString("en-BD", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`,
      time: o.placed_at,
      channel: o.channel || "web",
    }));

    // Top Products
    const productSalesMap = new Map<string, number>();
    (topItemsRes.data || []).forEach((item) => {
      const name = item.product_name || "Unknown Product";
      const q = Number(item.quantity || 0);
      productSalesMap.set(name, (productSalesMap.get(name) || 0) + q);
    });

    const topProducts = Array.from(productSalesMap.entries())
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    return {
      success: true,
      data: {
        kpis: {
          monthlyRevenue: curRevenue,
          monthlyRevenueDelta,
          monthlyOrders: curOrders.length,
          monthlyOrdersDelta,
          activeProducts,
          activeProductsDelta,
          newCustomers,
          newCustomersDelta,
          pendingOrders,
          pendingOrdersDelta: pendingOrders > 0 ? `+${pendingOrders}` : "0",
          quoteRequests,
          quoteRequestsDelta: quoteRequests > 0 ? `+${quoteRequests}` : "0",
          b2bAccounts,
          b2bAccountsDelta: b2bAccounts > 0 ? `+${b2bAccounts}` : "0",
          pendingReviews,
          pendingReviewsDelta: pendingReviews > 0 ? `+${pendingReviews}` : "0",
        },
        alerts: {
          lowStockCount: lowStockRes.count ?? 0,
          pendingQuotesCount: quoteRequests,
          pendingB2bCount: b2bAccounts,
        },
        revenueTrends,
        orderStatusDistribution,
        weeklyDispatch,
        recentOrders,
        topProducts,
      },
    };
  } catch (error: any) {
    console.error("getAdminDashboardStatsAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch dashboard statistics",
      data: {
        kpis: {
          monthlyRevenue: 0,
          monthlyRevenueDelta: "0%",
          monthlyOrders: 0,
          monthlyOrdersDelta: "0%",
          activeProducts: 0,
          activeProductsDelta: "0",
          newCustomers: 0,
          newCustomersDelta: "0%",
          pendingOrders: 0,
          pendingOrdersDelta: "0",
          quoteRequests: 0,
          quoteRequestsDelta: "0",
          b2bAccounts: 0,
          b2bAccountsDelta: "0",
          pendingReviews: 0,
          pendingReviewsDelta: "0",
        },
        alerts: {
          lowStockCount: 0,
          pendingQuotesCount: 0,
          pendingB2bCount: 0,
        },
        revenueTrends: [],
        orderStatusDistribution: [],
        weeklyDispatch: [],
        recentOrders: [],
        topProducts: [],
      },
    };
  }
}

