-- Migration: Add courier_invoice and courier_payload_snapshot for recreation & diff tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_invoice TEXT,
  ADD COLUMN IF NOT EXISTS courier_payload_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_courier_invoice ON public.orders (courier_invoice);

