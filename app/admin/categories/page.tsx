import * as React from "react";
import { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { fetchCategoriesFromDb, fetchCategoriesList } from "@/lib/supabase";
import { CategoriesClient } from "@/components/admin/categories-client";

export const metadata: Metadata = {
  title: "Categories | Admin Catalog",
  description: "Manage catalog taxonomy, English & Bangla category labels, and hierarchy",
};

// Opt-out of instant navigation validation for dynamic admin prefetch
export const instant = false;

async function CategoriesDataLoader() {
  const queryClient = getQueryClient();

  // Prefetch categories on the server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin", "categories"],
      queryFn: fetchCategoriesFromDb,
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "categories-list"],
      queryFn: fetchCategoriesList,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CategoriesClient />
    </HydrationBoundary>
  );
}

export default function CategoriesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-muted/60 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-24 bg-muted/50 rounded-xl" />
            <div className="h-24 bg-muted/50 rounded-xl" />
            <div className="h-24 bg-muted/50 rounded-xl" />
          </div>
          <div className="h-96 bg-muted/40 rounded-xl" />
        </div>
      }
    >
      <CategoriesDataLoader />
    </React.Suspense>
  );
}
