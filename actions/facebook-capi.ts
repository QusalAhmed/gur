"use server";

import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import {
  sendCapiEvents,
  formatPhoneForMeta,
  isServerPhoneAlreadyTracked,
  markServerPhoneAsTracked,
  type CapiUserData,
  type CapiCustomData,
  type CapiContentItem,
} from "@/lib/facebook-capi";

/**
 * Extracts incoming request headers and cookies for CAPI user data.
 */
async function getRequestContext(
  clientUserData?: Partial<CapiUserData>,
  clientUrl?: string
): Promise<{ userData: CapiUserData; eventSourceUrl?: string }> {
  let fbp = clientUserData?.fbp;
  let fbc = clientUserData?.fbc;
  let clientIp = clientUserData?.client_ip_address;
  let userAgent = clientUserData?.client_user_agent;
  let resolvedUrl = clientUrl;

  try {
    const cookieStore = await cookies();
    if (!fbp) fbp = cookieStore.get("_fbp")?.value;
    if (!fbc) fbc = cookieStore.get("_fbc")?.value;
  } catch {
    // Ignore if cookies cannot be accessed
  }

  try {
    const headerStore = await headers();
    if (!userAgent) {
      userAgent = headerStore.get("user-agent") || undefined;
    }
    if (!clientIp) {
      const forwardedFor = headerStore.get("x-forwarded-for");
      if (forwardedFor) {
        clientIp = forwardedFor.split(",")[0].trim();
      } else {
        clientIp = headerStore.get("x-real-ip") || undefined;
      }
    }
    if (!resolvedUrl) {
      resolvedUrl = headerStore.get("referer") || undefined;
    }
  } catch {
    // Ignore if headers cannot be accessed
  }

  return {
    userData: {
      ph: clientUserData?.ph || null,
      em: clientUserData?.em || null,
      fn: clientUserData?.fn || null,
      ln: clientUserData?.ln || null,
      external_id: clientUserData?.external_id || null,
      ct: clientUserData?.ct || null,
      st: clientUserData?.st || null,
      zp: clientUserData?.zp || null,
      country: clientUserData?.country || null,
      client_ip_address: clientIp || null,
      client_user_agent: userAgent || null,
      fbp: fbp || null,
      fbc: fbc || null,
    },
    eventSourceUrl: resolvedUrl,
  };
}

/**
 * Server action to send PageView event to Meta CAPI.
 * Non-blocking, fire-and-forget safe.
 */
export async function sendCapiPageViewAction(params: {
  eventId: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  try {
    const { userData, eventSourceUrl } = await getRequestContext(
      { fbp: params.fbp, fbc: params.fbc },
      params.url
    );

    return await sendCapiEvents([
      {
        eventName: "PageView",
        eventId: params.eventId,
        eventSourceUrl,
        userData,
      },
    ]);
  } catch (err: any) {
    console.error("[CAPI Action] sendCapiPageViewAction error:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Server action to send ViewContent event to Meta CAPI.
 */
export async function sendCapiViewContentAction(params: {
  eventId: string;
  productId: string;
  productName: string;
  price?: number;
  currency?: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  try {
    const { userData, eventSourceUrl } = await getRequestContext(
      { fbp: params.fbp, fbc: params.fbc },
      params.url
    );

    const safePrice = Number(params.price) || 0;

    return await sendCapiEvents([
      {
        eventName: "ViewContent",
        eventId: params.eventId,
        eventSourceUrl,
        userData,
        customData: {
          content_name: params.productName,
          content_ids: [String(params.productId)],
          content_type: "product",
          value: safePrice,
          currency: params.currency || "BDT",
        },
      },
    ]);
  } catch (err: any) {
    console.error("[CAPI Action] sendCapiViewContentAction error:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Server action to send AddToCart event to Meta CAPI.
 */
export async function sendCapiAddToCartAction(params: {
  eventId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  currency?: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  try {
    const { userData, eventSourceUrl } = await getRequestContext(
      { fbp: params.fbp, fbc: params.fbc },
      params.url
    );

    const safePrice = Number(params.price) || 0;
    const safeQuantity = Number(params.quantity) || 1;
    const lineTotal = safePrice * safeQuantity;

    return await sendCapiEvents([
      {
        eventName: "AddToCart",
        eventId: params.eventId,
        eventSourceUrl,
        userData,
        customData: {
          content_name: params.productName,
          content_ids: [String(params.productId)],
          content_type: "product",
          contents: [
            {
              id: String(params.productId),
              quantity: safeQuantity,
              item_price: safePrice,
            },
          ],
          num_items: safeQuantity,
          value: lineTotal,
          currency: params.currency || "BDT",
        },
      },
    ]);
  } catch (err: any) {
    console.error("[CAPI Action] sendCapiAddToCartAction error:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Server action to send InitiateCheckout event to Meta CAPI.
 */
export async function sendCapiInitiateCheckoutAction(params: {
  eventId: string;
  items: {
    productId: string;
    variantId?: string;
    productName?: string;
    quantity: number;
    unitPrice?: number;
  }[];
  value: number;
  phone?: string | null;
  currency?: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  try {
    const { userData, eventSourceUrl } = await getRequestContext(
      {
        ph: params.phone || null,
        fbp: params.fbp,
        fbc: params.fbc,
      },
      params.url
    );

    const safeItems = Array.isArray(params.items) ? params.items : [];
    const contents: CapiContentItem[] = safeItems.map((item) => ({
      id: String(item.productId),
      quantity: Number(item.quantity) || 1,
      item_price: Number(item.unitPrice) || 0,
    }));

    const totalQuantity = safeItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    return await sendCapiEvents([
      {
        eventName: "InitiateCheckout",
        eventId: params.eventId,
        eventSourceUrl,
        userData,
        customData: {
          content_ids: safeItems.map((item) => String(item.productId)),
          content_type: "product",
          contents,
          num_items: totalQuantity,
          value: Number(params.value) || 0,
          currency: params.currency || "BDT",
        },
      },
    ]);
  } catch (err: any) {
    console.error("[CAPI Action] sendCapiInitiateCheckoutAction error:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Server action to send Purchase event to Meta CAPI.
 */
export async function sendCapiPurchaseAction(params: {
  eventId: string;
  orderId?: string;
  orderNumber?: string;
  items: {
    productId: string;
    variantId?: string;
    productName?: string;
    quantity: number;
    unitPrice?: number;
  }[];
  value: number;
  phone: string;
  currency?: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  try {
    const { userData, eventSourceUrl } = await getRequestContext(
      {
        ph: params.phone,
        fbp: params.fbp,
        fbc: params.fbc,
      },
      params.url
    );

    const safeItems = Array.isArray(params.items) ? params.items : [];
    const contents: CapiContentItem[] = safeItems.map((item) => ({
      id: String(item.productId),
      quantity: Number(item.quantity) || 1,
      item_price: Number(item.unitPrice) || 0,
    }));

    const totalQuantity = safeItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    return await sendCapiEvents([
      {
        eventName: "Purchase",
        eventId: params.eventId,
        eventSourceUrl,
        userData,
        customData: {
          content_ids: safeItems.map((item) => String(item.productId)),
          content_type: "product",
          contents,
          num_items: totalQuantity,
          value: Number(params.value) || 0,
          currency: params.currency || "BDT",
          order_id: params.orderNumber || params.orderId,
        },
      },
    ]);
  } catch (err: any) {
    console.error("[CAPI Action] sendCapiPurchaseAction error:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Server action to send UserProperties event to Meta CAPI.
 * Deduplicates with browser-side UserProperties event using matching eventId.
 * Non-blocking, fire-and-forget safe.
 */
export async function sendCapiUserPropertiesAction(params: {
  eventId: string;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  externalId?: string | null;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
  customData?: Record<string, any>;
  testEventCode?: string;
}) {
  try {
    const metaPhone = formatPhoneForMeta(params.phone);
    if (metaPhone && isServerPhoneAlreadyTracked(metaPhone)) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[Facebook CAPI] Skipping duplicate UserProperties event for phone: ${metaPhone}`
        );
      }
      return { success: true, skipped: true, reason: "Duplicate phone already sent to CAPI" };
    }

    if (metaPhone) {
      markServerPhoneAsTracked(metaPhone);
    }

    const { userData, eventSourceUrl } = await getRequestContext(
      {
        ph: params.phone,
        em: params.email,
        fn: params.name,
        external_id: params.externalId,
        fbp: params.fbp,
        fbc: params.fbc,
      },
      params.url
    );

    return await sendCapiEvents(
      [
        {
          eventName: "UserProperties",
          eventId: params.eventId,
          eventSourceUrl,
          userData,
          customData: {
            ...(params.customData || {}),
            ...(params.phone ? { phone: params.phone } : {}),
          },
        },
      ],
      params.testEventCode ? { testEventCode: params.testEventCode } : undefined
    );
  } catch (err: any) {
    console.error("[CAPI Action] sendCapiUserPropertiesAction error:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Captures request context (cookies, headers, IP, user agent, URL) to store
 * inside order attribution metadata at checkout time for delayed CAPI purchase.
 */
export async function captureStorefrontMetaTracking(payload?: {
  eventId?: string;
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
}): Promise<Record<string, any>> {
  let fbp = payload?.fbp;
  let fbc = payload?.fbc;
  let clientIp: string | undefined;
  let userAgent: string | undefined;
  let resolvedUrl = payload?.eventSourceUrl;

  try {
    const cookieStore = await cookies();
    if (!fbp) fbp = cookieStore.get("_fbp")?.value;
    if (!fbc) fbc = cookieStore.get("_fbc")?.value;
  } catch {
    // Ignore if cookies cannot be accessed
  }

  try {
    const headerStore = await headers();
    if (!userAgent) {
      userAgent = headerStore.get("user-agent") || undefined;
    }
    if (!clientIp) {
      const forwardedFor = headerStore.get("x-forwarded-for");
      if (forwardedFor) {
        clientIp = forwardedFor.split(",")[0].trim();
      } else {
        clientIp = headerStore.get("x-real-ip") || undefined;
      }
    }
    if (!resolvedUrl) {
      resolvedUrl = headerStore.get("referer") || undefined;
    }
  } catch {
    // Ignore if headers cannot be accessed
  }

  return {
    event_id: payload?.eventId || ("evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11)),
    fbp: fbp || null,
    fbc: fbc || null,
    event_source_url: resolvedUrl || null,
    client_ip_address: clientIp || null,
    client_user_agent: userAgent || null,
    created_at: new Date().toISOString(),
    purchase_event_sent_at: null,
    purchase_event_id: null,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFIRMED_PURCHASE_ELIGIBLE_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "partially_delivered",
];

/**
 * Triggers Meta CAPI Purchase event when an admin changes the status of an order
 * to 'confirmed' (or forward progression).
 * - Reads customer data, final line items, and grand total from the database.
 * - Uses stored storefront meta_tracking (fbp, fbc, event_source_url, IP, user-agent).
 * - Enforces strict one-time dispatch via attribution.meta_tracking.purchase_event_sent_at.
 * - Non-blocking and fire-and-forget safe.
 */
export async function triggerCapiPurchaseOnOrderConfirmedAction(
  orderIdentifier: string
): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  eventId?: string;
  error?: string;
}> {
  if (!orderIdentifier || !orderIdentifier.trim()) {
    return { success: false, error: "Missing orderIdentifier" };
  }

  try {
    const cleanId = orderIdentifier.trim();
    const client = supabaseAdmin || supabase;

    let query = client
      .from("orders")
      .select(
        "id, order_number, status, grand_total, customer_name, customer_phone, shipping_phone, shipping_address, currency, attribution, order_items(id, product_id, sku, product_name, variant_name, quantity, unit_price, line_total)"
      );

    if (UUID_REGEX.test(cleanId)) {
      query = query.eq("id", cleanId);
    } else {
      query = query.eq("order_number", cleanId);
    }

    const { data: orderRow, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !orderRow) {
      return {
        success: false,
        error: fetchErr?.message || `Order '${cleanId}' not found in database.`,
      };
    }

    // 1. Verify status eligibility
    if (!CONFIRMED_PURCHASE_ELIGIBLE_STATUSES.includes(orderRow.status)) {
      return {
        success: true,
        skipped: true,
        reason: `Order status '${orderRow.status}' is not eligible for Purchase event.`,
      };
    }

    // 2. Strict One-Time Guard: Check if Purchase event has already been sent
    const attr =
      orderRow.attribution && typeof orderRow.attribution === "object"
        ? (orderRow.attribution as Record<string, any>)
        : {};
    const metaTracking =
      attr.meta_tracking && typeof attr.meta_tracking === "object"
        ? (attr.meta_tracking as Record<string, any>)
        : {};

    if (metaTracking.purchase_event_sent_at) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[Facebook CAPI] Skipping Purchase event for order ${orderRow.order_number || orderRow.id}: already sent at ${metaTracking.purchase_event_sent_at}`
        );
      }
      return {
        success: true,
        skipped: true,
        reason: `Purchase event already sent at ${metaTracking.purchase_event_sent_at}`,
        eventId: metaTracking.purchase_event_id,
      };
    }

    // 3. Prepare payload using up-to-date order details
    const eventId =
      metaTracking.event_id ||
      ("evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11));

    const phone = orderRow.customer_phone || orderRow.shipping_phone;
    const orderItems = Array.isArray(orderRow.order_items) ? orderRow.order_items : [];

    const contents: CapiContentItem[] = orderItems.map((item: any) => ({
      id: String(item.product_id || item.sku || item.id),
      quantity: Number(item.quantity) || 1,
      item_price: Number(item.unit_price) || 0,
    }));

    const totalQuantity = orderItems.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0
    );

    const safeValue = Number(orderRow.grand_total) || 0;
    const currency = (orderRow.currency || "BDT").trim().toUpperCase();

    // Parse customer name into first name and last name
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (orderRow.customer_name) {
      const nameParts = orderRow.customer_name.trim().split(/\s+/);
      if (nameParts.length > 1) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      } else {
        firstName = nameParts[0];
      }
    }

    const address =
      orderRow.shipping_address && typeof orderRow.shipping_address === "object"
        ? (orderRow.shipping_address as Record<string, any>)
        : {};

    const userData: CapiUserData = {
      ph: phone || null,
      fn: firstName || null,
      ln: lastName || null,
      ct: address.district ? String(address.district).trim().toLowerCase() : null,
      st: address.division ? String(address.division).trim().toLowerCase() : null,
      country: "bd",
      fbp: metaTracking.fbp || null,
      fbc: metaTracking.fbc || null,
      client_ip_address: metaTracking.client_ip_address || null,
      client_user_agent: metaTracking.client_user_agent || null,
    };

    const capiResult = await sendCapiEvents([
      {
        eventName: "Purchase",
        eventId,
        eventSourceUrl: metaTracking.event_source_url || undefined,
        userData,
        customData: {
          content_ids: orderItems.map((item: any) =>
            String(item.product_id || item.sku || item.id)
          ),
          content_type: "product",
          contents,
          num_items: totalQuantity,
          value: safeValue,
          currency,
          order_id: orderRow.order_number || orderRow.id,
        },
      },
    ]);

    // 4. Record timestamp and event ID in attribution.meta_tracking
    const nowIso = new Date().toISOString();
    const updatedMetaTracking = {
      ...metaTracking,
      event_id: eventId,
      purchase_event_sent_at: capiResult.success ? nowIso : null,
      purchase_event_id: eventId,
      purchase_event_error: capiResult.success
        ? null
        : capiResult.error || "CAPI dispatch failed",
      purchase_dispatched_at: nowIso,
    };

    try {
      await client
        .from("orders")
        .update({
          attribution: {
            ...attr,
            meta_tracking: updatedMetaTracking,
          },
        })
        .eq("id", orderRow.id);
    } catch (saveErr) {
      console.warn(
        `[Facebook CAPI] Failed to update purchase_event_sent_at for order ${orderRow.order_number}:`,
        saveErr
      );
    }

    return {
      success: capiResult.success,
      eventId,
      error: capiResult.error,
    };
  } catch (err: any) {
    console.error(
      `[Facebook CAPI] triggerCapiPurchaseOnOrderConfirmedAction error for ${orderIdentifier}:`,
      err
    );
    return { success: false, error: err?.message };
  }
}


