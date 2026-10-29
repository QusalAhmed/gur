import * as React from "react";
import { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import {
  fetchProductsFromDb,
  fetchCategoriesList,
} from "@/lib/supabase";
import { ProductsClient } from "@/components/admin/products-client";

export const metadata: Metadata = {
  title: "Products Catalog | Admin",
  description: "Manage catalog items, variants, stock status, and categorization",
};

// Opt-out of instant navigation validation for dynamic admin prefetch
export const instant = false;

async function ProductsDataLoader() {
  const queryClient = getQueryClient();

  // Prefetch products and categories on the server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin", "products"],
      queryFn: fetchProductsFromDb,
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "categories-list"],
      queryFn: fetchCategoriesList,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductsClient />
    </HydrationBoundary>
  );
}

export default function ProductsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-muted/60 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-24 bg-muted/50 rounded-xl" />
            <div className="h-24 bg-muted/50 rounded-xl" />
            <div className="h-24 bg-muted/50 rounded-xl" />
            <div className="h-24 bg-muted/50 rounded-xl" />
          </div>
          <div className="h-96 bg-muted/40 rounded-xl" />
        </div>
      }
    >
      <ProductsDataLoader />
    </React.Suspense>
  );
}
