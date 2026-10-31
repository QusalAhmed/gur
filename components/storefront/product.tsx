import * as React from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import {
  getStorefrontProductsAction,
  type StorefrontDataResult,
} from "@/actions/storefront-products";
import { STOREFRONT_PRODUCTS_QUERY_KEY } from "@/lib/storefront-query";
import { StorefrontProductsClient } from "./storefront-products-client";
import { Sparkles, Loader2 } from "lucide-react";

export function resolveProductImage(storageUrl?: string): string {
  if (storageUrl && (storageUrl.startsWith("http://") || storageUrl.startsWith("https://"))) {
    return storageUrl;
  }
  return "/images/products/blackstrap-drum.jpg";
}

export function ProductLoading() {
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

export async function Product() {
  const queryClient = getQueryClient();

  // Prefetch storefront products into TanStack Query cache on SSR
  await queryClient.prefetchQuery({
    queryKey: STOREFRONT_PRODUCTS_QUERY_KEY,
    queryFn: getStorefrontProductsAction,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StorefrontProductsClient />
    </HydrationBoundary>
  );
}

export default Product;
export {
  getStorefrontProductsAction as getStorefrontData,
  Product as Products,
  Product as StorefrontProducts,
  Product as StorefrontContent,
  ProductLoading as StorefrontLoading,
};
