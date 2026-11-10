import * as React from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { dehydrate } from "@/lib/hydrate";
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

export function ProductLoading({
  autoScrollToProduct = false,
}: {
  autoScrollToProduct?: boolean;
} = {}) {
  return (
    <ProductShowcase
      products={[]}
      defaultHotline="01843557389"
      storeName="খেজুরের খাঁটি গুড়"
      isLoading={true}
      autoScrollToProduct={autoScrollToProduct}
    />
  );
}

interface ProductProps {
  featuredIdentifier?: string;
  initialVariantId?: string;
  autoScrollToProduct?: boolean;
}

export async function Product({
  featuredIdentifier,
  initialVariantId,
  autoScrollToProduct,
}: ProductProps = {}) {
  let storefrontData: StorefrontDataResult | undefined = undefined;

  // Fetch storefront products directly and dehydrate with cached timestamp for SSR
  try {
    storefrontData = await getStorefrontProductsAction();
  } catch (err) {
    console.error("Failed to fetch storefront products on SSR:", err);
  }

  const state = await dehydrate(
    [
      {
        queryKey: STOREFRONT_PRODUCTS_QUERY_KEY,
        data: storefrontData,
      },
    ],
    { tags: ["storefront-products"] }
  );

  return (
    <HydrationBoundary state={state}>
      <StorefrontProductsClient
        featuredIdentifier={featuredIdentifier}
        initialVariantId={initialVariantId}
        autoScrollToProduct={autoScrollToProduct}
        initialData={storefrontData}
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
