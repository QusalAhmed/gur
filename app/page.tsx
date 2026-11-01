import { Suspense } from "react";
import { Product, ProductLoading } from "@/components/storefront/product";

export const instant = false;

interface HomePageProps {
  searchParams?: Promise<{ product?: string; p?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const sp = searchParams ? await searchParams : undefined;
  const featuredId = sp?.product || sp?.p;

  return (
    <Suspense fallback={<ProductLoading />}>
      <Product
        featuredIdentifier={featuredId}
        autoScrollToProduct={Boolean(featuredId)}
      />
    </Suspense>
  );
}
