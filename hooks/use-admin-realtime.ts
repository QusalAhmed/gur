"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/components/admin/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";

let realtimeConnected = false;
const listeners = new Set<() => void>();

function setRealtimeConnected(next: boolean) {
  if (realtimeConnected === next) return;
  realtimeConnected = next;
  listeners.forEach((listener) => listener());
}

function subscribeRealtimeStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getRealtimeSnapshot() {
  return realtimeConnected;
}

function getRealtimeServerSnapshot() {
  return false;
}

export function useAdminRealtimeConnected(): boolean {
  return useSyncExternalStore(
    subscribeRealtimeStatus,
    getRealtimeSnapshot,
    getRealtimeServerSnapshot
  );
}

const NOTIFICATIONS_QUERY_KEY = ["admin-notifications"] as const;
const BADGE_COUNTS_QUERY_KEY = ["admin", "badge-counts"] as const;

export function useAdminRealtime(enabled: boolean) {
  const { isAuthenticated, user } = useAdminAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !isAuthenticated || !user?.id) {
      setRealtimeConnected(false);
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let notifTimer: ReturnType<typeof setTimeout> | null = null;
    let badgeTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNotificationsRefresh = () => {
      if (notifTimer) clearTimeout(notifTimer);
      notifTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      }, 250);
    };

    const scheduleBadgeRefresh = () => {
      if (badgeTimer) clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: BADGE_COUNTS_QUERY_KEY });
      }, 350);
    };

    const startSubscription = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session?.access_token) {
        // Env-only root login has no Supabase Auth JWT cookie; fallback interval remains active.
        setRealtimeConnected(false);
        return;
      }

      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      const channel = supabase
        .channel("admin-realtime-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          scheduleNotificationsRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          scheduleBadgeRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "product_reviews" },
          scheduleBadgeRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quote_requests" },
          scheduleBadgeRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contact_messages" },
          scheduleBadgeRefresh
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setRealtimeConnected(true);
          } else if (
            status === "CLOSED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            setRealtimeConnected(false);
          }
        });

      activeChannel = channel;
    };

    startSubscription();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession?.access_token) {
        supabase.realtime.setAuth(nextSession.access_token);
      } else {
        setRealtimeConnected(false);
      }
    });

    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      if (notifTimer) clearTimeout(notifTimer);
      if (badgeTimer) clearTimeout(badgeTimer);
      authSubscription.unsubscribe();
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [enabled, isAuthenticated, user?.id, queryClient]);
}
