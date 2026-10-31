"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrderAction } from "@/actions/orders";
import {
  placeStorefrontOrderAction,
  type StorefrontOrderPayload,
  type StorefrontOrderResult,
} from "@/actions/storefront-order";
import type { Order } from "@/types/order";

export const ORDER_QUERY_KEY = (idOrNumber?: string | null) =>
  ["order", idOrNumber ? idOrNumber.trim() : ""] as const;

export interface UseOrderOptions {
  enabled?: boolean;
  initialData?: Order | null;
  staleTime?: number;
  refetchInterval?: number | false;
}

/**
 * Custom TanStack Query hook to get a single order by either its UUID or order_number.
 * Fully type-safe and leverages client-side caching.
 */
export function useOrder(
  idOrNumber?: string | null,
  options?: UseOrderOptions
) {
  const cleanId = (idOrNumber || "").trim();
  const isEnabled = Boolean(cleanId && (options?.enabled ?? true));

  return useQuery<Order | null>({
    queryKey: ORDER_QUERY_KEY(cleanId),
    queryFn: async () => {
      if (!cleanId) return null;
      return await getOrderAction(cleanId);
    },
    enabled: isEnabled,
    initialData: options?.initialData ?? undefined,
    staleTime: options?.staleTime ?? 1000 * 30, // 30 seconds default fresh cache
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export interface UseCreateOrderOptions {
  onSuccess?: (result: StorefrontOrderResult, variables: StorefrontOrderPayload) => void;
  onError?: (error: Error, variables: StorefrontOrderPayload) => void;
}

/**
 * Custom TanStack Query mutation hook to create a storefront order.
 * Handles server action invocation, cache invalidation, and optimistic state updates.
 */
export function useCreateOrderMutation(options?: UseCreateOrderOptions) {
  const queryClient = useQueryClient();

  return useMutation<StorefrontOrderResult, Error, StorefrontOrderPayload>({
    mutationKey: ["create-order"],
    mutationFn: async (payload: StorefrontOrderPayload) => {
      const res = await placeStorefrontOrderAction(payload);
      if (!res.success) {
        throw new Error(res.error || "Failed to create order");
      }
      return res;
    },
    onSuccess: (result, variables) => {
      // Invalidate admin orders queries so administrative screens immediately pick up the new order
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });

      // Invalidate the single order query key if needed
      if (result.orderNumber) {
        queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEY(result.orderNumber) });
      }

      options?.onSuccess?.(result, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error, variables);
    },
  });
}

