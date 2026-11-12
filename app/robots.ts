import type { MetadataRoute } from "next";
import { getCachedSeoSettings } from "@/lib/seo-settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getCachedSeoSettings();

  // Keep public HTML pages crawlable even when seo.allowIndexing is false so
  // crawlers can fetch pages and obey the <meta name="robots" content="noindex, nofollow"> directive.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/order-confirmed/"],
    },
    sitemap: `${seo.siteUrl}/sitemap.xml`,
  };
}
