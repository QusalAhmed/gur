"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { normalizeBdPhone } from "@/lib/supabase/api";
import { getOtherOrderInsight } from "@/types/order";
import { captureStorefrontMetaTracking } from "@/actions/facebook-capi";
import { enqueueAndDispatch } from "@/lib/outbox";

export interface StorefrontOrderItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}

export interface StorefrontOrderPayload {
  orderId?: string; // Database UUID of existing draft order to update
  status?: "incomplete_order" | "pending"; // Default: "pending" on submission, "incomplete_order" on auto-save
  customerName?: string;
  customerPhone: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka";
  addressLine?: string;
  division?: string;
  district?: string;
  courierName?: string;
  customerNote?: string;
  // Multiple items from Redux cart
  items?: StorefrontOrderItem[];
  // Single-item backwards compatibility
  productId?: string;
  productName?: string;
  variantId?: string;
  variantName?: string;
  quantity?: number;
  unitPrice?: number;
  // Facebook CAPI Attribution & Deduplication
  eventId?: string;
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
}

export interface StorefrontOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  publicToken?: string;
  status?: "incomplete_order" | "pending";
  grandTotal?: number;
  subtotal?: number;
  shippingTotal?: number;
  customerName?: string;
  phone?: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka";
  eventId?: string;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// In-Memory Performance Caching & Synchronization
// =============================================================================

export interface CatalogPricingData {
  validProdIds: Set<string>;
  validVarIds: Set<string>;
  varToProdMap: Map<string, string>;
  variantPriceMap: Map<string, number>;
  productDefaultPriceMap: Map<string, number>;
  productNameMap: Map<string, { id: string; defaultPrice: number; defaultVariantId?: string }>;
  priceTiersMap: Map<string, Array<{ minQty: number; unitPrice: number }>>;
}

let cachedCatalogPricing: CatalogPricingData | null = null;
let catalogCacheExpiry = 0;

async function getCatalogPricingData(client: any): Promise<CatalogPricingData> {
  const now = Date.now();
  if (cachedCatalogPricing && now < catalogCacheExpiry) {
    return cachedCatalogPricing;
  }

  try {
    const [prodsRes, varsRes, tiersRes] = await Promise.all([
      client.from("products").select("id, name, name_bn, status, sort_order"),
      client.from("product_variants").select("id, product_id, sku, name, name_bn, price, is_default, is_active, sort_order"),
      client.from("price_tiers").select("variant_id, min_qty, unit_price"),
    ]);

    const validProdIds = new Set<string>();
    const validVarIds = new Set<string>();
    const varToProdMap = new Map<string, string>();
    const variantPriceMap = new Map<string, number>();
    const productDefaultPriceMap = new Map<string, number>();
    const productNameMap = new Map<string, { id: string; defaultPrice: number; defaultVariantId?: string }>();
    const priceTiersMap = new Map<string, Array<{ minQty: number; unitPrice: number }>>();

    // 1. Process variants
    const activeVariantsByProd = new Map<string, any[]>();
    (varsRes.data || []).forEach((v: any) => {
      if (!v.id) return;
      validVarIds.add(v.id);
      if (v.product_id) {
        varToProdMap.set(v.id, v.product_id);
        const list = activeVariantsByProd.get(v.product_id) || [];
        if (v.is_active !== false) list.push(v);
        activeVariantsByProd.set(v.product_id, list);
      }
      variantPriceMap.set(v.id, Math.max(0, Number(v.price) || 0));
    });

    // 2. Process volume price tiers
    (tiersRes.data || []).forEach((t: any) => {
      if (!t.variant_id) return;
      const list = priceTiersMap.get(t.variant_id) || [];
      list.push({
        minQty: Number(t.min_qty) || 1,
        unitPrice: Math.max(0, Number(t.unit_price) || 0),
      });
      priceTiersMap.set(t.variant_id, list);
    });

    // Sort price tiers descending by minQty so the highest matching tier is evaluated first
    priceTiersMap.forEach((list) => {
      list.sort((a, b) => b.minQty - a.minQty);
    });

    // 3. Process products & default prices
    (prodsRes.data || []).forEach((p: any) => {
      if (!p.id) return;
      validProdIds.add(p.id);

      const variants = activeVariantsByProd.get(p.id) || [];
      variants.sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      const defaultVar = variants[0];
      const defaultPrice = defaultVar ? Math.max(0, Number(defaultVar.price) || 0) : 0;
      productDefaultPriceMap.set(p.id, defaultPrice);

      const entry = { id: p.id, defaultPrice, defaultVariantId: defaultVar?.id };
      if (p.name) productNameMap.set(p.name.trim().toLowerCase(), entry);
      if (p.name_bn) productNameMap.set(p.name_bn.trim().toLowerCase(), entry);
    });

    cachedCatalogPricing = {
      validProdIds,
      validVarIds,
      varToProdMap,
      variantPriceMap,
      productDefaultPriceMap,
      productNameMap,
      priceTiersMap,
    };
    catalogCacheExpiry = now + 5 * 60 * 1000; // 5-minute memory cache
    return cachedCatalogPricing;
  } catch (err) {
    console.error("[Storefront Order] Error fetching catalog pricing data:", err);
    return {
      validProdIds: new Set(),
      validVarIds: new Set(),
      varToProdMap: new Map(),
      variantPriceMap: new Map(),
      productDefaultPriceMap: new Map(),
      productNameMap: new Map(),
      priceTiersMap: new Map(),
    };
  }
}

async function getValidCatalogIds(
  client: any,
  candidateProdIds: string[],
  candidateVarIds: string[]
): Promise<{ validProdIds: Set<string>; validVarIds: Set<string>; varToProdMap: Map<string, string> }> {
  const data = await getCatalogPricingData(client);
  return {
    validProdIds: data.validProdIds,
    validVarIds: data.validVarIds,
    varToProdMap: data.varToProdMap,
  };
}

function resolveAuthoritativeItemPrice(
  catalog: CatalogPricingData,
  params: {
    variantId?: string;
    productId?: string;
    productName?: string;
    quantity: number;
    clientPrice?: number;
  }
): {
  unitPrice: number;
  resolvedVariantId?: string;
  resolvedProductId?: string;
} {
  const qty = Math.max(1, Math.floor(params.quantity || 1));
  const varId = params.variantId && UUID_REGEX.test(params.variantId) ? params.variantId : undefined;
  const prodId = params.productId && UUID_REGEX.test(params.productId) ? params.productId : undefined;

  // 1. Try finding by variant ID
  if (varId && catalog.validVarIds.has(varId)) {
    const parentProdId = catalog.varToProdMap.get(varId);
    // Check volume price tiers
    const tiers = catalog.priceTiersMap.get(varId);
    if (tiers && tiers.length > 0) {
      const matchedTier = tiers.find((t) => t.minQty <= qty);
      if (matchedTier) {
        return { unitPrice: matchedTier.unitPrice, resolvedVariantId: varId, resolvedProductId: parentProdId };
      }
    }
    const varPrice = catalog.variantPriceMap.get(varId);
    if (varPrice !== undefined) {
      return { unitPrice: varPrice, resolvedVariantId: varId, resolvedProductId: parentProdId };
    }
  }

  // 2. Try finding by product ID
  if (prodId && catalog.validProdIds.has(prodId)) {
    const defaultPrice = catalog.productDefaultPriceMap.get(prodId);
    if (defaultPrice !== undefined) {
      return { unitPrice: defaultPrice, resolvedProductId: prodId };
    }
  }

  // 3. Try finding by product name
  if (params.productName) {
    const lowerName = params.productName.trim().toLowerCase();
    for (const [key, p] of catalog.productNameMap.entries()) {
      if (lowerName.includes(key) || key.includes(lowerName)) {
        return { unitPrice: p.defaultPrice, resolvedProductId: p.id, resolvedVariantId: p.defaultVariantId };
      }
    }
  }

  // 4. Safe fallback to client-supplied price
  return {
    unitPrice: Math.max(0, Number(params.clientPrice) || 0),
    resolvedVariantId: varId,
    resolvedProductId: prodId,
  };
}

// 2. Per-phone concurrency lock: prevents simultaneous background sync & submit races
const activePhoneLocks = new Map<string, Promise<any>>();

async function withPhoneLock<T>(phone: string, fn: () => Promise<T>): Promise<T> {
  while (activePhoneLocks.has(phone)) {
    try {
      await activePhoneLocks.get(phone);
    } catch {
      // Safe ignore previous error and continue
    }
  }

  let resolveLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  activePhoneLocks.set(phone, lockPromise);

  try {
    return await fn();
  } finally {
    activePhoneLocks.delete(phone);
    resolveLock!();
  }
}

/**
 * Places or updates a storefront order with high performance and zero race conditions.
 * - If status is "incomplete_order": records/updates an abandoned lead in real time.
 * - If status is "pending": finalizes the customer order.
 * - Avoids duplicate orders through server-side per-phone serialization and atomic database triggers.
 */
export async function placeStorefrontOrderAction(
  payload: StorefrontOrderPayload
): Promise<StorefrontOrderResult> {
  const rawPhone = (payload.customerPhone || "").trim();
  const normalizedPhone = normalizeBdPhone(rawPhone);

  // Validate BD mobile phone: supports +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX
  if (!normalizedPhone || !/^\+8801[3-9]\d{8}$/.test(normalizedPhone)) {
    return {
      success: false,
      error: "অনুগ্রহ করে একটি সঠিক মোবাইল নম্বর দিন (উদা: 017XXXXXXXX, 1XXXXXXXXX বা +8801XXXXXXXXX)।",
    };
  }

  return withPhoneLock(normalizedPhone, async () => {
    try {
      const targetStatus: "incomplete_order" | "pending" = payload.status || "pending";

      const client = supabaseAdmin || supabase;
      const catalogPricing = await getCatalogPricingData(client);

      // Normalize items: support both multi-item list and legacy single item with authoritative server pricing
      let resolvedItems: StorefrontOrderItem[] = [];
      const rawItemList =
        payload.items && payload.items.length > 0
          ? payload.items
          : payload.productId
          ? [
              {
                productId: payload.productId,
                productName: payload.productName || "Pure Molasses",
                variantId: payload.variantId || "default",
                variantName: payload.variantName || "1 Pack",
                quantity: payload.quantity || 1,
                unitPrice: payload.unitPrice || 0,
              },
            ]
          : [];

      resolvedItems = rawItemList.map((i) => {
        const safeQuantity = Math.max(1, Math.floor(Number(i.quantity) || 1));
        const { unitPrice: verifiedUnitPrice, resolvedProductId, resolvedVariantId } = resolveAuthoritativeItemPrice(
          catalogPricing,
          {
            variantId: i.variantId,
            productId: i.productId,
            productName: i.productName,
            quantity: safeQuantity,
            clientPrice: i.unitPrice,
          }
        );

        return {
          productId: resolvedProductId || i.productId,
          productName: i.productName || "Pure Molasses",
          variantId: resolvedVariantId || i.variantId,
          variantName: i.variantName || "1 Pack",
          quantity: safeQuantity,
          unitPrice: verifiedUnitPrice,
        };
      });

      const hasItems = resolvedItems.length > 0;
      const rawSubtotal = hasItems
        ? resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        : 0;

      const hasDeliveryZone = Boolean(payload.deliveryZone);
      const isDhaka = payload.deliveryZone === "inside_dhaka";
      const baseShippingFee = hasItems && hasDeliveryZone ? (isDhaka ? 70 : 130) : 0;
      const shippingMethodName = payload.courierName
        ? payload.courierName.trim()
        : null;

      const metaTracking = await captureStorefrontMetaTracking({
        eventId: payload.eventId,
        fbp: payload.fbp,
        fbc: payload.fbc,
        eventSourceUrl: payload.eventSourceUrl,
      });

      // =========================================================================
      // Tier 1: Database-Level Atomic Transaction via PostgreSQL RPC
      // If public.process_storefront_order is available, the entire order creation,
      // deduplication, row-locking, and item sync execute inside a single ACID
      // transaction. If any error occurs, PostgreSQL rolls back completely so
      // no partial or corrupted rows are written to the database.
      // =========================================================================
      try {
        const rpcPayload = {
          p_order_id: payload.orderId && UUID_REGEX.test(payload.orderId) ? payload.orderId : null,
          p_status: targetStatus,
          p_customer_phone: normalizedPhone,
          p_customer_name: payload.customerName !== undefined ? (payload.customerName.trim() || null) : null,
          p_delivery_zone: payload.deliveryZone || null,
          p_address_line: payload.addressLine !== undefined ? (payload.addressLine.trim() || null) : null,
          p_customer_note: payload.customerNote !== undefined ? (payload.customerNote.trim() || null) : null,
          p_division: payload.division !== undefined ? (payload.division.trim() || null) : null,
          p_district: payload.district !== undefined ? (payload.district.trim() || null) : null,
          p_courier_name: payload.courierName !== undefined ? (payload.courierName.trim() || null) : null,
          p_items: resolvedItems.map((item) => ({
            product_id: item.productId,
            product_name: item.productName || "খেজুরের খাঁটি গুড়",
            variant_id: item.variantId,
            variant_name: item.variantName || "1 Pack",
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        };

        const { data: rpcData, error: rpcErr } = await client.rpc("process_storefront_order", rpcPayload);

        if (!rpcErr && rpcData?.success) {
          // Persist meta_tracking in order's attribution for delayed CAPI purchase upon admin confirmation
          let currentAttr: Record<string, any> = {};
          try {
            const { data: currentOrderRow } = await client
              .from("orders")
              .select("attribution")
              .eq("id", rpcData.order_id)
              .maybeSingle();

            currentAttr =
              currentOrderRow?.attribution && typeof currentOrderRow.attribution === "object"
                ? currentOrderRow.attribution
                : {};

            await client
              .from("orders")
              .update({
                attribution: {
                  ...currentAttr,
                  meta_tracking: {
                    ...(currentAttr.meta_tracking || {}),
                    ...metaTracking,
                  },
                },
              })
              .eq("id", rpcData.order_id);
          } catch (attrErr) {
            console.warn("[Storefront Order] Failed to update attribution with meta_tracking:", attrErr);
          }

          // Trigger Outbox Background Notification Job (Inngest event with transactional guarantee)
          if (rpcData.status === "pending" || rpcData.status === "confirmed") {
            enqueueAndDispatch({
              eventName: "order.created",
              aggregateType: "order",
              aggregateId: rpcData.order_id,
              idempotencyKey: `order.created:${rpcData.order_id}`,
              payload: {
                orderId: rpcData.order_id,
                orderNumber: rpcData.order_number,
                customerName: rpcData.customer_name || payload.customerName || "Customer",
                customerPhone: rpcData.phone || normalizedPhone,
                deliveryZone: rpcData.delivery_zone || payload.deliveryZone,
                address: {
                  address_line: payload.addressLine,
                  district: payload.district,
                  division: payload.division,
                },
                courierName: payload.courierName,
                items: resolvedItems.map((item) => ({
                  productName: item.productName || "খেজুরের খাঁটি গুড়",
                  variantName: item.variantName || "1 Pack",
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.quantity * item.unitPrice,
                })),
                subtotal: Number(rpcData.subtotal) || rawSubtotal,
                shippingTotal: Number(rpcData.shipping_total) || baseShippingFee,
                grandTotal: Number(rpcData.grand_total) || 0,
                customerNote: payload.customerNote,
                status: rpcData.status,
                channel: "web",
              },
            }).catch((outboxErr) => {
              console.warn("[Storefront Order] Background Outbox enqueue error (RPC):", outboxErr);
            });
          } else if (rpcData.status === "incomplete_order") {
            // Transactional Outbox for incomplete draft order / abandoned lead (idempotent per order)
            enqueueAndDispatch({
              eventName: "order.incomplete",
              aggregateType: "order",
              aggregateId: rpcData.order_id,
              idempotencyKey: `order.incomplete:${rpcData.order_id}`,
              payload: {
                orderId: rpcData.order_id,
                orderNumber: rpcData.order_number,
                customerName: rpcData.customer_name || payload.customerName || undefined,
                customerPhone: rpcData.phone || normalizedPhone,
                deliveryZone: rpcData.delivery_zone || payload.deliveryZone,
                address: {
                  address_line: payload.addressLine,
                  district: payload.district,
                  division: payload.division,
                },
                courierName: payload.courierName,
                items: resolvedItems.map((item) => ({
                  productName: item.productName || "খেজুরের খাঁটি গুড়",
                  variantName: item.variantName || "1 Pack",
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.quantity * item.unitPrice,
                })),
                subtotal: Number(rpcData.subtotal) || rawSubtotal,
                shippingTotal: Number(rpcData.shipping_total) || baseShippingFee,
                grandTotal: Number(rpcData.grand_total) || 0,
                customerNote: payload.customerNote,
                status: "incomplete_order",
                channel: "web",
              },
            }).catch((outboxErr) => {
              console.warn("[Storefront Order] Background Outbox enqueue error for incomplete order:", outboxErr);
            });
          }

          return {
            success: true,
            orderId: rpcData.order_id,
            orderNumber: rpcData.order_number,
            status: rpcData.status,
            grandTotal: Number(rpcData.grand_total) || 0,
            subtotal: Number(rpcData.subtotal) || 0,
            shippingTotal: Number(rpcData.shipping_total) || 0,
            customerName: rpcData.customer_name || undefined,
            phone: rpcData.phone,
            deliveryZone: rpcData.delivery_zone || payload.deliveryZone,
            eventId: payload.eventId,
          };
        }

        // If the error was a database business validation error raised by the RPC (e.g. code P0001)
        if (rpcErr && rpcErr.code === "P0001") {
          return {
            success: false,
            error: rpcErr.message || "অর্ডার প্রক্রিয়াকরণে সমস্যা হয়েছে। ডাটাবেজে কোনো পরিবর্তন করা হয়নি।",
          };
        }
      } catch (rpcCallErr) {
        // Fall through to compensating rollback fallback
      }

      // =========================================================================
      // Tier 2: Application-Level Compensating Transaction (Saga Rollback Pattern)
      // Active if the RPC procedure has not yet been applied to the remote database.
      // Guarantees that if order_items or any subsequent step fails, all mutations
      // are immediately rolled back (deleted or restored to snapshot) so the DB
      // never retains a partial or broken order.
      // =========================================================================
      let existingOrder: {
        id: string;
        order_number: string;
        public_token?: string | null;
        status: string;
        customer_name?: string | null;
        customer_note?: string | null;
        shipping_address?: Record<string, any> | null;
        shipping_method_name?: string | null;
        shipping_total?: number | null;
        subtotal?: number | null;
        grand_total?: number | null;
      } | null = null;

      let wasPending = false;
      let wasIncomplete = false;

      if (targetStatus === "pending") {
        // Rule 1: Check for existing pending order with the same phone number to update
        const { data: foundPending } = await client
          .from("orders")
          .select("id, order_number, public_token, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total, subtotal, grand_total")
          .eq("customer_phone", normalizedPhone)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (foundPending) {
          existingOrder = foundPending;
          wasPending = true;
        } else {
          // Rule 2: Check for existing incomplete order with the same phone number to update and upgrade
          const { data: foundIncomplete } = await client
            .from("orders")
            .select("id, order_number, public_token, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total, subtotal, grand_total")
            .eq("customer_phone", normalizedPhone)
            .eq("status", "incomplete_order")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (foundIncomplete) {
            existingOrder = foundIncomplete;
            wasIncomplete = true;
          }
        }
      } else {
        if (payload.orderId && UUID_REGEX.test(payload.orderId)) {
          const { data: foundById } = await client
            .from("orders")
            .select("id, order_number, public_token, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total, subtotal, grand_total")
            .eq("id", payload.orderId)
            .maybeSingle();

          if (foundById) {
            existingOrder = foundById;
          }
        }

        if (!existingOrder) {
          const { data: foundByPhone } = await client
            .from("orders")
            .select("id, order_number, public_token, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total, subtotal, grand_total")
            .eq("customer_phone", normalizedPhone)
            .eq("status", "incomplete_order")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (foundByPhone) {
            existingOrder = foundByPhone;
          }
        }
      }

      // Explicit orderId check if not yet matched
      if (!existingOrder && payload.orderId && UUID_REGEX.test(payload.orderId)) {
        const { data: foundById } = await client
          .from("orders")
          .select("id, order_number, public_token, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total, subtotal, grand_total")
          .eq("id", payload.orderId)
          .maybeSingle();

        if (foundById) {
          existingOrder = foundById;
          if (existingOrder.status === "pending") wasPending = true;
          if (existingOrder.status === "incomplete_order") wasIncomplete = true;
        }
      }

      // Rule 3: If found order is already confirmed/shipped/delivered/etc., do not overwrite it. Treat as fresh order.
      if (existingOrder && !["incomplete_order", "pending"].includes(existingOrder.status)) {
        existingOrder = null;
        wasPending = false;
        wasIncomplete = false;
      }

      // Rule 3 check: Check for any other orders with the same phone number in DB
      const { data: allPhoneOrders } = await client
        .from("orders")
        .select("id, order_number, status, created_at, grand_total")
        .eq("customer_phone", normalizedPhone);

      const otherOrdersList = (allPhoneOrders || [])
        .filter((o: any) => !existingOrder || o.id !== existingOrder.id)
        .map((o: any) => {
          const insight = getOtherOrderInsight(o.status);
          return {
            ...o,
            note: insight.note,
            detail_summary: `other order: ${insight.statusText}, note: ${insight.note}`,
          };
        });
      const hasOtherOrders = otherOrdersList.length > 0;
      const otherOrderNumbers = otherOrdersList.map((o: any) => o.order_number);

      // Snapshot existing line items for rollback if an existing order is being updated
      let previousItemsSnapshot: any[] = [];
      if (existingOrder) {
        const { data: oldItems } = await client
          .from("order_items")
          .select("id, order_id, product_id, variant_id, sku, product_name, variant_name, quantity, unit_price")
          .eq("order_id", existingOrder.id);
        previousItemsSnapshot = oldItems || [];
      }

      // Safeguard status transitions: prevent backwards transition from pending to incomplete_order
      let finalStatus: "incomplete_order" | "pending" = targetStatus;
      if (existingOrder && existingOrder.status !== "incomplete_order" && targetStatus === "incomplete_order") {
        finalStatus = "pending";
      }

      // Strict Customer Data SSOT: only store what customer input. Never inject system defaults.
      const resolvedCustomerName =
        payload.customerName !== undefined
          ? payload.customerName.trim() || null
          : existingOrder?.customer_name || null;

      const resolvedAddressLine =
        payload.addressLine !== undefined
          ? payload.addressLine.trim() || null
          : existingOrder?.shipping_address?.address_line || null;

      const resolvedCustomerNote =
        payload.customerNote !== undefined
          ? payload.customerNote.trim() || null
          : existingOrder?.customer_note || null;

      const existingShippingAddress = existingOrder?.shipping_address;
      const resolvedDistrict =
        payload.district !== undefined
          ? (payload.district.trim() || "")
          : (existingShippingAddress?.district || "");

      const resolvedDivision =
        payload.division !== undefined
          ? (payload.division.trim() || "")
          : (existingShippingAddress?.division || "");

      const resolvedShippingMethodName =
        payload.courierName !== undefined
          ? (payload.courierName.trim() || null)
          : (existingOrder?.shipping_method_name || null);

      const resolvedShippingFee = hasItems
        ? (hasDeliveryZone ? baseShippingFee : (existingOrder?.shipping_total ?? baseShippingFee))
        : 0;

      // Mathematical consistency for Postgres check constraint orders_totals_consistent
      const cleanSubtotal = Math.max(0, Math.round(rawSubtotal * 100) / 100);
      const cleanShippingTotal = Math.max(0, Math.round(resolvedShippingFee * 100) / 100);
      const cleanDiscountTotal = 0;
      const cleanTaxTotal = 0;
      const cleanGrandTotal = Math.round(
        (cleanSubtotal - cleanDiscountTotal + cleanShippingTotal + cleanTaxTotal) * 100
      ) / 100;

      const shippingAddress: Record<string, any> = {
        phone: normalizedPhone,
        recipient_name: resolvedCustomerName || "",
        address_line: resolvedAddressLine || "",
        district: resolvedDistrict,
        division: resolvedDivision,
      };

      let orderDbId: string;
      let orderNumber: string;
      let publicToken: string | undefined;

      if (existingOrder) {
        orderDbId = existingOrder.id;
        orderNumber = existingOrder.order_number;
        publicToken = existingOrder.public_token || undefined;
        const previousStatus = existingOrder.status;

        const updatePayload: Record<string, any> = {
          status: finalStatus,
          customer_name: resolvedCustomerName,
          customer_phone: normalizedPhone,
          shipping_phone: normalizedPhone,
          shipping_address: shippingAddress,
          shipping_method_name: resolvedShippingMethodName,
          subtotal: cleanSubtotal,
          shipping_total: cleanShippingTotal,
          tax_total: cleanTaxTotal,
          discount_total: cleanDiscountTotal,
          grand_total: cleanGrandTotal,
          customer_note: resolvedCustomerNote,
          attribution: {
            source: "direct_storefront_web",
            client_timestamp: new Date().toISOString(),
            zero_items_phone_order: !hasItems,
            last_sync_status: finalStatus,
            was_pending_updated: wasPending,
            was_incomplete_upgraded: wasIncomplete,
            has_other_orders: hasOtherOrders,
            other_order_numbers: otherOrderNumbers,
            other_orders: otherOrdersList,
            meta_tracking: metaTracking,
          },
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await client
          .from("orders")
          .update(updatePayload)
          .eq("id", orderDbId);

        if (updateErr) {
          console.error("Storefront order update DB error:", updateErr);
          return {
            success: false,
            error: updateErr.message || "অর্ডার আপডেট করতে সমস্যা হয়েছে।",
          };
        }
      } else {
        // Create a brand new order record.
        // Omit order_number so PostgreSQL trigger trg_orders_number automatically assigns sequence.
        const dbInsertPayload: Record<string, any> = {
          status: finalStatus,
          channel: "web",
          payment_status: "unpaid",
          fulfillment_status: "unfulfilled",
          payment_method: "cod",
          currency: "BDT",
          customer_name: resolvedCustomerName,
          customer_phone: normalizedPhone,
          shipping_phone: normalizedPhone,
          shipping_address: shippingAddress,
          shipping_method_name: resolvedShippingMethodName,
          subtotal: cleanSubtotal,
          shipping_total: cleanShippingTotal,
          tax_total: cleanTaxTotal,
          discount_total: cleanDiscountTotal,
          grand_total: cleanGrandTotal,
          amount_paid: 0,
          customer_note: resolvedCustomerNote,
          attribution: {
            source: "direct_storefront_web",
            client_timestamp: new Date().toISOString(),
            zero_items_phone_order: !hasItems,
            initial_status: finalStatus,
            has_other_orders: hasOtherOrders,
            other_order_numbers: otherOrderNumbers,
            other_orders: otherOrdersList,
            meta_tracking: metaTracking,
          },
        };

        const { data: orderData, error: orderErr } = await client
          .from("orders")
          .insert(dbInsertPayload)
          .select("id, order_number, public_token")
          .maybeSingle();

        if (orderErr) {
          console.error("Storefront order creation DB error:", orderErr);
          return {
            success: false,
            error: orderErr.message || "অর্ডার সম্পন্ন করতে সমস্যা হয়েছে, অনুগ্রহ করে সরাসরি ফোন করুন।",
          };
        }

        orderDbId = orderData?.id;
        orderNumber = orderData?.order_number;
        publicToken = orderData?.public_token;
      }

      // Synchronize order items if items were supplied
      if (orderDbId && resolvedItems.length > 0) {
        const candidateProdIds = resolvedItems.map((i) => i.productId).filter((id) => UUID_REGEX.test(id || ""));
        const candidateVarIds = resolvedItems.map((i) => i.variantId).filter((id) => UUID_REGEX.test(id || ""));

        const { validProdIds, validVarIds, varToProdMap } = await getValidCatalogIds(
          client,
          candidateProdIds,
          candidateVarIds
        );

        const itemRows = resolvedItems.map((item) => {
          const hasValidProd = validProdIds.has(item.productId);
          const hasValidVar = validVarIds.has(item.variantId);
          const resolvedProdId = hasValidProd
            ? item.productId
            : (hasValidVar ? varToProdMap.get(item.variantId) || null : null);

          const cleanSku =
            (item.variantName || item.productName || "ITEM")
              .replace(/[^a-zA-Z0-9]/g, "")
              .slice(0, 10)
              .toUpperCase() || "STD";

          const row: Record<string, any> = {
            order_id: orderDbId,
            sku: `GUR-${cleanSku}`,
            product_name: item.productName || "খেজুরের খাঁটি গুড়",
            variant_name: item.variantName || "1 Pack",
            quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
            unit_price: Math.max(0, Number(item.unitPrice) || 0),
          };

          if (resolvedProdId) row.product_id = resolvedProdId;
          if (hasValidVar) row.variant_id = item.variantId;
          return row;
        });

        // If updating an existing order, clean up old items first
        if (existingOrder) {
          await client.from("order_items").delete().eq("order_id", orderDbId);
        }

        const { error: itemsErr } = await client.from("order_items").insert(itemRows);
        if (itemsErr) {
          console.error("Storefront order items insert error, triggering compensating rollback:", itemsErr);

          if (!existingOrder) {
            // Compensating rollback for brand new order: Delete the order row completely
            await client.from("orders").delete().eq("id", orderDbId);
            return {
              success: false,
              error: "অর্ডার আইটেম সংরক্ষণ করতে সমস্যা হয়েছে। ডাটাবেজে কোনো অসম্পূর্ণ তথ্য রাখা হয়নি।",
            };
          } else {
            // Compensating rollback for existing order: Restore pre-update order snapshot and line items
            await client
              .from("orders")
              .update({
                status: existingOrder.status,
                customer_name: existingOrder.customer_name,
                shipping_address: existingOrder.shipping_address,
                shipping_method_name: existingOrder.shipping_method_name,
                shipping_total: existingOrder.shipping_total,
                subtotal: existingOrder.subtotal,
                grand_total: existingOrder.grand_total,
                customer_note: existingOrder.customer_note,
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderDbId);

            await client.from("order_items").delete().eq("order_id", orderDbId);
            if (previousItemsSnapshot.length > 0) {
              await client.from("order_items").insert(previousItemsSnapshot);
            }

            return {
              success: false,
              error: "অর্ডার আইটেম আপডেট করতে সমস্যা হয়েছে। পূর্বের ডাটা অপরিবর্তিত রাখা হয়েছে।",
            };
          }
        }
      }

      // Events logging for Rules 1 and 2 (Timeline status audit, no automated order_notes)
      if (wasIncomplete && finalStatus === "pending") {
        Promise.resolve(
          client.from("order_events").insert({
            order_id: orderDbId,
            event_type: "status_change",
            from_value: "incomplete_order",
            to_value: "pending",
            message: `গ্রাহক ওয়েবসাইট থেকে অর্ডার নিশ্চিত করেছেন (${resolvedItems.length}টি আইটেম, মোট ৳${cleanGrandTotal})`,
          })
        ).catch(() => {});
      } else if (wasPending && finalStatus === "pending") {
        Promise.resolve(
          client.from("order_events").insert({
            order_id: orderDbId,
            event_type: "updated",
            to_value: "pending",
            message: `গ্রাহক পেন্ডিং অর্ডার আপডেট করেছেন (${resolvedItems.length}টি আইটেম, মোট ৳${cleanGrandTotal})`,
          })
        ).catch(() => {});
      }

      // Trigger Outbox Background Notification Job (Tier 2 fallback path)
      if (finalStatus === "pending") {
        enqueueAndDispatch({
          eventName: "order.created",
          aggregateType: "order",
          aggregateId: orderDbId,
          idempotencyKey: `order.created:${orderDbId}`,
          payload: {
            orderId: orderDbId,
            orderNumber: orderNumber,
            customerName: resolvedCustomerName || undefined,
            customerPhone: normalizedPhone,
            deliveryZone: payload.deliveryZone,
            address: {
              address_line: resolvedAddressLine || undefined,
              district: resolvedDistrict || undefined,
              division: resolvedDivision || undefined,
            },
            courierName: resolvedShippingMethodName || undefined,
            items: resolvedItems.map((item) => ({
              productName: item.productName || "খেজুরের খাঁটি গুড়",
              variantName: item.variantName || "1 Pack",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
            })),
            subtotal: cleanSubtotal,
            shippingTotal: cleanShippingTotal,
            grandTotal: cleanGrandTotal,
            customerNote: resolvedCustomerNote || undefined,
            status: finalStatus,
            channel: "web",
            hasOtherOrders,
            otherOrderNumbers,
          },
        }).catch((outboxErr) => {
          console.warn("[Storefront Order] Background Outbox enqueue error (Tier 2):", outboxErr);
        });
      } else if (finalStatus === "incomplete_order") {
        // Transactional Outbox for incomplete draft order (Tier 2)
        enqueueAndDispatch({
          eventName: "order.incomplete",
          aggregateType: "order",
          aggregateId: orderDbId,
          idempotencyKey: `order.incomplete:${orderDbId}`,
          payload: {
            orderId: orderDbId,
            orderNumber: orderNumber,
            customerName: resolvedCustomerName || undefined,
            customerPhone: normalizedPhone,
            deliveryZone: payload.deliveryZone,
            address: {
              address_line: resolvedAddressLine || undefined,
              district: resolvedDistrict || undefined,
              division: resolvedDivision || undefined,
            },
            courierName: resolvedShippingMethodName || undefined,
            items: resolvedItems.map((item) => ({
              productName: item.productName || "খেজুরের খাঁটি গুড়",
              variantName: item.variantName || "1 Pack",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
            })),
            subtotal: cleanSubtotal,
            shippingTotal: cleanShippingTotal,
            grandTotal: cleanGrandTotal,
            customerNote: resolvedCustomerNote || undefined,
            status: "incomplete_order",
            channel: "web",
            hasOtherOrders,
            otherOrderNumbers,
          },
        }).catch((outboxErr) => {
          console.warn("[Storefront Order] Background Outbox enqueue error for incomplete order (Tier 2):", outboxErr);
        });
      }

      return {
        success: true,
        orderId: orderDbId,
        orderNumber: orderNumber,
        publicToken: publicToken,
        status: finalStatus,
        grandTotal: cleanGrandTotal,
        subtotal: cleanSubtotal,
        shippingTotal: cleanShippingTotal,
        customerName: resolvedCustomerName || undefined,
        phone: normalizedPhone,
        deliveryZone: payload.deliveryZone,
        eventId: payload.eventId,
      };
    } catch (err: any) {
      console.error("Unexpected error in placeStorefrontOrderAction:", err);
      return {
        success: false,
        error: err.message || "একটি অনাকাঙ্ক্ষিত ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
      };
    }
  });
}

/**
 * Dedicated server action to silently record or update an incomplete draft order.
 * Uses Inngest keyed debouncing (1.5s per phone) to absorb rapid typing and prevent DB thrashing.
 */
export async function syncStorefrontIncompleteOrderAction(
  payload: Omit<StorefrontOrderPayload, "status">
): Promise<StorefrontOrderResult> {
  try {
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      name: "order.draft.autosave",
      data: {
        orderId: payload.orderId,
        customerPhone: payload.customerPhone,
        customerName: payload.customerName,
        addressLine: payload.addressLine,
        deliveryZone: payload.deliveryZone,
        customerNote: payload.customerNote,
        items: payload.items,
      },
    });

    return {
      success: true,
      orderId: payload.orderId,
      status: "incomplete_order",
    };
  } catch (err) {
    // Graceful fallback to direct synchronous execution if Inngest is offline
    console.warn("[syncStorefrontIncompleteOrderAction] Inngest queue fallback to direct:", err);
    return placeStorefrontOrderAction({
      ...payload,
      status: "incomplete_order",
    });
  }
}

export interface AssistedPhoneOrderPayload {
  orderId?: string;
  customerPhone: string;
  customerName?: string;
  customerNote?: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka";
  items?: StorefrontOrderItem[];
}

/**
 * Dedicated server action for visitors who don't understand the ordering system
 * or cannot complete checkout online. Submits customer phone number with pending status.
 * Strictly stores only customer inputs without injecting default/synthetic text.
 */
export async function submitAssistedPhoneOrderAction(
  payload: AssistedPhoneOrderPayload
): Promise<StorefrontOrderResult> {
  return placeStorefrontOrderAction({
    orderId: payload.orderId,
    status: "pending",
    customerPhone: payload.customerPhone,
    customerName: payload.customerName?.trim() || undefined,
    customerNote: payload.customerNote?.trim() || undefined,
    deliveryZone: payload.deliveryZone,
    addressLine: undefined,
    items: payload.items || [],
  });
}
