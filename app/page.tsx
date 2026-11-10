import { Suspense } from "react";
import { Product, ProductLoading } from "@/components/storefront/product";

export const instant = true;

export default function HomePage() {
  return (
    <Suspense fallback={<ProductLoading />}>
      <Product autoScrollToProduct={false} />
    </Suspense>
  );
}
