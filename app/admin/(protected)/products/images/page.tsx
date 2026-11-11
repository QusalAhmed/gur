import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { requireStaffMember } from "@/lib/admin-guard";
import {
  fetchProductImagesAction,
  fetchImageKitMediaAction,
  fetchProductsForImageAssignmentAction,
} from "@/actions/product-images";
import { ProductImagesClient } from "@/components/admin/images/product-images-client";

export const metadata: Metadata = {
  title: "Product Images & Media | Admin",
  description: "Manage catalog product media gallery, primary hero covers, and ImageKit assets",
};

// Opt-out of instant navigation validation for dynamic admin prefetch
export const instant = false;

async function ProductImagesDataLoader() {
  await connection();
  await requireStaffMember("/admin/products/images");
  const queryClient = getQueryClient();

  // Prefetch product images, ImageKit media library, and product list on server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin", "imagekit-media"],
      queryFn: fetchImageKitMediaAction,
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "product-images"],
      queryFn: fetchProductImagesAction,
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "products-for-images"],
      queryFn: fetchProductsForImageAssignmentAction,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductImagesClient />
    </HydrationBoundary>
  );
}

export default function ProductImagesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between border-b border-border/80 pb-5">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted/60 rounded-xl" />
              <div className="h-4 w-80 bg-muted/40 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8.5 w-24 bg-muted/50 rounded-lg" />
              <div className="h-8.5 w-36 bg-amber-600/30 rounded-lg" />
            </div>
          </div>

          {/* Metrics Strip Skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                <div className="h-3 w-20 bg-muted/60 rounded" />
                <div className="h-6 w-12 bg-muted/80 rounded" />
              </div>
            ))}
          </div>

          {/* Nav & Search Skeleton */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3">
            <div className="h-9 w-64 bg-muted/40 rounded-xl" />
            <div className="h-8 w-24 bg-muted/30 rounded-lg" />
          </div>

          <div className="h-9 w-full max-w-sm bg-muted/40 rounded-lg" />

          {/* Visual Cards Skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl border border-border/60 bg-card p-2.5 space-y-3">
                <div className="h-48 w-full bg-muted/60 rounded-xl" />
                <div className="h-3.5 w-3/4 bg-muted/70 rounded" />
                <div className="h-3 w-1/2 bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <ProductImagesDataLoader />
    </React.Suspense>
  );
}
