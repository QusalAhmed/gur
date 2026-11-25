-- =============================================================================
-- Migration: Remove is_urgent column and active urgent index from public.orders
-- Timestamp: 2026-11-25
-- Description:
--   1. Drops partial index public.idx_orders_is_urgent_active.
--   2. Drops column is_urgent from public.orders while preserving pause and
--      sending_date columns.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_orders_is_urgent_active;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS is_urgent;

COMMIT;
