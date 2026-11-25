-- =============================================================================
-- Migration: Add order pause, scheduled sending_date, and urgent priority fields
-- Timestamp: 2026-11-25
-- Description:
--   1. Adds is_paused, sending_date, paused_at, pause_reason, and is_urgent
--      columns to public.orders.
--   2. Adds partial indexes for fast print queue and paused/urgent filtering.
--   3. Updates private.orders_before_insert() and private.orders_before_update()
--      to maintain paused_at and auto-clear is_paused when orders are shipped,
--      delivered, cancelled, or returned.
-- =============================================================================

BEGIN;

-- 1. Add scheduling, pause, and urgency columns to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sending_date date,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

-- 2. Partial indexes for fast filtering & print-queue sorting
CREATE INDEX IF NOT EXISTS idx_orders_is_urgent_active
  ON public.orders (is_urgent, placed_at ASC)
  WHERE is_urgent = true AND status NOT IN ('cancelled', 'returned', 'delivered');

CREATE INDEX IF NOT EXISTS idx_orders_is_paused
  ON public.orders (is_paused, sending_date)
  WHERE is_paused = true;

CREATE INDEX IF NOT EXISTS idx_orders_sending_date
  ON public.orders (sending_date)
  WHERE sending_date IS NOT NULL;

-- 3. Maintain paused_at on insert
CREATE OR REPLACE FUNCTION private.orders_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.order_number IS NULL THEN
    new.order_number := private.next_number(
      coalesce((SELECT s.value #>> '{}' FROM public.site_settings s WHERE s.key = 'orders.number_prefix'), 'MOL'),
      'private.order_number_seq'::regclass);
  END IF;

  IF new.status IN ('shipped', 'delivered', 'cancelled', 'returned') THEN
    new.is_paused := false;
    new.paused_at := null;
  ELSIF new.is_paused = true THEN
    new.paused_at := coalesce(new.paused_at, now());
  ELSE
    new.paused_at := null;
  END IF;

  RETURN new;
END;
$$;

-- 4. Update private.orders_before_update() preserving all existing checks + pause lifecycle
CREATE OR REPLACE FUNCTION private.orders_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_flow CONSTANT text[] := ARRAY['incomplete_order','pending','confirmed','processing','shipped','delivered'];
BEGIN
  IF new.order_number IS DISTINCT FROM old.order_number
     OR new.public_token IS DISTINCT FROM old.public_token
     OR new.currency     IS DISTINCT FROM old.currency THEN
    RAISE EXCEPTION 'ORDER_IMMUTABLE: order_number, public_token and currency cannot change' USING errcode = 'P0001';
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    IF old.status IN ('cancelled','returned') THEN
      RAISE EXCEPTION 'ORDER_FINAL: order is already %', old.status USING errcode = 'P0001';
    ELSIF new.status = 'cancelled' THEN
      IF old.status IN ('shipped','delivered') THEN
        RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE: order is already %', old.status USING errcode = 'P0001';
      END IF;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    ELSIF new.status = 'returned' THEN
      IF old.status NOT IN ('shipped','delivered') THEN
        RAISE EXCEPTION 'ORDER_NOT_RETURNABLE: order is still %', old.status USING errcode = 'P0001';
      END IF;
    ELSIF array_position(v_flow, new.status::text) <= array_position(v_flow, old.status::text) THEN
      RAISE EXCEPTION 'ORDER_STATUS_BACKWARDS: % -> %', old.status, new.status USING errcode = 'P0001';
    END IF;

    -- Enforce order items and phone details before moving to confirmed or higher
    IF array_position(v_flow, new.status::text) >= array_position(v_flow, 'confirmed'::text) THEN
      IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = new.id) THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: at least one order item is required before confirming order' USING errcode = 'P0001';
      END IF;

      IF new.customer_phone IS NULL OR new.customer_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
        RAISE EXCEPTION 'CUSTOMER_PHONE_REQUIRED: valid customer phone is required before confirming order' USING errcode = 'P0001';
      END IF;
    END IF;

    IF new.status = 'confirmed' THEN new.confirmed_at := coalesce(new.confirmed_at, now()); END IF;
    IF new.status = 'shipped'   THEN new.shipped_at   := coalesce(new.shipped_at,   now()); END IF;
    IF new.status = 'delivered' THEN
      new.delivered_at := coalesce(new.delivered_at, now());
      IF new.amount_paid = 0 AND new.advance_paid > 0 THEN
        new.amount_paid := new.advance_paid;
      END IF;
    END IF;
  END IF;

  IF new.status IN ('incomplete_order', 'pending', 'confirmed', 'processing', 'shipped') THEN
    new.amount_paid := 0;
  END IF;

  -- Auto-clear pause once order is shipped, delivered, cancelled, or returned
  IF new.status IN ('shipped', 'delivered', 'cancelled', 'returned') THEN
    new.is_paused := false;
    new.paused_at := null;
  ELSIF new.is_paused = true THEN
    IF old.is_paused IS DISTINCT FROM true THEN
      new.paused_at := coalesce(new.paused_at, now());
    END IF;
  ELSE
    new.paused_at := null;
  END IF;

  RETURN new;
END;
$$;

COMMIT;
