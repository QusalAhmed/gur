"use client";

import React, { useMemo } from "react";
import { useStorefrontProducts } from "@/hooks/use-storefront-products";
import { ProductShowcase } from "./product-showcase";

interface StorefrontProductsClientProps {
  featuredIdentifier?: string;
  autoScrollToProduct?: boolean;
}

export function StorefrontProductsClient({
  featuredIdentifier,
  autoScrollToProduct = false,
}: StorefrontProductsClientProps) {
  // TanStack Query to get storefront products, variants, and store settings
  const { data, isLoading } = useStorefrontProducts();

  const orderedProducts = useMemo(() => {
    const rawProducts = data?.products ?? [];
    if (!featuredIdentifier || rawProducts.length === 0) {
      return rawProducts;
    }

    const featuredIndex = rawProducts.findIndex(
      (p) => p.slug === featuredIdentifier || p.id === featuredIdentifier
    );

    if (featuredIndex > 0) {
      const featured = rawProducts[featuredIndex];
      const rest = rawProducts.filter((_, idx) => idx !== featuredIndex);
      return [featured, ...rest];
    }

    return rawProducts;
  }, [data?.products, featuredIdentifier]);

  return (
    <ProductShowcase
      products={orderedProducts}
      defaultHotline={data?.hotline ?? "01843557389"}
      storeName={data?.storeName ?? "খেজুরের খাঁটি গুড়"}
      storeSubtitle={data?.storeSubtitle}
      isLoading={isLoading}
      featuredIdentifier={featuredIdentifier}
      autoScrollToProduct={autoScrollToProduct || Boolean(featuredIdentifier)}
    />
  );
}
