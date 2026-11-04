"use cache";

import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { Product, ProductLoading } from "@/components/storefront/product";

export default async function HomePage() {
  cacheLife("minutes");

  return (
    <Suspense fallback={<ProductLoading />}>
      <Product />
    </Suspense>
  );
}
