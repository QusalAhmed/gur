"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminRealtimeConnected } from "@/hooks/use-admin-realtime";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  clearReadNotificationsAction,
} from "@/actions/notifications";
import { AdminNotification } from "@/types/notification";
import { playNotificationChime } from "@/lib/audio/notification-chime";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export const NOTIFICATIONS_QUERY_KEY = ["admin-notifications"];

export function useNotifications() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const realtimeConnected = useAdminRealtimeConnected();
  const hasInitializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // 1. Fetch initial notifications once; Supabase Realtime invalidates on DB changes
  const {
    data: notifications = [],
    isLoading,
    isFetched,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await getNotificationsAction(50);
      if (!res.success) {
        throw new Error(res.error || "Failed to load notifications");
      }
      return res.data || [];
    },
    staleTime: realtimeConnected ? Infinity : 60_000,
    refetchInterval: realtimeConnected ? false : 60_000,
    refetchOnWindowFocus: false,
  });

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // 2. Diff newly arrived notifications on poll cycles and trigger toast + audio chime
  useEffect(() => {
    if (!isFetched || isLoading) return;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      seenIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }

    const unseenUnread = notifications.filter(
      (n) => !seenIdsRef.current.has(n.id) && !n.is_read
    );

    for (const n of notifications) {
      seenIdsRef.current.add(n.id);
    }

    if (unseenUnread.length > 0) {
      playNotificationChime();
      const newNotif = unseenUnread[0];
      toast(newNotif.title, {
        description: newNotif.message,
        action: newNotif.data?.link
          ? {
              label: "View",
              onClick: () => {
                const link = newNotif.data?.link;
                if (!link) return;
                if (link.startsWith("http://") || link.startsWith("https://")) {
                  window.open(link, "_blank", "noopener,noreferrer");
                  return;
                }
                if (
                  typeof window !== "undefined" &&
                  (newNotif.data?.order_number || newNotif.data?.order_id)
                ) {
                  window.dispatchEvent(
                    new CustomEvent("gur:open-order", {
                      detail: {
                        orderNumber: newNotif.data.order_number,
                        orderId: newNotif.data.order_id,
                      },
                    })
                  );
                }
                router.push(link);
              },
            }
          : undefined,
        duration: 6000,
      });
    }
  }, [notifications, isFetched, isLoading, router]);

  // 3. Mark single as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return markNotificationReadAction(id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<AdminNotification[]>(NOTIFICATIONS_QUERY_KEY);

      queryClient.setQueryData<AdminNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (old = []) =>
          old.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  // 4. Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return markAllNotificationsReadAction();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<AdminNotification[]>(NOTIFICATIONS_QUERY_KEY);

      queryClient.setQueryData<AdminNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (old = []) =>
          old.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  // 5. Delete single notification
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteNotificationAction(id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<AdminNotification[]>(NOTIFICATIONS_QUERY_KEY);

      queryClient.setQueryData<AdminNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (old = []) => old.filter((n) => n.id !== id)
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  // 6. Clear read notifications
  const clearReadMutation = useMutation({
    mutationFn: async () => {
      return clearReadNotificationsAction();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<AdminNotification[]>(NOTIFICATIONS_QUERY_KEY);

      queryClient.setQueryData<AdminNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (old = []) => old.filter((n) => !n.is_read)
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    isRefetching,
    refetch,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    clearRead: clearReadMutation.mutate,
    isMarkingAllRead: markAllAsReadMutation.isPending,
    isClearingRead: clearReadMutation.isPending,
  };
}

