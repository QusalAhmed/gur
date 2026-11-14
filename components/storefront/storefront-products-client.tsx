"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useStorefrontProducts } from "@/hooks/use-storefront-products";
import type { StorefrontDataResult } from "@/actions/storefront-products";
import { ProductShowcase } from "./product-showcase";
import { ProductPixelTracker } from "./product-pixel-tracker";

interface StorefrontProductsClientProps {
  featuredIdentifier?: string;
  initialVariantId?: string;
  autoScrollToProduct?: boolean;
  initialData?: StorefrontDataResult;
}

export function StorefrontProductsClient({
  featuredIdentifier,
  initialVariantId,
  autoScrollToProduct = false,
  initialData,
}: StorefrontProductsClientProps) {
  const searchParams = useSearchParams();
  const urlProduct = searchParams?.get("product") || searchParams?.get("p") || undefined;
  const urlVariant = searchParams?.get("variant") || searchParams?.get("v") || undefined;
  const effectiveFeaturedId = featuredIdentifier || urlProduct;
  const effectiveVariantId = initialVariantId || urlVariant;
  const effectiveAutoScroll = autoScrollToProduct || Boolean(effectiveFeaturedId);

  // TanStack Query to get storefront products, variants, and store settings
  const { data, isLoading } = useStorefrontProducts({ initialData });

  const featuredProduct = useMemo(() => {
    if (!effectiveFeaturedId || !data?.products || data.products.length === 0) {
      return null;
    }
    return (
      data.products.find(
        (p) => p.slug === effectiveFeaturedId || p.id === effectiveFeaturedId
      ) || null
    );
  }, [data?.products, effectiveFeaturedId]);

  const orderedProducts = useMemo(() => {
    const rawProducts = data?.products ?? [];
    if (!effectiveFeaturedId || rawProducts.length === 0) {
      return rawProducts;
    }

    const featuredIndex = rawProducts.findIndex(
      (p) => p.slug === effectiveFeaturedId || p.id === effectiveFeaturedId
    );

    if (featuredIndex > 0) {
      const featured = rawProducts[featuredIndex];
      const rest = rawProducts.filter((_, idx) => idx !== featuredIndex);
      return [featured, ...rest];
    }

    return rawProducts;
  }, [data?.products, effectiveFeaturedId]);

  return (
    <>
      <ProductPixelTracker product={featuredProduct} variantId={effectiveVariantId} />
      <ProductShowcase
        products={orderedProducts}
        defaultHotline={data?.hotline ?? "01843557389"}
        storeName={data?.storeName ?? "খেজুরের খাঁটি গুড়"}
        storeSubtitle={data?.storeSubtitle}
        isLoading={isLoading}
        featuredIdentifier={effectiveFeaturedId}
        initialVariantId={effectiveVariantId}
        autoScrollToProduct={effectiveAutoScroll}
        deliveryConfig={data?.deliveryConfig}
      />
    </>
  );
}
