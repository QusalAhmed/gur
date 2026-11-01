import * as React from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import {
  getStorefrontProductsAction,
  type StorefrontDataResult,
} from "@/actions/storefront-products";
import { STOREFRONT_PRODUCTS_QUERY_KEY } from "@/lib/storefront-query";
import { StorefrontProductsClient } from "./storefront-products-client";
import { ProductShowcase } from "./product-showcase";

export function resolveProductImage(storageUrl?: string): string {
  if (storageUrl && (storageUrl.startsWith("http://") || storageUrl.startsWith("https://"))) {
    return storageUrl;
  }
  return "/images/products/blackstrap-drum.jpg";
}

export function ProductLoading() {
  return (
    <ProductShowcase
      products={[]}
      defaultHotline="01843557389"
      storeName="খেজুরের খাঁটি গুড়"
      isLoading={true}
    />
  );
}

interface ProductProps {
  featuredIdentifier?: string;
  autoScrollToProduct?: boolean;
}

export async function Product({
  featuredIdentifier,
  autoScrollToProduct,
}: ProductProps = {}) {
  const queryClient = getQueryClient();

  // Prefetch storefront products into TanStack Query cache on SSR
  try {
    await queryClient.prefetchQuery({
      queryKey: STOREFRONT_PRODUCTS_QUERY_KEY,
      queryFn: getStorefrontProductsAction,
    });
  } catch (err) {
    console.error("Failed to prefetch storefront products on SSR:", err);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StorefrontProductsClient
        featuredIdentifier={featuredIdentifier}
        autoScrollToProduct={autoScrollToProduct}
      />
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
