"use client";

import { useQueryClient } from "@tanstack/react-query";
import { STOREFRONT_PRODUCTS_QUERY_KEY } from "@/lib/storefront-query";
import {
  type DeliveryChargeConfig,
  DEFAULT_DELIVERY_CONFIG,
  calculateAuthoritativeDeliveryCharge,
  type DeliveryChargeResult,
} from "@/lib/delivery-charge";
import type { StorefrontDataResult } from "@/actions/storefront-products";

export function useDeliveryConfig(overrideConfig?: DeliveryChargeConfig): DeliveryChargeConfig {
  const queryClient = useQueryClient();
  const cachedData = queryClient.getQueryData<StorefrontDataResult>(STOREFRONT_PRODUCTS_QUERY_KEY);

  return overrideConfig || cachedData?.deliveryConfig || DEFAULT_DELIVERY_CONFIG;
}

export function useDeliveryCharge({
  zone,
  subtotal,
  hasItems,
  overrideConfig,
}: {
  zone?: "inside_dhaka" | "outside_dhaka" | null;
  subtotal: number;
  hasItems: boolean;
  overrideConfig?: DeliveryChargeConfig;
}): DeliveryChargeResult & { config: DeliveryChargeConfig } {
  const config = useDeliveryConfig(overrideConfig);
  const result = calculateAuthoritativeDeliveryCharge({
    zone,
    subtotal,
    hasItems,
    config,
  });

  return {
    ...result,
    config,
  };
}
