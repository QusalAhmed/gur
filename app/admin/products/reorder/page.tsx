import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { fetchProductsFromDb } from "@/lib/supabase";
import { ReorderProductsPageClient } from "@/components/admin/reorder-products-page-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Storefront Product Order | Admin Catalog",
  description: "Set and arrange which products appear first, second, and so on on the storefront showcase",
};

// Opt-out of instant navigation validation for dynamic admin prefetch
export const instant = false;

async function ReorderProductsDataLoader() {
  await connection();
  const queryClient = getQueryClient();

  // Prefetch active products on the server
  await queryClient.prefetchQuery({
    queryKey: ["admin", "products"],
    queryFn: fetchProductsFromDb,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReorderProductsPageClient />
    </HydrationBoundary>
  );
}

export default function ReorderProductsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse pb-12">
          <div className="flex items-center justify-between border-b border-border/80 pb-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      }
    >
      <ReorderProductsDataLoader />
    </React.Suspense>
  );
}
