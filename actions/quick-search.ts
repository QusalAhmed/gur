"use server";

import { createClient } from "@/lib/supabase/server";
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
  const q = query.trim();
  if (!q || q.length < 2) return empty;

  try {
    const supabase = await createClient();

    // 1. Search orders (by order_number or customer_phone or customer_name)
    const normalizedPhone = normalizeBDPhone(q);
    let ordersQuery = supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, grand_total, status")
      .limit(5);

    if (normalizedPhone) {
      ordersQuery = ordersQuery.or(`customer_phone.eq.${normalizedPhone},order_number.ilike.%${q}%`);
    } else {
      ordersQuery = ordersQuery.or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`
      );
    }

    // 2. Search products (by name, slug)
    const productsQuery = supabase
      .from("products")
      .select("id, name, slug, status")
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      .limit(5);

    // 3. Search profiles / customers
    const customersQuery = supabase
      .from("profiles")
      .select("id, full_name, phone, account_type")
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(5);

    const [ordersRes, productsRes, customersRes] = await Promise.all([
      ordersQuery,
      productsQuery,
      customersQuery,
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
