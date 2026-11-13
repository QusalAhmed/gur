"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  assertStaffRole,
  getActorUuid,
  type StaffSession,
} from "@/lib/admin-guard";
import {
  clampInt,
  isValidUuid,
  sanitizePostgrestFilterTerm,
} from "@/lib/security";
import { timingSafeTokenEqual } from "@/lib/server-security";
import { normalizeBdPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/utils";
import {
  formatDbOrderRecord,
  fallbackDivisions,
  fallbackDistricts,
  type BulkCourierUpdateResult,
  type BulkDeleteResult,
} from "@/lib/supabase/api";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import {
  validateOrderStatusTransition,
  parseDatabaseError,
  DatabaseOperationError,
} from "@/lib/supabase/error-handler";
import { bookSteadfastParcelInternal } from "@/lib/steadfast-service";
import {
  parseDbNoteToDomainInternal,
  persistOrderUpdateInternal,
} from "@/lib/order-service";
import { triggerCapiPurchaseInternal } from "@/lib/capi-service";
import {
  buildSteadfastPayloadSnapshot,
  type SteadfastConsignmentResult,
} from "@/lib/steadfast";
import { enqueueAndDispatch } from "@/lib/outbox";
import type { DbGeoDivision, DbGeoDistrict } from "@/lib/supabase/types";
import type {
  CatalogProduct,
  Order,
  OrderEvent,
  OrderNote,
  OrderNoteType,
} from "@/types/order";

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

export interface AdminBadgeCounts {
  pendingOrders: number;
  incompleteOrders: number;
  pendingReviews: number;
  newQuotes: number;
  newMessages: number;
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

const ORDER_STAFF_ROLES = ["owner", "admin", "manager", "support"] as const;
const ALL_STAFF_ROLES = ["owner", "admin", "manager", "editor", "support"] as const;

/**
 * Dynamically enriches order items with their combo components recipe if snapshot is missing
 */
async function enrichOrderItemsWithCombos(client: any, rawOrders: any[]) {
  if (!rawOrders || rawOrders.length === 0) return;

  const candidateVarIds = new Set<string>();
  for (const o of rawOrders) {
    if (!o || !Array.isArray(o.order_items)) continue;
    for (const it of o.order_items) {
      if (
        it.variant_id &&
        (!it.is_combo ||
          !Array.isArray(it.combo_components) ||
          it.combo_components.length === 0)
      ) {
        candidateVarIds.add(it.variant_id);
      }
    }
  }

  if (candidateVarIds.size === 0) return;

  try {
    const { data: comboVariants } = await client
      .from("product_variants")
      .select("id, is_combo")
      .in("id", Array.from(candidateVarIds))
      .eq("is_combo", true);

    if (comboVariants && comboVariants.length > 0) {
      const comboRecipeMap = new Map<string, any[]>();
      for (const cv of comboVariants) {
        const { data: recipe } = await client.rpc("get_combo_details", {
          p_combo_variant_id: cv.id,
        });
        if (recipe && Array.isArray(recipe) && recipe.length > 0) {
          comboRecipeMap.set(cv.id, recipe);
        }
      }

      for (const o of rawOrders) {
        if (!o || !Array.isArray(o.order_items)) continue;
        for (const it of o.order_items) {
          const hasExistingSnapshot =
            Array.isArray(it.combo_components) && it.combo_components.length > 0;
          if (
            !hasExistingSnapshot &&
            it.variant_id &&
            comboRecipeMap.has(it.variant_id)
          ) {
            it.is_combo = true;
            it.combo_components = comboRecipeMap.get(it.variant_id);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not dynamically enrich order items with combo recipes:", err);
  }
}

async function enrichOrderItemsWithImages(client: any, orderData: any) {
  if (
    !orderData ||
    !Array.isArray(orderData.order_items) ||
    orderData.order_items.length === 0
  ) {
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
    console.warn(
      "Could not enrich order items with product images from server:",
      err
    );
  }
}

function buildOrderNotesOrFilter(orderUuid: string | null, orderNumber: string): string {
  const cleanNum = sanitizePostgrestFilterTerm(orderNumber);
  if (orderUuid && isValidUuid(orderUuid) && cleanNum) {
    return `order_id.eq.${orderUuid},order_number.eq.${cleanNum}`;
  }
  if (orderUuid && isValidUuid(orderUuid)) {
    return `order_id.eq.${orderUuid}`;
  }
  return `order_number.eq.${cleanNum || orderNumber}`;
}

async function resolveOrderIdentity(
  client: any,
  idOrNumber: string,
  knownUuid?: string | null
): Promise<{ orderUuid: string | null; orderNumber: string }> {
  const clean = idOrNumber.trim();
  const isUuid = isValidUuid(clean);

  if (knownUuid && isValidUuid(knownUuid) && !isUuid) {
    return { orderUuid: knownUuid, orderNumber: clean };
  }

  let q = client.from("orders").select("id, order_number");
  if (isUuid) {
    q = q.eq("id", clean);
  } else {
    q = q.eq("order_number", clean);
  }

  const { data } = await q.maybeSingle();
  return {
    orderUuid: data?.id && isValidUuid(data.id) ? data.id : knownUuid && isValidUuid(knownUuid) ? knownUuid : isUuid ? clean : null,
    orderNumber: data?.order_number || (!isUuid ? clean : idOrNumber),
  };
}

let _cachedOrderPrefix: string | null = null;
async function getOrderNumberPrefixInternal(client: any): Promise<string> {
  if (_cachedOrderPrefix) return _cachedOrderPrefix;
  try {
    const { data } = await client
      .from("site_settings")
      .select("value")
      .eq("key", "orders.number_prefix")
      .maybeSingle();
    if (data?.value) {
      _cachedOrderPrefix = String(data.value).replace(/['"]+/g, "").trim() || "MOL";
      return _cachedOrderPrefix;
    }
  } catch {
    // Fallback
  }
  return "MOL";
}

async function fetchRawShippingMethodsInternal(
  client: any
): Promise<{ id: string; name: string; is_pickup: boolean }[]> {
  try {
    const { data, error } = await client
      .from("shipping_methods")
      .select("id, name, is_pickup")
      .eq("is_active", true);
    if (error || !data || data.length === 0) {
      return [
        {
          id: "f6e5986b-b545-4023-9b6b-abf7bdb2d5d3",
          name: "Courier delivery",
          is_pickup: false,
        },
        {
          id: "e09c2596-174e-45a8-95b8-81c62744e5e3",
          name: "Pickup from warehouse",
          is_pickup: true,
        },
      ];
    }
    return data;
  } catch {
    return [
      {
        id: "f6e5986b-b545-4023-9b6b-abf7bdb2d5d3",
        name: "Courier delivery",
        is_pickup: false,
      },
    ];
  }
}

async function convertStorefrontInquiryForOrderInternal(
  client: any,
  params: {
    orderId?: string | null;
    attribution?: Order["attribution"];
    normalizedPhone?: string | null;
    flowContext: string;
  }
): Promise<boolean> {
  const { orderId, attribution, normalizedPhone, flowContext } = params;
  const matchedInquiryId =
    attribution?.matched_inquiry_id ||
    attribution?.meta_tracking?.matched_inquiry_id;

  let converted = false;
  if (matchedInquiryId && isValidUuid(matchedInquiryId) && orderId) {
    try {
      const idUpdatePayload: Record<string, unknown> = {
        status: "converted",
        converted_order_id: orderId,
        updated_at: new Date().toISOString(),
      };
      if (normalizedPhone) {
        idUpdatePayload.customer_phone = normalizedPhone;
      }
      const { data, error } = await client
        .from("storefront_inquiries")
        .update(idUpdatePayload)
        .eq("id", matchedInquiryId)
        .neq("status", "converted")
        .select("id");

      if (!error && data && data.length > 0) {
        converted = true;
      } else if (error) {
        console.warn(`Could not mark inquiry converted by ID in ${flowContext}:`, error);
      }
    } catch (inqErr) {
      console.warn(`Error marking inquiry converted by ID in ${flowContext}:`, inqErr);
    }
  }

  if (!converted && attribution?.inquiry_ref_code) {
    try {
      const cleanRef = String(attribution.inquiry_ref_code)
        .replace(/^#/, "")
        .trim();
      if (cleanRef) {
        const candidateRefs = Array.from(
          new Set([cleanRef, cleanRef.toUpperCase(), cleanRef.toLowerCase()])
        );

        const { data: matchingInquiries, error: searchErr } = await client
          .from("storefront_inquiries")
          .select("id, ref_code")
          .in("ref_code", candidateRefs)
          .neq("status", "converted");

        if (!searchErr && matchingInquiries && matchingInquiries.length > 0) {
          let resolvedInquiryId: string | null = null;
          if (matchingInquiries.length === 1) {
            resolvedInquiryId = matchingInquiries[0].id;
          } else {
            const exactMatches = matchingInquiries.filter(
              (row: any) => row.ref_code === cleanRef
            );
            if (exactMatches.length === 1) {
              resolvedInquiryId = exactMatches[0].id;
            }
          }

          if (resolvedInquiryId && orderId) {
            const refUpdatePayload: Record<string, unknown> = {
              status: "converted",
              converted_order_id: orderId,
              updated_at: new Date().toISOString(),
            };
            if (normalizedPhone) {
              refUpdatePayload.customer_phone = normalizedPhone;
            }
            const { data: updatedRows, error: updateErr } = await client
              .from("storefront_inquiries")
              .update(refUpdatePayload)
              .eq("id", resolvedInquiryId)
              .neq("status", "converted")
              .select("id");

            if (!updateErr && updatedRows && updatedRows.length > 0) {
              converted = true;
            }
          }
        }
      }
    } catch (inqErr) {
      console.warn(`Could not mark inquiry converted in ${flowContext}:`, inqErr);
    }
  }

  return converted;
}

/**
 * Server Action: Fetches a paginated slice of orders matching the given filter,
 * search term, and sort order, along with global status counts and revenue metrics.
 */
export async function getOrdersAction(
  params: GetOrdersParams = {}
): Promise<GetOrdersResult> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);

  const page = clampInt(params.page, 1, 1, 10000);
  const pageSize = clampInt(params.pageSize, 10, 1, 100);
  const status = (params.status || "all").trim();
  const channel = (params.channel || "all").trim();
  const payment = (params.payment || "all").trim();
  const cleanSearch = sanitizePostgrestFilterTerm(params.search || "");
  const sortByInput = (params.sortBy || "placed_at").trim();
  const sortColumn = VALID_SORT_COLUMNS[sortByInput] || "placed_at";
  const isAscending = params.sortOrder === "asc";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const client = getSupabaseAdmin();

  const buildQuery = (selectString: string) => {
    let q = client.from("orders").select(selectString, { count: "exact" });

    if (status && status !== "all") {
      q = q.eq("status", status);
    }

    if (channel && channel !== "all") {
      q = q.eq("channel", channel);
    }

    if (payment && payment !== "all") {
      q = q.eq("payment_status", payment);
    }

    if (cleanSearch) {
      q = q.or(
        `order_number.ilike.%${cleanSearch}%,customer_name.ilike.%${cleanSearch}%,customer_phone.ilike.%${cleanSearch}%,customer_alternative_phone.ilike.%${cleanSearch}%,shipping_phone.ilike.%${cleanSearch}%,customer_note.ilike.%${cleanSearch}%,shipping_method_name.ilike.%${cleanSearch}%`
      );
    }

    q = q.order(sortColumn, { ascending: isAscending });
    if (sortColumn !== "placed_at") {
      q = q.order("placed_at", { ascending: false });
    }

    q = q.range(from, to);

    return q;
  };

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
        if (
          res.error.code === "PGRST103" ||
          res.error.message?.includes("Requested range not satisfiable")
        ) {
          return { data: [], count: res.count ?? null, error: null };
        }
        console.warn(
          "Full orders relation query encountered an issue, trying fallback select:",
          res.error.message
        );
        const fallbackRes = await buildQuery(fallbackSelect);
        if (fallbackRes.error) {
          if (
            fallbackRes.error.code === "PGRST103" ||
            fallbackRes.error.message?.includes("Requested range not satisfiable")
          ) {
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
    if (
      ordersResResult.error.code === "PGRST103" ||
      ordersResResult.error.message?.includes("Requested range not satisfiable")
    ) {
      rawOrders = [];
      totalCount = statsRes.data?.length ?? 0;
    } else {
      console.error("Failed to query paginated orders:", ordersResResult.error);
      throw new Error(ordersResResult.error.message || "Failed to fetch orders");
    }
  } else {
    rawOrders = ordersResResult.data || [];
    totalCount =
      ordersResResult.count ?? (statsRes.data?.length ?? rawOrders.length);
  }
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasMore = page < pageCount;

  await enrichOrderItemsWithCombos(client, rawOrders);

  const orders: Order[] = rawOrders.map((row: any) => formatDbOrderRecord(row));

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
      if (
        row.status !== "cancelled" &&
        row.status !== "returned" &&
        row.status !== "incomplete_order"
      ) {
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
 * Server Action (Staff Only): Fetches a single order by either its UUID or order_number,
 * including related order_items, order_events, and order_notes.
 */
export async function getOrderAction(idOrNumber: string): Promise<Order | null> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);

  if (!idOrNumber || !idOrNumber.trim()) return null;

  const client = getSupabaseAdmin();
  const cleanId = idOrNumber.trim();
  const isUuid = isValidUuid(cleanId);

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
    await enrichOrderItemsWithCombos(client, [fallbackRes.data]);
    await enrichOrderItemsWithImages(client, fallbackRes.data);
    return formatDbOrderRecord(fallbackRes.data);
  }

  if (!data) return null;
  await enrichOrderItemsWithCombos(client, [data]);
  await enrichOrderItemsWithImages(client, data);
  return formatDbOrderRecord(data);
}

/**
 * Server Action (Public Customer Receipt): Fetches a single scrubbed order ONLY if a valid
 * `public_token` matching `orders.public_token` is presented. Strips internal staff notes,
 * attribution, snapshots, and raw secret tokens before returning to the storefront.
 */
export async function getPublicOrderAction(
  idOrNumber: string,
  publicToken?: string | null
): Promise<Order | null> {
  const cleanId = typeof idOrNumber === "string" ? idOrNumber.trim() : "";
  const cleanToken = typeof publicToken === "string" ? publicToken.trim() : "";
  if (!cleanId || !cleanToken || cleanToken.length < 16) {
    return null;
  }

  const client = getSupabaseAdmin();
  const publicSelect = `
    id,
    order_number,
    public_token,
    status,
    payment_status,
    fulfillment_status,
    payment_method,
    channel,
    subtotal,
    discount_total,
    shipping_total,
    grand_total,
    amount_paid,
    currency,
    placed_at,
    created_at,
    customer_name,
    customer_phone,
    shipping_phone,
    customer_alternative_phone,
    customer_email,
    shipping_address,
    shipping_method_name,
    customer_note,
    courier_consignment_id,
    courier_tracking_code,
    courier_tracking_url,
    courier_invoice,
    courier_delivery_charge,
    printed_at,
    order_items (*),
    order_events (id, event_type, message, created_at)
  `;

  let query = client.from("orders").select(publicSelect);
  if (isValidUuid(cleanId)) {
    query = query.eq("id", cleanId);
  } else {
    query = query.eq("order_number", cleanId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data || !data.public_token) {
    return null;
  }

  if (!timingSafeTokenEqual(cleanToken, String(data.public_token))) {
    return null;
  }

  await enrichOrderItemsWithCombos(client, [data]);
  await enrichOrderItemsWithImages(client, data);

  const formatted = formatDbOrderRecord(data);
  return {
    ...formatted,
    notes: [],
    attribution: undefined,
    cancel_reason: undefined,
    printed_courier_snapshot: undefined,
    courier_payload_snapshot: undefined,
    public_token: undefined,
  };
}

/**
 * Server Action: Returns sidebar navigation badge counts across protected admin queues.
 */
export async function getAdminBadgeCountsAction(): Promise<AdminBadgeCounts> {
  await assertStaffRole([...ALL_STAFF_ROLES]);

  const client = getSupabaseAdmin();
  const [
    pendingOrdersRes,
    incompleteOrdersRes,
    reviewsRes,
    quotesRes,
    messagesRes,
  ] = await Promise.all([
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "incomplete_order"),
    client
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    client
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    client
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  return {
    pendingOrders: pendingOrdersRes.count || 0,
    incompleteOrders: incompleteOrdersRes.count || 0,
    pendingReviews: reviewsRes.count || 0,
    newQuotes: quotesRes.count || 0,
    newMessages: messagesRes.count || 0,
  };
}

/**
 * Server Action: Fetches a list of orders by their order numbers for invoice printing.
 */
export async function getOrdersByIdsAction(
  orderNumbers: string[]
): Promise<Order[]> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);

  const cleanNumbers = (orderNumbers || [])
    .map((n) => String(n || "").trim())
    .filter(Boolean)
    .slice(0, 200);
  if (cleanNumbers.length === 0) return [];

  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        products (id, name, name_bn),
        product_variants (id, name, name_bn)
      ),
      order_events (*),
      order_notes (*)
    `
    )
    .in("order_number", cleanNumbers)
    .order("placed_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching orders by ids:", error);
    return [];
  }

  await enrichOrderItemsWithCombos(client, data);
  return data.map((d: any) => formatDbOrderRecord(d));
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
  await assertStaffRole([...ORDER_STAFF_ROLES]);

  if (!orderNumbers || orderNumbers.length === 0) {
    return { success: true, count: 0 };
  }

  const client = getSupabaseAdmin();
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
    return {
      success: false,
      count: 0,
      error: err.message || "Failed to mark orders as printed",
    };
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

async function updateOrderStatusWithSession(
  params: UpdateOrderStatusParams,
  session: StaffSession
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

  const client = getSupabaseAdmin();
  const actorUuid = getActorUuid(session);
  const actorName = session.user.name || "Admin Staff";
  const isSteadfast = courierName.toLowerCase().includes("steadfast");
  const isEnteringProcessing = newStatus === "processing";

  try {
    const cleanOrderId = sanitizePostgrestFilterTerm(orderId);
    const isUuid = isValidUuid(cleanOrderId);

    let fetchQuery = client
      .from("orders")
      .select("*, order_items(*), order_events(*), order_notes(*)");

    if (isUuid) {
      fetchQuery = fetchQuery.or(`id.eq.${cleanOrderId},order_number.eq.${cleanOrderId}`);
    } else {
      fetchQuery = fetchQuery.eq("order_number", orderId.trim());
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

    const resolvedOrder: Order = dbRow
      ? formatDbOrderRecord(dbRow)
      : currentOrder!;

    let finalOrderUuid: string | null =
      dbRow?.id && isValidUuid(dbRow.id) ? dbRow.id : isUuid ? cleanOrderId : null;

    if (!finalOrderUuid) {
      const orderNumToFind = resolvedOrder.order_number || orderId;
      const { data: match } = await client
        .from("orders")
        .select("id")
        .eq("order_number", orderNumToFind)
        .maybeSingle();
      if (match?.id && isValidUuid(match.id)) {
        finalOrderUuid = match.id;
      }
    }

    const orderDivision = (
      resolvedOrder.address?.division ||
      dbRow?.shipping_address?.division ||
      ""
    ).trim();
    const orderDistrict = (
      resolvedOrder.address?.district ||
      dbRow?.shipping_address?.district ||
      ""
    ).trim();
    if (!orderDivision || !orderDistrict) {
      return {
        success: false,
        error: `Cannot change status for Order ${resolvedOrder.order_number || orderId}: Delivery division and district are required before changing order status.`,
      };
    }

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

    const hasExistingBooking = Boolean(
      dbRow?.courier_consignment_id ||
        dbRow?.courier_tracking_code ||
        resolvedOrder.courier_consignment_id ||
        resolvedOrder.courier_tracking_code
    );

    let bookingResult: any = null;

    if (
      isSteadfast &&
      isEnteringProcessing &&
      !hasExistingBooking &&
      !forceWithoutCourier
    ) {
      bookingResult = await bookSteadfastParcelInternal(
        resolvedOrder,
        customCodAmount
      );

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

    const nowIso = new Date().toISOString();
    const dbStatus =
      newStatus === "partially_delivered" ? "delivered" : newStatus;

    const updatePayload: Record<string, any> = {
      status: dbStatus,
      updated_at: nowIso,
    };

    if (courierName) {
      updatePayload.shipping_method_name = courierName;
    }

    if (bookingResult?.success && bookingResult.consignment) {
      updatePayload.courier_consignment_id = String(
        bookingResult.consignment.consignment_id
      );
      updatePayload.courier_tracking_code =
        bookingResult.consignment.tracking_code;
      updatePayload.courier_tracking_url =
        bookingResult.consignment.tracking_link;
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
    } else if (
      newStatus === "delivered" ||
      newStatus === "partially_delivered"
    ) {
      updatePayload.delivered_at = nowIso;
    }

    let updateQuery = client.from("orders").update(updatePayload);
    if (finalOrderUuid) {
      updateQuery = updateQuery.eq("id", finalOrderUuid);
    } else {
      updateQuery = updateQuery.eq(
        "order_number",
        resolvedOrder.order_number || orderId
      );
    }

    const { data: updatedRows, error: updateErr } = await updateQuery.select(
      "*, order_items(*), order_events(*), order_notes(*)"
    );

    if (updateErr) {
      console.error("[updateOrderStatusAction] Database update error:", updateErr);
      return {
        success: false,
        error:
          updateErr.message || "Failed to persist order status in database.",
      };
    }

    try {
      const orderUuidForRelations =
        updatedRows?.[0]?.id && isValidUuid(updatedRows[0].id)
          ? updatedRows[0].id
          : finalOrderUuid;

      if (orderUuidForRelations) {
        if (bookingResult?.success && bookingResult.consignment) {
          const c = bookingResult.consignment;
          await client.from("order_events").insert({
            order_id: orderUuidForRelations,
            event_type: "courier_consignment_created",
            message: `Steadfast Consignment #${c.consignment_id} created (Tracking: ${c.tracking_code})${c.item_description ? ` • Items: ${c.item_description}` : ""}`,
            actor_id: actorUuid,
          });
        } else if (
          forceWithoutCourier &&
          isSteadfast &&
          isEnteringProcessing
        ) {
          await client.from("order_events").insert({
            order_id: orderUuidForRelations,
            event_type: "status_changed",
            message: `Order status moved to PROCESSING without Steadfast booking (Admin Forced)`,
            actor_id: actorUuid,
          });
        } else {
          const detailParts: string[] = [];
          if (cancelReason) detailParts.push(`Reason: ${cancelReason}`);
          if (courierName) detailParts.push(`Courier: ${courierName}`);
          const detailsStr =
            detailParts.length > 0 ? ` (${detailParts.join(" | ")})` : "";

          await client.from("order_events").insert({
            order_id: orderUuidForRelations,
            event_type: "status_changed",
            to_value: newStatus,
            message:
              eventMsg ||
              `Order status updated to ${newStatus.toUpperCase()}${detailsStr}`,
            actor_id: actorUuid,
          });

          if (note && note.trim()) {
            await client.from("order_notes").insert({
              order_id: orderUuidForRelations,
              order_number: resolvedOrder.order_number || orderId,
              type: "internal",
              note: note.trim(),
              author: actorName,
            });
          }
        }
      }
    } catch (logErr) {
      console.warn(
        "[updateOrderStatusAction] Could not insert order event log:",
        logErr
      );
    }

    if (
      [
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "partially_delivered",
      ].includes(newStatus) ||
      [
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "partially_delivered",
      ].includes(dbStatus)
    ) {
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
          newStatus: (newStatus === "partially_delivered"
            ? "delivered"
            : newStatus) as any,
          previousStatus: resolvedOrder.status,
          customerPhone:
            resolvedOrder.phone ||
            resolvedOrder.shipping_phone ||
            resolvedOrder.address?.phone ||
            "",
          customerName:
            resolvedOrder.customer || resolvedOrder.address?.recipient_name,
          grandTotal: resolvedOrder.grand_total,
          courierName:
            courierName || resolvedOrder.courier_name || undefined,
          trackingCode,
          trackingUrl,
          triggerMetaCapi: true,
        },
      }).catch((outboxErr) => {
        console.warn(
          "[updateOrderStatusAction] Background Outbox enqueue error:",
          outboxErr
        );
      });
    }

    const updatedOrder =
      updatedRows && updatedRows[0]
        ? formatDbOrderRecord(updatedRows[0])
        : {
            ...resolvedOrder,
            status: newStatus,
            courier_name: courierName || resolvedOrder.courier_name,
            courier_consignment_id: bookingResult?.consignment
              ? String(bookingResult.consignment.consignment_id)
              : dbRow?.courier_consignment_id ||
                resolvedOrder.courier_consignment_id,
            courier_tracking_code: bookingResult?.consignment
              ? bookingResult.consignment.tracking_code
              : dbRow?.courier_tracking_code ||
                resolvedOrder.courier_tracking_code,
            courier_tracking_url: bookingResult?.consignment
              ? bookingResult.consignment.tracking_link
              : dbRow?.courier_tracking_url ||
                resolvedOrder.courier_tracking_url,
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
      error:
        err.message ||
        "An unexpected error occurred while updating order status.",
    };
  }
}

/**
 * Server Action: Central Order Status Changer
 */
export async function updateOrderStatusAction(
  params: UpdateOrderStatusParams
): Promise<UpdateOrderStatusResult> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  return updateOrderStatusWithSession(params, session);
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
 */
export async function bulkUpdateOrderStatusAction(
  orderIds: string[],
  newStatus: Order["status"],
  batchNote?: string,
  courierName?: string
): Promise<BulkUpdateStatusResult> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);

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
      const res = await updateOrderStatusWithSession(
        {
          orderId: id,
          newStatus,
          cancelReason: newStatus === "cancelled" ? batchNote : undefined,
          note: batchNote
            ? `[Batch Status Update → ${newStatus.toUpperCase()}]: ${batchNote}`
            : undefined,
          eventMsg: batchNote
            ? `[Batch Status Update → ${newStatus.toUpperCase()}]: ${batchNote}`
            : undefined,
          courierName,
        },
        session
      );

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

/**
 * Server Action: Creates a new admin/phone/WhatsApp order in database.
 */
export async function createAdminOrderAction(savedOrder: Order): Promise<Order> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();
  const actorName = session.user.name || "Admin Staff";

  const isDraft =
    savedOrder.status === "incomplete_order" || savedOrder.status === "pending";

  if (!isDraft && (!savedOrder.items || savedOrder.items.length === 0)) {
    throw new Error("Cannot place a confirmed or processing order with no items.");
  }

  const normalizedPhone = normalizeBdPhone(savedOrder.phone);
  const normalizedAltPhone = savedOrder.alternative_phone
    ? normalizeBdPhone(savedOrder.alternative_phone)
    : "";
  const rawShippingPhone =
    savedOrder.address?.phone || savedOrder.shipping_phone || savedOrder.phone;
  const normalizedShippingPhone = rawShippingPhone
    ? normalizeBdPhone(rawShippingPhone)
    : "";
  const customerName = (savedOrder.customer || "").trim();
  const recipientName = (
    savedOrder.address?.recipient_name ||
    savedOrder.recipient_name ||
    customerName
  ).trim();
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);

  const shouldUseDirectInsert = isDraft || !customerName || !normalizedPhone;

  if (shouldUseDirectInsert) {
    const prefix = await getOrderNumberPrefixInternal(client);
    const orderNumber =
      savedOrder.id ||
      `${prefix}-2610-0${1085 + Date.now().toString().slice(-4)}`;

    const subtotal = (savedOrder.items || []).reduce(
      (sum, item) =>
        sum +
        (Number(item.line_total) ||
          Number(item.quantity) * Number(item.unit_price) ||
          0),
      0
    );
    const shippingTotal = Number(savedOrder.shipping_total) || 0;
    const discountTotal = Number(savedOrder.discount_total) || 0;
    const grandTotal = Math.max(0, subtotal - discountTotal + shippingTotal);

    const createdOrder: Order = {
      id: orderNumber,
      customer: customerName,
      phone: normalizedPhone,
      alternative_phone: normalizedAltPhone,
      shipping_phone: normalizedShippingPhone || normalizedPhone,
      recipient_name: recipientName || customerName,
      email: savedOrder.email ? savedOrder.email.trim() : "",
      address: {
        division: savedOrder.address?.division || "",
        district: savedOrder.address?.district || "",
        address_line: savedOrder.address?.address_line || "",
        recipient_name: recipientName || customerName,
        phone: normalizedShippingPhone || normalizedPhone,
      },
      status: savedOrder.status,
      payment: savedOrder.payment || "unpaid",
      fulfillment: savedOrder.fulfillment || "unfulfilled",
      method: savedOrder.method || "cod",
      channel: savedOrder.channel || "phone",
      subtotal,
      discount_total: discountTotal,
      shipping_total: shippingTotal,
      grand_total: grandTotal,
      amount_paid: Number(savedOrder.amount_paid) || 0,
      currency: "BDT",
      date: savedOrder.date || nowStr,
      customer_note: savedOrder.customer_note || "",
      courier_name: savedOrder.courier_name || "",
      cancel_reason: savedOrder.cancel_reason || "",
      items: savedOrder.items || [],
      notes:
        savedOrder.notes && savedOrder.notes.length > 0
          ? savedOrder.notes
          : [
              {
                id: `note-${Date.now()}`,
                author: actorName,
                text: `Order recorded via ${savedOrder.channel?.toUpperCase() || "ADMIN"}.`,
                type: "internal",
                created_at: formatDateTime(nowStr),
              },
            ],
      events:
        savedOrder.events && savedOrder.events.length > 0
          ? savedOrder.events
          : [
              {
                id: `ev-${Date.now()}`,
                event_type: "placed",
                message: `Order created (${savedOrder.status.replace(/_/g, " ")})`,
                actor: actorName,
                created_at: formatDateTime(nowStr),
              },
            ],
      isFromDb: false,
    };

    try {
      const dbInsertPayload: Record<string, any> = {
        order_number: orderNumber,
        status: savedOrder.status,
        channel: savedOrder.channel || "phone",
        payment_status: savedOrder.payment || "unpaid",
        fulfillment_status: savedOrder.fulfillment || "unfulfilled",
        payment_method: savedOrder.method || "cod",
        currency: "BDT",
        placed_at: savedOrder.date || nowStr,
        customer_name: customerName || null,
        customer_phone: normalizedPhone || null,
        customer_alternative_phone: normalizedAltPhone || null,
        shipping_phone: normalizedShippingPhone || normalizedPhone || null,
        customer_email: savedOrder.email ? savedOrder.email.trim() : null,
        shipping_address: {
          division: savedOrder.address?.division || "",
          district: savedOrder.address?.district || "",
          address_line: savedOrder.address?.address_line || "",
          phone: normalizedShippingPhone || normalizedPhone || "",
          alternative_phone: normalizedAltPhone || "",
          recipient_name: recipientName || customerName || "",
        },
        subtotal,
        discount_total: discountTotal,
        shipping_total: shippingTotal,
        tax_total: 0,
        grand_total: grandTotal,
        amount_paid: Number(savedOrder.amount_paid) || 0,
        customer_note: savedOrder.customer_note || null,
        attribution: savedOrder.attribution || {},
        cancel_reason: savedOrder.cancel_reason || null,
        shipping_method_name: savedOrder.courier_name || null,
      };

      const { data: dbData, error: dbErr } = await client
        .from("orders")
        .insert(dbInsertPayload)
        .select()
        .maybeSingle();

      if (dbErr) {
        throw new Error(dbErr.message || "Failed to create order in database");
      }

      createdOrder.id = dbData?.order_number || orderNumber;
      createdOrder.isFromDb = true;
      createdOrder.public_token = dbData?.public_token;

      let orderDbId = dbData?.id;
      if (!orderDbId) {
        const { data: fetchedOrder } = await client
          .from("orders")
          .select("id")
          .eq("order_number", orderNumber)
          .maybeSingle();
        orderDbId = fetchedOrder?.id;
      }

      if (orderDbId && savedOrder.items && savedOrder.items.length > 0) {
        try {
          const candidateVarIds = savedOrder.items
            .map((it) => it.variant_id || (it as any).variantId)
            .filter((id) => isValidUuid(id));

          const varToProdMap = new Map<string, string>();
          if (candidateVarIds.length > 0) {
            const { data: varsData } = await client
              .from("product_variants")
              .select("id, product_id")
              .in("id", candidateVarIds);
            (varsData || []).forEach((v: any) => {
              if (v.id && v.product_id) varToProdMap.set(v.id, v.product_id);
            });
          }

          const itemRows = savedOrder.items.map((it) => {
            const isVarUuid = isValidUuid(it.variant_id);
            const rawProdId = it.product_id || (it as any).productId;
            const isProdUuid = isValidUuid(rawProdId);
            const resolvedProdId = isProdUuid
              ? rawProdId
              : isVarUuid && it.variant_id
              ? varToProdMap.get(it.variant_id) || null
              : null;

            return {
              order_id: orderDbId,
              product_id: resolvedProdId,
              variant_id: isVarUuid ? it.variant_id : null,
              sku: it.sku || "SKU-ITEM",
              product_name: it.product_name || "Molasses Product",
              variant_name: it.variant_name || "Standard",
              quantity: Math.max(1, Number(it.quantity) || 1),
              unit_price: Math.max(0, Number(it.unit_price) || 0),
            };
          });
          const { error: itemInsertErr } = await client
            .from("order_items")
            .insert(itemRows);
          if (itemInsertErr) {
            console.error("Direct order_items insert error:", itemInsertErr);
          }
        } catch (itemErr) {
          console.warn("Could not insert order items directly:", itemErr);
        }
      }

      if (orderDbId && savedOrder.notes && savedOrder.notes.length > 0) {
        try {
          const nonCustomerNotes = savedOrder.notes.filter(
            (n) => n && n.text && n.text.trim() && n.type !== "customer"
          );
          if (nonCustomerNotes.length > 0) {
            const noteRows = nonCustomerNotes.map((n) => {
              const dbType =
                n.type === "delivery" || n.type === "delivery_note"
                  ? "delivery"
                  : n.type === "packaging" || n.type === "packaging_note"
                  ? "packaging"
                  : n.type === "system" || n.type === "system_note"
                  ? "system"
                  : "internal";
              return {
                order_id: orderDbId,
                order_number: orderNumber,
                type: dbType,
                author: n.author || actorName,
                note: n.text
                  .trim()
                  .replace(/^\[(Delivery|Packaging|Internal|System) Note\]\s*/i, ""),
                created_at: n.created_at || new Date().toISOString(),
              };
            });
            await client.from("order_notes").insert(noteRows);
          }
        } catch (noteInsErr) {
          console.warn("Notice inserting notes into order_notes:", noteInsErr);
        }
      }

      await convertStorefrontInquiryForOrderInternal(client, {
        orderId: orderDbId,
        attribution: savedOrder.attribution,
        normalizedPhone,
        flowContext: "direct insert flow",
      });
    } catch (insertErr: any) {
      console.error("Error attempting order insert:", insertErr);
      throw new Error(insertErr?.message || "Failed to save order in database");
    }

    if (
      [
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "partially_delivered",
      ].includes(createdOrder.status)
    ) {
      triggerCapiPurchaseInternal(createdOrder.id).catch(() => {});
    }

    return createdOrder;
  }

  let districtId = 30;
  try {
    const targetDistrictName = (savedOrder.address?.district || "")
      .trim()
      .toLowerCase();
    const { data: distData } = await client
      .from("geo_districts")
      .select("id, name");

    const exactDbMatch = (distData || []).find(
      (d: any) => String(d.name || "").trim().toLowerCase() === targetDistrictName
    );
    if (exactDbMatch) {
      districtId = exactDbMatch.id;
    } else {
      const found = fallbackDistricts.find(
        (d) => d.name.toLowerCase() === targetDistrictName
      );
      if (found) districtId = found.id;
    }
  } catch (e) {
    console.warn("District resolution warning:", e);
  }

  const shippingMethods = await fetchRawShippingMethodsInternal(client);
  const isPickup =
    (savedOrder.address?.address_line || "").toLowerCase().includes("pickup") ||
    Number(savedOrder.shipping_total) === 0;

  const matchedMethod =
    shippingMethods.find((m) => m.is_pickup === isPickup) ||
    shippingMethods.find((m) => !m.is_pickup) ||
    shippingMethods[0];

  const shippingMethodId = matchedMethod.id;

  const { data: dbVariants } = await client
    .from("product_variants")
    .select("id, sku, price")
    .eq("is_active", true);

  const variantSkuMap = new Map<string, string>();
  if (dbVariants) {
    dbVariants.forEach((v: any) =>
      variantSkuMap.set(String(v.sku || "").toLowerCase(), v.id)
    );
  }
  const defaultVariantId =
    dbVariants && dbVariants.length > 0
      ? dbVariants[0].id
      : "0c696f68-7bc2-4006-befa-0540dd24dc5b";

  const pItems = savedOrder.items.map((it) => {
    let vId = it.variant_id;
    if (!vId || vId.length < 32) {
      vId = variantSkuMap.get(it.sku.toLowerCase()) || defaultVariantId;
    }
    return {
      variant_id: vId,
      quantity: Math.max(1, Number(it.quantity) || 1),
    };
  });

  const validMethods = [
    "cod",
    "bkash",
    "nagad",
    "rocket",
    "card",
    "bank_transfer",
    "credit_terms",
    "cash",
  ];
  let paymentMethod = (savedOrder.method || "cod") as any;
  if (!validMethods.includes(paymentMethod)) {
    paymentMethod = "cod";
  }

  const { data: placeData, error: placeError } = await client.rpc(
    "place_order",
    {
      p_items: pItems,
      p_customer: {
        name: customerName,
        phone: normalizedPhone,
        email: savedOrder.email ? savedOrder.email.trim() : undefined,
      },
      p_shipping_address: {
        recipient_name: recipientName || customerName,
        phone: normalizedShippingPhone || normalizedPhone,
        district_id: districtId,
        address_line: savedOrder.address?.address_line?.trim() || "",
      },
      p_shipping_method_id: shippingMethodId,
      p_payment_method: paymentMethod,
      p_customer_note: savedOrder.customer_note?.trim() || undefined,
      p_attribution: savedOrder.attribution
        ? (savedOrder.attribution as any)
        : undefined,
      p_channel: savedOrder.channel || "phone",
    }
  );

  if (placeError) {
    console.error("Supabase place_order RPC error:", placeError);
    let msg = placeError.message;
    if (msg.includes("OUT_OF_STOCK"))
      msg = "Selected molasses product is currently out of stock in warehouse.";
    else if (msg.includes("CUSTOMER_PHONE_INVALID"))
      msg = "Please enter a valid mobile number (+880...)";
    else if (msg.includes("ADDRESS_REQUIRED"))
      msg = "Please provide delivery district and street address.";
    else if (msg.includes("FORBIDDEN"))
      msg = "Access restricted for this channel or customer action.";
    throw new Error(msg);
  }

  let orderDetails: any = null;
  if (placeData?.public_token) {
    try {
      const { data: tokenData } = await client.rpc("get_order_by_token", {
        p_token: placeData.public_token,
      });
      if (tokenData) {
        orderDetails = tokenData;
      }
    } catch (e) {
      console.warn("Could not immediately fetch order token details:", e);
    }
  }

  const prefix = await getOrderNumberPrefixInternal(client);
  const orderNumber =
    orderDetails?.order_number ||
    placeData?.order_number ||
    `${prefix}-2610-${Date.now().toString().slice(-5)}`;

  const createdResult: Order = {
    id: orderNumber,
    customer: orderDetails?.customer_name || customerName || "",
    phone: normalizedPhone,
    alternative_phone:
      orderDetails?.shipping_address?.alternative_phone ||
      orderDetails?.customer_alternative_phone ||
      normalizedAltPhone ||
      "",
    shipping_phone: normalizedShippingPhone || normalizedPhone,
    recipient_name: recipientName || customerName,
    email: savedOrder.email || "",
    address: {
      division:
        orderDetails?.shipping_address?.division ||
        savedOrder.address?.division ||
        "",
      district:
        orderDetails?.shipping_address?.district ||
        savedOrder.address?.district ||
        "",
      address_line:
        orderDetails?.shipping_address?.address_line ||
        savedOrder.address?.address_line ||
        "",
      recipient_name: recipientName || customerName,
      phone: normalizedShippingPhone || normalizedPhone,
    },
    status: savedOrder.status || (orderDetails?.status as any) || "pending",
    payment:
      (orderDetails?.payment_status as any) || savedOrder.payment || "unpaid",
    fulfillment:
      (orderDetails?.fulfillment_status as any) ||
      savedOrder.fulfillment ||
      "unfulfilled",
    method: (orderDetails?.payment_method as any) || paymentMethod,
    channel: savedOrder.channel || "web",
    subtotal:
      Number(orderDetails?.subtotal) ||
      Number(placeData?.grand_total) ||
      savedOrder.subtotal,
    discount_total: Number(orderDetails?.discount_total) || 0,
    shipping_total:
      Number(orderDetails?.shipping_total) || savedOrder.shipping_total,
    grand_total:
      Number(orderDetails?.grand_total) ||
      Number(placeData?.grand_total) ||
      savedOrder.grand_total,
    amount_paid: Number(orderDetails?.amount_paid) || 0,
    currency: orderDetails?.currency || "BDT",
    date: orderDetails?.placed_at || orderDetails?.created_at || nowStr,
    customer_note: savedOrder.customer_note,
    items:
      orderDetails?.items && orderDetails.items.length > 0
        ? orderDetails.items.map((it: any, idx: number) => ({
            id: `item-db-${idx}-${it.sku}`,
            sku: it.sku,
            product_name: it.product_name,
            variant_name: it.variant_name,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            line_total:
              Number(it.line_total) ||
              Number(it.quantity) * Number(it.unit_price),
            variant_id: savedOrder.items[idx]?.variant_id,
          }))
        : savedOrder.items,
    notes: [
      {
        id: `note-${Date.now()}`,
        author: "System",
        text: `Order created and confirmed.`,
        type: "system",
        created_at: formatDateTime(nowStr),
      },
    ],
    events:
      orderDetails?.timeline && orderDetails.timeline.length > 0
        ? orderDetails.timeline.map((ev: any, idx: number) => ({
            id: `ev-db-${idx}`,
            event_type: ev.event || "placed",
            message: ev.message || "Order placed",
            actor: "System Checkout",
            created_at: formatDateTime(ev.at) || formatDateTime(nowStr),
          }))
        : [
            {
              id: `ev-${Date.now()}`,
              event_type: "placed",
              message: "Order placed",
              actor: "System Checkout",
              created_at: formatDateTime(nowStr),
            },
          ],
    isFromDb: true,
    public_token: placeData?.public_token,
  };

  const postRpcUpdate: Record<string, any> = {};
  if (normalizedAltPhone) {
    postRpcUpdate.customer_alternative_phone = normalizedAltPhone;
  }
  if (normalizedShippingPhone) {
    postRpcUpdate.shipping_phone = normalizedShippingPhone;
  }
  if (savedOrder.attribution && Object.keys(savedOrder.attribution).length > 0) {
    postRpcUpdate.attribution = savedOrder.attribution;
  }
  if (savedOrder.channel) {
    postRpcUpdate.channel = savedOrder.channel;
  }
  if (Object.keys(postRpcUpdate).length > 0 && orderNumber) {
    try {
      await client
        .from("orders")
        .update(postRpcUpdate)
        .eq("order_number", orderNumber);
    } catch (e) {
      console.warn("Could not set phone/attribution fields on newly created RPC order:", e);
    }
  }

  await convertStorefrontInquiryForOrderInternal(client, {
    orderId: placeData?.order_id,
    attribution: savedOrder.attribution,
    normalizedPhone,
    flowContext: "place_order flow",
  });

  if (
    [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "partially_delivered",
    ].includes(createdResult.status)
  ) {
    triggerCapiPurchaseInternal(createdResult.id).catch(() => {});
  }

  return createdResult;
}

/**
 * Server Action: Updates an existing order, line items, and notes via admin client.
 */
export async function updateAdminOrderAction(
  updatedOrder: Order,
  syncItems: boolean = true
): Promise<Order> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  return persistOrderUpdateInternal(
    updatedOrder,
    syncItems,
    session.user.name || "Admin Staff"
  );
}

/**
 * Server Action: Appends a customer or internal note to an order.
 */
export async function addOrderNoteAction(
  orderId: string,
  note: OrderNote,
  currentOrder?: Order
): Promise<Order> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  const { orderUuid, orderNumber } = await resolveOrderIdentity(
    client,
    orderId,
    (currentOrder as any)?.uuid || (currentOrder as any)?.db_id
  );

  const baseOrder =
    currentOrder ||
    (await getOrderAction(orderNumber || orderId)) ||
    ({
      id: orderNumber || orderId,
      customer: "",
      phone: "",
      email: "",
      address: { division: "", district: "", address_line: "" },
      status: "pending",
      payment: "unpaid",
      fulfillment: "unfulfilled",
      method: "cod",
      channel: "web",
      subtotal: 0,
      discount_total: 0,
      shipping_total: 0,
      grand_total: 0,
      amount_paid: 0,
      currency: "BDT",
      date: new Date().toISOString(),
      items: [],
      notes: [],
      events: [],
    } as Order);

  const trimmedText = note.text.trim();
  const authorName = note.author || session.user.name || "Admin Staff";
  const nowIso = new Date().toISOString();

  if (note.type === "customer") {
    await client
      .from("orders")
      .update({ customer_note: trimmedText })
      .eq("order_number", orderNumber);

    if (orderUuid) {
      await client
        .from("order_notes")
        .delete()
        .eq("order_id", orderUuid)
        .eq("type", "customer");
    }
    await client
      .from("order_notes")
      .delete()
      .eq("order_number", orderNumber)
      .eq("type", "customer");

    baseOrder.customer_note = trimmedText;
    baseOrder.notes = (baseOrder.notes || []).filter(
      (n) => n.type !== "customer"
    );
    return baseOrder;
  }

  const dbType =
    note.type === "delivery" || note.type === "delivery_note"
      ? "delivery"
      : note.type === "packaging" || note.type === "packaging_note"
      ? "packaging"
      : note.type === "system" || note.type === "system_note"
      ? "system"
      : "internal";

  const cleanNoteText = trimmedText.replace(
    /^\[(Delivery|Packaging|Internal|System) Note\]\s*/i,
    ""
  );

  const insertPayload = {
    order_id: orderUuid || null,
    order_number: orderNumber,
    type: dbType,
    author: authorName,
    note: cleanNoteText,
    created_at: nowIso,
  };

  const { data: insData, error: insErr } = await client
    .from("order_notes")
    .insert(insertPayload)
    .select();

  if (insErr) {
    console.error("Failed to insert order note into database:", insErr);
    throw new Error(insErr.message || "Failed to add note to database");
  }

  const insertedRow = insData?.[0];

  const { data: dbNotes } = await client
    .from("order_notes")
    .select("*")
    .or(buildOrderNotesOrFilter(orderUuid, orderNumber))
    .order("created_at", { ascending: false });

  if (dbNotes && dbNotes.length > 0) {
    baseOrder.notes = dbNotes
      .filter((n: any) => n.type !== "customer")
      .map((n: any) => parseDbNoteToDomainInternal(n, orderNumber));
  } else if (insertedRow) {
    const parsed = parseDbNoteToDomainInternal(insertedRow, orderNumber);
    baseOrder.notes = [
      parsed,
      ...(baseOrder.notes || []).filter((n) => n.id !== parsed.id),
    ];
  }

  return baseOrder;
}

/**
 * Server Action: Updates an existing note on an order (handles customer/internal transitions safely).
 */
export async function updateOrderNoteAction(
  orderId: string,
  noteId: string,
  updatedText: string,
  updatedType?: OrderNoteType,
  currentOrder?: Order
): Promise<Order> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();
  const actorName = session.user.name || "Admin Staff";

  const { orderUuid, orderNumber } = await resolveOrderIdentity(
    client,
    orderId,
    (currentOrder as any)?.uuid || (currentOrder as any)?.db_id
  );

  const baseOrder =
    currentOrder ||
    (await getOrderAction(orderNumber || orderId)) ||
    ({ id: orderNumber || orderId, notes: [] } as any as Order);

  const trimmed = updatedText.trim();
  const targetNote = (baseOrder.notes || []).find((n) => n.id === noteId);
  const finalType =
    updatedType ||
    targetNote?.type ||
    (noteId === "customer_note" ? "customer" : "internal");
  const nowIso = new Date().toISOString();

  if (noteId === "customer_note" || targetNote?.type === "customer") {
    if (finalType === "customer") {
      await client
        .from("orders")
        .update({ customer_note: trimmed })
        .eq("order_number", orderNumber);

      if (orderUuid) {
        await client
          .from("order_notes")
          .delete()
          .eq("order_id", orderUuid)
          .eq("type", "customer");
      }
      await client
        .from("order_notes")
        .delete()
        .eq("order_number", orderNumber)
        .eq("type", "customer");

      baseOrder.customer_note = trimmed;
      baseOrder.notes = (baseOrder.notes || []).filter(
        (n) => n.id !== noteId && n.type !== "customer"
      );
      return baseOrder;
    } else {
      await client
        .from("orders")
        .update({ customer_note: null })
        .eq("order_number", orderNumber);

      baseOrder.customer_note = "";
      return await addOrderNoteAction(
        orderNumber,
        {
          id: `note-${Date.now()}`,
          author: actorName,
          text: trimmed,
          type: finalType,
          created_at: formatDateTime(nowIso),
        },
        baseOrder
      );
    }
  }

  if (finalType === "customer") {
    if (isValidUuid(noteId)) {
      await client.from("order_notes").delete().eq("id", noteId);
    } else if (targetNote?.text) {
      const { data: existingRows } = await client
        .from("order_notes")
        .select("id, note")
        .eq("order_number", orderNumber);
      const needle = targetNote.text.trim().toLowerCase();
      const matchingIds = (existingRows || [])
        .filter((r: any) =>
          String(r.note || "").toLowerCase().includes(needle)
        )
        .map((r: any) => r.id);
      if (matchingIds.length > 0) {
        await client.from("order_notes").delete().in("id", matchingIds);
      }
    }

    await client
      .from("orders")
      .update({ customer_note: trimmed })
      .eq("order_number", orderNumber);

    baseOrder.customer_note = trimmed;

    const { data: dbNotes } = await client
      .from("order_notes")
      .select("*")
      .or(buildOrderNotesOrFilter(orderUuid, orderNumber))
      .order("created_at", { ascending: false });

    if (dbNotes) {
      baseOrder.notes = dbNotes
        .filter((n: any) => n.type !== "customer")
        .map((n: any) => parseDbNoteToDomainInternal(n, orderNumber));
    } else {
      baseOrder.notes = (baseOrder.notes || []).filter((n) => n.id !== noteId);
    }
    return baseOrder;
  }

  const cleanText = trimmed.replace(
    /^\[(Delivery|Packaging|Internal|System) Note\]\s*/i,
    ""
  );
  const dbFinalType =
    finalType === "delivery" || finalType === "delivery_note"
      ? "delivery"
      : finalType === "packaging" || finalType === "packaging_note"
      ? "packaging"
      : finalType === "system" || finalType === "system_note"
      ? "system"
      : "internal";

  if (isValidUuid(noteId)) {
    const { error: updErr } = await client
      .from("order_notes")
      .update({
        note: cleanText,
        type: dbFinalType,
      })
      .eq("id", noteId);

    if (updErr) {
      console.error("Failed to update order note in DB:", updErr);
      throw new Error(updErr.message || "Failed to update note in database");
    }
  } else {
    const { data: existingRows } = await client
      .from("order_notes")
      .select("id, note")
      .eq("order_number", orderNumber);

    const matchingRow = existingRows?.find((r: any) =>
      targetNote?.text ? String(r.note || "").includes(targetNote.text.trim()) : false
    );

    if (matchingRow && isValidUuid(matchingRow.id)) {
      await client
        .from("order_notes")
        .update({ note: cleanText, type: dbFinalType })
        .eq("id", matchingRow.id);
    } else {
      return await addOrderNoteAction(
        orderNumber,
        {
          id: noteId,
          author: targetNote?.author || actorName,
          text: trimmed,
          type: finalType,
          created_at: formatDateTime(nowIso),
        },
        baseOrder
      );
    }
  }

  const { data: dbNotes } = await client
    .from("order_notes")
    .select("*")
    .or(buildOrderNotesOrFilter(orderUuid, orderNumber))
    .order("created_at", { ascending: false });

  if (dbNotes && dbNotes.length > 0) {
    baseOrder.notes = dbNotes
      .filter((n: any) => n.type !== "customer")
      .map((n: any) => parseDbNoteToDomainInternal(n, orderNumber));
  } else {
    baseOrder.notes = (baseOrder.notes || []).map((n) =>
      n.id === noteId ? { ...n, text: trimmed, type: finalType } : n
    );
  }

  return baseOrder;
}

/**
 * Server Action: Deletes a customer or internal note from an order.
 */
export async function deleteOrderNoteAction(
  orderId: string,
  noteId: string,
  currentOrder?: Order
): Promise<Order> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  const { orderUuid, orderNumber } = await resolveOrderIdentity(
    client,
    orderId,
    (currentOrder as any)?.uuid || (currentOrder as any)?.db_id
  );

  const baseOrder =
    currentOrder ||
    (await getOrderAction(orderNumber || orderId)) ||
    ({ id: orderNumber || orderId, notes: [] } as any as Order);

  const targetNote = (baseOrder.notes || []).find((n) => n.id === noteId);

  if (noteId === "customer_note" || targetNote?.type === "customer") {
    await client
      .from("orders")
      .update({ customer_note: null })
      .eq("order_number", orderNumber);

    if (orderUuid) {
      await client
        .from("order_notes")
        .delete()
        .eq("order_id", orderUuid)
        .eq("type", "customer");
    }
    await client
      .from("order_notes")
      .delete()
      .eq("order_number", orderNumber)
      .eq("type", "customer");

    baseOrder.customer_note = "";
    baseOrder.notes = (baseOrder.notes || []).filter(
      (n) => n.id !== noteId && n.type !== "customer"
    );
    return baseOrder;
  }

  if (isValidUuid(noteId)) {
    await client.from("order_notes").delete().eq("id", noteId);
  } else if (targetNote?.text) {
    const { data: existingRows } = await client
      .from("order_notes")
      .select("id, note")
      .or(buildOrderNotesOrFilter(orderUuid, orderNumber));
    const needle = targetNote.text.trim().toLowerCase();
    const matchingIds = (existingRows || [])
      .filter((r: any) => String(r.note || "").toLowerCase().includes(needle))
      .map((r: any) => r.id);
    if (matchingIds.length > 0) {
      await client.from("order_notes").delete().in("id", matchingIds);
    }
  }

  const { data: dbNotes } = await client
    .from("order_notes")
    .select("*")
    .or(buildOrderNotesOrFilter(orderUuid, orderNumber))
    .order("created_at", { ascending: false });

  if (dbNotes) {
    baseOrder.notes = dbNotes
      .filter((n: any) => n.type !== "customer")
      .map((n: any) => parseDbNoteToDomainInternal(n, orderNumber));
  } else {
    baseOrder.notes = (baseOrder.notes || []).filter((n) => n.id !== noteId);
  }

  return baseOrder;
}

/**
 * Server Action: Updates an order's customer note.
 */
export async function updateCustomerNoteAction(
  orderId: string,
  customerNoteText: string,
  currentOrder?: Order
): Promise<Order> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  const baseOrder =
    currentOrder ||
    (await getOrderAction(orderId)) ||
    ({ id: orderId, customer_note: "" } as any as Order);

  const trimmed = customerNoteText.trim();

  await client
    .from("orders")
    .update({ customer_note: trimmed || null })
    .eq("order_number", orderId);

  await client
    .from("order_notes")
    .delete()
    .eq("order_number", orderId)
    .eq("type", "customer");

  baseOrder.customer_note = trimmed;
  baseOrder.notes = (baseOrder.notes || []).filter((n) => n.type !== "customer");
  return baseOrder;
}

/**
 * Server Action: Records payment amount and status on an order.
 */
export async function recordOrderPaymentAction(
  orderId: string,
  amountPaid: number,
  paymentStatus: Order["payment"],
  paymentMethod?: Order["method"],
  transactionRef?: string,
  noteText?: string,
  currentOrder?: Order
): Promise<Order> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();
  const actorName = session.user.name || "Admin Staff";

  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
  const paymentEvent: OrderEvent = {
    id: `ev-pay-${Date.now()}`,
    event_type: "payment_recorded",
    to_value: paymentStatus,
    message: `Payment updated: ৳ ${amountPaid.toLocaleString()} (${paymentStatus.replace("_", " ")})${transactionRef ? ` via ${transactionRef}` : ""}`,
    actor: actorName,
    created_at: formatDateTime(nowStr),
  };

  const newNotes = [...(currentOrder?.notes || [])];
  if (noteText && noteText.trim()) {
    newNotes.unshift({
      id: `note-pay-${Date.now()}`,
      author: actorName,
      text: `[Payment Record]: ${noteText.trim()}${transactionRef ? ` (Ref: ${transactionRef})` : ""}`,
      type: "internal",
      created_at: formatDateTime(nowStr),
    });
  }

  const baseOrder =
    currentOrder ||
    (await getOrderAction(orderId)) ||
    ({
      id: orderId,
      customer: "",
      phone: "",
      email: "",
      address: { division: "", district: "", address_line: "" },
      status: "confirmed",
      payment: paymentStatus,
      fulfillment: "unfulfilled",
      method: paymentMethod || "cod",
      channel: "web",
      subtotal: 0,
      discount_total: 0,
      shipping_total: 0,
      grand_total: 0,
      amount_paid: amountPaid,
      currency: "BDT",
      date: nowStr,
      items: [],
      notes: [],
      events: [],
    } as Order);

  const updated: Order = {
    ...baseOrder,
    payment: paymentStatus,
    amount_paid: amountPaid,
    method: paymentMethod || baseOrder.method || "cod",
    notes: newNotes,
    events: [paymentEvent, ...(baseOrder.events || [])],
  };

  const orderPaymentUpdatePayload: Record<string, any> = {
    payment_status: paymentStatus,
    amount_paid: Number(amountPaid) || 0,
    updated_at: new Date().toISOString(),
  };
  if (paymentMethod) {
    orderPaymentUpdatePayload.payment_method = paymentMethod;
  }

  const { error: directPayErr } = await client
    .from("orders")
    .update(orderPaymentUpdatePayload)
    .eq("order_number", orderId);

  if (directPayErr) {
    console.error("Direct payment update error:", directPayErr);
  }

  return await persistOrderUpdateInternal(updated, false, actorName);
}

/**
 * Server Action: Deletes an order by order_number (or falls back to cancelled on FK constraint).
 */
export async function deleteOrderAction(orderId: string): Promise<boolean> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();
  const cleanId = orderId.trim();

  const { error } = isValidUuid(cleanId)
    ? await client.from("orders").delete().eq("id", cleanId)
    : await client.from("orders").delete().eq("order_number", cleanId);

  if (error) {
    console.warn("Direct delete failed, marking order as cancelled:", error);
    const { error: cancelError } = await client
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: "Cancelled by Admin",
      })
      .eq(isValidUuid(cleanId) ? "id" : "order_number", cleanId);

    if (cancelError) {
      throw new Error(
        cancelError.message || "Failed to delete or cancel order in database"
      );
    }
  }

  return true;
}

/**
 * Server Action: Bulk-assigns a courier partner across eligible selected orders.
 */
export async function bulkAssignCourierAction(
  orderIds: string[],
  courierName: string,
  batchNote?: string
): Promise<BulkCourierUpdateResult> {
  const session = await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();
  const actorUuid = getActorUuid(session);
  const actorName = session.user.name || "Admin Staff";

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

  const cleanCourier = (courierName || "").trim();
  if (cleanCourier.length < 2) {
    throw new DatabaseOperationError(
      parseDatabaseError({
        code: "COURIER_REQUIRED",
        message:
          "A valid courier partner name is required before assigning in bulk.",
      })
    );
  }

  const nowIso = new Date().toISOString();

  const { data: dbOrders, error: fetchErr } = await client
    .from("orders")
    .select(
      "id, order_number, status, courier_consignment_id, courier_tracking_code"
    )
    .in("order_number", orderIds);

  if (fetchErr) {
    console.error("Failed to query orders for bulk courier assignment:", fetchErr);
    throw new DatabaseOperationError(parseDatabaseError(fetchErr));
  }

  const ordersList = dbOrders || [];
  const eligibleOrders: typeof ordersList = [];
  const skippedOrders: { id: string; reason: string }[] = [];

  const foundOrderNumbers = new Set(ordersList.map((o: any) => o.order_number));
  for (const id of orderIds) {
    if (!foundOrderNumbers.has(id)) {
      skippedOrders.push({ id, reason: "Order not found in database" });
    }
  }

  for (const o of ordersList) {
    if (o.status === "cancelled" || o.status === "returned") {
      skippedOrders.push({
        id: o.order_number,
        reason: `Order is already ${o.status.replace(/_/g, " ")} and cannot be assigned a courier`,
      });
    } else if (o.status === "delivered") {
      skippedOrders.push({
        id: o.order_number,
        reason:
          "Order is already delivered and courier partner cannot be reassigned",
      });
    } else if (o.courier_consignment_id) {
      skippedOrders.push({
        id: o.order_number,
        reason: `Order is already booked with courier (Consignment #${o.courier_consignment_id}) and cannot be reassigned`,
      });
    } else {
      eligibleOrders.push(o);
    }
  }

  if (eligibleOrders.length === 0) {
    const reasonSummary = skippedOrders
      .map((s) => `${s.id}: ${s.reason}`)
      .join("; ");
    throw new DatabaseOperationError(
      parseDatabaseError({
        code: "ORDER_FINAL",
        message: `Cannot assign courier to selected order(s): ${skippedOrders[0]?.reason || "Orders are finalized"}`,
        details: reasonSummary,
        hint: "Select orders that are in pending, confirmed, or processing status.",
      })
    );
  }

  const eligibleOrderNumbers = eligibleOrders.map((o: any) => o.order_number);

  const { data: updatedOrders, error: updateErr } = await client
    .from("orders")
    .update({
      shipping_method_name: cleanCourier,
      updated_at: nowIso,
    })
    .in("order_number", eligibleOrderNumbers)
    .select("id, order_number");

  if (updateErr) {
    console.error("Failed to bulk assign courier:", updateErr);
    throw new DatabaseOperationError(parseDatabaseError(updateErr));
  }

  const actuallyUpdated = (updatedOrders || []).map((o: any) => o.order_number);

  if (batchNote && batchNote.trim()) {
    const cleanNote = batchNote.trim();
    const ordersMap = updatedOrders || [];

    const noteRows = ordersMap.map((o: any) => ({
      order_id: o.id,
      order_number: o.order_number,
      type: "internal",
      author: actorName,
      note: `[Courier Assigned → ${cleanCourier}]: ${cleanNote}`,
      created_at: nowIso,
    }));

    if (noteRows.length > 0) {
      try {
        await client.from("order_notes").insert(noteRows);
      } catch (noteErr) {
        console.warn("Could not record batch courier note:", noteErr);
      }
    }
  }

  if (updatedOrders && updatedOrders.length > 0) {
    try {
      const eventRows = updatedOrders.map((o: any) => ({
        order_id: o.id,
        event_type: "courier_assigned",
        message: `Courier partner assigned to ${cleanCourier} (Bulk Action)`,
        actor_id: actorUuid,
      }));
      await client.from("order_events").insert(eventRows);
    } catch (eventErr) {
      console.warn(
        "Could not record timeline events for bulk courier:",
        eventErr
      );
    }
  }

  return {
    success: true,
    totalRequested: orderIds.length,
    updatedCount: actuallyUpdated.length,
    skippedCount: skippedOrders.length,
    updatedOrderNumbers: actuallyUpdated,
    skippedOrders,
  };
}

/**
 * Server Action: Bulk-deletes eligible orders (never shipped/delivered).
 */
export async function bulkDeleteOrdersAction(
  orderIds: string[]
): Promise<BulkDeleteResult> {
  await assertStaffRole([...ORDER_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  if (!orderIds || orderIds.length === 0) {
    return {
      success: true,
      totalRequested: 0,
      deletedCount: 0,
      skippedCount: 0,
      deletedOrderNumbers: [],
      skippedOrders: [],
    };
  }

  const { data: dbOrders, error: fetchErr } = await client
    .from("orders")
    .select(
      "id, order_number, status, courier_consignment_id, courier_tracking_code"
    )
    .in("order_number", orderIds);

  if (fetchErr) {
    console.error("Failed to query orders for bulk delete:", fetchErr);
    throw new DatabaseOperationError(parseDatabaseError(fetchErr));
  }

  const ordersList = dbOrders || [];
  const eligibleOrders: typeof ordersList = [];
  const skippedOrders: { id: string; reason: string }[] = [];

  const foundOrderNumbers = new Set(ordersList.map((o: any) => o.order_number));
  for (const id of orderIds) {
    if (!foundOrderNumbers.has(id)) {
      skippedOrders.push({ id, reason: "Order not found in database" });
    }
  }

  for (const o of ordersList) {
    if (o.status === "shipped" || o.status === "delivered") {
      skippedOrders.push({
        id: o.order_number,
        reason: `Orders already ${o.status} cannot be deleted. Use return or cancellation workflows instead.`,
      });
    } else {
      eligibleOrders.push(o);
    }
  }

  if (eligibleOrders.length === 0) {
    const reasonSummary = skippedOrders
      .map((s) => `${s.id}: ${s.reason}`)
      .join("; ");
    throw new DatabaseOperationError(
      parseDatabaseError({
        code: "ORDER_NOT_CANCELLABLE",
        message: `Cannot delete selected orders: ${skippedOrders[0]?.reason || "Orders cannot be deleted"}`,
        details: reasonSummary,
        hint: "Only draft, pending, or cancelled orders can be deleted.",
      })
    );
  }

  const eligibleOrderNumbers = eligibleOrders.map((o: any) => o.order_number);

  const { error } = await client
    .from("orders")
    .delete()
    .in("order_number", eligibleOrderNumbers);

  if (error) {
    console.warn("Bulk delete failed, falling back to cancel:", error);
    const { error: cancelError } = await client
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: "Bulk cancelled by Admin",
        cancelled_at: new Date().toISOString(),
      })
      .in("order_number", eligibleOrderNumbers);

    if (cancelError) {
      throw new DatabaseOperationError(parseDatabaseError(cancelError));
    }
  }

  return {
    success: true,
    totalRequested: orderIds.length,
    deletedCount: eligibleOrderNumbers.length,
    skippedCount: skippedOrders.length,
    deletedOrderNumbers: eligibleOrderNumbers,
    skippedOrders,
  };
}

/**
 * Server Action: Fetches Bangladesh divisions and districts for admin order dialogs.
 */
export async function getGeoDataAction(): Promise<{
  divisions: DbGeoDivision[];
  districts: DbGeoDistrict[];
}> {
  await assertStaffRole([...ALL_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  try {
    const [divRes, distRes] = await Promise.all([
      client.from("geo_divisions").select("*").order("name", { ascending: true }),
      client.from("geo_districts").select("*").order("name", { ascending: true }),
    ]);

    return {
      divisions:
        divRes.data && divRes.data.length > 0 ? divRes.data : fallbackDivisions,
      districts:
        distRes.data && distRes.data.length > 0
          ? distRes.data
          : fallbackDistricts,
    };
  } catch (err) {
    console.error("Error fetching geo divisions and districts:", err);
    return {
      divisions: fallbackDivisions,
      districts: fallbackDistricts,
    };
  }
}

/**
 * Server Action: Fetches Bangladesh districts filtered optionally by division ID.
 */
export async function getGeoDistrictsAction(
  divisionId?: number
): Promise<DbGeoDistrict[]> {
  await assertStaffRole([...ALL_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  try {
    let query = client
      .from("geo_districts")
      .select("*")
      .order("name", { ascending: true });
    if (divisionId) {
      query = query.eq("division_id", divisionId);
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      if (divisionId) {
        return fallbackDistricts.filter((d) => d.division_id === divisionId);
      }
      return fallbackDistricts;
    }
    return data;
  } catch (err) {
    console.error("Error fetching geo_districts:", err);
    if (divisionId) {
      return fallbackDistricts.filter((d) => d.division_id === divisionId);
    }
    return fallbackDistricts;
  }
}

/**
 * Server Action: Fetches active variant catalog items for admin order entry forms.
 */
export async function getCatalogProductsAction(): Promise<CatalogProduct[]> {
  await assertStaffRole([...ALL_STAFF_ROLES]);
  const client = getSupabaseAdmin();

  try {
    const [prodRes, varRes, catRes, imgRes] = await Promise.all([
      client
        .from("products")
        .select("id, name, slug, category_id")
        .order("sort_order", { ascending: true }),
      client
        .from("product_variants")
        .select("id, product_id, sku, name, price, stock_status, pack_type")
        .eq("is_active", true),
      client.from("categories").select("id, name"),
      client
        .from("product_images")
        .select("id, product_id, storage_path, is_primary, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

    if (varRes.error || !varRes.data || varRes.data.length === 0) {
      return [];
    }

    const categoryMap = new Map<string, string>();
    if (catRes.data) {
      catRes.data.forEach((c: any) => categoryMap.set(c.id, c.name));
    }

    const productMap = new Map<string, any>();
    if (prodRes.data) {
      prodRes.data.forEach((p: any) => productMap.set(p.id, p));
    }

    const imageMap = new Map<string, string>();
    if (imgRes.data) {
      for (const img of imgRes.data) {
        if (!imageMap.has(img.product_id) || img.is_primary) {
          const pubUrl = resolveCdnImageUrl(img.storage_path);
          if (pubUrl) {
            imageMap.set(img.product_id, pubUrl);
          }
        }
      }
    }

    return varRes.data.map((v: any) => {
      const prod = productMap.get(v.product_id);
      const catName = prod?.category_id
        ? categoryMap.get(prod.category_id) || "Molasses"
        : "Pure Molasses";
      return {
        variant_id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        product_name: prod ? prod.name : "Pure Cane Molasses",
        variant_name: v.name,
        category: catName,
        unit_price: Number(v.price) || 0,
        stock:
          v.stock_status === "in_stock"
            ? "In Stock"
            : String(v.stock_status || "").replace("_", " "),
        image:
          imageMap.get(v.product_id) || "/images/products/raw-sugarcane-drum.jpg",
        pack_type: v.pack_type || "jar",
      };
    });
  } catch (err) {
    console.error("Error fetching catalog products:", err);
    return [];
  }
}
