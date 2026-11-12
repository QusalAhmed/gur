import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { getCachedSeoSettings } from "@/lib/seo-settings";

export const instant = true;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const title = seo.productsTitle;
  const description = seo.productsDescription;
  const ogImages = seo.ogImageUrl
    ? [{ url: seo.ogImageUrl, width: 1200, height: 630, alt: title }]
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: "/products",
    },
    openGraph: {
      title,
      description,
      url: `${seo.siteUrl}/products`,
      type: "website",
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImages ? { images: [seo.ogImageUrl] } : {}),
    },
  };
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductLoading autoScrollToProduct={true} />}>
      <Product autoScrollToProduct={true} />
    </Suspense>
  );
}
