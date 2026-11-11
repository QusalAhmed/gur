"use client";

import { useQuery, useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { getOrderAction, getPublicOrderAction } from "@/actions/orders";
import {
  placeStorefrontOrderAction,
  syncStorefrontIncompleteOrderAction,
  submitAssistedPhoneOrderAction,
  type StorefrontOrderPayload,
  type StorefrontOrderResult,
  type AssistedPhoneOrderPayload,
} from "@/actions/storefront-order";
import type { Order } from "@/types/order";

export const ORDER_QUERY_KEY = (idOrNumber?: string | null) =>
  ["order", idOrNumber ? idOrNumber.trim() : ""] as const;

export interface UseOrderOptions {
  enabled?: boolean;
  mode?: "admin" | "public";
  publicToken?: string | null;
  initialData?: Order | null;
  staleTime?: number;
  refetchInterval?: number | false | ((query: Query<Order | null, Error, Order | null, ReturnType<typeof ORDER_QUERY_KEY>>) => number | false | undefined);
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
  const mode = options?.mode ?? "admin";
  const cleanPublicToken = options?.publicToken?.trim() || null;
  const isEnabled = Boolean(
    cleanId &&
      cleanId !== "preview" &&
      (mode === "admin" || Boolean(cleanPublicToken)) &&
      (options?.enabled ?? true)
  );

  return useQuery<Order | null, Error, Order | null, ReturnType<typeof ORDER_QUERY_KEY>>({
    queryKey: ORDER_QUERY_KEY(cleanId),
    queryFn: async () => {
      if (!cleanId) return null;
      if (mode === "public") {
        if (!cleanPublicToken) return null;
        return await getPublicOrderAction(cleanId, cleanPublicToken);
      }
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

export interface UseSyncIncompleteOrderOptions {
  onSuccess?: (result: StorefrontOrderResult, variables: Omit<StorefrontOrderPayload, "status">) => void;
  onError?: (error: Error, variables: Omit<StorefrontOrderPayload, "status">) => void;
}

/**
 * Custom TanStack Query mutation hook to silently record or update an incomplete order.
 */
export function useSyncIncompleteOrderMutation(options?: UseSyncIncompleteOrderOptions) {
  const queryClient = useQueryClient();

  return useMutation<StorefrontOrderResult, Error, Omit<StorefrontOrderPayload, "status">>({
    mutationKey: ["sync-incomplete-order"],
    mutationFn: async (payload) => {
      const res = await syncStorefrontIncompleteOrderAction(payload);
      if (!res.success) {
        throw new Error(res.error || "Failed to sync incomplete order");
      }
      return res;
    },
    onSuccess: (result, variables) => {
      // Invalidate admin orders queries so administrative screens immediately pick up the draft lead
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      options?.onSuccess?.(result, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error, variables);
    },
  });
}

export interface UseSubmitAssistedPhoneOrderOptions {
  onSuccess?: (result: StorefrontOrderResult, variables: AssistedPhoneOrderPayload) => void;
  onError?: (error: Error, variables: AssistedPhoneOrderPayload) => void;
}

/**
 * Custom TanStack Query mutation hook for submitting quick assisted phone orders.
 */
export function useSubmitAssistedPhoneOrderMutation(options?: UseSubmitAssistedPhoneOrderOptions) {
  const queryClient = useQueryClient();

  return useMutation<StorefrontOrderResult, Error, AssistedPhoneOrderPayload>({
    mutationKey: ["submit-assisted-phone-order"],
    mutationFn: async (payload) => {
      const res = await submitAssistedPhoneOrderAction(payload);
      if (!res.success) {
        throw new Error(res.error || "Failed to submit assisted phone order");
      }
      return res;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
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


