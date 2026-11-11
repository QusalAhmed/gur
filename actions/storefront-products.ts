"use server";

import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import type { StorefrontProduct } from "@/components/storefront/product-card";

export interface StorefrontDataResult {
  products: StorefrontProduct[];
  hotline: string;
  storeName: string;
  storeSubtitle: string;
}

export interface PublicLiveStockStatsResult {
  dailyProductionKg: number | null;
  simulatedDemandEnabled: boolean | null;
  simulatedDemandKg: number | null;
  totalActiveOrdersKg: number;
  activeOrderCount: number;
  fetchedAt: number;
}

function resolveProductImage(storageUrl?: string): string {
  return resolveCdnImageUrl(storageUrl, "/images/products/blackstrap-drum.jpg");
}

function computeOrderItemWeightKg(item: {
  quantity?: number | string | null;
  net_quantity?: number | string | null;
  net_unit?: string | null;
  variant_name?: string | null;
  product_name?: string | null;
}): number {
  const qty = Number(item.quantity) || 1;

  if (item.net_quantity != null && Number(item.net_quantity) > 0) {
    const net = Number(item.net_quantity);
    const unit = (item.net_unit || "").toLowerCase();
    if (unit === "g" || unit === "gram" || unit === "grams") return (net / 1000) * qty;
    if (unit === "t" || unit === "ton" || unit === "tonne") return net * 1000 * qty;
    return net * qty;
  }

  const name = `${item.variant_name || ""} ${item.product_name || ""}`.toLowerCase();
  if (name.includes("500 g") || name.includes("500g") || name.includes("৫০০ গ্রাম")) {
    return 0.5 * qty;
  }
  if (
    name.includes("1 kg") ||
    name.includes("1kg") ||
    name.includes("১ কেজি") ||
    name.includes("standard pack")
  ) {
    return 1 * qty;
  }
  if (name.includes("2 kg") || name.includes("2kg") || name.includes("২ কেজি")) {
    return 2 * qty;
  }
  if (name.includes("5 kg") || name.includes("5kg") || name.includes("৫ কেজি")) {
    return 5 * qty;
  }
  if (name.includes("20 l") || name.includes("20l") || name.includes("২০ লিটার")) {
    return 20 * qty;
  }
  if (name.includes("200 l") || name.includes("200l") || name.includes("২০০ লিটার")) {
    return 200 * qty;
  }
  if (name.includes("ton") || name.includes("টন")) {
    return 1000 * qty;
  }

  return 1 * qty;
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

  const client = getSupabaseAdmin();

  let hotline = "01843557389";
  let storeName = "খেজুরের খাটি গুড়";
  const storeSubtitle = "আমার নিজের বাসায় তৈরী খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়";

  try {
    const { data: settings } = await client
      .from("site_settings")
      .select("key, value")
      .eq("is_public", true)
      .in("key", ["store.support_phone", "store.name_bn", "store.name"]);

    if (settings) {
      let nameEn = "";
      let nameBn = "";
      for (const row of settings) {
        const cleanVal = String(row.value || "").replace(/^["']|["']$/g, "").trim();
        if (!cleanVal) continue;
        if (row.key === "store.support_phone") hotline = cleanVal;
        if (row.key === "store.name") nameEn = cleanVal;
        if (row.key === "store.name_bn") nameBn = cleanVal;
      }
      if (nameBn) storeName = nameBn;
      else if (nameEn) storeName = nameEn;
    }
  } catch (err) {
    console.warn("Could not fetch site_settings:", err);
  }

  let realProducts: StorefrontProduct[] = [];

  try {
    const [prodRes, varRes, imgRes] = await Promise.all([
      client
        .from("products")
        .select("id, slug, name, name_bn, summary, summary_bn, origin, rating_avg, rating_count, sort_order")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      client
        .from("product_variants")
        .select("id, product_id, name, name_bn, price, compare_at_price, net_quantity, net_unit, stock_status, is_default, is_active, is_combo, sort_order")
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
          });
          comboItemsMap.set(row.combo_variant_id, list);
        }
      }
    }

    const variantsByProduct = new Map<string, any[]>();
    if (varRes.data) {
      for (const v of varRes.data) {
        if (v.is_active === false) continue;
        // Omit combo variant if recipe query failed or recipe data is missing
        if (v.is_combo) {
          const recipe = comboItemsMap.get(v.id);
          if (comboQueryFailed || !recipe || recipe.length === 0) {
            continue;
          }
        }
        const list = variantsByProduct.get(v.product_id) || [];
        list.push({
          id: v.id,
          name: v.name,
          nameBn: v.name_bn || v.name,
          price: Number(v.price) || 0,
          compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : null,
          netQuantity: v.net_quantity,
          netUnit: v.net_unit,
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
            image: primaryImg,
            images: resolvedImgs,
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

  return {
    products: realProducts,
    hotline,
    storeName,
    storeSubtitle,
  };
}

/**
 * Server Action: Computes aggregated live production capacity and active backlog weight in KG
 * for the storefront availability banner without exposing individual order rows or PII.
 */
export async function getPublicLiveStockStatsAction(): Promise<PublicLiveStockStatsResult> {
  const fetchedAt = Date.now();
  try {
    const client = getSupabaseAdmin();
    const [settingsRes, ordersRes] = await Promise.all([
      client
        .from("site_settings")
        .select("key, value")
        .eq("is_public", true)
        .in("key", [
          "inventory.daily_production_kg",
          "inventory.simulated_demand_enabled",
          "inventory.simulated_demand_kg",
        ]),
      client
        .from("orders")
        .select(
          `
          id,
          order_items (
            quantity,
            net_quantity,
            net_unit,
            variant_name,
            product_name
          )
        `
        )
        .in("status", ["pending", "confirmed", "processing"]),
    ]);

    let dailyProductionKg: number | null = null;
    let simulatedDemandEnabled: boolean | null = null;
    let simulatedDemandKg: number | null = null;

    for (const row of settingsRes.data || []) {
      if (row.key === "inventory.daily_production_kg") {
        const prod = Number(row.value);
        if (Number.isFinite(prod) && prod > 0) {
          dailyProductionKg = prod;
        }
      } else if (row.key === "inventory.simulated_demand_enabled") {
        simulatedDemandEnabled =
          row.value === true ||
          row.value === "true" ||
          row.value === 1 ||
          row.value === "1";
      } else if (row.key === "inventory.simulated_demand_kg") {
        const kg = Math.round(Number(row.value) || 0);
        simulatedDemandKg = Math.max(0, kg);
      }
    }

    let totalWeight = 0;
    let activeOrderCount = 0;

    if (!ordersRes.error && Array.isArray(ordersRes.data)) {
      for (const order of ordersRes.data) {
        activeOrderCount++;
        const items = Array.isArray((order as any).order_items)
          ? (order as any).order_items
          : [];
        for (const item of items) {
          totalWeight += computeOrderItemWeightKg(item);
        }
      }
    }

    return {
      dailyProductionKg,
      simulatedDemandEnabled,
      simulatedDemandKg,
      totalActiveOrdersKg: Math.round(totalWeight * 10) / 10,
      activeOrderCount,
      fetchedAt,
    };
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
