import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";

export const instant = true;

export const metadata: Metadata = {
  alternates: {
    canonical: "/products",
  },
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductLoading autoScrollToProduct={true} />}>
      <Product autoScrollToProduct={true} />
    </Suspense>
  );
}
