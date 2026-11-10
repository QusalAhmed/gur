"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getStorefrontProductsAction,
  type StorefrontDataResult,
} from "@/actions/storefront-products";
import { STOREFRONT_PRODUCTS_QUERY_KEY } from "@/lib/storefront-query";

export { STOREFRONT_PRODUCTS_QUERY_KEY };

export interface UseStorefrontProductsOptions {
  initialData?: StorefrontDataResult;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Custom TanStack Query hook to get active products and store settings for the storefront.
 * Fully cached, type-safe, and automatically updates when cache is invalidated.
 */
export function useStorefrontProducts(options?: UseStorefrontProductsOptions) {
  return useQuery<StorefrontDataResult>({
    queryKey: STOREFRONT_PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      // In browser context, fetch via standard GET API route to prevent premature Server Action dispatch before App Router initialization
      if (typeof window !== "undefined") {
        try {
          const res = await fetch("/api/storefront/products");
          if (res.ok) {
            return await res.json();
          }
        } catch (err) {
          console.warn("Failed to fetch products from /api/storefront/products, falling back:", err);
        }
      }
      return await getStorefrontProductsAction();
    },
    initialData: options?.initialData,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes fresh
    refetchOnWindowFocus: false,
  });
}

