"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { formatDbOrderRecord } from "@/lib/supabase";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import { validateOrderStatusTransition } from "@/lib/supabase/error-handler";
import { bookSteadfastParcelAction } from "@/actions/steadfast";
import { buildSteadfastPayloadSnapshot, type SteadfastConsignmentResult } from "@/lib/steadfast";
import { enqueueAndDispatch } from "@/lib/outbox";
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

/**
 * Server Action: Fetches a single order by either its UUID or order_number,
 * including related order_items, order_events, and order_notes.
 */
async function enrichOrderItemsWithImages(client: any, orderData: any) {
  if (!orderData || !Array.isArray(orderData.order_items) || orderData.order_items.length === 0) {
    return;
  }
  const prodIds = orderData.order_items
    .map((it: any) => it.product_id)
    .filter((id: any) => Boolean(id));

  if (prodIds.length === 0) return;

  try {
    const { data: imgRows } = await client
      .from("product_images")
      .select("product_id, storage_path, is_primary")
      .in("product_id", prodIds)
      .order("is_primary", { ascending: false });

    if (imgRows && imgRows.length > 0) {
      const imgMap = new Map<string, string>();
      for (const row of imgRows) {
        if (!imgMap.has(row.product_id)) {
          const pubUrl = resolveCdnImageUrl(row.storage_path);
          if (pubUrl) {
            imgMap.set(row.product_id, pubUrl);
          }
        }
      }
      for (const it of orderData.order_items) {
        if (it.product_id && imgMap.has(it.product_id)) {
          it.image = imgMap.get(it.product_id);
        }
      }
    }
  } catch (err) {
    console.warn("Could not enrich order items with product images from server:", err);
  }
}

export async function getOrderAction(idOrNumber: string): Promise<Order | null> {
  if (!idOrNumber || !idOrNumber.trim()) return null;

  const client = supabaseAdmin || supabase;
  const cleanId = idOrNumber.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  const fullSelect = `
    *,
    order_items (*),
    order_events (*),
    order_notes (*)
  `;

  let query = client.from("orders").select(fullSelect);
  if (isUuid) {
    query = query.eq("id", cleanId);
  } else {
    query = query.eq("order_number", cleanId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // If order_notes relation is missing in schema cache, fallback without order_notes
    let fallbackQuery = client.from("orders").select(`
      *,
      order_items (*),
      order_events (*)
    `);
    if (isUuid) {
      fallbackQuery = fallbackQuery.eq("id", cleanId);
    } else {
      fallbackQuery = fallbackQuery.eq("order_number", cleanId);
    }
    const fallbackRes = await fallbackQuery.maybeSingle();
    if (fallbackRes.error || !fallbackRes.data) {
      return null;
    }
    await enrichOrderItemsWithImages(client, fallbackRes.data);
    return formatDbOrderRecord(fallbackRes.data);
  }

  if (!data) return null;
  await enrichOrderItemsWithImages(client, data);
  return formatDbOrderRecord(data);
}

/**
 * Server Action: Marks orders as printed, capturing their current courier-related
 * fields into printed_courier_snapshot and setting printed_at timestamp.
 */
export async function markOrdersAsPrintedAction(orderNumbers: string[]): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  if (!orderNumbers || orderNumbers.length === 0) {
    return { success: true, count: 0 };
  }

  const client = supabaseAdmin || supabase;
  try {
    const { data, error } = await client.rpc("mark_orders_as_printed", {
      p_order_numbers: orderNumbers,
    });

    if (error) {
      console.error("[markOrdersAsPrintedAction] Error marking orders as printed:", error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: Number(data) || 0 };
  } catch (err: any) {
    console.error("[markOrdersAsPrintedAction] Unexpected exception:", err);
    return { success: false, count: 0, error: err.message || "Failed to mark orders as printed" };
  }
}

export interface UpdateOrderStatusParams {
  orderId: string; // UUID or order_number
  newStatus: Order["status"];
  cancelReason?: string;
  note?: string;
  eventMsg?: string;
  currentOrder?: Order;
  courierName?: string;
  forceWithoutCourier?: boolean;
  customCodAmount?: number;
}

export interface UpdateOrderStatusResult {
  success: boolean;
  order?: Order;
  bookedWithSteadfast?: boolean;
  consignment?: SteadfastConsignmentResult;
  requiresPrompt?: boolean;
  fieldErrors?: Record<string, string[]>;
  error?: string;
}

/**
 * Server Action: Central Order Status Changer
 * Canonical, single entry-point for updating order status across the entire application.
 * Handles validation, Steadfast booking, database mutation, timeline events,
 * Meta CAPI triggers, and automated SMSBangladesh customer messaging on the server.
 */
export async function updateOrderStatusAction(
  params: UpdateOrderStatusParams
): Promise<UpdateOrderStatusResult> {
  const {
    orderId,
    newStatus,
    cancelReason,
    note,
    eventMsg,
    currentOrder,
    courierName = "",
    forceWithoutCourier = false,
    customCodAmount,
  } = params;

  const client = supabaseAdmin || supabase;
  const isSteadfast = courierName.toLowerCase().includes("steadfast");
  const isEnteringProcessing = newStatus === "processing";

  try {
    // 1. Fetch latest fresh database record to ensure courier tracking fields and line items are up to date
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let fetchQuery = client
      .from("orders")
      .select("*, order_items(*), order_events(*), order_notes(*)");

    if (isUuid) {
      fetchQuery = fetchQuery.or(`id.eq.${orderId},order_number.eq.${orderId}`);
    } else {
      fetchQuery = fetchQuery.eq("order_number", orderId);
    }

    const { data: dbRow, error: fetchErr } = await fetchQuery.maybeSingle();

    if (fetchErr || !dbRow) {
      if (!currentOrder) {
        return {
          success: false,
          error: `Order '${orderId}' not found in database.`,
        };
      }
    }

    const resolvedOrder: Order = dbRow ? formatDbOrderRecord(dbRow) : currentOrder!;

    // Resolve authoritative PostgreSQL UUID for orders and relational tables
    const isDbRowUuid = dbRow?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbRow.id);
    let finalOrderUuid: string | null = isDbRowUuid ? dbRow.id : (isUuid ? orderId : null);

    if (!finalOrderUuid) {
      const orderNumToFind = resolvedOrder.order_number || orderId;
      const { data: match } = await client
        .from("orders")
        .select("id")
        .eq("order_number", orderNumToFind)
        .maybeSingle();
      if (match?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
        finalOrderUuid = match.id;
      }
    }

    // 2. Enforce delivery division and district requirement
    const orderDivision = (resolvedOrder.address?.division || dbRow?.shipping_address?.division || "").trim();
    const orderDistrict = (resolvedOrder.address?.district || dbRow?.shipping_address?.district || "").trim();
    if (!orderDivision || !orderDistrict) {
      return {
        success: false,
        error: `Cannot change status for Order ${resolvedOrder.order_number || orderId}: Delivery division and district are required before changing order status.`,
      };
    }

    // 3. Validate state machine transition
    const val = validateOrderStatusTransition(
      resolvedOrder.status,
      newStatus === "partially_delivered" ? "delivered" : newStatus,
      resolvedOrder.customer || resolvedOrder.address?.recipient_name,
      resolvedOrder.phone || resolvedOrder.address?.phone,
      resolvedOrder.address?.address_line,
      Array.isArray(resolvedOrder.items) ? resolvedOrder.items.length : 0,
      courierName || resolvedOrder.courier_name,
      cancelReason,
      orderDivision,
      orderDistrict
    );

    if (!val.valid) {
      return {
        success: false,
        error: val.reason,
      };
    }

    // 4. Steadfast Auto-Booking when entering processing
    const hasExistingBooking = Boolean(
      dbRow?.courier_consignment_id ||
      dbRow?.courier_tracking_code ||
      resolvedOrder.courier_consignment_id ||
      resolvedOrder.courier_tracking_code
    );

    let bookingResult: any = null;

    if (isSteadfast && isEnteringProcessing && !hasExistingBooking && !forceWithoutCourier) {
      bookingResult = await bookSteadfastParcelAction(resolvedOrder, customCodAmount);

      if (!bookingResult.success) {
        return {
          success: false,
          requiresPrompt: true,
          error: bookingResult.error,
          fieldErrors: bookingResult.fieldErrors,
          order: resolvedOrder,
        };
      }
    }

    // 5. Prepare order status update payload
    const nowIso = new Date().toISOString();
    const dbStatus = newStatus === "partially_delivered" ? "delivered" : newStatus;

    const updatePayload: Record<string, any> = {
      status: dbStatus,
      updated_at: nowIso,
    };

    if (courierName) {
      updatePayload.shipping_method_name = courierName;
    }

    // Only update consignment fields if a NEW booking was made
    if (bookingResult?.success && bookingResult.consignment) {
      updatePayload.courier_consignment_id = String(bookingResult.consignment.consignment_id);
      updatePayload.courier_tracking_code = bookingResult.consignment.tracking_code;
      updatePayload.courier_tracking_url = bookingResult.consignment.tracking_link;
      updatePayload.courier_invoice = bookingResult.consignment.invoice;
      updatePayload.courier_payload_snapshot = buildSteadfastPayloadSnapshot(
        resolvedOrder,
        customCodAmount,
        bookingResult.consignment.invoice
      );
    }

    if (newStatus === "cancelled") {
      if (cancelReason) updatePayload.cancel_reason = cancelReason;
      updatePayload.cancelled_at = nowIso;
    } else if (newStatus === "confirmed") {
      updatePayload.confirmed_at = nowIso;
    } else if (newStatus === "shipped") {
      updatePayload.shipped_at = nowIso;
    } else if (newStatus === "delivered" || newStatus === "partially_delivered") {
      updatePayload.delivered_at = nowIso;
    }

    // 6. Update orders table in Supabase
    let updateQuery = client.from("orders").update(updatePayload);
    if (finalOrderUuid) {
      updateQuery = updateQuery.eq("id", finalOrderUuid);
    } else {
      updateQuery = updateQuery.eq("order_number", resolvedOrder.order_number || orderId);
    }

    const { data: updatedRows, error: updateErr } = await updateQuery
      .select("*, order_items(*), order_events(*), order_notes(*)");

    if (updateErr) {
      console.error("[updateOrderStatusAction] Database update error:", updateErr);
      return {
        success: false,
        error: updateErr.message || "Failed to persist order status in database.",
      };
    }

    // 7. Record timeline events & notes
    try {
      const orderUuidForRelations =
        updatedRows?.[0]?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedRows[0].id)
          ? updatedRows[0].id
          : finalOrderUuid;

      if (orderUuidForRelations) {
        if (bookingResult?.success && bookingResult.consignment) {
          const c = bookingResult.consignment;
          await client.from("order_events").insert({
            order_id: orderUuidForRelations,
            event_type: "courier_consignment_created",
            message: `Steadfast Consignment #${c.consignment_id} created (Tracking: ${c.tracking_code})${c.item_description ? ` • Items: ${c.item_description}` : ""}`,
            actor_id: null,
          });
        } else if (forceWithoutCourier && isSteadfast && isEnteringProcessing) {
          await client.from("order_events").insert({
            order_id: orderUuidForRelations,
            event_type: "status_changed",
            message: `Order status moved to PROCESSING without Steadfast booking (Admin Forced)`,
            actor_id: null,
          });
        } else {
          const detailParts: string[] = [];
          if (cancelReason) detailParts.push(`Reason: ${cancelReason}`);
          if (courierName) detailParts.push(`Courier: ${courierName}`);
          const detailsStr = detailParts.length > 0 ? ` (${detailParts.join(" | ")})` : "";

          await client.from("order_events").insert({
            order_id: orderUuidForRelations,
            event_type: "status_changed",
            to_value: newStatus,
            message: eventMsg || `Order status updated to ${newStatus.toUpperCase()}${detailsStr}`,
            actor_id: null,
          });

          if (note && note.trim()) {
            await client.from("order_notes").insert({
              order_id: orderUuidForRelations,
              order_number: resolvedOrder.order_number || orderId,
              type: "internal",
              note: note.trim(),
              author: "Admin Staff",
            });
          }
        }
      }
    } catch (logErr) {
      console.warn("[updateOrderStatusAction] Could not insert order event log:", logErr);
    }

    // 8. SIDE EFFECTS (Dispatched via Transactional Outbox + Inngest)
    if (["confirmed", "processing", "shipped", "delivered", "partially_delivered"].includes(newStatus) || ["confirmed", "processing", "shipped", "delivered", "partially_delivered"].includes(dbStatus)) {
      const trackingCode =
        bookingResult?.consignment?.tracking_code ||
        resolvedOrder.courier_tracking_code ||
        updatePayload.courier_tracking_code;
      const trackingUrl =
        bookingResult?.consignment?.tracking_link ||
        resolvedOrder.courier_tracking_url ||
        updatePayload.courier_tracking_url;

      enqueueAndDispatch({
        eventName: "order.status_updated",
        aggregateType: "order",
        aggregateId: finalOrderUuid || resolvedOrder.order_number || orderId,
        idempotencyKey: `order.status:${finalOrderUuid || resolvedOrder.order_number || orderId}:${newStatus}`,
        payload: {
          orderId: finalOrderUuid || resolvedOrder.order_number || orderId,
          orderNumber: resolvedOrder.order_number || orderId,
          newStatus: (newStatus === "partially_delivered" ? "delivered" : newStatus) as any,
          previousStatus: resolvedOrder.status,
          customerPhone:
            resolvedOrder.phone ||
            resolvedOrder.shipping_phone ||
            resolvedOrder.address?.phone ||
            "",
          customerName: resolvedOrder.customer || resolvedOrder.address?.recipient_name,
          grandTotal: resolvedOrder.grand_total,
          courierName: courierName || resolvedOrder.courier_name || "Steadfast Courier",
          trackingCode,
          trackingUrl,
          triggerMetaCapi: true,
        },
      }).catch((outboxErr) => {
        console.warn("[updateOrderStatusAction] Background Outbox enqueue error:", outboxErr);
      });
    }

    const updatedOrder = updatedRows && updatedRows[0]
      ? formatDbOrderRecord(updatedRows[0])
      : {
          ...resolvedOrder,
          status: newStatus,
          courier_name: courierName || resolvedOrder.courier_name,
          courier_consignment_id: bookingResult?.consignment
            ? String(bookingResult.consignment.consignment_id)
            : (dbRow?.courier_consignment_id || resolvedOrder.courier_consignment_id),
          courier_tracking_code: bookingResult?.consignment
            ? bookingResult.consignment.tracking_code
            : (dbRow?.courier_tracking_code || resolvedOrder.courier_tracking_code),
          courier_tracking_url: bookingResult?.consignment
            ? bookingResult.consignment.tracking_link
            : (dbRow?.courier_tracking_url || resolvedOrder.courier_tracking_url),
        };

    return {
      success: true,
      order: updatedOrder,
      bookedWithSteadfast: Boolean(bookingResult?.success),
      consignment: bookingResult?.consignment,
    };
  } catch (err: any) {
    console.error("[updateOrderStatusAction] Unexpected error:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred while updating order status.",
    };
  }
}

export interface BulkUpdateStatusResult {
  success: boolean;
  totalRequested: number;
  updatedCount: number;
  skippedCount: number;
  updatedOrderNumbers: string[];
  skippedOrders: { id: string; reason: string }[];
}

/**
 * Server Action: Bulk Order Status Changer
 * Reuses the central updateOrderStatusAction for every order in the selection,
 * guaranteeing consistent validation, DB persistence, timeline notes, CAPI,
 * and SMS notifications without duplicate code.
 */
export async function bulkUpdateOrderStatusAction(
  orderIds: string[],
  newStatus: Order["status"],
  batchNote?: string,
  courierName?: string
): Promise<BulkUpdateStatusResult> {
  if (!orderIds || orderIds.length === 0) {
    return {
      success: true,
      totalRequested: 0,
      updatedCount: 0,
      skippedCount: 0,
      updatedOrderNumbers: [],
      skippedOrders: [],
    };
  }

  const updatedOrderNumbers: string[] = [];
  const skippedOrders: { id: string; reason: string }[] = [];

  const promises = orderIds.map(async (id) => {
    try {
      const res = await updateOrderStatusAction({
        orderId: id,
        newStatus,
        cancelReason: newStatus === "cancelled" ? batchNote : undefined,
        note: batchNote ? `[Batch Status Update → ${newStatus.toUpperCase()}]: ${batchNote}` : undefined,
        eventMsg: batchNote
          ? `[Batch Status Update → ${newStatus.toUpperCase()}]: ${batchNote}`
          : undefined,
        courierName,
      });

      if (res.success && res.order) {
        updatedOrderNumbers.push(res.order.order_number || id);
      } else {
        skippedOrders.push({ id, reason: res.error || "Failed to update" });
      }
    } catch (err: any) {
      skippedOrders.push({ id, reason: err.message || "Failed to update" });
    }
  });

  await Promise.allSettled(promises);

  return {
    success: updatedOrderNumbers.length > 0,
    totalRequested: orderIds.length,
    updatedCount: updatedOrderNumbers.length,
    skippedCount: skippedOrders.length,
    updatedOrderNumbers,
    skippedOrders,
  };
}
