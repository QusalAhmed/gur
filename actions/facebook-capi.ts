"use server";

import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { inngest } from "@/lib/inngest/client";
import {
  sendCapiEvents,
  formatPhoneForMeta,
  isServerPhoneAlreadyTracked,
  markServerPhoneAsTracked,
  type CapiEventParams,
  type CapiUserData,
  type CapiCustomData,
  type CapiContentItem,
} from "@/lib/facebook-capi";

export interface CatalogIdLookupParams {
  productId?: string | null;
  variantId?: string | null;
  productName?: string | null;
  sku?: string | null;
}

interface CachedCatalogMapping {
  productIds: Set<string>;
  variantIds: Set<string>;
  variantToProductMap: Map<string, string>;
  productToDefaultVariantMap: Map<string, string>;
  productNameMap: Map<string, string>;
  skuToVariantMap: Map<string, string>;
  defaultVariantId: string;
  defaultProductId: string;
  fetchedAt: number;
}

let catalogCache: CachedCatalogMapping | null = null;
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute memory cache

/**
 * Loads active products and variants from Supabase to guarantee 1:1 match
 * with Meta Commerce Catalog item IDs.
 */
async function getOrFetchCatalogMappings(): Promise<CachedCatalogMapping> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache;
  }

  const client = supabaseAdmin || supabase;
  try {
    const [prodsRes, varsRes] = await Promise.all([
      client.from("products").select("id, name, name_bn, slug, status").order("sort_order", { ascending: true }),
      client.from("product_variants").select("id, product_id, name, sku, is_default"),
    ]);

    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    const productNameMap = new Map<string, string>();
    let defaultProductId = "";

    const activeProds = (prodsRes.data || []).filter((p: any) => p.status === "active");
    const allProds = prodsRes.data || [];

    for (const p of allProds) {
      const pid = String(p.id).trim();
      productIds.add(pid);
      if (p.name) productNameMap.set(p.name.trim().toLowerCase(), pid);
      if (p.name_bn) productNameMap.set(p.name_bn.trim().toLowerCase(), pid);
      if (p.slug) productNameMap.set(p.slug.trim().toLowerCase(), pid);
    }

    if (activeProds.length > 0) {
      defaultProductId = String(activeProds[0].id).trim();
    } else if (allProds.length > 0) {
      defaultProductId = String(allProds[0].id).trim();
    }

    const variantToProductMap = new Map<string, string>();
    const productToDefaultVariantMap = new Map<string, string>();
    const skuToVariantMap = new Map<string, string>();
    let defaultVariantId = "";

    const allVars = varsRes.data || [];
    for (const v of allVars) {
      const vid = String(v.id).trim();
      const pid = String(v.product_id).trim();
      if (vid) {
        variantIds.add(vid);
      }
      if (vid && pid) {
        variantToProductMap.set(vid, pid);
        if (v.is_default || !productToDefaultVariantMap.has(pid)) {
          productToDefaultVariantMap.set(pid, vid);
        }
      }
      if (v.sku && vid) {
        skuToVariantMap.set(v.sku.trim().toLowerCase(), vid);
      }
    }

    if (defaultProductId && productToDefaultVariantMap.has(defaultProductId)) {
      defaultVariantId = productToDefaultVariantMap.get(defaultProductId)!;
    } else if (allVars.length > 0) {
      defaultVariantId = String(allVars[0].id).trim();
    }

    catalogCache = {
      productIds,
      variantIds,
      variantToProductMap,
      productToDefaultVariantMap,
      productNameMap,
      skuToVariantMap,
      defaultVariantId,
      defaultProductId,
      fetchedAt: now,
    };
    return catalogCache;
  } catch (err) {
    console.warn("[Facebook CAPI] Failed to fetch catalog mappings:", err);
    return (
      catalogCache || {
        productIds: new Set(),
        variantIds: new Set(),
        variantToProductMap: new Map(),
        productToDefaultVariantMap: new Map(),
        productNameMap: new Map(),
        skuToVariantMap: new Map(),
        defaultVariantId: "",
        defaultProductId: "",
        fetchedAt: 0,
      }
    );
  }
}

/**
 * Resolves a reliable, canonical Meta Catalog Item ID (Variation ID).
 * Priority:
 * 1. Explicit variantId if it exists in catalog
 * 2. If productId was passed directly as variantId
 * 3. Default variant ID of the provided productId
 * 4. SKU lookup in product_variants -> returns variantId
 * 5. Product name lookup -> default variant ID
 * 6. Fallback to productId (e.g. products with no variants)
 * 7. Active default catalog variant ID
 */
export async function resolveCatalogItemId(
  params: CatalogIdLookupParams
): Promise<string> {
  const {
    productIds,
    variantIds,
    productToDefaultVariantMap,
    productNameMap,
    skuToVariantMap,
    defaultVariantId,
    defaultProductId,
  } = await getOrFetchCatalogMappings();

  const rawProdId = params.productId ? String(params.productId).trim() : null;
  const rawVarId = params.variantId ? String(params.variantId).trim() : null;

  // 1. Direct valid variant UUID in catalog
  if (rawVarId && variantIds.has(rawVarId)) {
    return rawVarId;
  }

  // 2. If productId was passed as a variant ID directly
  if (rawProdId && variantIds.has(rawProdId)) {
    return rawProdId;
  }

  // 3. If productId is provided, resolve its default variant
  if (rawProdId && productToDefaultVariantMap.has(rawProdId)) {
    return productToDefaultVariantMap.get(rawProdId)!;
  }

  // 4. SKU lookup
  if (params.sku) {
    const cleanSku = params.sku.trim().toLowerCase();
    if (skuToVariantMap.has(cleanSku)) {
      return skuToVariantMap.get(cleanSku)!;
    }
  }

  // 5. Product Name lookup -> default variant
  if (params.productName) {
    const cleanName = params.productName.trim().toLowerCase();
    let matchedProdId = productNameMap.get(cleanName);
    if (!matchedProdId) {
      for (const [key, pid] of productNameMap.entries()) {
        if (cleanName.includes(key) || key.includes(cleanName)) {
          matchedProdId = pid;
          break;
        }
      }
    }
    if (matchedProdId && productToDefaultVariantMap.has(matchedProdId)) {
      return productToDefaultVariantMap.get(matchedProdId)!;
    }
    if (matchedProdId && productIds.has(matchedProdId)) {
      return matchedProdId;
    }
  }

  // 6. If rawVarId looks like a valid UUID, use it as fallback
  if (rawVarId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawVarId)) {
    return rawVarId;
  }

  // 7. If rawProdId looks like a valid UUID, use it as fallback (for zero-variant products)
  if (rawProdId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawProdId)) {
    return rawProdId;
  }

  // 8. Catalog default fallback
  return defaultVariantId || defaultProductId;
}

// Backwards-compatible alias
export const resolveCatalogProductId = resolveCatalogItemId;

/**
 * Dispatches an event to the Inngest Meta CAPI batch queue with automatic
 * fallback to direct synchronous dispatch if Inngest is unreachable.
 */
async function dispatchCapiEventWithQueue(
  event: CapiEventParams,
  options?: { testEventCode?: string }
): Promise<{ success: boolean; eventId?: string; queued?: boolean; error?: string }> {
  try {
    await inngest.send({
      name: "meta.capi.event",
      data: {
        event,
        testEventCode: options?.testEventCode,
      },
      id: `capi-${event.eventName.toLowerCase()}-${event.eventId}`,
    });
    return { success: true, eventId: event.eventId, queued: true };
  } catch (queueErr) {
    console.warn(
      "[Facebook CAPI] Inngest queue dispatch failed, falling back to direct send:",
      queueErr
    );
    return await sendCapiEvents([event], options);
  }
}

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

    return await dispatchCapiEventWithQueue({
      eventName: "PageView",
      eventId: params.eventId,
      eventSourceUrl,
      userData,
    });
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
  variantId?: string;
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
    const resolvedProductId = await resolveCatalogProductId({
      productId: params.productId,
      variantId: params.variantId,
      productName: params.productName,
    });

    return await dispatchCapiEventWithQueue({
      eventName: "ViewContent",
      eventId: params.eventId,
      eventSourceUrl,
      userData,
      customData: {
        content_name: params.productName,
        content_ids: [resolvedProductId],
        content_type: "product",
        contents: [
          {
            id: resolvedProductId,
            quantity: 1,
            item_price: safePrice,
          },
        ],
        value: safePrice,
        currency: (params.currency || "BDT").trim().toUpperCase(),
      },
    });
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
  variantId?: string;
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
    const safeQuantity = Math.max(1, Math.floor(Number(params.quantity) || 1));
    const lineTotal = safePrice * safeQuantity;
    const resolvedProductId = await resolveCatalogProductId({
      productId: params.productId,
      variantId: params.variantId,
      productName: params.productName,
    });

    return await dispatchCapiEventWithQueue({
      eventName: "AddToCart",
      eventId: params.eventId,
      eventSourceUrl,
      userData,
      customData: {
        content_name: params.productName,
        content_ids: [resolvedProductId],
        content_type: "product",
        contents: [
          {
            id: resolvedProductId,
            quantity: safeQuantity,
            item_price: safePrice,
          },
        ],
        num_items: safeQuantity,
        value: lineTotal,
        currency: (params.currency || "BDT").trim().toUpperCase(),
      },
    });
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
    const contents: CapiContentItem[] = await Promise.all(
      safeItems.map(async (item) => {
        const resolvedId = await resolveCatalogProductId({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
        });
        return {
          id: resolvedId,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          item_price: Math.max(0, Number(item.unitPrice) || 0),
        };
      })
    );

    const contentIds = Array.from(new Set(contents.map((item) => item.id)));
    const totalQuantity = contents.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    return await dispatchCapiEventWithQueue({
      eventName: "InitiateCheckout",
      eventId: params.eventId,
      eventSourceUrl,
      userData,
      customData: {
        content_ids: contentIds,
        content_type: "product",
        contents,
        num_items: totalQuantity,
        value: Number(params.value) || 0,
        currency: (params.currency || "BDT").trim().toUpperCase(),
      },
    });
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
    const contents: CapiContentItem[] = await Promise.all(
      safeItems.map(async (item) => {
        const resolvedId = await resolveCatalogProductId({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
        });
        return {
          id: resolvedId,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          item_price: Math.max(0, Number(item.unitPrice) || 0),
        };
      })
    );

    const contentIds = Array.from(new Set(contents.map((item) => item.id)));
    const totalQuantity = contents.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    return await dispatchCapiEventWithQueue({
      eventName: "Purchase",
      eventId: params.eventId,
      eventSourceUrl,
      userData,
      customData: {
        content_ids: contentIds,
        content_type: "product",
        contents,
        num_items: totalQuantity,
        value: Number(params.value) || 0,
        currency: (params.currency || "BDT").trim().toUpperCase(),
        order_id: params.orderNumber || params.orderId,
      },
    });
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

    return await dispatchCapiEventWithQueue(
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
        "id, order_number, status, grand_total, customer_name, customer_phone, shipping_phone, shipping_address, currency, attribution, order_items(id, product_id, variant_id, sku, product_name, variant_name, quantity, unit_price, line_total)"
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

    // Resolve accurate Meta Catalog product IDs for every line item
    const contents: CapiContentItem[] = await Promise.all(
      orderItems.map(async (item: any) => {
        const resolvedId = await resolveCatalogProductId({
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name,
          sku: item.sku,
        });

        // If product_id was not populated on this order item, persist the resolved ID to DB
        if (!item.product_id && item.id && resolvedId) {
          try {
            await client
              .from("order_items")
              .update({ product_id: resolvedId })
              .eq("id", item.id);
          } catch {
            // Non-critical background save fallback
          }
        }

        const safeQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const safePrice = Math.max(0, Number(item.unit_price ?? item.unitPrice) || 0);

        return {
          id: resolvedId,
          quantity: safeQty,
          item_price: safePrice,
        };
      })
    );

    let contentIds = Array.from(new Set(contents.map((item) => item.id).filter(Boolean)));

    // Fallback if no item resolved (e.g. phone-only order)
    if (contentIds.length === 0) {
      const defaultId = await resolveCatalogProductId({});
      if (defaultId) {
        contentIds = [defaultId];
        contents.push({
          id: defaultId,
          quantity: 1,
          item_price: Number(orderRow.grand_total) || 0,
        });
      }
    }

    const totalQuantity = contents.reduce(
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
          content_ids: contentIds,
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


