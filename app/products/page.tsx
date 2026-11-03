import { Suspense } from "react";
import { Product, ProductLoading } from "@/components/storefront/product";

export const instant = false;

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductLoading />}>
      <Product autoScrollToProduct={true} />
    </Suspense>
  );
}

