import * as React from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { getOrdersAction } from "@/actions/orders";
import {
  fetchCatalogProductsFromDb,
  fetchGeoDivisionsAndDistricts,
  fetchGeoDistricts,
  fallbackDivisions,
  fallbackDistricts,
} from "@/lib/supabase";
import { OrdersClient } from "@/components/admin/orders-client";
import OrdersLoading from "./loading";

// Opt-out of instant navigation validation for dynamic admin prefetch
export const instant = false;

interface OrdersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function OrdersDataLoader({ searchParams }: OrdersPageProps) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number(resolvedSearchParams?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(resolvedSearchParams?.pageSize) || 10));
  const status = typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : "all";
  const channel = typeof resolvedSearchParams?.channel === "string" ? resolvedSearchParams.channel : "all";
  const payment = typeof resolvedSearchParams?.payment === "string" ? resolvedSearchParams.payment : "all";
  const search = typeof resolvedSearchParams?.search === "string" ? resolvedSearchParams.search : "";
  const sortBy = typeof resolvedSearchParams?.sortBy === "string" ? resolvedSearchParams.sortBy : "placed_at";
  const sortOrder = resolvedSearchParams?.sortOrder === "asc" ? "asc" : "desc";

  const queryClient = getQueryClient();

  // SSR Prefetch paginated orders with exact URL params, catalog products, and geo data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: [
        "admin",
        "orders",
        {
          page,
          pageSize,
          status,
          channel,
          payment,
          search,
          sortBy,
          sortOrder,
        },
      ],
      queryFn: () =>
        getOrdersAction({
          page,
          pageSize,
          status,
          channel,
          payment,
          search,
          sortBy,
          sortOrder,
        }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "catalog-products"],
      queryFn: fetchCatalogProductsFromDb,
    }),
    queryClient.prefetchQuery({
      queryKey: ["admin", "geo-data"],
      queryFn: async () => {
        try {
          const [geoAll, dbDistricts] = await Promise.all([
            fetchGeoDivisionsAndDistricts(),
            fetchGeoDistricts(),
          ]);
          return {
            divisions:
              geoAll.divisions && geoAll.divisions.length > 0
                ? geoAll.divisions
                : fallbackDivisions,
            districts:
              dbDistricts && dbDistricts.length > 0
                ? dbDistricts
                : fallbackDistricts,
          };
        } catch {
          return {
            divisions: fallbackDivisions,
            districts: fallbackDistricts,
          };
        }
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrdersClient />
    </HydrationBoundary>
  );
}

export default function OrdersPage({ searchParams }: OrdersPageProps) {
  return (
    <React.Suspense fallback={<OrdersLoading />}>
      <OrdersDataLoader searchParams={searchParams} />
    </React.Suspense>
  );
}
