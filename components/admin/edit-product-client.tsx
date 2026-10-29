"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, AlertCircle, Package } from "lucide-react";
import { fetchProductDetailById } from "@/lib/supabase";
import { ProductForm } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface EditProductClientProps {
  id: string;
}

export function EditProductClient({ id }: EditProductClientProps) {
  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => fetchProductDetailById(id),
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        <Skeleton className="h-10 w-96 max-w-full" />

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Product Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The requested product (ID: <code className="font-mono text-xs">{id}</code>) could not be
          found in the database or may have been deleted.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" asChild size="sm">
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Products
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => refetch()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4">
      <ProductForm initialData={product} mode="edit" />
    </div>
  );
}
