import type { MetadataRoute } from "next";
import { escapeSitemapXmlUrl } from "@/lib/site-url";
import { getSitemapProducts } from "@/lib/sitemap-data";
import { getCachedSeoSettings } from "@/lib/seo-settings";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getCachedSeoSettings();
  if (seo.isFallback) {
    return [];
  }
  const siteUrl = seo.siteUrl;
  const products = await getSitemapProducts(siteUrl);

  const latestCatalogTimestamp = products.reduce<string | undefined>((latest, product) => {
    if (!product.lastModified) return latest;
    if (!latest || product.lastModified > latest) return product.lastModified;
    return latest;
  }, undefined);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: escapeSitemapXmlUrl(siteUrl),
      ...(latestCatalogTimestamp ? { lastModified: latestCatalogTimestamp } : {}),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: escapeSitemapXmlUrl(`${siteUrl}/products`),
      ...(latestCatalogTimestamp ? { lastModified: latestCatalogTimestamp } : {}),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: escapeSitemapXmlUrl(`${siteUrl}/contact`),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: escapeSitemapXmlUrl(`${siteUrl}/privacy-policy`),
      lastModified: "2026-11-01T00:00:00.000Z",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: escapeSitemapXmlUrl(`${siteUrl}/products/${encodeURIComponent(product.identifier)}`),
    ...(product.lastModified ? { lastModified: product.lastModified } : {}),
    changeFrequency: "weekly",
    priority: 0.8,
    ...(product.images.length > 0 ? { images: product.images } : {}),
  }));

  return [...staticRoutes, ...productRoutes];
}
