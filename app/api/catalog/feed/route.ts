import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import {
  getMetaSdkConfig,
  resolvePublicImageUrl,
  formatPriceForMeta,
  resolveProductCatalogTaxonomy,
} from "@/lib/meta-catalog";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Public RSS/XML Feed for Facebook / Meta Catalog and Google Merchant Center.
 * URL: /api/catalog/feed
 */
export async function GET() {
  const config = getMetaSdkConfig();
  const client = supabaseAdmin || supabase;
  const siteUrl = config.siteUrl;

  let storeName = "খেজুরের খাটি গুড়";
  try {
    const { data: settings } = await client
      .from("site_settings")
      .select("key, value")
      .in("key", ["store.name", "store.name_bn"]);

    if (settings) {
      for (const s of settings) {
        if (s.value) {
          const val = String(s.value).replace(/^["']|["']$/g, "").trim();
          if (val) storeName = val;
        }
      }
    }
  } catch {
    // fallback
  }

  const { data: dbProducts, error: dbErr } = await client
    .from("products")
    .select(`
      id, slug, name, name_bn, summary, summary_bn, description, description_bn,
      origin, status, category_id, google_product_category, product_type,
      category:categories(id, name, name_bn, google_product_category, product_type),
      variants:product_variants(*),
      images:product_images(*)
    `)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (dbErr || !dbProducts) {
    return new NextResponse(`Error loading products: ${dbErr?.message || "Not found"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const itemsXml: string[] = [];

  for (const prod of dbProducts) {
    const rawImages: any[] = Array.isArray(prod.images) ? prod.images : [];
    rawImages.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    const allProductImageUrls = rawImages
      .map((img) => resolvePublicImageUrl(img.storage_path, siteUrl))
      .filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);

    const primaryImageUrl = allProductImageUrls[0] || resolvePublicImageUrl(null, siteUrl);
    const extraImageUrls = allProductImageUrls.filter((url) => url !== primaryImageUrl);

    const productTitle = prod.name_bn || prod.name || "Traditional Molasses";
    const productDesc =
      prod.summary_bn ||
      prod.summary ||
      prod.description_bn ||
      prod.description ||
      `${productTitle} - 100% Pure & Authentic from village tree-tappers.`;

    const productLink = prod.slug
      ? `${siteUrl.replace(/\/$/, "")}/products/${prod.slug}`
      : `${siteUrl.replace(/\/$/, "")}#${prod.id}`;

    const taxonomy = resolveProductCatalogTaxonomy(prod);
    const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
    const activeVariants = variants.filter((v) => v.is_active !== false);

    if (activeVariants.length === 0) {
      itemsXml.push(`
    <item>
      <g:id>${escapeXml(prod.id)}</g:id>
      <g:title>${escapeXml(productTitle)}</g:title>
      <g:description>${escapeXml(productDesc)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(primaryImageUrl)}</g:image_link>
      ${extraImageUrls.map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`).join("\n      ")}
      <g:brand>${escapeXml(storeName)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>in stock</g:availability>
      <g:price>${escapeXml(formatPriceForMeta(500, "BDT"))}</g:price>
      <g:google_product_category>${escapeXml(taxonomy.googleProductCategory)}</g:google_product_category>
      <g:product_type>${escapeXml(taxonomy.productType)}</g:product_type>
    </item>`);
      continue;
    }

    // Default variant / Primary product
    const defaultVariant = activeVariants.find((v) => v.is_default) || activeVariants[0];
    const defaultPrice = Number(defaultVariant.price) || 0;
    const defaultComparePrice = Number(defaultVariant.compare_at_price) || 0;
    const defaultAvailability =
      defaultVariant.stock_status === "out_of_stock" ? "out of stock" : "in stock";

    itemsXml.push(`
    <item>
      <g:id>${escapeXml(prod.id)}</g:id>
      <g:title>${escapeXml(productTitle)}</g:title>
      <g:description>${escapeXml(productDesc)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(primaryImageUrl)}</g:image_link>
      ${extraImageUrls.map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`).join("\n      ")}
      <g:brand>${escapeXml(storeName)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${defaultAvailability}</g:availability>
      <g:price>${escapeXml(formatPriceForMeta(defaultComparePrice > defaultPrice ? defaultComparePrice : defaultPrice, "BDT"))}</g:price>
      ${defaultComparePrice > defaultPrice ? `<g:sale_price>${escapeXml(formatPriceForMeta(defaultPrice, "BDT"))}</g:sale_price>` : ""}
      <g:google_product_category>${escapeXml(taxonomy.googleProductCategory)}</g:google_product_category>
      <g:product_type>${escapeXml(taxonomy.productType)}</g:product_type>
    </item>`);

    // Additional variants if multiple exist
    if (activeVariants.length > 1) {
      for (const variant of activeVariants) {
        const variantTitle = `${productTitle} (${variant.name_bn || variant.name})`;
        const variantPrice = Number(variant.price) || defaultPrice;
        const variantComparePrice = Number(variant.compare_at_price) || 0;
        const variantAvailability =
          variant.stock_status === "out_of_stock" ? "out of stock" : "in stock";

        const variantImages = rawImages.filter((img) => img.variant_id === variant.id);
        const variantPrimary = variantImages[0]
          ? resolvePublicImageUrl(variantImages[0].storage_path, siteUrl)
          : primaryImageUrl;
        const variantExtras = allProductImageUrls.filter((url) => url !== variantPrimary);

        itemsXml.push(`
    <item>
      <g:id>${escapeXml(variant.id)}</g:id>
      <g:item_group_id>${escapeXml(prod.id)}</g:item_group_id>
      <g:title>${escapeXml(variantTitle)}</g:title>
      <g:description>${escapeXml(productDesc)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(variantPrimary)}</g:image_link>
      ${variantExtras.map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`).join("\n      ")}
      <g:brand>${escapeXml(storeName)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${variantAvailability}</g:availability>
      <g:price>${escapeXml(formatPriceForMeta(variantComparePrice > variantPrice ? variantComparePrice : variantPrice, "BDT"))}</g:price>
      ${variantComparePrice > variantPrice ? `<g:sale_price>${escapeXml(formatPriceForMeta(variantPrice, "BDT"))}</g:sale_price>` : ""}
      <g:google_product_category>${escapeXml(taxonomy.googleProductCategory)}</g:google_product_category>
      <g:product_type>${escapeXml(taxonomy.productType)}</g:product_type>
    </item>`);
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)} - Product Catalog Feed</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Authentic artisanal Date Palm Jaggery and Molasses feed for Facebook &amp; Google Shopping</description>
${itemsXml.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
