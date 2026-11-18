import { parseBdPhone } from "@/lib/phone";
import {
  claritySetTag,
  clarityTrackEvent,
  clarityUpgrade,
} from "@/lib/clarity";

export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "1234708877758735";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    _fbqQueue?: any[];
  }
}

/**
 * Generates a unique UUID v4 string for event deduplication.
 */
export const generateEventId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
};

/**
 * Reads a cookie value by name from document.cookie in the browser.
 */
export const getClientCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
};

/**
 * Gets _fbp and _fbc from client cookies if available.
 */
export const getClientFbpAndFbc = (): { fbp: string | null; fbc: string | null } => {
  return {
    fbp: getClientCookie("_fbp"),
    fbc: getClientCookie("_fbc"),
  };
};

/**
 * Safe invocation of window.fbq if running in the browser
 */
export const fbq = (...args: any[]) => {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "%c[Facebook Pixel]",
      "background: #1877F2; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
      ...args
    );
  }

  if (typeof window.fbq === "function") {
    window.fbq(...args);
  } else {
    const win = window as any;
    win._fbqQueue = win._fbqQueue || [];
    win._fbqQueue.push(args);
  }
};

/**
 * Standard PageView event.
 * Automatically excludes admin panel routes.
 * Returns the eventId for CAPI deduplication.
 */
export const trackPageView = (customEventId?: string): string | null => {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin")
  ) {
    return null;
  }
  const eventId = customEventId || generateEventId();
  fbq("track", "PageView", {}, { eventID: eventId });
  return eventId;
};

export interface ViewContentParams {
  productId: string;
  variantId?: string;
  productName: string;
  price?: number;
  currency?: string;
  eventId?: string;
}

/**
 * Standard ViewContent event.
 * Fired when a customer views / dwells on a product card or lands on product page.
 * Uses variantId as primary identifier when available.
 * Returns the eventId for CAPI deduplication.
 */
export const trackViewContent = ({
  productId,
  variantId,
  productName,
  price,
  currency = "BDT",
  eventId: customEventId,
}: ViewContentParams): string => {
  const safePrice = Number(price) || 0;
  const eventId = customEventId || generateEventId();
  const targetId = String(variantId || productId);

  fbq(
    "track",
    "ViewContent",
    {
      content_name: productName,
      content_ids: [targetId],
      content_type: "product",
      contents: [
        {
          id: targetId,
          quantity: 1,
          item_price: safePrice,
        },
      ],
      value: safePrice,
      currency,
    },
    { eventID: eventId }
  );

  return eventId;
};

export interface AddToCartParams {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
  currency?: string;
  eventId?: string;
}

/**
 * Standard AddToCart event.
 * Fired when a customer adds a product/variant or increases quantity in cart.
 * Uses variantId as primary identifier when available.
 * Accurately sends current item quantity, num_items, line total value, and contents array.
 * Returns the eventId for CAPI deduplication.
 */
export const trackAddToCart = ({
  productId,
  productName,
  variantId,
  variantName,
  price,
  quantity,
  currency = "BDT",
  eventId: customEventId,
}: AddToCartParams): string => {
  const safePrice = Number(price) || 0;
  const safeQuantity = Number(quantity) || 1;
  const lineTotal = safePrice * safeQuantity;
  const eventId = customEventId || generateEventId();
  const targetId = String(variantId || productId);

  fbq(
    "track",
    "AddToCart",
    {
      content_name: productName,
      content_ids: [targetId],
      content_type: "product",
      contents: [
        {
          id: targetId,
          quantity: safeQuantity,
          item_price: safePrice,
        },
      ],
      num_items: safeQuantity,
      quantity: safeQuantity,
      value: lineTotal,
      currency,
    },
    { eventID: eventId }
  );

  clarityTrackEvent("add_to_cart");

  return eventId;
};

export interface InitiateCheckoutParams {
  items: {
    productId: string;
    variantId?: string;
    productName?: string;
    quantity: number;
    unitPrice?: number;
  }[];
  value: number;
  phone?: string;
  currency?: string;
  eventId?: string;
}

/**
 * Helper to compute deterministic cart signature from items and their quantities.
 * Returns empty string if items array is empty.
 */
export const getCartSignature = (
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice?: number;
  }>
): string => {
  if (!items || items.length === 0) return "";
  return items
    .map(
      (item) =>
        `${String(item.productId)}_${String(item.variantId || "")}_${Number(item.quantity) || 1}_${Number(item.unitPrice) || 0}`
    )
    .sort()
    .join("|");
};

let lastInitiateCheckoutCartSignature: string | null = null;

/**
 * Resets the tracked cart signature for InitiateCheckout.
 * Call this when an order is completed or cart is cleared.
 */
export const resetInitiateCheckoutTracking = () => {
  lastInitiateCheckoutCartSignature = null;
};

/**
 * Standard InitiateCheckout event.
 * Fired only when the customer types text in the order form.
 * Deduplicated against the cart's content/signature: does NOT fire again until cart changes.
 * Sends accurate item quantities (contents[].quantity, num_items, and quantity).
 * Returns { eventId, fired: true } or { eventId: null, fired: false }.
 */
export const trackInitiateCheckout = ({
  items,
  value,
  phone,
  currency = "BDT",
  eventId: customEventId,
}: InitiateCheckoutParams): { eventId: string | null; fired: boolean } => {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) return { eventId: null, fired: false };

  const currentCartSignature = getCartSignature(safeItems);

  // Don't fire initiate checkout again until cart changes
  if (currentCartSignature === lastInitiateCheckoutCartSignature) {
    return { eventId: null, fired: false };
  }

  // Update signature to current cart signature so it will not fire again until the cart changes
  lastInitiateCheckoutCartSignature = currentCartSignature;

  const safeValue = Number(value) || 0;
  const eventId = customEventId || generateEventId();

  const totalQuantity = safeItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  const params: Record<string, any> = {
    content_ids: safeItems.map((item) => String(item.variantId || item.productId)),
    content_type: "product",
    contents: safeItems.map((item) => ({
      id: String(item.variantId || item.productId),
      quantity: Number(item.quantity) || 1,
      item_price: Number(item.unitPrice) || 0,
    })),
    num_items: totalQuantity,
    quantity: totalQuantity,
    value: safeValue,
    currency,
  };

  fbq("track", "InitiateCheckout", params, { eventID: eventId });

  clarityTrackEvent("initiate_checkout");
  clarityUpgrade("initiate_checkout");

  return { eventId, fired: true };
};

export interface TrackContactParams {
  channel: "phone" | "whatsapp" | "messenger" | "imo" | "sms";
  refCode?: string;
  phone?: string | null;
  customData?: Record<string, any>;
  eventId?: string;
}

const INQUIRY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateInquiryRefSuffix(length = 6): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (b) => INQUIRY_ALPHABET[b % INQUIRY_ALPHABET.length]).join("");
  }
  let res = "";
  for (let i = 0; i < length; i++) {
    res += INQUIRY_ALPHABET[Math.floor(Math.random() * INQUIRY_ALPHABET.length)];
  }
  return res;
}

/**
 * Generates or retrieves a short, memorable inquiry reference code for WhatsApp/call leads.
 * Persists in sessionStorage so the visitor gets the same reference during their session.
 * Uses an expanded 6-character alphanumeric space to avoid visitor collisions.
 */
export const getOrGenerateInquiryRefCode = (prefix = "W"): string => {
  if (typeof window === "undefined") {
    return `#${prefix}-${generateInquiryRefSuffix(6)}`;
  }
  try {
    const key = `gur_inquiry_ref_${prefix}`;
    let stored = sessionStorage.getItem(key);
    if (!stored) {
      stored = `#${prefix}-${generateInquiryRefSuffix(6)}`;
      sessionStorage.setItem(key, stored);
    }
    return stored;
  } catch {
    return `#${prefix}-${generateInquiryRefSuffix(6)}`;
  }
};

/**
 * Tracks Contact / Lead touchpoint when visitor clicks Call, WhatsApp, or Messenger.
 * - Fires browser fbq("track", "Contact", ...)
 * - Asynchronously dispatches server CAPI Contact event with cookies & IP
 */
export const trackContact = ({
  channel,
  refCode,
  phone,
  customData,
  eventId: customEventId,
}: TrackContactParams): string => {
  const eventId = customEventId || generateEventId();

  const payload: Record<string, any> = {
    channel,
    content_name: `Contact via ${channel.toUpperCase()}`,
    content_category: "Direct Outreach",
    ...(refCode ? { ref_code: refCode } : {}),
    ...(customData || {}),
  };

  fbq("track", "Contact", payload, { eventID: eventId });

  claritySetTag("contact_channel", channel);
  clarityTrackEvent("contact_click");

  if (typeof window !== "undefined") {
    const { fbp, fbc } = getClientFbpAndFbc();
    const currentUrl = window.location.href;

    sendCapiClientEvent("Contact", {
      eventId,
      channel,
      refCode,
      phone: phone || null,
      url: currentUrl,
      fbp,
      fbc,
      customData: payload,
    });
  }

  return eventId;
};

/**
 * Dispatches a CAPI event from the browser to the /api/facebook-capi endpoint.
 * Completely decouples analytics pings from Next.js Server Actions and Router transitions,
 * preventing 'Router action dispatched before initialization' errors.
 */
export async function sendCapiClientEvent(
  eventType: string,
  params: Record<string, any>
): Promise<void> {
  if (typeof window === "undefined") return;

  const payload = { eventType, ...params };
  const jsonStr = JSON.stringify(payload);

  try {
    // If sendBeacon is available, prefer it for lightweight fire-and-forget delivery
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      jsonStr.length < 64000
    ) {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const queued = navigator.sendBeacon("/api/facebook-capi", blob);
      if (queued) return;
    }

    await fetch("/api/facebook-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonStr,
      keepalive: true,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Facebook CAPI] Failed to send ${eventType}:`, err);
    }
  }
}

export interface TrackPurchaseParams {
  orderNumber: string;
  orderId?: string;
  value: number;
  currency?: string;
  items?: Array<{
    productId?: string;
    variantId?: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
  phone?: string | null;
  eventId?: string;
  force?: boolean;
}

/**
 * Deduplicated client-side browser Purchase event.
 * Fires fbq("track", "Purchase", ...) using orderNumber as the eventID.
 * Meta deduplicates this with the server CAPI Purchase event having the same eventID.
 * Strictly checks sessionStorage to avoid double-firing on page reloads.
 */
export const trackPurchase = ({
  orderNumber,
  orderId,
  value,
  currency = "BDT",
  items = [],
  phone,
  eventId: customEventId,
  force = false,
}: TrackPurchaseParams): { eventId: string; fired: boolean } => {
  const orderRef =
    (orderNumber ? String(orderNumber).trim() : "") ||
    (orderId ? String(orderId).trim() : "");

  const effectiveEventId =
    customEventId ||
    orderRef ||
    generateEventId();

  if (typeof window !== "undefined") {
    try {
      const storageKey = `fb_pixel_purchase_${orderRef || effectiveEventId}`;
      if (sessionStorage.getItem(storageKey) && !force) {
        console.log(
          `%c[Facebook Pixel] Purchase event skipped: Already recorded in this session for order #${orderRef || effectiveEventId} (deduplicated to prevent duplicate conversion reporting). Pass ?test=1 in URL or clear sessionStorage to re-test.`,
          "color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 2px 6px; border-radius: 4px;"
        );
        return { eventId: effectiveEventId, fired: false };
      }
      sessionStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Safe fallback
    }
  }

  const safeItems = Array.isArray(items) ? items : [];
  const safeValue = Number(value) || 0;
  const totalQuantity = safeItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1),
    0
  );

  const payload: Record<string, any> = {
    content_ids: safeItems.map((item) => String(item.variantId || item.productId || "")).filter(Boolean),
    content_type: "product",
    contents: safeItems.map((item) => ({
      id: String(item.variantId || item.productId || ""),
      quantity: Number(item.quantity) || 1,
      item_price: Number(item.unitPrice) || 0,
    })),
    num_items: totalQuantity || 1,
    value: safeValue,
    currency: String(currency || "BDT").trim().toUpperCase(),
    order_id: orderRef || undefined,
  };

  console.log(
    `%c[Facebook Pixel] Firing Purchase event for order #${orderRef || effectiveEventId}:`,
    "background: #1877F2; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
    payload,
    { eventID: effectiveEventId }
  );

  fbq("track", "Purchase", payload, { eventID: effectiveEventId });

  claritySetTag("order_placed", "true");
  clarityTrackEvent("purchase");
  clarityUpgrade("purchase");

  return { eventId: effectiveEventId, fired: true };
};
