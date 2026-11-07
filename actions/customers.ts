"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";

export interface CustomerItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "individual" | "business";
  orders: number;
  spent: string;
  spentNumeric: number;
  joined: string;
  lastOrder: string;
}

export interface BusinessItem {
  id: string;
  name: string;
  industry: string;
  trade: string;
  tin?: string;
  bin?: string;
  status: "approved" | "pending" | "suspended";
  members: number;
  creditLimit: string;
  creditLimitNumeric: number;
  terms: number;
  contact: string;
  phone?: string;
  email?: string;
  appliedDate?: string;
}

export interface AdminCustomersData {
  customers: CustomerItem[];
  businesses: BusinessItem[];
}

export async function getAdminCustomersAction(): Promise<{
  success: boolean;
  data: AdminCustomersData;
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    const [profilesRes, ordersRes, businessesRes, membersRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, account_type, created_at")
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("orders")
        .select("id, user_id, customer_phone, grand_total, status, placed_at")
        .order("placed_at", { ascending: false }),

      supabase
        .from("business_accounts")
        .select(
          `
          id,
          name,
          industry,
          trade_license_no,
          tin,
          bin,
          contact_name,
          contact_phone,
          contact_email,
          status,
          credit_limit,
          payment_terms_days,
          created_at
        `
        )
        .order("created_at", { ascending: false })
        .limit(200),

      supabase.from("business_members").select("business_id, user_id"),
    ]);

    const rawProfiles = profilesRes.data || [];
    const rawOrders = ordersRes.data || [];
    const rawBusinesses = businessesRes.data || [];
    const rawMembers = membersRes.data || [];

    // Aggregate orders per customer (by user_id or phone)
    const userOrderStats = new Map<string, { count: number; spent: number; lastOrder: string }>();

    rawOrders.forEach((o) => {
      const keys = [o.user_id, o.customer_phone].filter(Boolean) as string[];
      keys.forEach((k) => {
        const existing = userOrderStats.get(k) || { count: 0, spent: 0, lastOrder: "" };
        existing.count += 1;
        if (o.status !== "cancelled" && o.status !== "returned") {
          existing.spent += Number(o.grand_total || 0);
        }
        if (!existing.lastOrder || new Date(o.placed_at) > new Date(existing.lastOrder)) {
          existing.lastOrder = o.placed_at;
        }
        userOrderStats.set(k, existing);
      });
    });

    const customers: CustomerItem[] = rawProfiles.map((p) => {
      const stats = userOrderStats.get(p.id) || (p.phone ? userOrderStats.get(p.phone) : null) || {
        count: 0,
        spent: 0,
        lastOrder: "",
      };

      return {
        id: p.id,
        name: p.full_name || "Anonymous Customer",
        email: "",
        phone: p.phone || "N/A",
        type: p.account_type === "business" ? "business" : "individual",
        orders: stats.count,
        spent: `৳ ${stats.spent.toLocaleString("en-BD")}`,
        spentNumeric: stats.spent,
        joined: p.created_at,
        lastOrder: stats.lastOrder || p.created_at,
      };
    });

    // Count members per business
    const memberCounts = new Map<string, number>();
    rawMembers.forEach((m) => {
      memberCounts.set(m.business_id, (memberCounts.get(m.business_id) || 0) + 1);
    });

    const businesses: BusinessItem[] = rawBusinesses.map((b) => ({
      id: b.id,
      name: b.name,
      industry: b.industry || "General Commercial",
      trade: b.trade_license_no || "N/A",
      tin: b.tin || undefined,
      bin: b.bin || undefined,
      status: (b.status as any) || "pending",
      members: memberCounts.get(b.id) || 1,
      creditLimit: `৳ ${Number(b.credit_limit || 0).toLocaleString("en-BD")}`,
      creditLimitNumeric: Number(b.credit_limit || 0),
      terms: Number(b.payment_terms_days || 0),
      contact: b.contact_name || "Primary Contact",
      phone: b.contact_phone || undefined,
      email: b.contact_email || undefined,
      appliedDate: b.created_at,
    }));

    return {
      success: true,
      data: {
        customers,
        businesses,
      },
    };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return {
      success: false,
      error: friendly.message,
      data: {
        customers: [],
        businesses: [],
      },
    };
  }
}

export async function createBusinessAccountAction(payload: {
  name: string;
  industry?: string;
  tradeLicenseNo?: string;
  tin?: string;
  bin?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase.from("business_accounts").insert({
      name: payload.name.trim(),
      industry: payload.industry?.trim() || null,
      trade_license_no: payload.tradeLicenseNo?.trim() || null,
      tin: payload.tin?.trim() || null,
      bin: payload.bin?.trim() || null,
      contact_name: payload.contactName.trim(),
      contact_phone: payload.contactPhone.trim(),
      contact_email: payload.contactEmail?.trim() || null,
      credit_limit: payload.creditLimit || 0,
      payment_terms_days: payload.paymentTermsDays || 0,
      status: "pending",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/businesses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create business account" };
  }
}

export async function updateBusinessStatusAction(payload: {
  id: string;
  status: "approved" | "pending" | "suspended";
  creditLimit?: number;
  paymentTermsDays?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString(),
    };
    if (payload.status === "approved") {
      updateData.approved_at = new Date().toISOString();
    }
    if (payload.creditLimit !== undefined) {
      updateData.credit_limit = payload.creditLimit;
    }
    if (payload.paymentTermsDays !== undefined) {
      updateData.payment_terms_days = payload.paymentTermsDays;
    }

    const { error } = await supabase
      .from("business_accounts")
      .update(updateData)
      .eq("id", payload.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/businesses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update business status" };
  }
}

export async function deleteBusinessAccountAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("business_accounts").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/businesses");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete business account" };
  }
}

export async function deleteCustomerAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/customers");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete customer" };
  }
}
