-- =============================================================================
-- Migration: Reinstate public.orders.is_urgent and active urgent index
-- Timestamp: 2026-11-25
-- Description:
--   1. Re-adds is_urgent boolean NOT NULL DEFAULT false to public.orders.
--   2. Recreates partial index public.idx_orders_is_urgent_active.
--   3. Backfills is_urgent = true from the latest priority_changed event in
--      public.order_events where an order was marked Urgent.
-- =============================================================================

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_is_urgent_active
  ON public.orders (is_urgent, placed_at ASC)
  WHERE is_urgent = true AND status NOT IN ('cancelled', 'returned', 'delivered');

WITH latest_priority_events AS (
  SELECT DISTINCT ON (order_id)
    order_id,
    message
  FROM public.order_events
  WHERE event_type = 'priority_changed'
  ORDER BY order_id, created_at DESC
)
UPDATE public.orders o
SET is_urgent = true
FROM latest_priority_events e
WHERE o.id = e.order_id
  AND e.message ILIKE '%Marked as URGENT%';

COMMIT;
