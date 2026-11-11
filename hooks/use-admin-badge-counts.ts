"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminBadgeCountsAction, type AdminBadgeCounts } from "@/actions/orders";

export type { AdminBadgeCounts };

export function useAdminBadgeCounts() {
  return useQuery<AdminBadgeCounts>({
    queryKey: ["admin", "badge-counts"],
    queryFn: () => getAdminBadgeCountsAction(),
    staleTime: 30_000, // 30s cache
    refetchInterval: 30_000,
  });
}
