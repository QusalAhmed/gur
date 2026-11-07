"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface AdminBadgeCounts {
  pendingOrders: number;
  incompleteOrders: number;
  pendingReviews: number;
  newQuotes: number;
  newMessages: number;
}

export function useAdminBadgeCounts() {
  return useQuery<AdminBadgeCounts>({
    queryKey: ["admin", "badge-counts"],
    queryFn: async () => {
      const supabase = getSupabaseClient();

      const [pendingOrdersRes, incompleteOrdersRes, reviewsRes, quotesRes, messagesRes] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "incomplete_order"),
          supabase
            .from("product_reviews")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("quote_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
          supabase
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
        ]);

      return {
        pendingOrders: pendingOrdersRes.count || 0,
        incompleteOrders: incompleteOrdersRes.count || 0,
        pendingReviews: reviewsRes.count || 0,
        newQuotes: quotesRes.count || 0,
        newMessages: messagesRes.count || 0,
      };
    },
    staleTime: 30_000, // 30s cache
    refetchInterval: 30_000,
  });
}
