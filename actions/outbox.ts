"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  dispatchOutboxEvent,
  processPendingOutboxEvents,
  type OutboxEventRecord,
  type OutboxStatus,
} from "@/lib/outbox";

export interface OutboxMetrics {
  total: number;
  pending: number;
  processing: number;
  dispatched: number;
  failed: number;
  dead_letter: number;
}

export interface GetOutboxEventsParams {
  status?: OutboxStatus | "all";
  limit?: number;
  offset?: number;
}

/**
 * Server Action: Fetches aggregate metrics for the Transactional Outbox.
 */
export async function getOutboxMetricsAction(): Promise<{
  success: boolean;
  metrics: OutboxMetrics;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("outbox_events")
      .select("status");

    if (error) {
      return {
        success: false,
        metrics: { total: 0, pending: 0, processing: 0, dispatched: 0, failed: 0, dead_letter: 0 },
        error: error.message,
      };
    }

    const counts: OutboxMetrics = {
      total: data.length,
      pending: 0,
      processing: 0,
      dispatched: 0,
      failed: 0,
      dead_letter: 0,
    };

    for (const row of data) {
      const st = row.status as keyof OutboxMetrics;
      if (st && typeof counts[st] === "number") {
        counts[st]++;
      }
    }

    return { success: true, metrics: counts };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch outbox metrics";
    return {
      success: false,
      metrics: { total: 0, pending: 0, processing: 0, dispatched: 0, failed: 0, dead_letter: 0 },
      error: message,
    };
  }
}

/**
 * Server Action: Fetches paginated outbox events for admin monitoring.
 */
export async function getOutboxEventsAction(params?: GetOutboxEventsParams): Promise<{
  success: boolean;
  events: OutboxEventRecord[];
  total: number;
  error?: string;
}> {
  try {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;
    const status = params?.status || "all";

    let query = supabaseAdmin
      .from("outbox_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, count, error } = await query;

    if (error) {
      return { success: false, events: [], total: 0, error: error.message };
    }

    return {
      success: true,
      events: (data as OutboxEventRecord[]) || [],
      total: count || 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch outbox events";
    return {
      success: false,
      events: [],
      total: 0,
      error: message,
    };
  }
}

/**
 * Server Action: Manually retries a single outbox event.
 */
export async function retryOutboxEventAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: event, error: fetchErr } = await supabaseAdmin
      .from("outbox_events")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !event) {
      return { success: false, error: fetchErr?.message || "Event not found" };
    }

    const record = event as OutboxEventRecord;
    const res = await dispatchOutboxEvent(record);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retry event";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Drains pending outbox events immediately (manual recovery trigger).
 */
export async function drainOutboxQueueAction(): Promise<{
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  error?: string;
}> {
  try {
    const stats = await processPendingOutboxEvents(50);
    return { success: true, ...stats };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to drain outbox queue";
    return {
      success: false,
      processed: 0,
      succeeded: 0,
      failed: 0,
      error: message,
    };
  }
}
