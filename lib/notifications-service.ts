import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminNotification, NotificationType } from "@/types/notification";

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

    return { success: true, data: inserted as AdminNotification };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to create notification",
    };
  }
}
