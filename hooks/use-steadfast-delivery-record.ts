"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSteadfastDeliveryRecordAction,
  batchGetSteadfastDeliveryRecordsAction,
} from "@/actions/steadfast";
import { normalizePhoneForSteadfast, type SteadfastDeliveryRecord } from "@/lib/steadfast";

export function useSteadfastDeliveryRecord(
  phone?: string | null,
  options?: { enabled?: boolean; autoFetch?: boolean }
) {
  const queryClient = useQueryClient();
  const cleanPhone = phone ? normalizePhoneForSteadfast(phone) : "";
  const isValid = Boolean(cleanPhone && /^01[3-9]\d{8}$/.test(cleanPhone));

  const [manuallyTriggered, setManuallyTriggered] = React.useState(options?.autoFetch ?? false);

  // If this phone already exists in the client cache, auto-enable so we don't hide cached records
  const isAlreadyInCache = Boolean(
    cleanPhone && queryClient.getQueryData(["steadfast", "delivery-record", cleanPhone])
  );

  const shouldFetch = isValid && (options?.enabled ?? true) && (manuallyTriggered || isAlreadyInCache);

  const query = useQuery({
    queryKey: ["steadfast", "delivery-record", cleanPhone],
    queryFn: async (): Promise<SteadfastDeliveryRecord | null> => {
      if (!isValid) return null;
      const res = await getSteadfastDeliveryRecordAction(cleanPhone);
      if (!res.success) {
        throw new Error(res.error || "Failed to fetch delivery record");
      }
      return res.data || null;
    },
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 15, // 15 minutes client stale time
    gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection
    retry: false,
    refetchOnWindowFocus: false,
  });

  const triggerFetch = React.useCallback(() => {
    setManuallyTriggered(true);
  }, []);

  const refetchFresh = React.useCallback(async () => {
    if (!isValid) return;
    setManuallyTriggered(true);
    const res = await getSteadfastDeliveryRecordAction(cleanPhone, true);
    if (res.success && res.data) {
      queryClient.setQueryData(["steadfast", "delivery-record", cleanPhone], res.data);
      await query.refetch();
    }
  }, [cleanPhone, isValid, query, queryClient]);

  const source = query.data?.source || (query.data?.stored_at ? "db" : "api");
  const storedAt = query.data?.updated_at || query.data?.stored_at || query.data?.fetchedAt;

  return {
    ...query,
    cleanPhone,
    isValidPhone: isValid,
    isTriggered: manuallyTriggered || isAlreadyInCache,
    source,
    storedAt,
    triggerFetch,
    refetchFresh,
  };
}

/**
 * Hook to batch preload known customer delivery records from the database for an array of phone numbers.
 * When loaded, it automatically seeds the React Query cache so table row badges display immediately.
 */
export function useBatchSteadfastDeliveryRecords(phones: (string | null | undefined)[]) {
  const queryClient = useQueryClient();

  const validPhones = React.useMemo(() => {
    return Array.from(
      new Set(
        phones
          .map((p) => (p ? normalizePhoneForSteadfast(p) : ""))
          .filter((p) => /^01[3-9]\d{8}$/.test(p))
      )
    );
  }, [phones]);

  const sortedKey = React.useMemo(() => [...validPhones].sort().join(","), [validPhones]);

  const query = useQuery({
    queryKey: ["steadfast", "batch-delivery-records", sortedKey],
    queryFn: async (): Promise<Record<string, SteadfastDeliveryRecord>> => {
      if (validPhones.length === 0) return {};
      const records = await batchGetSteadfastDeliveryRecordsAction(validPhones);

      // Seed each record into the single-phone query cache
      Object.entries(records).forEach(([phone, record]) => {
        queryClient.setQueryData(["steadfast", "delivery-record", phone], record);
      });

      return records;
    },
    enabled: validPhones.length > 0,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  return query;
}
