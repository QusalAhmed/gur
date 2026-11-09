import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { fetchCombosListAction } from "@/actions/combos";
import { fetchProductsFromDb } from "@/lib/supabase";
import { CombosClient } from "@/components/admin/combos/combos-client";

export const metadata: Metadata = {
  title: "Combos & Bundles | Admin",
  description: "Manage multi-product bundle offers, composite packaging, and shared inventory",
};

// Opt-out of instant navigation validation for dynamic admin prefetch
export const instant = false;

async function CombosDataLoader() {
  await connection();
  const queryClient = getQueryClient();

  // Prefetch combos and catalog products on the server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin", "combos"],
      queryFn: () => fetchCombosListAction(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "products"],
      queryFn: fetchProductsFromDb,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CombosClient />
    </HydrationBoundary>
  );
}

export default function CombosPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted/60 rounded-lg" />
              <div className="h-4 w-96 bg-muted/40 rounded-lg" />
            </div>
            <div className="h-9 w-32 bg-muted/50 rounded-lg" />
          </div>
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
      <CombosDataLoader />
    </React.Suspense>
  );
}
