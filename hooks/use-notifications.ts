"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
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

  // 1. Fetch notifications
  const {
    data: notifications = [],
    isLoading,
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
    staleTime: 1000 * 30, // 30s
    refetchOnWindowFocus: true,
  });

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // 2. Realtime WebSocket subscription
  useEffect(() => {
    const channelName = `admin-notifications-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotif = payload.new as AdminNotification;

          // Optimistically insert to front of list
          queryClient.setQueryData<AdminNotification[]>(
            NOTIFICATIONS_QUERY_KEY,
            (old = []) => [newNotif, ...old.filter((n) => n.id !== newNotif.id)]
          );

          // Play Web Audio chime
          playNotificationChime();

          // Show interactive Sonner toast
          toast(newNotif.title, {
            description: newNotif.message,
            action: newNotif.data?.link
              ? {
                  label: "View",
                  onClick: () => {
                    if (typeof window !== "undefined" && (newNotif.data?.order_number || newNotif.data?.order_id)) {
                      window.dispatchEvent(
                        new CustomEvent("gur:open-order", {
                          detail: {
                            orderNumber: newNotif.data.order_number,
                            orderId: newNotif.data.order_id,
                          },
                        })
                      );
                    }
                    router.push(newNotif.data.link);
                  },
                }
              : undefined,
            duration: 6000,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const updated = payload.new as AdminNotification;
          queryClient.setQueryData<AdminNotification[]>(
            NOTIFICATIONS_QUERY_KEY,
            (old = []) => old.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const deletedId = (payload.old as { id: string })?.id;
          if (deletedId) {
            queryClient.setQueryData<AdminNotification[]>(
              NOTIFICATIONS_QUERY_KEY,
              (old = []) => old.filter((n) => n.id !== deletedId)
            );
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.info("[Notifications] Realtime connected successfully.");
        } else if (status === "CLOSED") {
          // Closed normally on unmount
        } else if (err || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[Notifications] Realtime subscription status:", status, err?.message || err || "");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, router]);

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

