import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { getStorefrontProductsAction } from "@/actions/storefront-products";

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

  try {
    const storefrontData = await getStorefrontProductsAction();
    const product = storefrontData.products.find(
      (p) => p.slug === id || p.id === id
    );

    if (!product) {
      return {
        title: storefrontData.storeName || "খেজুরের খাঁটি গুড়",
        description:
          storefrontData.storeSubtitle ||
          "গাছিদের সংগ্রহ করা খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়।",
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

    const title = hasDistinctVariantName
      ? `${baseName} (${variantName}) | ${storefrontData.storeName || "খেজুরের খাঁটি গুড়"}`
      : `${baseName} | ${storefrontData.storeName || "খেজুরের খাঁটি গুড়"}`;

    const description =
      product.summaryBn ||
      product.summary ||
      storefrontData.storeSubtitle ||
      "গাছিদের সংগ্রহ করা খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়।";
    const image = product.image;
    const canonicalPath = `/products/${encodeURIComponent(product.slug || product.id)}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title,
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
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : [],
      },
    };
  } catch {
    return {
      title: "খেজুরের খাঁটি গুড়",
      description: "গাছিদের সংগ্রহ করা খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়।",
    };
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialVariantId =
    typeof sp?.variant === "string" ? sp.variant : typeof sp?.v === "string" ? sp.v : undefined;

  return (
    <Suspense fallback={<ProductLoading />}>
      <Product
        featuredIdentifier={id}
        initialVariantId={initialVariantId}
        autoScrollToProduct={true}
      />
    </Suspense>
  );
}

