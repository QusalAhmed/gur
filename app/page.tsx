import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { buildPageSeoMetadata, getCachedSeoSettings } from "@/lib/seo-settings";

export const instant = true;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const title = seo.homeTitle || seo.defaultTitle;
  const description = seo.homeDescription || seo.defaultDescription;

  return buildPageSeoMetadata(seo, {
    ...(seo.homeTitle ? { title: { absolute: seo.homeTitle } } : {}),
    ogTitle: title,
    description,
    canonicalPath: "/",
    url: seo.siteUrl,
  });
}

export default function HomePage() {
  return (
    <Suspense fallback={<ProductLoading />}>
      <Product autoScrollToProduct={false} />
    </Suspense>
  );
}
