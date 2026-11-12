import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { getCachedSeoSettings } from "@/lib/seo-settings";

export const instant = true;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const title = seo.homeTitle || seo.defaultTitle;
  const description = seo.homeDescription || seo.defaultDescription;
  const ogImages = seo.ogImageUrl
    ? [{ url: seo.ogImageUrl, width: 1200, height: 630, alt: title }]
    : undefined;

  return {
    ...(seo.homeTitle ? { title: { absolute: seo.homeTitle } } : {}),
    description,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title,
      description,
      url: seo.siteUrl,
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

export default function HomePage() {
  return (
    <Suspense fallback={<ProductLoading />}>
      <Product autoScrollToProduct={false} />
    </Suspense>
  );
}
