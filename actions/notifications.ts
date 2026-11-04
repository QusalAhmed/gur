"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminNotification, NotificationType } from "@/types/notification";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch latest notifications with optional limit
 */
export async function getNotificationsAction(
  limit = 40
): Promise<ActionResult<AdminNotification[]>> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getNotificationsAction] error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as AdminNotification[]) || [] };
  } catch (err: any) {
    console.error("[getNotificationsAction] exception:", err);
    return { success: false, error: err?.message || "Failed to fetch notifications" };
  }
}

/**
 * Fetch total unread notifications count
 */
export async function getUnreadNotificationsCountAction(): Promise<ActionResult<number>> {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: count || 0 };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to count unread notifications" };
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationReadAction(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to mark notification as read" };
  }
}

/**
 * Mark all unread notifications as read
 */
export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("is_read", false);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to mark all as read" };
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotificationAction(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete notification" };
  }
}

/**
 * Clear all read notifications
 */
export async function clearReadNotificationsAction(): Promise<ActionResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("is_read", true);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to clear read notifications" };
  }
}

/**
 * Push an application-level notification (e.g. from customer phone inquiry, custom alert)
 */
export async function createNotificationAction({
  type = "system_alert",
  title,
  message,
  data = {},
}: {
  type?: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}): Promise<ActionResult<AdminNotification>> {
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

    return { success: true, data: inserted as AdminNotification };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create notification" };
  }
}

