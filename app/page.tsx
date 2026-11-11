import { Suspense } from "react";
import type { Metadata } from "next";
import { Product, ProductLoading } from "@/components/storefront/product";

export const instant = true;

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={<ProductLoading />}>
      <Product autoScrollToProduct={false} />
    </Suspense>
  );
}
