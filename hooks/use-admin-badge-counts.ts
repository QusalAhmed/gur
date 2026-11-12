"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminBadgeCountsAction, type AdminBadgeCounts } from "@/actions/orders";
import { useAdminRealtimeConnected } from "@/hooks/use-admin-realtime";

export type { AdminBadgeCounts };

export function useAdminBadgeCounts() {
  const realtimeConnected = useAdminRealtimeConnected();

  return useQuery<AdminBadgeCounts>({
    queryKey: ["admin", "badge-counts"],
    queryFn: () => getAdminBadgeCountsAction(),
    staleTime: realtimeConnected ? Infinity : 60_000,
    refetchInterval: realtimeConnected ? false : 90_000,
    refetchOnWindowFocus: false,
  });
}
