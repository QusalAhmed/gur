"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { formatDbOrderRecord } from "@/lib/supabase";
import type { Order } from "@/types/order";

export interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  channel?: string;
  payment?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface StatusCounts {
  all: number;
  incomplete_order: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  partially_delivered: number;
  cancelled: number;
  returned: number;
}

export interface GetOrdersResult {
  orders: Order[];
  totalCount: number;
  pageCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  statusCounts: StatusCounts;
  totalRevenue: number;
}

const VALID_SORT_COLUMNS: Record<string, string> = {
  id: "order_number",
  order_number: "order_number",
  date: "placed_at",
  placed_at: "placed_at",
  customer: "customer_name",
  customer_name: "customer_name",
  grand_total: "grand_total",
  status: "status",
  payment: "payment_status",
  payment_status: "payment_status",
  fulfillment: "fulfillment_status",
  fulfillment_status: "fulfillment_status",
  method: "payment_method",
  payment_method: "payment_method",
  channel: "channel",
};

/**
 * Server Action: Fetches a paginated slice of orders matching the given filter,
 * search term, and sort order, along with global status counts and revenue metrics.
 */
export async function getOrdersAction(params: GetOrdersParams = {}): Promise<GetOrdersResult> {
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const rawPageSize = Math.floor(Number(params.pageSize) || 10);
  const pageSize = Math.min(100, Math.max(1, rawPageSize));
  const status = (params.status || "all").trim();
  const channel = (params.channel || "all").trim();
  const payment = (params.payment || "all").trim();
  const rawSearch = (params.search || "").trim();
  const sortByInput = (params.sortBy || "placed_at").trim();
  const sortColumn = VALID_SORT_COLUMNS[sortByInput] || "placed_at";
  const isAscending = params.sortOrder === "asc";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Use supabaseAdmin if configured on the server, otherwise fallback to standard supabase client
  const client = supabaseAdmin || supabase;

  // 1. Build the paginated orders query
  const buildQuery = (selectString: string) => {
    let q = client
      .from("orders")
      .select(selectString, { count: "exact" });

    // Status filter
    if (status && status !== "all") {
      q = q.eq("status", status);
    }

    // Channel filter
    if (channel && channel !== "all") {
      q = q.eq("channel", channel);
    }

    // Payment status filter
    if (payment && payment !== "all") {
      q = q.eq("payment_status", payment);
    }

    // Search filter across order ID, customer name, phone, alternative phone, customer note, shipping method
    if (rawSearch) {
      // Remove characters that conflict with PostgREST URL filter grammar
      const cleanTerm = rawSearch.replace(/[,()]/g, "").trim();
      if (cleanTerm) {
        q = q.or(
          `order_number.ilike.%${cleanTerm}%,customer_name.ilike.%${cleanTerm}%,customer_phone.ilike.%${cleanTerm}%,customer_alternative_phone.ilike.%${cleanTerm}%,shipping_phone.ilike.%${cleanTerm}%,customer_note.ilike.%${cleanTerm}%,shipping_method_name.ilike.%${cleanTerm}%`
        );
      }
    }

    // Sorting: Primary sort by chosen column, deterministic secondary sort by placed_at
    q = q.order(sortColumn, { ascending: isAscending });
    if (sortColumn !== "placed_at") {
      q = q.order("placed_at", { ascending: false });
    }

    // Range-based pagination slice
    q = q.range(from, to);

    return q;
  };

  // 2. Execute paginated orders query + status counts aggregation query concurrently
  const fullSelect = `
    *,
    order_items (*),
    order_events (*),
    order_notes (*)
  `;

  const fallbackSelect = `
    *,
    order_items (*),
    order_events (*)
  `;

  const [ordersResResult, statsRes] = await Promise.all([
    buildQuery(fullSelect).then(async (res) => {
      if (res.error) {
        // If out of range (PGRST103), safely treat as empty page with known count
        if (res.error.code === "PGRST103" || res.error.message?.includes("Requested range not satisfiable")) {
          return { data: [], count: res.count ?? null, error: null };
        }
        console.warn("Full orders relation query encountered an issue, trying fallback select:", res.error.message);
        const fallbackRes = await buildQuery(fallbackSelect);
        if (fallbackRes.error) {
          if (fallbackRes.error.code === "PGRST103" || fallbackRes.error.message?.includes("Requested range not satisfiable")) {
            return { data: [], count: fallbackRes.count ?? null, error: null };
          }
          if (fallbackRes.error.code === "42501") {
            return await buildQuery("*");
          }
        }
        return fallbackRes;
      }
      return res;
    }),
    client.from("orders").select("status, grand_total"),
  ]);

  let rawOrders: any[] = [];
  let totalCount = 0;

  if (ordersResResult.error) {
    if (ordersResResult.error.code === "PGRST103" || ordersResResult.error.message?.includes("Requested range not satisfiable")) {
      rawOrders = [];
      totalCount = statsRes.data?.length ?? 0;
    } else {
      console.error("Failed to query paginated orders:", ordersResResult.error);
      throw new Error(ordersResResult.error.message || "Failed to fetch orders");
    }
  } else {
    rawOrders = ordersResResult.data || [];
    totalCount = ordersResResult.count ?? (statsRes.data?.length ?? rawOrders.length);
  }
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasMore = page < pageCount;

  // Format orders to standard domain Order objects
  const orders: Order[] = rawOrders.map((row: any) => formatDbOrderRecord(row));

  // Compute status counts and aggregate revenue from database stats
  const initialStatusCounts: StatusCounts = {
    all: 0,
    incomplete_order: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    partially_delivered: 0,
    cancelled: 0,
    returned: 0,
  };

  let totalRevenue = 0;

  if (statsRes.data && Array.isArray(statsRes.data)) {
    initialStatusCounts.all = statsRes.data.length;
    for (const row of statsRes.data) {
      const st = row.status as keyof Omit<StatusCounts, "all">;
      if (st in initialStatusCounts) {
        initialStatusCounts[st] = (initialStatusCounts[st] || 0) + 1;
      }
      if (row.status !== "cancelled" && row.status !== "returned" && row.status !== "incomplete_order") {
        totalRevenue += Number(row.grand_total) || 0;
      }
    }
  }

  return {
    orders,
    totalCount,
    pageCount,
    page,
    pageSize,
    hasMore,
    statusCounts: initialStatusCounts,
    totalRevenue,
  };
}
