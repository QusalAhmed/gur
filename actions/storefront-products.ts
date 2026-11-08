"use server";

import { cacheLife, cacheTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import type { StorefrontProduct } from "@/components/storefront/product-card";

export interface StorefrontDataResult {
  products: StorefrontProduct[];
  hotline: string;
  storeName: string;
  storeSubtitle: string;
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

  const client = supabaseAdmin || supabase;

  let hotline = "01843557389";
  let storeName = "খেজুরের খাটি গুড়";
  let storeSubtitle = "আমার নিজের বাসায় তৈরী খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়";

  try {
    const { data: settings } = await client
      .from("site_settings")
      .select("key, value")
      .in("key", ["store.support_phone", "store.name_bn", "store.name"]);

    if (settings) {
      for (const row of settings) {
        const cleanVal = String(row.value || "").replace(/^["']|["']$/g, "").trim();
        if (!cleanVal) continue;
        if (row.key === "store.support_phone") hotline = cleanVal;
        if (row.key === "store.name_bn" || row.key === "store.name") storeName = cleanVal;
      }
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
        .select("id, product_id, name, name_bn, price, net_quantity, net_unit, stock_status, is_default, is_active, sort_order")
        .order("sort_order", { ascending: true })
        .order("price", { ascending: true }),
      client
        .from("product_images")
        .select("product_id, storage_path, is_primary, sort_order")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    const variantsByProduct = new Map<string, any[]>();
    if (varRes.data) {
      for (const v of varRes.data) {
        if (v.is_active === false) continue;
        const list = variantsByProduct.get(v.product_id) || [];
        list.push({
          id: v.id,
          name: v.name,
          nameBn: v.name_bn || v.name,
          price: Number(v.price) || 0,
          netQuantity: v.net_quantity,
          netUnit: v.net_unit,
          stockStatus: v.stock_status,
          isDefault: Boolean(v.is_default),
          sortOrder: typeof v.sort_order === "number" ? v.sort_order : 0,
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
      realProducts = prodRes.data.map((p) => {
        const productImgs = imagesByProduct.get(p.id) || [];
        const resolvedImgs =
          productImgs.length > 0 ? productImgs : [resolveProductImage()];
        const primaryImg = resolvedImgs[0];
        const rawVariants = variantsByProduct.get(p.id) || [];
        const variants = (
          rawVariants.length > 0
            ? rawVariants
            : [
              {
                id: `v-${p.id}`,
                name: "1 Pack",
                nameBn: "১ প্যাক",
                price: 700,
                isDefault: true,
                sortOrder: 0,
              },
            ]
        ).sort((a, b) => {
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
      });
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
