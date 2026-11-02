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
 */
export const trackPageView = () => {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin")
  ) {
    return;
  }
  fbq("track", "PageView");
};

export interface ViewContentParams {
  productId: string;
  productName: string;
  price?: number;
  currency?: string;
}

/**
 * Standard ViewContent event.
 * Fired when a customer views / dwells on a product card.
 */
export const trackViewContent = ({
  productId,
  productName,
  price,
  currency = "BDT",
}: ViewContentParams) => {
  const safePrice = Number(price) || 0;
  fbq("track", "ViewContent", {
    content_name: productName,
    content_ids: [String(productId)],
    content_type: "product",
    value: safePrice,
    currency,
  });
};

export interface AddToCartParams {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
  currency?: string;
}

/**
 * Standard AddToCart event.
 * Fired when a customer adds a product/variant or increases quantity in cart.
 * Accurately sends current item quantity, num_items, line total value, and contents array.
 */
export const trackAddToCart = ({
  productId,
  productName,
  variantId,
  variantName,
  price,
  quantity,
  currency = "BDT",
}: AddToCartParams) => {
  const safePrice = Number(price) || 0;
  const safeQuantity = Number(quantity) || 1;
  const lineTotal = safePrice * safeQuantity;

  fbq("track", "AddToCart", {
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
  });
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
 * Sets customer phone for Advanced Matching via setUserProperties.
 * ONLY sends when the phone is a completely valid Bangladeshi mobile number.
 * Formats as country code + digits (e.g., 8801XXXXXXXXX) according to Meta specifications.
 */
export const setPixelUserPhone = (rawPhone?: string | null) => {
  if (!rawPhone) return;
  const parsed = parseBdPhone(rawPhone);
  if (!parsed.isValid) return;

  try {
    const formattedPhone = parsed.normalized.replace(/^\+/, "");
    fbq("setUserProperties", FB_PIXEL_ID, { ph: formattedPhone });
  } catch {
    // Ignore if setUserProperties fails
  }
};

/**
 * Standard InitiateCheckout event.
 * Fired only when the customer types text in the order form.
 * Deduplicated against the cart's content/signature: does NOT fire again until cart changes.
 * Sends accurate item quantities (contents[].quantity, num_items, and quantity).
 */
export const trackInitiateCheckout = ({
  items,
  value,
  phone,
  currency = "BDT",
}: InitiateCheckoutParams) => {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) return;

  const currentCartSignature = getCartSignature(safeItems);

  // Don't fire initiate checkout again until cart changes
  if (currentCartSignature === lastInitiateCheckoutCartSignature) {
    // If phone is provided, only set user properties if it is a completely valid phone number
    if (phone) {
      setPixelUserPhone(phone);
    }
    return;
  }

  // Update signature to current cart signature so it will not fire again until the cart changes
  lastInitiateCheckoutCartSignature = currentCartSignature;

  const safeValue = Number(value) || 0;

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

  fbq("track", "InitiateCheckout", params);
};


