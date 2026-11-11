"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { sanitizePostgrestFilterTerm } from "@/lib/security";
import { normalizeBDPhone } from "@/lib/admin-format";

export interface QuickSearchResult {
  orders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    grand_total: number;
    status: string;
  }>;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
  }>;
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
  }>;
}

export async function searchGlobalAction(query: string): Promise<QuickSearchResult> {
  const empty: QuickSearchResult = { orders: [], products: [], customers: [] };
  const q = sanitizePostgrestFilterTerm(query);
  if (!q || q.length < 2) return empty;

  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = getSupabaseAdmin();
    const canViewOrdersAndCustomers = session.role !== "editor";

    // 1. Search orders (by order_number or customer_phone or customer_name)
    const normalizedPhone = normalizeBDPhone(q);
    let ordersQuery = null;
    if (canViewOrdersAndCustomers) {
      let oq = supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, grand_total, status")
        .limit(5);

      if (normalizedPhone) {
        oq = oq.or(`customer_phone.eq.${normalizedPhone},order_number.ilike.%${q}%`);
      } else {
        oq = oq.or(
          `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`
        );
      }
      ordersQuery = oq;
    }

    // 2. Search products (by name, slug)
    const productsQuery = supabase
      .from("products")
      .select("id, name, slug, status")
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      .limit(5);

    // 3. Search profiles / customers
    const customersQuery = canViewOrdersAndCustomers
      ? supabase
          .from("profiles")
          .select("id, full_name, phone, account_type")
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5)
      : null;

    const [ordersRes, productsRes, customersRes] = await Promise.all([
      ordersQuery ?? Promise.resolve({ data: [] as any[] }),
      productsQuery,
      customersQuery ?? Promise.resolve({ data: [] as any[] }),
    ]);

    return {
      orders: (ordersRes.data || []).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name || "Guest Customer",
        customer_phone: o.customer_phone || "",
        grand_total: Number(o.grand_total) || 0,
        status: o.status,
      })),
      products: (productsRes.data || []).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
      })),
      customers: (customersRes.data || []).map((c) => ({
        id: c.id,
        name: c.full_name || "Customer",
        phone: c.phone || "",
        email: null,
      })),
    };
  } catch (err) {
    console.error("Global search error:", err);
    return empty;
  }
}
