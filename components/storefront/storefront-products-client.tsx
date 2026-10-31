"use client";

import React from "react";
import { useStorefrontProducts } from "@/hooks/use-storefront-products";
import { ProductShowcase } from "./product-showcase";

export function StorefrontProductsClient() {
  // TanStack Query to get storefront products, variants, and store settings
  const { data, isLoading } = useStorefrontProducts();

  return (
    <ProductShowcase
      products={data?.products ?? []}
      defaultHotline={data?.hotline ?? "01843557389"}
      storeName={data?.storeName ?? "খেজুরের খাঁটি গুড়"}
      storeSubtitle={data?.storeSubtitle}
      isLoading={isLoading}
    />
  );
}
