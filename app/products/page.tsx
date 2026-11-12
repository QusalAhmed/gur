import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { buildPageSeoMetadata, getCachedSeoSettings } from "@/lib/seo-settings";

export const instant = true;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const title = seo.productsTitle;
  const description = seo.productsDescription;

  return buildPageSeoMetadata(seo, {
    title,
    ogTitle: title,
    description,
    canonicalPath: "/products",
    url: `${seo.siteUrl}/products`,
  });
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductLoading autoScrollToProduct={true} />}>
      <Product autoScrollToProduct={true} />
    </Suspense>
  );
}
