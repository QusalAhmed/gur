import { parseBdPhone } from "@/lib/phone";

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
  productName: string;
  price?: number;
  currency?: string;
  eventId?: string;
}

/**
 * Standard ViewContent event.
 * Fired when a customer views / dwells on a product card.
 * Returns the eventId for CAPI deduplication.
 */
export const trackViewContent = ({
  productId,
  productName,
  price,
  currency = "BDT",
  eventId: customEventId,
}: ViewContentParams): string => {
  const safePrice = Number(price) || 0;
  const eventId = customEventId || generateEventId();

  fbq(
    "track",
    "ViewContent",
    {
      content_name: productName,
      content_ids: [String(productId)],
      content_type: "product",
      contents: [
        {
          id: String(productId),
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

  fbq(
    "track",
    "AddToCart",
    {
      content_name: productName,
      content_ids: [String(productId)],
      content_type: "product",
      contents: [
        {
          id: String(productId),
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

export interface UserPropertiesParams {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  externalId?: string | null;
  eventId?: string;
  customData?: Record<string, any>;
  skipCapi?: boolean;
  testEventCode?: string;
}

const SESSION_STORAGE_TRACKED_PHONES_KEY = "fb_tracked_user_prop_phones";

// In-memory set of normalized phone numbers tracked in this runtime
const trackedPhoneNumbers = new Set<string>();

/**
 * Checks if a phone number has already had UserProperties dispatched in this session.
 */
function isPhoneAlreadyTracked(normalizedPhone: string): boolean {
  if (trackedPhoneNumbers.has(normalizedPhone)) {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_TRACKED_PHONES_KEY);
      if (raw) {
        const stored: string[] = JSON.parse(raw);
        if (Array.isArray(stored) && stored.includes(normalizedPhone)) {
          trackedPhoneNumbers.add(normalizedPhone);
          return true;
        }
      }
    } catch {
      // Safe fallback if sessionStorage is inaccessible
    }
  }
  return false;
}

/**
 * Marks a phone number as tracked both in memory and sessionStorage.
 */
function markPhoneAsTracked(normalizedPhone: string): void {
  trackedPhoneNumbers.add(normalizedPhone);
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_TRACKED_PHONES_KEY);
      const stored: string[] = raw ? JSON.parse(raw) : [];
      if (!stored.includes(normalizedPhone)) {
        stored.push(normalizedPhone);
        sessionStorage.setItem(
          SESSION_STORAGE_TRACKED_PHONES_KEY,
          JSON.stringify(stored)
        );
      }
    } catch {
      // Safe fallback
    }
  }
}

/**
 * Clears the session tracked phone numbers cache.
 */
export const clearTrackedUserPropertyPhones = () => {
  trackedPhoneNumbers.clear();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_TRACKED_PHONES_KEY);
    } catch {
      // Safe fallback
    }
  }
};

let lastTrackedUserPropertiesKey: string | null = null;

/**
 * Resets the tracked user properties signature.
 */
export const resetUserPropertiesTracking = () => {
  lastTrackedUserPropertiesKey = null;
};

/**
 * Tracks UserProperties event both in browser (via Meta Pixel) and server (via Meta CAPI).
 * - Client-side: Updates pixel Advanced Matching state (fbq setUserProperties) AND fires
 *   fbq("trackCustom", "UserProperties", properties, { eventID: eventId }) so Meta receives
 *   a distinct browser event with matching eventID.
 * - Server-side: Dispatches sendCapiUserPropertiesAction with the matching eventId.
 * - Result: Meta deduplicates the browser UserProperties event with the CAPI event.
 * Returns { eventId, fired: boolean }.
 */
export const trackUserProperties = ({
  phone,
  email,
  name,
  externalId,
  eventId: customEventId,
  customData,
  skipCapi = false,
  testEventCode,
}: UserPropertiesParams): { eventId: string | null; fired: boolean } => {
  if (typeof window === "undefined") return { eventId: null, fired: false };

  let formattedPhone: string | null = null;
  if (phone) {
    const parsed = parseBdPhone(phone);
    if (parsed.isValid) {
      formattedPhone = parsed.normalized.replace(/^\+/, "");
    }
  }

  // If phone was provided but is not a valid Bangladeshi phone, and no email/name/externalId,
  // do not fire to avoid sending invalid tracking signals
  if (phone && !formattedPhone && !email && !name && !externalId) {
    return { eventId: null, fired: false };
  }

  // CRITICAL: Don't send multiple UserProperties events for the same phone number for pixel and capi
  if (formattedPhone && isPhoneAlreadyTracked(formattedPhone)) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[Facebook Pixel] Skipping duplicate UserProperties event for phone: ${formattedPhone}`
      );
    }
    return { eventId: null, fired: false };
  }

  // Compute a deterministic key to avoid spamming duplicate events on repeated blur events
  const trackingKey = `${formattedPhone || ""}|${email || ""}|${name || ""}|${externalId || ""}`;
  if (!trackingKey.replace(/\|/g, "")) {
    return { eventId: null, fired: false };
  }

  if (trackingKey === lastTrackedUserPropertiesKey) {
    return { eventId: null, fired: false };
  }

  lastTrackedUserPropertiesKey = trackingKey;

  // Mark this phone number as tracked so it will NEVER be sent again
  if (formattedPhone) {
    markPhoneAsTracked(formattedPhone);
  }

  const eventId = customEventId || generateEventId();

  const properties: Record<string, any> = {
    ...(customData || {}),
  };
  if (formattedPhone) properties.ph = formattedPhone;
  if (email) properties.em = email.trim().toLowerCase();
  if (name) properties.fn = name.trim();
  if (externalId) properties.external_id = externalId.trim();

  // Fire single browser custom UserProperties event with matching eventID for CAPI deduplication.
  // (Do NOT call fbq("setUserProperties") here as that internally dispatches an extra UserProperties event, causing pixel to fire twice)
  fbq("trackCustom", "UserProperties", properties, { eventID: eventId });

  // 3. Dispatch server-side CAPI event with matching eventId (fire-and-forget safe)
  if (!skipCapi) {
    const { fbp, fbc } = getClientFbpAndFbc();
    const currentUrl = typeof window !== "undefined" ? window.location.href : undefined;

    let effectiveTestCode = testEventCode;
    if (!effectiveTestCode && typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        effectiveTestCode =
          urlParams.get("test_event_code") ||
          (window as any).__fb_test_event_code ||
          undefined;
      } catch {
        // Safe ignore
      }
    }

    import("@/actions/facebook-capi")
      .then(({ sendCapiUserPropertiesAction }) => {
        sendCapiUserPropertiesAction({
          eventId,
          phone: formattedPhone || phone || null,
          email: email || null,
          name: name || null,
          externalId: externalId || null,
          url: currentUrl,
          fbp,
          fbc,
          customData,
          testEventCode: effectiveTestCode,
        }).catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("[Facebook Pixel/CAPI] sendCapiUserPropertiesAction error:", err);
          }
        });
      })
      .catch((importErr) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Facebook Pixel/CAPI] Failed to import CAPI action:", importErr);
        }
      });
  }

  return { eventId, fired: true };
};

/**
 * Sets customer phone for Advanced Matching via setUserProperties
 * AND sends deduplicated UserProperties event via browser pixel and CAPI.
 * ONLY sends when the phone is a completely valid Bangladeshi mobile number.
 */
export const setPixelUserPhone = (rawPhone?: string | null, customEventId?: string) => {
  return trackUserProperties({
    phone: rawPhone,
    eventId: customEventId,
  });
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
    if (phone) {
      setPixelUserPhone(phone);
    }
    return { eventId: null, fired: false };
  }

  // Update signature to current cart signature so it will not fire again until the cart changes
  lastInitiateCheckoutCartSignature = currentCartSignature;

  const safeValue = Number(value) || 0;
  const eventId = customEventId || generateEventId();

  // If phone is provided, only set user properties if it is a completely valid phone number
  if (phone) {
    setPixelUserPhone(phone);
  }

  const totalQuantity = safeItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  const params: Record<string, any> = {
    content_ids: safeItems.map((item) => String(item.productId)),
    content_type: "product",
    contents: safeItems.map((item) => ({
      id: String(item.productId),
      quantity: Number(item.quantity) || 1,
      item_price: Number(item.unitPrice) || 0,
    })),
    num_items: totalQuantity,
    quantity: totalQuantity,
    value: safeValue,
    currency,
  };

  fbq("track", "InitiateCheckout", params, { eventID: eventId });

  return { eventId, fired: true };
};
