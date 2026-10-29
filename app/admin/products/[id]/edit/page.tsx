import * as React from "react";
import { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { fetchProductDetailById, fetchCategoriesList } from "@/lib/supabase";
import { EditProductClient } from "@/components/admin/edit-product-client";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const instant = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Edit Product | Admin Catalog`,
    description: `Edit product details, packaging variants and media`,
  };
}

async function EditProductDataLoader({ id }: { id: string }) {
  const queryClient = getQueryClient();

  // Prefetch product details and categories on the server
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin", "product", id],
      queryFn: () => fetchProductDetailById(id),
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "categories-list"],
      queryFn: fetchCategoriesList,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EditProductClient id={id} />
    </HydrationBoundary>
  );
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <React.Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-2 sm:px-4 space-y-6 animate-pulse">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <EditProductDataLoader id={id} />
    </React.Suspense>
  );
}
