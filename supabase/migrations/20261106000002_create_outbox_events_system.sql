-- Migration: 20261106000002_create_outbox_events_system.sql
-- Description: Creates outbox_events table for reliable transactional event persistence, background job orchestration, and retry recovery.

CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    aggregate_type TEXT NOT NULL DEFAULT 'order',
    aggregate_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'dispatched', 'failed', 'dead_letter')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    dispatched_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup indices
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_next_retry ON public.outbox_events(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate ON public.outbox_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_created_at ON public.outbox_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Allow service role full access to outbox_events"
    ON public.outbox_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users access (Admin)
CREATE POLICY "Allow authenticated read outbox_events"
    ON public.outbox_events
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert outbox_events"
    ON public.outbox_events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update outbox_events"
    ON public.outbox_events
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
