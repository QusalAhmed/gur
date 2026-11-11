import { cookies, headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { isValidUuid } from "@/lib/security";
import { timingSafeTokenEqual } from "@/lib/server-security";
import {
  sendCapiEvents,
  formatPhoneForMeta,
  isServerPhoneAlreadyTracked,
  markServerPhoneAsTracked,
  type CapiEventParams,
  type CapiUserData,
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
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

const CONFIRMED_PURCHASE_ELIGIBLE_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "partially_delivered",
];

async function getOrFetchCatalogMappings(): Promise<CachedCatalogMapping> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache;
  }

  const client = getSupabaseAdmin();
  try {
    const [prodsRes, varsRes] = await Promise.all([
      client
        .from("products")
        .select("id, name, name_bn, slug, status")
        .order("sort_order", { ascending: true }),
      client
        .from("product_variants")
        .select("id, product_id, name, sku, is_default"),
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

export async function resolveCatalogItemIdInternal(
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

  if (rawVarId && variantIds.has(rawVarId)) {
    return rawVarId;
  }
  if (rawProdId && variantIds.has(rawProdId)) {
    return rawProdId;
  }
  if (rawProdId && productToDefaultVariantMap.has(rawProdId)) {
    return productToDefaultVariantMap.get(rawProdId)!;
  }

  if (params.sku) {
    const cleanSku = params.sku.trim().toLowerCase();
    if (skuToVariantMap.has(cleanSku)) {
      return skuToVariantMap.get(cleanSku)!;
    }
  }

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

  if (rawVarId && isValidUuid(rawVarId)) {
    return rawVarId;
  }
  if (rawProdId && isValidUuid(rawProdId)) {
    return rawProdId;
  }

  return defaultVariantId || defaultProductId;
}

export async function dispatchCapiEventWithQueue(
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

export function sanitizeMetaEventUrl(rawUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== "string") return undefined;
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete("token");
    parsed.searchParams.delete("test");
    parsed.searchParams.delete("force");
    return parsed.toString();
  } catch {
    return rawUrl.replace(/([?&])(token|test|force)=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  }
}

export async function getRequestContext(
  clientUserData?: Partial<CapiUserData>,
  clientUrl?: string
): Promise<{ userData: CapiUserData; eventSourceUrl?: string }> {
  let fbp = clientUserData?.fbp;
  let fbc = clientUserData?.fbc;
  let clientIp = clientUserData?.client_ip_address;
  let userAgent = clientUserData?.client_user_agent;
  let resolvedUrl = sanitizeMetaEventUrl(clientUrl);

  try {
    const cookieStore = await cookies();
    if (!fbp) fbp = cookieStore.get("_fbp")?.value;
    if (!fbc) fbc = cookieStore.get("_fbc")?.value;
  } catch {
    // Ignore outside request scope
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
      resolvedUrl = sanitizeMetaEventUrl(headerStore.get("referer") || undefined);
    }
  } catch {
    // Ignore outside request scope
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

export async function sendCapiPageViewInternal(params: {
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
    console.error("[CAPI Service] sendCapiPageViewInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function sendCapiViewContentInternal(params: {
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
    const resolvedProductId = await resolveCatalogItemIdInternal({
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
        currency: String(params.currency || "BDT").trim().toUpperCase(),
      },
    });
  } catch (err: any) {
    console.error("[CAPI Service] sendCapiViewContentInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function sendCapiAddToCartInternal(params: {
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
    const resolvedProductId = await resolveCatalogItemIdInternal({
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
        currency: String(params.currency || "BDT").trim().toUpperCase(),
      },
    });
  } catch (err: any) {
    console.error("[CAPI Service] sendCapiAddToCartInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function sendCapiInitiateCheckoutInternal(params: {
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
        const resolvedId = await resolveCatalogItemIdInternal({
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
        currency: String(params.currency || "BDT").trim().toUpperCase(),
      },
    });
  } catch (err: any) {
    console.error("[CAPI Service] sendCapiInitiateCheckoutInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function sendCapiPurchaseInternal(params: {
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
        const resolvedId = await resolveCatalogItemIdInternal({
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

    const effectiveEventId =
      params.eventId ||
      (params.orderNumber ? String(params.orderNumber).trim() : undefined) ||
      (params.orderId ? String(params.orderId).trim() : undefined) ||
      "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);

    return await dispatchCapiEventWithQueue({
      eventName: "Purchase",
      eventId: effectiveEventId,
      eventSourceUrl,
      userData,
      customData: {
        content_ids: contentIds,
        content_type: "product",
        contents,
        num_items: totalQuantity,
        value: Number(params.value) || 0,
        currency: String(params.currency || "BDT").trim().toUpperCase(),
        order_id: params.orderNumber || params.orderId,
      },
    });
  } catch (err: any) {
    console.error("[CAPI Service] sendCapiPurchaseInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function sendCapiUserPropertiesInternal(params: {
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
    console.error("[CAPI Service] sendCapiUserPropertiesInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function sendCapiContactInternal(params: {
  eventId: string;
  channel: string;
  refCode?: string;
  phone?: string | null;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
  customData?: Record<string, any>;
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

    if (params.refCode) {
      try {
        const cleanRef = params.refCode.replace(/^#/, "").trim().toUpperCase();
        if (cleanRef) {
          const client = getSupabaseAdmin();

          const isSessionAuthorized = (
            existingFbp: string | null | undefined,
            callerFbp: string | null | undefined
          ) => {
            if (existingFbp) {
              return Boolean(callerFbp && existingFbp === callerFbp);
            }
            return true;
          };

          const { data: existingInq, error: readErr } = await client
            .from("storefront_inquiries")
            .select(
              "id, channel, customer_phone, fbp, fbc, event_source_url, client_ip, user_agent, meta_tracking"
            )
            .eq("ref_code", cleanRef)
            .maybeSingle();

          if (readErr) {
            console.warn(
              "[CAPI Service] Failed to read storefront inquiry for ref_code:",
              cleanRef,
              readErr
            );
          } else if (existingInq) {
            if (!isSessionAuthorized(existingInq.fbp, userData.fbp)) {
              console.warn(
                `[CAPI Service] Session mismatch for inquiry ${cleanRef}: update rejected`
              );
            } else {
              const mergedPhone = params.phone || existingInq.customer_phone || null;
              const mergedFbp = userData.fbp || existingInq.fbp || null;
              const mergedFbc = userData.fbc || existingInq.fbc || null;
              const mergedUrl = eventSourceUrl || existingInq.event_source_url || null;
              const mergedIp = userData.client_ip_address || existingInq.client_ip || null;
              const mergedUa = userData.client_user_agent || existingInq.user_agent || null;

              const existingMeta =
                existingInq.meta_tracking && typeof existingInq.meta_tracking === "object"
                  ? (existingInq.meta_tracking as Record<string, any>)
                  : {};

              const { error: updateErr } = await client
                .from("storefront_inquiries")
                .update({
                  channel: params.channel || existingInq.channel || "whatsapp",
                  customer_phone: mergedPhone,
                  fbp: mergedFbp,
                  fbc: mergedFbc,
                  client_ip: mergedIp,
                  user_agent: mergedUa,
                  event_source_url: mergedUrl,
                  meta_tracking: {
                    ...existingMeta,
                    fbp: mergedFbp,
                    fbc: mergedFbc,
                    client_ip_address: mergedIp,
                    client_user_agent: mergedUa,
                    event_source_url: mergedUrl,
                    ref_code: cleanRef,
                    channel: params.channel || existingMeta.channel || "whatsapp",
                    updated_at: new Date().toISOString(),
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingInq.id);

              if (updateErr) {
                console.warn("[CAPI Service] Failed to update storefront inquiry:", updateErr);
              }
            }
          } else {
            const { error: insErr } = await client.from("storefront_inquiries").insert({
              ref_code: cleanRef,
              channel: params.channel || "whatsapp",
              customer_phone: params.phone || null,
              fbp: userData.fbp || null,
              fbc: userData.fbc || null,
              client_ip: userData.client_ip_address || null,
              user_agent: userData.client_user_agent || null,
              event_source_url: eventSourceUrl || null,
              meta_tracking: {
                fbp: userData.fbp || null,
                fbc: userData.fbc || null,
                client_ip_address: userData.client_ip_address || null,
                client_user_agent: userData.client_user_agent || null,
                event_source_url: eventSourceUrl || null,
                ref_code: cleanRef,
                channel: params.channel || "whatsapp",
                created_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            });

            if (insErr) {
              if (insErr.code === "23505" || insErr.message?.includes("duplicate key")) {
                const { data: raceInq, error: raceReadErr } = await client
                  .from("storefront_inquiries")
                  .select(
                    "id, channel, customer_phone, fbp, fbc, event_source_url, client_ip, user_agent, meta_tracking"
                  )
                  .eq("ref_code", cleanRef)
                  .maybeSingle();

                if (!raceReadErr && raceInq) {
                  if (!isSessionAuthorized(raceInq.fbp, userData.fbp)) {
                    console.warn(
                      `[CAPI Service] Session mismatch on concurrent inquiry insert for ${cleanRef}`
                    );
                  } else {
                    const raceMeta =
                      raceInq.meta_tracking && typeof raceInq.meta_tracking === "object"
                        ? (raceInq.meta_tracking as Record<string, any>)
                        : {};

                    await client
                      .from("storefront_inquiries")
                      .update({
                        customer_phone: params.phone || raceInq.customer_phone || null,
                        fbp: userData.fbp || raceInq.fbp || null,
                        fbc: userData.fbc || raceInq.fbc || null,
                        client_ip: userData.client_ip_address || raceInq.client_ip || null,
                        user_agent: userData.client_user_agent || raceInq.user_agent || null,
                        event_source_url: eventSourceUrl || raceInq.event_source_url || null,
                        meta_tracking: {
                          ...raceMeta,
                          fbp: userData.fbp || raceInq.fbp || null,
                          fbc: userData.fbc || raceInq.fbc || null,
                          client_ip_address: userData.client_ip_address || raceInq.client_ip || null,
                          client_user_agent: userData.client_user_agent || raceInq.user_agent || null,
                          event_source_url: eventSourceUrl || raceInq.event_source_url || null,
                          ref_code: cleanRef,
                          updated_at: new Date().toISOString(),
                        },
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", raceInq.id);
                  }
                }
              } else {
                console.warn("[CAPI Service] Failed to insert inquiry:", insErr);
              }
            }
          }
        }
      } catch (inqErr) {
        console.warn("[CAPI Service] Failed to persist storefront inquiry:", inqErr);
      }
    }

    return await dispatchCapiEventWithQueue({
      eventName: "Contact",
      eventId: params.eventId,
      eventSourceUrl,
      actionSource: "website",
      userData,
      customData: {
        channel: params.channel,
        content_name: `Contact via ${params.channel.toUpperCase()}`,
        content_category: "Direct Outreach",
        ...(params.refCode ? { ref_code: params.refCode } : {}),
        ...(params.customData || {}),
      },
    });
  } catch (err: any) {
    console.error("[CAPI Service] sendCapiContactInternal error:", err);
    return { success: false, error: "CAPI dispatch failed" };
  }
}

export async function enrichOrderMetaTrackingInternal(params: {
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
  try {
    const cleanId = (params.orderIdentifier || "").trim();
    if (!cleanId) return { success: false, error: "Missing orderIdentifier" };

    const client = getSupabaseAdmin();
    let query = client
      .from("orders")
      .select("id, order_number, public_token, status, attribution");

    if (isValidUuid(cleanId)) {
      query = query.eq("id", cleanId);
    } else {
      query = query.eq("order_number", cleanId);
    }

    const { data: orderRow, error: fetchErr } = await query.maybeSingle();
    if (fetchErr || !orderRow) {
      return { success: false, error: "Order not found" };
    }

    if (
      !params.publicToken ||
      !orderRow.public_token ||
      !timingSafeTokenEqual(params.publicToken, orderRow.public_token)
    ) {
      return { success: false, error: "Invalid public token" };
    }

    const { userData, eventSourceUrl } = await getRequestContext(
      { fbp: params.fbp, fbc: params.fbc },
      params.url
    );

    const attr =
      orderRow.attribution && typeof orderRow.attribution === "object"
        ? (orderRow.attribution as Record<string, any>)
        : {};
    const existingMeta =
      attr.meta_tracking && typeof attr.meta_tracking === "object"
        ? (attr.meta_tracking as Record<string, any>)
        : {};

    const hasSentPurchase = Boolean(existingMeta.purchase_event_sent_at);
    const enrichedMeta = {
      ...existingMeta,
      purchase_event_id:
        hasSentPurchase && existingMeta.purchase_event_id
          ? existingMeta.purchase_event_id
          : params.eventId || existingMeta.purchase_event_id || null,
      event_id:
        params.eventId ||
        existingMeta.event_id ||
        (orderRow.order_number ? String(orderRow.order_number).trim() : undefined) ||
        orderRow.id,
      fbp: userData.fbp || existingMeta.fbp || null,
      fbc: userData.fbc || existingMeta.fbc || null,
      client_ip_address: userData.client_ip_address || existingMeta.client_ip_address || null,
      client_user_agent: userData.client_user_agent || existingMeta.client_user_agent || null,
      event_source_url: eventSourceUrl || existingMeta.event_source_url || null,
      last_link_opened_at: new Date().toISOString(),
    };

    await client
      .from("orders")
      .update({
        attribution: {
          ...attr,
          meta_tracking: enrichedMeta,
        },
      })
      .eq("id", orderRow.id);

    return {
      success: true,
      orderNumber: orderRow.order_number,
      enriched: true,
    };
  } catch (err: any) {
    console.error("[CAPI Service] enrichOrderMetaTrackingInternal error:", err);
    return { success: false, error: "Failed to enrich attribution" };
  }
}

export async function captureStorefrontMetaTrackingInternal(payload?: {
  eventId?: string;
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
}): Promise<Record<string, any>> {
  let fbp = payload?.fbp;
  let fbc = payload?.fbc;
  let clientIp: string | undefined;
  let userAgent: string | undefined;
  let resolvedUrl = sanitizeMetaEventUrl(payload?.eventSourceUrl);

  try {
    const cookieStore = await cookies();
    if (!fbp) fbp = cookieStore.get("_fbp")?.value;
    if (!fbc) fbc = cookieStore.get("_fbc")?.value;
  } catch {
    // Ignore outside request scope
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
      resolvedUrl = sanitizeMetaEventUrl(headerStore.get("referer") || undefined);
    }
  } catch {
    // Ignore outside request scope
  }

  return {
    event_id:
      payload?.eventId ||
      "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11),
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

export async function triggerCapiPurchaseInternal(
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
    const client = getSupabaseAdmin();

    let query = client
      .from("orders")
      .select(
        "id, order_number, public_token, channel, status, grand_total, customer_name, customer_phone, shipping_phone, shipping_address, currency, attribution, order_items(id, product_id, variant_id, sku, product_name, variant_name, quantity, unit_price, line_total)"
      );

    if (isValidUuid(cleanId)) {
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

    if (!CONFIRMED_PURCHASE_ELIGIBLE_STATUSES.includes(orderRow.status)) {
      return {
        success: true,
        skipped: true,
        reason: `Order status '${orderRow.status}' is not eligible for Purchase event.`,
      };
    }

    const attr =
      orderRow.attribution && typeof orderRow.attribution === "object"
        ? (orderRow.attribution as Record<string, any>)
        : {};
    const metaTracking =
      attr.meta_tracking && typeof attr.meta_tracking === "object"
        ? (attr.meta_tracking as Record<string, any>)
        : {};

    if (metaTracking.purchase_event_sent_at) {
      return {
        success: true,
        skipped: true,
        reason: `Purchase event already sent at ${metaTracking.purchase_event_sent_at}`,
        eventId:
          metaTracking.purchase_event_id ||
          (orderRow.order_number ? String(orderRow.order_number).trim() : undefined) ||
          (orderRow.id ? String(orderRow.id).trim() : undefined) ||
          "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11),
      };
    }

    const eventId =
      metaTracking.purchase_event_id ||
      (orderRow.order_number ? String(orderRow.order_number).trim() : undefined) ||
      (orderRow.id ? String(orderRow.id).trim() : undefined) ||
      "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);

    const phone = orderRow.customer_phone || orderRow.shipping_phone;
    const orderItems = Array.isArray(orderRow.order_items) ? orderRow.order_items : [];

    const contents: CapiContentItem[] = await Promise.all(
      orderItems.map(async (item: any) => {
        const resolvedId = await resolveCatalogItemIdInternal({
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name,
          sku: item.sku,
        });

        if (!item.product_id && item.id && resolvedId) {
          try {
            await client
              .from("order_items")
              .update({ product_id: resolvedId })
              .eq("id", item.id);
          } catch {
            // Non-critical
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

    if (contentIds.length === 0) {
      const defaultId = await resolveCatalogItemIdInternal({});
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
    const currency = String(orderRow.currency || "BDT").trim().toUpperCase();

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

    const fbp = metaTracking.fbp || attr.fbp || null;
    const fbc = metaTracking.fbc || attr.fbc || null;
    const clientIp = metaTracking.client_ip_address || null;
    const clientUa = metaTracking.client_user_agent || null;

    const userData: CapiUserData = {
      ph: phone || null,
      fn: firstName || null,
      ln: lastName || null,
      ct: address.district ? String(address.district).trim().toLowerCase() : null,
      st: address.division ? String(address.division).trim().toLowerCase() : null,
      country: "bd",
      fbp,
      fbc,
      client_ip_address: clientIp,
      client_user_agent: clientUa,
    };

    const channel = (orderRow.channel || "").toLowerCase();
    let actionSource: "website" | "phone_call" | "chat" = "website";
    if (fbp || clientIp || metaTracking.event_source_url) {
      actionSource = "website";
    } else if (channel === "phone") {
      actionSource = "phone_call";
    } else if (channel === "whatsapp") {
      actionSource = "chat";
    } else {
      actionSource = "phone_call";
    }

    const capiResult = await sendCapiEvents([
      {
        eventName: "Purchase",
        eventId,
        eventSourceUrl: metaTracking.event_source_url || undefined,
        actionSource,
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
      `[Facebook CAPI] triggerCapiPurchaseInternal error for ${orderIdentifier}:`,
      err
    );
    return { success: false, error: err?.message || "CAPI dispatch failed" };
  }
}
