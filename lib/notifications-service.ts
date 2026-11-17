import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import {
  dispatchPendingNotificationPushes,
  dispatchPushForNotificationId,
  getVapidConfig,
} from "@/lib/push/web-push";
import type { AdminNotification, NotificationType } from "@/types/notification";

/**
 * Enqueues Web Push delivery via Inngest (with direct fallback when Inngest is unavailable).
 * Never throws so callers' primary mutations are never blocked.
 */
export async function enqueueNotificationPush(notificationId?: string): Promise<void> {
  if (!getVapidConfig().configured) return;

  try {
    await inngest.send({
      name: "notification.push.send",
      data: notificationId ? { notificationId } : { limit: 15 },
    });
  } catch (err) {
    // Fallback to direct push dispatch (e.g. local dev without Inngest dev server running)
    try {
      if (notificationId) {
        await dispatchPushForNotificationId(notificationId);
      } else {
        await dispatchPendingNotificationPushes(15);
      }
    } catch (fallbackErr) {
      console.warn(
        "[enqueueNotificationPush] Fallback dispatch error:",
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        "(original Inngest error:",
        err instanceof Error ? err.message : String(err),
        ")"
      );
    }
  }
}

export async function createNotificationInternal({
  type = "system_alert",
  title,
  message,
  data = {},
}: {
  type?: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}): Promise<{ success: boolean; data?: AdminNotification; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from("notifications")
      .insert({
        type,
        title,
        message,
        data,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const notification = inserted as AdminNotification;
    // Trigger async Web Push fan-out for eligible staff devices
    enqueueNotificationPush(notification.id).catch(() => {});

    return { success: true, data: notification };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to create notification",
    };
  }
}
