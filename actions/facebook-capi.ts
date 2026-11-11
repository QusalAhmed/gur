"use server";

import { assertStaffRole } from "@/lib/admin-guard";
import {
  resolveCatalogItemIdInternal,
  sendCapiPageViewInternal,
  sendCapiViewContentInternal,
  sendCapiAddToCartInternal,
  sendCapiInitiateCheckoutInternal,
  sendCapiPurchaseInternal,
  sendCapiUserPropertiesInternal,
  sendCapiContactInternal,
  enrichOrderMetaTrackingInternal,
  captureStorefrontMetaTrackingInternal,
  triggerCapiPurchaseInternal,
  type CatalogIdLookupParams,
} from "@/lib/capi-service";

export type { CatalogIdLookupParams };

/**
 * Resolves a reliable, canonical Meta Catalog Item ID (Variation ID).
 */
export async function resolveCatalogItemId(
  params: CatalogIdLookupParams
): Promise<string> {
  return resolveCatalogItemIdInternal(params);
}

// Backwards-compatible async alias
export async function resolveCatalogProductId(
  params: CatalogIdLookupParams
): Promise<string> {
  return resolveCatalogItemIdInternal(params);
}

/**
 * Server action to send PageView event to Meta CAPI.
 */
export async function sendCapiPageViewAction(params: {
  eventId: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  return sendCapiPageViewInternal(params);
}

/**
 * Server action to send ViewContent event to Meta CAPI.
 */
export async function sendCapiViewContentAction(params: {
  eventId: string;
  productId: string;
  variantId?: string;
  productName: string;
  price?: number;
  currency?: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  return sendCapiViewContentInternal(params);
}

/**
 * Server action to send AddToCart event to Meta CAPI.
 */
export async function sendCapiAddToCartAction(params: {
  eventId: string;
  productId: string;
  variantId?: string;
  productName: string;
  price: number;
  quantity: number;
  currency?: string;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
}) {
  return sendCapiAddToCartInternal(params);
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
  return sendCapiInitiateCheckoutInternal(params);
}

/**
 * Server action to send Purchase event to Meta CAPI (staff-only).
 */
export async function sendCapiPurchaseAction(params: {
  eventId?: string;
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
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await sendCapiPurchaseInternal(params);
  } catch (err: any) {
    return { success: false, error: err?.message || "Unauthorized" };
  }
}

/**
 * Server action to send UserProperties event to Meta CAPI.
 * Deduplicates with browser-side UserProperties event using matching eventId.
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
  return sendCapiUserPropertiesInternal(params);
}

/**
 * Server action to send Contact / Lead touchpoint event to Meta CAPI.
 * Dispatched when visitor clicks Call, WhatsApp, Messenger, or submits call request.
 */
export async function sendCapiContactAction(params: {
  eventId: string;
  channel: string;
  refCode?: string;
  phone?: string | null;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
  customData?: Record<string, any>;
}) {
  return sendCapiContactInternal(params);
}

/**
 * Enriches an existing order's meta_tracking attribution when the customer
 * opens their confirmation link (/order-confirmed/[id]).
 */
export async function enrichOrderMetaTrackingAction(params: {
  orderIdentifier: string;
  publicToken?: string;
  fbp?: string | null;
  fbc?: string | null;
  url?: string;
  eventId?: string;
}): Promise<{
  success: boolean;
  orderNumber?: string;
  enriched?: boolean;
  error?: string;
}> {
  return enrichOrderMetaTrackingInternal(params);
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
  return captureStorefrontMetaTrackingInternal(payload);
}

/**
 * Triggers Meta CAPI Purchase event when an admin changes the status of an order
 * to 'confirmed' (or forward progression). Staff-only.
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
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await triggerCapiPurchaseInternal(orderIdentifier);
  } catch (err: any) {
    return { success: false, error: err?.message || "Unauthorized" };
  }
}
