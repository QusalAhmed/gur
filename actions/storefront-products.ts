"use server";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import type { StorefrontProduct } from "@/components/storefront/product-card";
import { DeliveryChargeConfig, DEFAULT_DELIVERY_CONFIG } from "@/lib/delivery-charge";
import type { PublicLiveStockStatsResult } from "@/lib/storefront-public-data";
import { getCachedPublicLiveStockStats } from "@/lib/storefront-cache";
import { DEFAULT_MESSENGER_URL, sanitizeMessengerUrl } from "@/lib/messenger";
import { DEFAULT_IMO_URL, sanitizeImoUrl } from "@/lib/imo";

const tracer = trace.getTracer("gramayon");

export type { PublicLiveStockStatsResult };

export interface StorefrontDataResult {
  products: StorefrontProduct[];
  hotline: string;
  storeName: string;
  storeSubtitle: string;
  logoUrl?: string;
  messengerUrl?: string;
  imoUrl?: string;
  deliveryConfig: DeliveryChargeConfig;
}

function resolveProductImage(storageUrl?: string): string {
  return resolveCdnImageUrl(storageUrl, "/images/products/blackstrap-drum.jpg");
}

/**
 * Server Action: Fetches active products, variants, images, and store settings for the storefront.
 */
export async function getStorefrontProductsAction(): Promise<StorefrontDataResult> {
  "use cache";
  cacheTag("storefront-products");
  cacheLife({
    stale: 300,
    revalidate: 300,
    expire: 1800,
  });

  return tracer.startActiveSpan("storefront.getProducts", async (span) => {
    try {
      const client = getSupabaseAdmin();

  let hotline = "01843557389";
  let storeName = "Gramayon";
  let storeSubtitle = "আমার নিজের বাসায় তৈরী গুড়, গলাকাটা দাম মুক্ত";
  let logoUrl: string | undefined = undefined;
  let messengerUrl =
    sanitizeMessengerUrl(process.env.NEXT_PUBLIC_MESSENGER_URL) ||
    DEFAULT_MESSENGER_URL;
  let imoUrl =
    sanitizeImoUrl(process.env.NEXT_PUBLIC_IMO_URL) ||
    DEFAULT_IMO_URL;
  const deliveryConfig: DeliveryChargeConfig = { ...DEFAULT_DELIVERY_CONFIG };

  try {
    const { data: settings } = await client
      .from("site_settings")
      .select("key, value")
      .eq("is_public", true)
      .in("key", [
        "store.support_phone",
        "store.messenger_url",
        "store.imo_url",
        "store.name_bn",
        "store.name",
        "store.subtitle",
        "store.logo_url",
        "store.favicon_url",
        "shipping.inside_dhaka_fee",
        "shipping.outside_dhaka_fee",
        "shipping.free_delivery_enabled",
        "shipping.free_delivery_threshold",
      ]);

    if (settings) {
      let nameEn = "";
      let nameBn = "";
      let faviconUrl = "";
      for (const row of settings) {
        const val = row.value;
        const cleanVal = String(val || "").replace(/^["']|["']$/g, "").trim();
        if (row.key === "store.support_phone" && cleanVal) hotline = cleanVal;
        if (row.key === "store.messenger_url") messengerUrl = sanitizeMessengerUrl(val);
        if (row.key === "store.imo_url") imoUrl = sanitizeImoUrl(val);
        if (row.key === "store.name" && cleanVal) nameEn = cleanVal;
        if (row.key === "store.name_bn" && cleanVal) nameBn = cleanVal;
        if (row.key === "store.subtitle" && cleanVal) storeSubtitle = cleanVal;
        if (row.key === "store.logo_url" && cleanVal) logoUrl = cleanVal;
        if (row.key === "store.favicon_url" && cleanVal) faviconUrl = cleanVal;

        if (row.key === "shipping.inside_dhaka_fee") {
          const num = typeof val === "number" ? val : parseFloat(cleanVal);
          if (!isNaN(num) && num >= 0) deliveryConfig.insideDhakaFee = num;
        } else if (row.key === "shipping.outside_dhaka_fee") {
          const num = typeof val === "number" ? val : parseFloat(cleanVal);
          if (!isNaN(num) && num >= 0) deliveryConfig.outsideDhakaFee = num;
        } else if (row.key === "shipping.free_delivery_enabled") {
          deliveryConfig.freeDeliveryEnabled = val === true || val === "true" || cleanVal === "true";
        } else if (row.key === "shipping.free_delivery_threshold") {
          const num = typeof val === "number" ? val : parseFloat(cleanVal);
          if (!isNaN(num) && num >= 0) deliveryConfig.freeDeliveryThreshold = num;
        }
      }
      if (nameEn) storeName = nameEn;
      else if (nameBn) storeName = nameBn;
      if (!logoUrl && faviconUrl) logoUrl = faviconUrl;
    }
  } catch (err) {
    console.warn("Could not fetch site_settings:", err);
  }

  let realProducts: StorefrontProduct[] = [];

  try {
    const [prodRes, varRes, imgRes] = await Promise.all([
      client
        .from("products")
        .select("id, slug, name, name_bn, summary, summary_bn, seo_title, seo_description, video_url, origin, rating_avg, rating_count, sort_order")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      client
        .from("product_variants")
        .select("id, product_id, name, name_bn, price, compare_at_price, net_quantity, net_unit, weight_grams, stock_status, is_default, is_active, is_combo, sort_order")
        .order("sort_order", { ascending: true })
        .order("price", { ascending: true }),
      client
        .from("product_images")
        .select("product_id, storage_path, is_primary, sort_order")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    const comboVariantIds = (varRes.data || [])
      .filter((v) => v.is_combo && v.is_active !== false)
      .map((v) => v.id);

    const comboItemsMap = new Map<string, any[]>();
    let comboQueryFailed = false;

    if (comboVariantIds.length > 0) {
      const { data: comboRows, error: comboErr } = await client
        .from("combo_items")
        .select("*, component:product_variants!combo_items_component_variant_id_fkey(*, product:products(name, name_bn))")
        .in("combo_variant_id", comboVariantIds)
        .order("sort_order", { ascending: true });

      if (comboErr) {
        console.error("Failed to query combo_items for storefront products:", comboErr);
        comboQueryFailed = true;
      } else if (comboRows) {
        for (const row of comboRows) {
          const list = comboItemsMap.get(row.combo_variant_id) || [];
          list.push({
            component_variant_id: row.component_variant_id,
            product_name: row.component?.product?.name,
            product_name_bn: row.component?.product?.name_bn,
            variant_name: row.component?.name,
            variant_name_bn: row.component?.name_bn,
            quantity: Number(row.quantity) || 1,
            unit_price: Number(row.component?.price) || 0,
            weight_grams: row.component?.weight_grams ? Number(row.component.weight_grams) : undefined,
            weight_kg: row.component?.weight_grams
              ? Number(row.component.weight_grams) / 1000
              : row.component?.net_quantity
              ? Number(row.component.net_quantity)
              : undefined,
          });
          comboItemsMap.set(row.combo_variant_id, list);
        }
      }
    }

    const variantsByProduct = new Map<string, any[]>();
    if (varRes.data) {
      for (const v of varRes.data) {
        if (v.is_active === false) continue;
        let computedWeightGrams = v.weight_grams ? Number(v.weight_grams) : undefined;
        let computedWeightKg = computedWeightGrams
          ? computedWeightGrams / 1000
          : v.net_quantity
          ? Number(v.net_quantity)
          : 1;

        // Omit combo variant if recipe query failed or recipe data is missing
        if (v.is_combo) {
          const recipe = comboItemsMap.get(v.id);
          if (comboQueryFailed || !recipe || recipe.length === 0) {
            continue;
          }

          let recipeGrams = 0;
          for (const item of recipe) {
            const itemGrams =
              typeof item.weight_grams === "number" && item.weight_grams > 0
                ? item.weight_grams
                : typeof item.weight_kg === "number" && item.weight_kg > 0
                ? Math.round(item.weight_kg * 1000)
                : undefined;
            if (itemGrams && itemGrams > 0) {
              recipeGrams += itemGrams * (Number(item.quantity) || 1);
            }
          }
          if (recipeGrams > 0) {
            computedWeightGrams = recipeGrams;
            computedWeightKg = recipeGrams / 1000;
          }
        }

        const list = variantsByProduct.get(v.product_id) || [];
        list.push({
          id: v.id,
          name: v.name,
          nameBn: v.name_bn || v.name,
          price: Number(v.price) || 0,
          compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
          netQuantity: v.is_combo && computedWeightKg ? computedWeightKg : v.net_quantity,
          netUnit: v.is_combo ? "kg" : v.net_unit,
          weightGrams: computedWeightGrams,
          weightKg: computedWeightKg,
          stockStatus: v.stock_status,
          isDefault: Boolean(v.is_default),
          sortOrder: typeof v.sort_order === "number" ? v.sort_order : 0,
          isCombo: Boolean(v.is_combo),
          comboItems: comboItemsMap.get(v.id) || [],
        });
        variantsByProduct.set(v.product_id, list);
      }
    }

    const imagesByProduct = new Map<string, string[]>();
    if (imgRes.data) {
      for (const img of imgRes.data) {
        const pubUrl = resolveCdnImageUrl(img.storage_path);
        if (pubUrl) {
          const list = imagesByProduct.get(img.product_id) || [];
          if (img.is_primary) {
            list.unshift(pubUrl);
          } else {
            list.push(pubUrl);
          }
          imagesByProduct.set(img.product_id, list);
        }
      }
    }

    if (prodRes.data && prodRes.data.length > 0) {
      realProducts = prodRes.data
        .map((p) => {
          const rawVariants = variantsByProduct.get(p.id) || [];
          // If product has no active valid variants, omit product rather than generating synthetic fallback
          if (rawVariants.length === 0) {
            return null;
          }

          const productImgs = imagesByProduct.get(p.id) || [];
          const resolvedImgs =
            productImgs.length > 0 ? productImgs : [resolveProductImage()];
          const primaryImg = resolvedImgs[0];
          const variants = [...rawVariants].sort((a, b) => {
            if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
              return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            }
            return Number(a.price) - Number(b.price);
          });

          // Ensure exactly one variant has isDefault: true
          const defaultIndex = variants.findIndex((v) => v.isDefault);
          const resolvedDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;
          variants.forEach((v, idx) => {
            v.isDefault = idx === resolvedDefaultIndex;
          });

          return {
            id: p.id,
            slug: (p as any).slug || undefined,
            name: p.name,
            nameBn: p.name_bn || p.name,
            summary: p.summary,
            summaryBn: p.summary_bn,
            seoTitle: (p as any).seo_title || null,
            seoDescription: (p as any).seo_description || null,
            image: primaryImg,
            images: resolvedImgs,
            videoUrl: (p as any).video_url || null,
            origin: p.origin,
            ratingAvg: Number(p.rating_avg) || 5,
            ratingCount: Number(p.rating_count) || 1,
            variants,
          };
        })
        .filter((p): p is any => p !== null);
    }
      } catch (err) {
        console.error("Error fetching real products from Supabase DB in actions/storefront-products.ts:", err);
      }

      span.setAttribute("products.count", realProducts.length);
      return {
        products: realProducts,
        hotline,
        storeName,
        storeSubtitle,
        logoUrl,
        messengerUrl,
        deliveryConfig,
      };
    } catch (error) {
      if (error instanceof Error) span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Server Action: Computes aggregated live production capacity and active backlog weight in KG
 * for the storefront availability banner without exposing individual order rows or PII.
 */
export async function getPublicLiveStockStatsAction(): Promise<PublicLiveStockStatsResult> {
  const fetchedAt = Date.now();
  try {
    return await getCachedPublicLiveStockStats();
  } catch (err) {
    console.warn("Failed to compute public live stock stats:", err);
    return {
      dailyProductionKg: null,
      simulatedDemandEnabled: null,
      simulatedDemandKg: null,
      totalActiveOrdersKg: 0,
      activeOrderCount: 0,
      fetchedAt,
    };
  }
}
