"use client";

import React from "react";
import { useStorefrontProducts } from "@/hooks/use-storefront-products";
import { ProductShowcase } from "./product-showcase";
import { Sparkles, Loader2 } from "lucide-react";

export function StorefrontProductsClient() {
  // TanStack Query to get storefront products, variants, and store settings
  const { data, isLoading, error } = useStorefrontProducts();

  if (isLoading || !data) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#fdfbf7] dark:bg-stone-950 text-amber-950 dark:text-amber-100 select-none">
        <div className="w-16 h-16 rounded-full bg-amber-200 dark:bg-stone-800 flex items-center justify-center text-amber-800 dark:text-amber-200 shadow-lg">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>
        <p className="mt-4 font-bold text-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-700 dark:text-amber-300" />
          <span>দোকানের পণ্য লোড হচ্ছে...</span>
        </p>
      </div>
    );
  }

  return (
    <ProductShowcase
      products={data.products}
      defaultHotline={data.hotline}
      storeName={data.storeName}
      storeSubtitle={data.storeSubtitle}
    />
  );
}

