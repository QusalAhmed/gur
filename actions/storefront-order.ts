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
  orderNumber?: string;
  grandTotal?: number;
  subtotal?: number;
  shippingTotal?: number;
  customerName?: string;
  phone?: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka";
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function placeStorefrontOrderAction(
  payload: StorefrontOrderPayload
): Promise<StorefrontOrderResult> {
  try {
    const rawPhone = (payload.customerPhone || "").trim();
    const normalizedPhone = normalizeBdPhone(rawPhone);
    // Validate BD mobile phone: only phone number is mandatory (+8801[3-9]XXXXXXXX)
    if (!normalizedPhone || !/^\+8801[3-9]\d{8}$/.test(normalizedPhone)) {
      return {
        success: false,
        error: "অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (উদা: 017XXXXXXXX)।",
      };
    }

    // Name and address are optional: provide respectful fallbacks if omitted by customer
    const customerName = (payload.customerName || "").trim() || "সম্মানিত গ্রাহক";
    const addressLine = (payload.addressLine || "").trim() || "ঠিকানা ফোনে নিশ্চিত করা হবে";

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

    if (resolvedItems.length === 0) {
      return {
        success: false,
        error: "অর্ডারে কোনো পণ্য নির্বাচন করা হয়নি।",
      };
    }

    const subtotal = Math.round(
      resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100
    ) / 100;

    const isDhaka = payload.deliveryZone === "inside_dhaka";
    const shippingFee = isDhaka ? 70 : 130;
    const grandTotal = Math.round((subtotal + shippingFee) * 100) / 100;

    const prefix = await getOrderNumberPrefix().catch(() => "MOL");
    const orderNumber = `${prefix}-2610-${Date.now().toString().slice(-5)}`;

    const client = supabaseAdmin || supabase;

    const dbInsertPayload: Record<string, any> = {
      order_number: orderNumber,
      status: "pending",
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
      customer_note: payload.customerNote?.trim() || "ওয়েবসাইট থেকে সরাসরি গ্রাহকের অর্ডার (Cash on Delivery)",
      attribution: {
        source: "direct_storefront_web",
        client_timestamp: new Date().toISOString(),
      },
    };

    // 1. Insert order
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

    const orderDbId = orderData?.id;

    // 2. Insert order items if order was saved
    if (orderDbId) {
      const itemRows = resolvedItems.map((item) => {
        const isProductUuid = UUID_REGEX.test(item.productId || "");
        const isVariantUuid = UUID_REGEX.test(item.variantId || "");

        const row: Record<string, any> = {
          order_id: orderDbId,
          product_name: item.productName,
          variant_name: item.variantName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: Math.round(item.quantity * item.unitPrice * 100) / 100,
        };

        if (isProductUuid) row.product_id = item.productId;
        if (isVariantUuid) row.variant_id = item.variantId;
        return row;
      });

      try {
        await client.from("order_items").insert(itemRows);
      } catch (err) {
        console.warn("Storefront order items insert warning:", err);
      }

      // 3. Insert order placed event
      try {
        await client.from("order_events").insert([
          {
            order_id: orderDbId,
            event_type: "placed",
            message: `ওয়েবসাইট থেকে সরাসরি অর্ডার গ্রহণ করা হয়েছে (${resolvedItems.length}টি আইটেম, ক্যাশ অন ডেলিভারি, মোট ৳${grandTotal})।`,
            actor: "Web Customer",
          },
        ]);
      } catch {
        // Safe ignore
      }
    }

    return {
      success: true,
      orderNumber: orderData?.order_number || orderNumber,
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
