import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { getStorefrontProductsAction } from "@/actions/storefront-products";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  getCachedSeoSettings,
} from "@/lib/seo-settings";

export const instant = false;

interface ProductPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const rawVariantId =
    typeof sp?.variant === "string" ? sp.variant : typeof sp?.v === "string" ? sp.v : undefined;

  const seo = await getCachedSeoSettings();

  try {
    const storefrontData = await getStorefrontProductsAction();
    const product = storefrontData.products.find(
      (p) => p.slug === id || p.id === id
    );

    if (!product) {
      return {
        title: storefrontData.storeName || seo.storeName,
        description:
          storefrontData.storeSubtitle || seo.defaultDescription,
        alternates: {
          canonical: `/products/${encodeURIComponent(id)}`,
        },
      };
    }

    const matchedVariant = rawVariantId && Array.isArray(product.variants)
      ? product.variants.find((v) => v.id === rawVariantId)
      : undefined;

    const baseName = product.nameBn || product.name;
    const variantName = matchedVariant?.nameBn || matchedVariant?.name;
    const hasDistinctVariantName =
      variantName &&
      variantName.toLowerCase() !== baseName.toLowerCase() &&
      variantName.toLowerCase() !== (product.name || "").toLowerCase();

    const customSeoTitle = product.seoTitle?.trim();
    const fallbackTitlePart = hasDistinctVariantName
      ? `${baseName} (${variantName})`
      : baseName;
    const resolvedTitle = customSeoTitle || fallbackTitlePart;
    const ogTitle = resolvedTitle.includes("|")
      ? resolvedTitle
      : `${resolvedTitle} | ${storefrontData.storeName || seo.storeName}`;

    const description =
      product.seoDescription?.trim() ||
      product.summaryBn ||
      product.summary ||
      storefrontData.storeSubtitle ||
      seo.defaultDescription;
    const image = product.image || seo.ogImageUrl;
    const canonicalPath = `/products/${encodeURIComponent(product.slug || product.id)}`;

    return {
      title: resolvedTitle.includes("|") ? { absolute: resolvedTitle } : resolvedTitle,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: ogTitle,
        description,
        url: canonicalPath,
        type: "website",
        images: image
          ? [
              {
                url: image,
                width: 1000,
                height: 750,
                alt: hasDistinctVariantName ? `${baseName} (${variantName})` : baseName,
              },
            ]
          : [],
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: ogTitle,
        description,
        images: image ? [image] : [],
      },
    };
  } catch {
    return {
      title: seo.storeName,
      description: seo.defaultDescription,
    };
  }
}

async function ProductStructuredData({
  id,
  variantId,
}: {
  id: string;
  variantId?: string;
}) {
  try {
    const [seo, storefrontData] = await Promise.all([
      getCachedSeoSettings(),
      getStorefrontProductsAction(),
    ]);
    const product = storefrontData.products.find(
      (p) => p.slug === id || p.id === id
    );
    if (!product) return null;

    const productJsonLd = buildProductJsonLd(seo, product, variantId);
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(seo.siteUrl, [
      { name: "হোম", path: "/" },
      { name: "পণ্যসমূহ", path: "/products" },
      {
        name: product.nameBn || product.name,
        path: `/products/${encodeURIComponent(product.slug || product.id)}`,
      },
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </>
    );
  } catch {
    return null;
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialVariantId =
    typeof sp?.variant === "string" ? sp.variant : typeof sp?.v === "string" ? sp.v : undefined;

  return (
    <>
      <Suspense fallback={null}>
        <ProductStructuredData id={id} variantId={initialVariantId} />
      </Suspense>
      <Suspense fallback={<ProductLoading />}>
        <Product
          featuredIdentifier={id}
          initialVariantId={initialVariantId}
          autoScrollToProduct={true}
        />
      </Suspense>
    </>
  );
}

