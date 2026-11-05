-- =============================================================================
-- Migration: Create Courier Webhook System & Tracking
-- Timestamp: 20261105000001_create_courier_webhook_system.sql
-- Description:
--   1. Adds courier_delivery_charge column to public.orders
--   2. Creates public.courier_webhook_logs table for audit trail & idempotency
--   3. Adds performance indexes and Row Level Security policies
-- =============================================================================

-- 1. Add courier_delivery_charge to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_delivery_charge numeric(14,2) DEFAULT NULL;

-- 2. Create courier_webhook_logs table
CREATE TABLE IF NOT EXISTS public.courier_webhook_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  text,
  notification_type text NOT NULL,
  consignment_id   text,
  invoice          text,
  order_id         uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  order_number     text,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'processed', -- 'processed', 'already_processed', 'order_not_found', 'error', 'ignored'
  response_data    jsonb DEFAULT '{}'::jsonb,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_created_at
  ON public.courier_webhook_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_idempotency
  ON public.courier_webhook_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_consignment
  ON public.courier_webhook_logs (consignment_id)
  WHERE consignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_invoice
  ON public.courier_webhook_logs (invoice)
  WHERE invoice IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_order_id
  ON public.courier_webhook_logs (order_id)
  WHERE order_id IS NOT NULL;

-- Row Level Security
ALTER TABLE public.courier_webhook_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.courier_webhook_logs TO service_role;
GRANT SELECT ON public.courier_webhook_logs TO authenticated;

DROP POLICY IF EXISTS courier_webhook_logs_staff_select ON public.courier_webhook_logs;
CREATE POLICY courier_webhook_logs_staff_select ON public.courier_webhook_logs
  FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));

