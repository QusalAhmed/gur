import { Suspense } from "react";
import { Product, ProductLoading } from "@/components/storefront/product";

export const instant = true;

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductLoading autoScrollToProduct={true} />}>
      <Product autoScrollToProduct={true} />
    </Suspense>
  );
}
