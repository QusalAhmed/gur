"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";

export interface OutboxNotification {
  id: number;
  channel: string;
  template: string;
  recipient: string;
  payload: any;
  status: string;
  attempts: number;
  lastError: string | null;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

/**
 * Returns outbox notifications for monitoring SMS, email, and webhook events.
 */
export async function getOutboxNotificationsAction(params?: {
  status?: string;
  channel?: string;
  limit?: number;
}): Promise<{ ok: boolean; data: OutboxNotification[]; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("notification_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(params?.limit || 100);

    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status as any);
    }
    if (params?.channel && params.channel !== "all") {
      query = query.eq("channel", params.channel as any);
    }

    const { data, error } = await query;
    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, data: [], message: friendly.message };
    }

    const notifications: OutboxNotification[] = (data || []).map((row: any) => ({
      id: row.id,
      channel: row.channel,
      template: row.template,
      recipient: row.recipient,
      payload: row.payload,
      status: row.status,
      attempts: Number(row.attempts || 0),
      lastError: row.last_error,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      createdAt: row.created_at,
    }));

    return { ok: true, data: notifications };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, data: [], message: friendly.message };
  }
}

/**
 * Retries a failed or stuck notification in the outbox.
 */
export async function retryOutboxNotificationAction(
  id: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("notification_outbox")
      .update({
        status: "pending",
        attempts: 0,
        scheduled_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", id);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { ok: false, message: friendly.message };
    }

    revalidatePath("/admin/outbox");
    return { ok: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { ok: false, message: friendly.message };
  }
}
