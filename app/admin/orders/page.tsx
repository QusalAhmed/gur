import * as React from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import {
  fetchOrdersFromDb,
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

async function OrdersDataLoader() {
  const queryClient = getQueryClient();

  // SSR Prefetch orders, catalog products, and geo data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["admin", "orders"],
      queryFn: fetchOrdersFromDb,
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

export default function OrdersPage() {
  return (
    <React.Suspense fallback={<OrdersLoading />}>
      <OrdersDataLoader />
    </React.Suspense>
  );
}
