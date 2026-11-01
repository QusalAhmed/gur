import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";
import { getStorefrontProductsAction } from "@/actions/storefront-products";

export const instant = false;

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
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
      };
    }

    const title = `${product.nameBn || product.name} | ${storefrontData.storeName || "খেজুরের খাঁটি গুড়"}`;
    const description =
      product.summaryBn ||
      product.summary ||
      storefrontData.storeSubtitle ||
      "গাছিদের সংগ্রহ করা খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়।";
    const image = product.image;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        images: image
          ? [
              {
                url: image,
                width: 1000,
                height: 750,
                alt: product.nameBn || product.name,
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

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<ProductLoading />}>
      <Product featuredIdentifier={id} autoScrollToProduct={true} />
    </Suspense>
  );
}

