import type { MetadataRoute } from "next";
import { getCachedSeoSettings } from "@/lib/seo-settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getCachedSeoSettings();

  if (!seo.allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: `${seo.siteUrl}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/order-confirmed/"],
    },
    sitemap: `${seo.siteUrl}/sitemap.xml`,
  };
}
