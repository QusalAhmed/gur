import * as React from "react";
import { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "New Product | Admin Catalog",
  description: "Create a new product in the molasses store catalog",
};

export const instant = false;

export default function NewProductPage() {
  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4">
      <React.Suspense
        fallback={
          <div className="space-y-6 animate-pulse">
            <Skeleton className="h-10 w-48 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        }
      >
        <ProductForm mode="create" />
      </React.Suspense>
    </div>
  );
}
