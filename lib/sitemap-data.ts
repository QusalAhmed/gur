import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import { escapeSitemapXmlUrl } from "@/lib/site-url";

export interface SitemapProductEntry {
  identifier: string;
  lastModified?: string;
  images: string[];
}

function resolveAbsoluteImageUrl(storagePath: string | null | undefined, siteUrl: string): string | null {
  const resolved = resolveCdnImageUrl(storagePath);
  if (!resolved) return null;

  const absolute = resolved.startsWith("/") ? `${siteUrl}${resolved}` : resolved;
  if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) {
    return null;
  }
  return escapeSitemapXmlUrl(absolute);
}

function pickLatestIsoTimestamp(...candidates: Array<string | null | undefined>): string | undefined {
  let latestMs = -Infinity;
  let latestIso: string | undefined;

  for (const value of candidates) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = new Date(ms).toISOString();
    }
  }

  return latestIso;
}

/**
 * Fetches active storefront products, latest modification timestamps, and public image URLs
 * for sitemap.xml generation. Tagged with "storefront-products" so catalog edits invalidate it.
 */
export async function getSitemapProducts(siteUrl: string): Promise<SitemapProductEntry[]> {
  "use cache";
  cacheTag("storefront-products");
  cacheLife({
    stale: 300,
    revalidate: 300,
    expire: 1800,
  });

  try {
    const client = getSupabaseAdmin();

    const [prodRes, varRes, imgRes] = await Promise.all([
      client
        .from("products")
        .select("id, slug, updated_at, created_at, sort_order")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      client
        .from("product_variants")
        .select("id, product_id, is_active, is_combo, updated_at"),
      client
        .from("product_images")
        .select("product_id, storage_path, is_primary, sort_order")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    if (prodRes.error || !prodRes.data || prodRes.data.length === 0) {
      if (prodRes.error) {
        console.warn("[Sitemap] Failed to load active products:", prodRes.error.message);
      }
      return [];
    }

    const comboVariantIds = (varRes.data || [])
      .filter((v) => v.is_combo && v.is_active !== false)
      .map((v) => v.id);

    const validComboVariantIds = new Set<string>();
    let comboQueryFailed = false;

    if (comboVariantIds.length > 0) {
      const { data: comboRows, error: comboErr } = await client
        .from("combo_items")
        .select("combo_variant_id")
        .in("combo_variant_id", comboVariantIds);

      if (comboErr) {
        console.warn("[Sitemap] Failed to query combo_items:", comboErr.message);
        comboQueryFailed = true;
      } else if (comboRows) {
        for (const row of comboRows) {
          if (row.combo_variant_id) {
            validComboVariantIds.add(row.combo_variant_id);
          }
        }
      }
    }

    const activeVariantUpdatesByProduct = new Map<string, string[]>();
    if (varRes.data) {
      for (const v of varRes.data) {
        if (v.is_active === false) continue;
        if (v.is_combo && (comboQueryFailed || !validComboVariantIds.has(v.id))) {
          continue;
        }
        const timestamps = activeVariantUpdatesByProduct.get(v.product_id) || [];
        if (v.updated_at) timestamps.push(v.updated_at);
        activeVariantUpdatesByProduct.set(v.product_id, timestamps);
      }
    }

    const imagesByProduct = new Map<string, string[]>();
    if (imgRes.data) {
      for (const img of imgRes.data) {
        const imageUrl = resolveAbsoluteImageUrl(img.storage_path, siteUrl);
        if (!imageUrl) continue;
        const list = imagesByProduct.get(img.product_id) || [];
        if (!list.includes(imageUrl)) {
          if (img.is_primary) {
            list.unshift(imageUrl);
          } else {
            list.push(imageUrl);
          }
        }
        imagesByProduct.set(img.product_id, list);
      }
    }

    const entries: SitemapProductEntry[] = [];

    for (const product of prodRes.data) {
      const variantTimestamps = activeVariantUpdatesByProduct.get(product.id);
      if (!variantTimestamps) continue;

      const identifier = (product.slug || product.id || "").trim();
      if (!identifier) continue;

      const lastModified = pickLatestIsoTimestamp(
        product.updated_at,
        product.created_at,
        ...variantTimestamps
      );

      entries.push({
        identifier,
        ...(lastModified ? { lastModified } : {}),
        images: imagesByProduct.get(product.id) || [],
      });
    }

    return entries;
  } catch (err) {
    console.warn("[Sitemap] Failed to generate product entries:", err);
    return [];
  }
}
