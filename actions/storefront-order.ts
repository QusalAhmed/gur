"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { normalizeBdPhone, getOrderNumberPrefix } from "@/lib/supabase/api";

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
  deliveryZone: "inside_dhaka" | "outside_dhaka";
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

/**
 * Places or updates a storefront order.
 * - If status is "incomplete_order": records/updates an abandoned lead in real time.
 * - If status is "pending": finalizes the customer order.
 * - Uses hybrid deduplication: checks for existing draft by orderId or 24-hr phone match.
 */
export async function placeStorefrontOrderAction(
  payload: StorefrontOrderPayload
): Promise<StorefrontOrderResult> {
  try {
    const rawPhone = (payload.customerPhone || "").trim();
    const normalizedPhone = normalizeBdPhone(rawPhone);

    // Validate BD mobile phone: supports +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX
    if (!normalizedPhone || !/^\+8801[3-9]\d{8}$/.test(normalizedPhone)) {
      return {
        success: false,
        error: "অনুগ্রহ করে একটি সঠিক মোবাইল নম্বর দিন (উদা: 017XXXXXXXX, 1XXXXXXXXX বা +8801XXXXXXXXX)।",
      };
    }

    const targetStatus: "incomplete_order" | "pending" = payload.status || "pending";
    const isIncomplete = targetStatus === "incomplete_order";

    // Name and address: respectful fallbacks for missing optional info
    const customerName = (payload.customerName || "").trim() || (isIncomplete ? "সম্মানিত গ্রাহক (খসড়া)" : "সম্মানিত গ্রাহক");
    const addressLine = (payload.addressLine || "").trim() || (isIncomplete ? "" : "ঠিকানা ফোনে নিশ্চিত করা হবে");

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
    const subtotal = hasItems
      ? Math.round(
          resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100
        ) / 100
      : 0;

    const isDhaka = payload.deliveryZone === "inside_dhaka";
    const shippingFee = hasItems ? (isDhaka ? 70 : 130) : 0;
    const grandTotal = Math.round((subtotal + shippingFee) * 100) / 100;

    const client = supabaseAdmin || supabase;

    const customerNote = payload.customerNote?.trim()
      ? payload.customerNote.trim()
      : isIncomplete
        ? "ওয়েবসাইট থেকে খসড়া অর্ডার (Incomplete Lead - ফোনের মাধ্যমে সংগ্রহ)"
        : hasItems
          ? "ওয়েবসাইট থেকে সরাসরি গ্রাহকের অর্ডার (Cash on Delivery)"
          : "সরাসরি ফোন অর্ডারের অনুরোধ (কোনো পণ্য নির্বাচিত ছিল না - ফোনে কথা বলে পণ্য নির্ধারণ করা হবে)";

    // =========================================================================
    // Deduplication Strategy:
    // 1. Try finding by provided orderId (if UUID is valid)
    // 2. Fallback: Find recent incomplete_order with same phone in last 24 hours
    // =========================================================================
    let existingOrder: { id: string; order_number: string; status: string } | null = null;

    if (payload.orderId && UUID_REGEX.test(payload.orderId)) {
      const { data: foundById } = await client
        .from("orders")
        .select("id, order_number, status")
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
        .select("id, order_number, status")
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

    let orderDbId: string;
    let orderNumber: string;
    const isUpdatingExisting = Boolean(existingOrder);

    if (existingOrder) {
      orderDbId = existingOrder.id;
      orderNumber = existingOrder.order_number;
      const previousStatus = existingOrder.status;

      // Update the existing draft order
      const updatePayload: Record<string, any> = {
        status: targetStatus,
        customer_name: customerName,
        customer_phone: normalizedPhone,
        shipping_phone: normalizedPhone,
        shipping_address: {
          address_line: addressLine,
          district: isDhaka ? "Dhaka" : "Outside Dhaka",
          division: isDhaka ? "Dhaka" : "Bangladesh",
          recipient_name: customerName,
          phone: normalizedPhone,
        },
        shipping_method_name: isDhaka
          ? "কুরিয়ার হোম ডেলিভারি (ঢাকার ভেতরে - ৳৭০)"
          : "কুরিয়ার হোম ডেলিভারি (ঢাকার বাইরে - ৳১৩০)",
        subtotal,
        shipping_total: shippingFee,
        tax_total: 0,
        discount_total: 0,
        grand_total: grandTotal,
        customer_note: customerNote,
        attribution: {
          source: "direct_storefront_web",
          client_timestamp: new Date().toISOString(),
          zero_items_phone_order: !hasItems,
          last_sync_status: targetStatus,
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

      // Re-synchronize order items: delete old items and insert updated ones
      const { error: delErr } = await client.from("order_items").delete().eq("order_id", orderDbId);
      if (delErr) {
        console.warn("Could not delete old order items:", delErr);
      }

      // Record timeline transition event if promoting from incomplete to pending
      if (previousStatus === "incomplete_order" && targetStatus === "pending") {
        try {
          await client.from("order_events").insert([
            {
              order_id: orderDbId,
              event_type: "confirmed",
              message: `গ্রাহক খসড়া অর্ডার নিশ্চিত করেছেন (${resolvedItems.length}টি আইটেম, ক্যাশ অন ডেলিভারি, মোট ৳${grandTotal})।`,
              actor: "Web Customer",
            },
          ]);
        } catch {
          // Safe ignore
        }
      }
    } else {
      // Create a brand new order record
      const prefix = await getOrderNumberPrefix().catch(() => "MOL");
      orderNumber = `${prefix}-2610-${Date.now().toString().slice(-5)}`;

      const dbInsertPayload: Record<string, any> = {
        order_number: orderNumber,
        status: targetStatus,
        channel: "web",
        payment_status: "unpaid",
        fulfillment_status: "unfulfilled",
        payment_method: "cod",
        currency: "BDT",
        customer_name: customerName,
        customer_phone: normalizedPhone,
        shipping_phone: normalizedPhone,
        shipping_address: {
          address_line: addressLine,
          district: isDhaka ? "Dhaka" : "Outside Dhaka",
          division: isDhaka ? "Dhaka" : "Bangladesh",
          recipient_name: customerName,
          phone: normalizedPhone,
        },
        shipping_method_name: isDhaka
          ? "কুরিয়ার হোম ডেলিভারি (ঢাকার ভেতরে - ৳৭০)"
          : "কুরিয়ার হোম ডেলিভারি (ঢাকার বাইরে - ৳১৩০)",
        subtotal,
        shipping_total: shippingFee,
        tax_total: 0,
        discount_total: 0,
        grand_total: grandTotal,
        amount_paid: 0,
        customer_note: customerNote,
        attribution: {
          source: "direct_storefront_web",
          client_timestamp: new Date().toISOString(),
          zero_items_phone_order: !hasItems,
          initial_status: targetStatus,
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
      orderNumber = orderData?.order_number || orderNumber;

      // Log initial event
      try {
        const initialEventMessage = isIncomplete
          ? `ওয়েবসাইট থেকে অসম্পূর্ণ অর্ডার (Incomplete Lead) সংগৃহীত হয়েছে (ফোন: ${normalizedPhone})।`
          : hasItems
            ? `ওয়েবসাইট থেকে সরাসরি অর্ডার গ্রহণ করা হয়েছে (${resolvedItems.length}টি আইটেম, ক্যাশ অন ডেলিভারি, মোট ৳${grandTotal})।`
            : `ওয়েবসাইট থেকে ফোন অর্ডারের অনুরোধ গ্রহণ করা হয়েছে (কোনো পণ্য নির্বাচিত ছিল না)।`;

        await client.from("order_events").insert([
          {
            order_id: orderDbId,
            event_type: isIncomplete ? "draft_saved" : "placed",
            message: initialEventMessage,
            actor: "Web Customer",
          },
        ]);
      } catch {
        // Safe ignore
      }
    }

    // Insert updated order items if order was saved/updated
    if (orderDbId && resolvedItems.length > 0) {
      // First verify which candidate product_ids and variant_ids actually exist in the DB
      const candidateProdIds = resolvedItems.map((i) => i.productId).filter((id) => UUID_REGEX.test(id || ""));
      const candidateVarIds = resolvedItems.map((i) => i.variantId).filter((id) => UUID_REGEX.test(id || ""));

      let validProdIds = new Set<string>();
      let validVarIds = new Set<string>();

      if (candidateProdIds.length > 0) {
        const { data: dbProds } = await client.from("products").select("id").in("id", candidateProdIds);
        if (dbProds) {
          validProdIds = new Set(dbProds.map((p) => p.id));
        }
      }

      if (candidateVarIds.length > 0) {
        const { data: dbVars } = await client.from("product_variants").select("id").in("id", candidateVarIds);
        if (dbVars) {
          validVarIds = new Set(dbVars.map((v) => v.id));
        }
      }

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

      const { error: itemsErr } = await client.from("order_items").insert(itemRows);
      if (itemsErr) {
        console.error("Storefront order items insert error:", itemsErr);
      }
    }

    return {
      success: true,
      orderId: orderDbId,
      orderNumber: orderNumber,
      status: targetStatus,
      grandTotal,
      subtotal,
      shippingTotal: shippingFee,
      customerName,
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
 * or cannot complete checkout online. Submits customer phone number with pending status
 * and notifies admins/staff to immediately call them back and fulfill the order.
 */
export async function submitAssistedPhoneOrderAction(
  payload: AssistedPhoneOrderPayload
): Promise<StorefrontOrderResult> {
  const noteParts: string[] = [];
  if (payload.customerNote?.trim()) {
    noteParts.push(`[গ্রাহকের পছন্দ/পরিমাণ]: ${payload.customerNote.trim()}`);
  }
  noteParts.push(
    "সহজ ফোন সহায়তা অর্ডার: গ্রাহক ওয়েবসাইট সিস্টেম না বুঝে সরাসরি ফোন নম্বর জমা দিয়েছেন। অবিলম্বে ফোনে কথা বলে গুড়ের প্রকার, পরিমাণ ও ডেলিভারি ঠিকানা নিশ্চিত করুন।"
  );

  return placeStorefrontOrderAction({
    orderId: payload.orderId,
    status: "pending",
    customerPhone: payload.customerPhone,
    customerName: payload.customerName?.trim() || "সহায়তাপ্রার্থী গ্রাহক (ফোন অর্ডার)",
    customerNote: noteParts.join(" | "),
    deliveryZone: payload.deliveryZone || "inside_dhaka",
    addressLine: "সরাসরি ফোনে কথা বলে ঠিকানা নেওয়া হবে",
    items: payload.items || [],
  });
}

