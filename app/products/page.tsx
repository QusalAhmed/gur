import { Suspense } from "react";
import { StorefrontProductsClient } from "@/components/storefront/storefront-products-client";
import { ProductLoading } from "@/components/storefront/product";

export const instant = true;

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductLoading autoScrollToProduct={true} />}>
      <StorefrontProductsClient autoScrollToProduct={true} />
    </Suspense>
  );
}

