"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import type { StorefrontProduct } from "@/components/storefront/product-card";

export interface StorefrontDataResult {
  products: StorefrontProduct[];
  hotline: string;
  storeName: string;
  storeSubtitle: string;
}

function resolveProductImage(storageUrl?: string): string {
  if (storageUrl && (storageUrl.startsWith("http://") || storageUrl.startsWith("https://"))) {
    return storageUrl;
  }
  // Generic fallback placeholder
  return "/images/products/blackstrap-drum.jpg";
}

/**
 * Server Action: Fetches active products, variants, images, and store settings for the storefront.
 */
export async function getStorefrontProductsAction(): Promise<StorefrontDataResult> {
  const client = supabaseAdmin || supabase;

  let hotline = "01843557389";
  let storeName = "খেজুরের খাটি গুড়";
  let storeSubtitle = "গ্রামের গাছিদের তৈরি খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়";

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
        .select("id, name, name_bn, summary, summary_bn, origin, rating_avg, rating_count, sort_order")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      client
        .from("product_variants")
        .select("id, product_id, name, name_bn, price, net_quantity, net_unit, stock_status")
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
        const list = variantsByProduct.get(v.product_id) || [];
        list.push({
          id: v.id,
          name: v.name,
          nameBn: v.name_bn || v.name,
          price: Number(v.price) || 0,
          netQuantity: v.net_quantity,
          netUnit: v.net_unit,
          stockStatus: v.stock_status,
        });
        variantsByProduct.set(v.product_id, list);
      }
    }

    const imagesByProduct = new Map<string, string[]>();
    if (imgRes.data) {
      for (const img of imgRes.data) {
        let pubUrl = img.storage_path;
        if (pubUrl && !pubUrl.startsWith("http")) {
          const { data } = client.storage.from("catalog-images").getPublicUrl(img.storage_path);
          pubUrl = data?.publicUrl || "";
        }
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
        const variants = (variantsByProduct.get(p.id) || [
          {
            id: `v-${p.id}`,
            name: "1 Pack",
            nameBn: "১ প্যাক",
            price: 700,
          },
        ]).sort((a, b) => Number(a.price) - Number(b.price));

        return {
          id: p.id,
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

