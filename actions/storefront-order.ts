"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { normalizeBdPhone } from "@/lib/supabase/api";

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
}

export interface StorefrontOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  status?: "incomplete_order" | "pending";
  grandTotal?: number;
  subtotal?: number;
  shippingTotal?: number;
  customerName?: string;
  phone?: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka";
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// In-Memory Performance Caching & Synchronization
// =============================================================================

// 1. Catalog UUID in-memory cache: prevents repeated round-trips to products / variants
let cachedValidProductIds: Set<string> | null = null;
let cachedValidVariantIds: Set<string> | null = null;
let catalogCacheExpiry = 0;

async function getValidCatalogIds(
  client: any,
  candidateProdIds: string[],
  candidateVarIds: string[]
): Promise<{ validProdIds: Set<string>; validVarIds: Set<string> }> {
  const now = Date.now();
  if (
    cachedValidProductIds &&
    cachedValidVariantIds &&
    now < catalogCacheExpiry &&
    candidateProdIds.every((id) => cachedValidProductIds!.has(id)) &&
    candidateVarIds.every((id) => cachedValidVariantIds!.has(id))
  ) {
    return {
      validProdIds: cachedValidProductIds,
      validVarIds: cachedValidVariantIds,
    };
  }

  try {
    const [prodsRes, varsRes] = await Promise.all([
      client.from("products").select("id"),
      client.from("product_variants").select("id"),
    ]);

    const pSet = new Set<string>((prodsRes.data || []).map((p: any) => p.id));
    const vSet = new Set<string>((varsRes.data || []).map((v: any) => v.id));

    cachedValidProductIds = pSet;
    cachedValidVariantIds = vSet;
    catalogCacheExpiry = now + 5 * 60 * 1000; // 5-minute memory cache

    return { validProdIds: pSet, validVarIds: vSet };
  } catch {
    return {
      validProdIds: new Set(candidateProdIds),
      validVarIds: new Set(candidateVarIds),
    };
  }
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

      // Normalize items: support both multi-item list and legacy single item
      let resolvedItems: StorefrontOrderItem[] = [];
      if (payload.items && payload.items.length > 0) {
        resolvedItems = payload.items.map((i) => ({
          productId: i.productId,
          productName: i.productName || "Pure Molasses",
          variantId: i.variantId,
          variantName: i.variantName || "1 Pack",
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
          unitPrice: Math.max(0, Number(i.unitPrice) || 0),
        }));
      } else if (payload.productId) {
        resolvedItems = [
          {
            productId: payload.productId,
            productName: payload.productName || "Pure Molasses",
            variantId: payload.variantId || "default",
            variantName: payload.variantName || "1 Pack",
            quantity: Math.max(1, Math.floor(Number(payload.quantity) || 1)),
            unitPrice: Math.max(0, Number(payload.unitPrice) || 0),
          },
        ];
      }

      const hasItems = resolvedItems.length > 0;
      const rawSubtotal = hasItems
        ? resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        : 0;

      const hasDeliveryZone = Boolean(payload.deliveryZone);
      const isDhaka = payload.deliveryZone === "inside_dhaka";
      const baseShippingFee = hasItems && hasDeliveryZone ? (isDhaka ? 70 : 130) : 0;
      const shippingMethodName = hasDeliveryZone
        ? isDhaka
          ? "কুরিয়ার হোম ডেলিভারি (ঢাকার ভেতরে - ৳৭০)"
          : "কুরিয়ার হোম ডেলিভারি (ঢাকার বাইরে - ৳১৩০)"
        : null;

      const client = supabaseAdmin || supabase;

      // =========================================================================
      // Fast Deduplication Strategy:
      // 1. If explicit orderId is given, fetch by ID directly.
      // 2. Otherwise find recent incomplete_order with same phone in last 24 hours.
      // =========================================================================
      let existingOrder: {
        id: string;
        order_number: string;
        status: string;
        customer_name?: string | null;
        customer_note?: string | null;
        shipping_address?: Record<string, any> | null;
        shipping_method_name?: string | null;
        shipping_total?: number | null;
      } | null = null;

      if (payload.orderId && UUID_REGEX.test(payload.orderId)) {
        const { data: foundById } = await client
          .from("orders")
          .select("id, order_number, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total")
          .eq("id", payload.orderId)
          .maybeSingle();

        if (foundById) {
          existingOrder = foundById;
        }
      }

      if (!existingOrder) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: foundByPhone } = await client
          .from("orders")
          .select("id, order_number, status, customer_name, customer_note, shipping_address, shipping_method_name, shipping_total")
          .eq("customer_phone", normalizedPhone)
          .eq("status", "incomplete_order")
          .gte("created_at", oneDayAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (foundByPhone) {
          existingOrder = foundByPhone;
        }
      }

      // If existing order is already confirmed/shipped/delivered/etc., do not overwrite it. Treat as fresh order.
      if (existingOrder && !["incomplete_order", "pending"].includes(existingOrder.status)) {
        existingOrder = null;
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
      const resolvedDistrict = hasDeliveryZone
        ? isDhaka
          ? "Dhaka"
          : "Outside Dhaka"
        : existingShippingAddress?.district || "";

      const resolvedDivision = hasDeliveryZone
        ? isDhaka
          ? "Dhaka"
          : "Bangladesh"
        : existingShippingAddress?.division || "";

      const resolvedShippingMethodName = hasDeliveryZone
        ? shippingMethodName
        : existingOrder?.shipping_method_name || null;

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

      if (existingOrder) {
        orderDbId = existingOrder.id;
        orderNumber = existingOrder.order_number;
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

        // Fire-and-forget transition event if promoting from incomplete to pending
        if (previousStatus === "incomplete_order" && finalStatus === "pending") {
          Promise.resolve(
            client.from("order_events").insert([
              {
                order_id: orderDbId,
                event_type: "placed",
                to_value: "pending",
                message: `গ্রাহক ওয়েবসাইট থেকে অর্ডার নিশ্চিত করেছেন (${resolvedItems.length}টি আইটেম, মোট ৳${cleanGrandTotal})`,
              },
            ])
          ).catch(() => {});
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
          },
        };

        const { data: orderData, error: orderErr } = await client
          .from("orders")
          .insert(dbInsertPayload)
          .select("id, order_number")
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
      }

      // Synchronize order items if items were supplied
      if (orderDbId && resolvedItems.length > 0) {
        const candidateProdIds = resolvedItems.map((i) => i.productId).filter((id) => UUID_REGEX.test(id || ""));
        const candidateVarIds = resolvedItems.map((i) => i.variantId).filter((id) => UUID_REGEX.test(id || ""));

        const { validProdIds, validVarIds } = await getValidCatalogIds(
          client,
          candidateProdIds,
          candidateVarIds
        );

        const itemRows = resolvedItems.map((item) => {
          const hasValidProd = validProdIds.has(item.productId);
          const hasValidVar = validVarIds.has(item.variantId);

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

          if (hasValidProd) row.product_id = item.productId;
          if (hasValidVar) row.variant_id = item.variantId;
          return row;
        });

        // If updating an existing order, clean up old items first
        if (existingOrder) {
          await client.from("order_items").delete().eq("order_id", orderDbId);
        }

        const { error: itemsErr } = await client.from("order_items").insert(itemRows);
        if (itemsErr) {
          console.error("Storefront order items insert error:", itemsErr);
        }
      }

      return {
        success: true,
        orderId: orderDbId,
        orderNumber: orderNumber,
        status: finalStatus,
        grandTotal: cleanGrandTotal,
        subtotal: cleanSubtotal,
        shippingTotal: cleanShippingTotal,
        customerName: resolvedCustomerName || undefined,
        phone: normalizedPhone,
        deliveryZone: payload.deliveryZone,
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
 */
export async function syncStorefrontIncompleteOrderAction(
  payload: Omit<StorefrontOrderPayload, "status">
): Promise<StorefrontOrderResult> {
  return placeStorefrontOrderAction({
    ...payload,
    status: "incomplete_order",
  });
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
