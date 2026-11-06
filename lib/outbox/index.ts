import { supabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import type { InngestEvents } from "@/lib/inngest/events";

export type OutboxStatus = "pending" | "processing" | "dispatched" | "failed" | "dead_letter";

export interface OutboxEventRecord {
  id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retry_count: number;
  max_retries: number;
  last_error?: string | null;
  dispatched_at?: string | null;
  next_retry_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueOutboxParams {
  eventName: string;
  aggregateType?: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxRetries?: number;
}

export interface EnqueueOutboxResult {
  success: boolean;
  event?: OutboxEventRecord;
  alreadyExists?: boolean;
  error?: string;
}

/**
 * Calculates exponential backoff in seconds.
 * 1st retry: 30s, 2nd: 60s, 3rd: 120s, 4th: 240s, 5th: 480s (max 1 hour).
 */
export function calculateBackoffSeconds(retryCount: number): number {
  const base = 30;
  const backoff = base * Math.pow(2, Math.max(0, retryCount));
  return Math.min(backoff, 3600);
}

/**
 * Persists an event reliably into public.outbox_events using the Transactional Outbox Pattern.
 * Guarantees idempotency via ON CONFLICT (idempotency_key) DO NOTHING.
 */
export async function enqueueOutboxEvent(params: EnqueueOutboxParams): Promise<EnqueueOutboxResult> {
  try {
    const {
      eventName,
      aggregateType = "order",
      aggregateId,
      idempotencyKey,
      payload,
      maxRetries = 5,
    } = params;

    const rowToInsert = {
      event_name: eventName,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      idempotency_key: idempotencyKey,
      payload,
      status: "pending" as OutboxStatus,
      retry_count: 0,
      max_retries: maxRetries,
      next_retry_at: new Date().toISOString(),
    };

    // Insert with idempotency guard
    const { data, error } = await supabaseAdmin
      .from("outbox_events")
      .insert(rowToInsert)
      .select("*")
      .maybeSingle();

    if (error) {
      // 23505 is PostgreSQL unique_violation code
      if (error.code === "23505") {
        const { data: existing } = await supabaseAdmin
          .from("outbox_events")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        return {
          success: true,
          event: (existing as OutboxEventRecord) || undefined,
          alreadyExists: true,
        };
      }

      console.error("[Outbox] DB insert error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      event: (data as OutboxEventRecord) || undefined,
      alreadyExists: false,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to enqueue event";
    console.error("[Outbox] Unexpected enqueue error:", err);
    return { success: false, error: message };
  }
}

/**
 * Attempts to dispatch an outbox event to Inngest.
 * If Inngest is unconfigured or unreachable, safely updates retry metadata so the recovery
 * cron can deliver it later without losing the event or impacting the customer.
 */
export async function dispatchOutboxEvent(event: OutboxEventRecord): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  try {
    // 1. Mark as processing
    await supabaseAdmin
      .from("outbox_events")
      .update({
        status: "processing",
        updated_at: nowIso,
      })
      .eq("id", event.id);

    // 2. Dispatch to Inngest with idempotency key
    await inngest.send({
      name: event.event_name as keyof InngestEvents,
      data: {
        ...event.payload,
        outboxEventId: event.id,
      },
      id: event.idempotency_key,
    });

    // 3. Mark as dispatched
    await supabaseAdmin
      .from("outbox_events")
      .update({
        status: "dispatched",
        dispatched_at: nowIso,
        updated_at: nowIso,
        last_error: null,
      })
      .eq("id", event.id);

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newRetryCount = (event.retry_count || 0) + 1;
    const isDeadLetter = newRetryCount >= (event.max_retries || 5);

    const backoffSec = calculateBackoffSeconds(newRetryCount);
    const nextRetryDate = new Date(Date.now() + backoffSec * 1000).toISOString();

    console.warn(`[Outbox] Dispatch failed for event ${event.id} (${event.event_name}). Retry ${newRetryCount}/${event.max_retries}. Error:`, errorMsg);

    await supabaseAdmin
      .from("outbox_events")
      .update({
        status: isDeadLetter ? "dead_letter" : "pending",
        retry_count: newRetryCount,
        last_error: errorMsg,
        next_retry_at: nextRetryDate,
        updated_at: nowIso,
      })
      .eq("id", event.id);

    return { success: false, error: errorMsg };
  }
}

/**
 * High-level producer: Persists the event to the outbox table immediately,
 * then triggers non-blocking background dispatch to Inngest.
 * Customer request never awaits or depends on Inngest availability.
 */
export async function enqueueAndDispatch(params: EnqueueOutboxParams): Promise<EnqueueOutboxResult> {
  // 1. Persist to outbox
  const enqueueResult = await enqueueOutboxEvent(params);
  if (!enqueueResult.success || !enqueueResult.event) {
    return enqueueResult;
  }

  // If already exists and already dispatched, do nothing
  if (enqueueResult.alreadyExists && enqueueResult.event.status === "dispatched") {
    return enqueueResult;
  }

  // 2. Non-blocking dispatch attempt: execute in background microtask
  const eventToDispatch = enqueueResult.event;
  queueMicrotask(() => {
    dispatchOutboxEvent(eventToDispatch).catch((err) => {
      console.warn("[Outbox] Background dispatchMicrotask error:", err);
    });
  });

  return enqueueResult;
}

/**
 * Recovers pending or failed outbox events that are eligible for retry.
 * Used by Inngest cron worker and manual admin recovery.
 */
export async function processPendingOutboxEvents(batchSize: number = 25): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();

  // Query pending events whose next_retry_at <= now
  const { data: events, error } = await supabaseAdmin
    .from("outbox_events")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error || !events || events.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const record of events as OutboxEventRecord[]) {
    const res = await dispatchOutboxEvent(record);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: events.length,
    succeeded,
    failed,
  };
}
