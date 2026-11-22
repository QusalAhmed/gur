-- =============================================================================
-- Migration: Add reprint_required to orders & maintain via trigger and RPC
-- Timestamp: 2026-11-23
-- Description:
--   1. Adds reprint_required column to public.orders (default false).
--   2. Adds partial index on reprint_required for fast querying.
--   3. Creates BEFORE UPDATE trigger to detect courier changes on printed orders.
--   4. Updates mark_orders_as_printed() to reset reprint_required to false.
--   5. Backfills reprint_required for any existing orders.
-- =============================================================================

BEGIN;

-- 1. Add reprint_required column to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reprint_required boolean NOT NULL DEFAULT false;

-- 2. Add partial index for fast lookups of orders requiring reprint
CREATE INDEX IF NOT EXISTS idx_orders_reprint_required
  ON public.orders (created_at DESC)
  WHERE reprint_required = true;

-- 3. Trigger Function: Detect courier modifications on printed orders
CREATE OR REPLACE FUNCTION public.check_order_reprint_required()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_curr_snap jsonb;
  v_diffs jsonb;
BEGIN
  -- Cancelled or returned orders do not require reprint
  IF NEW.status IN ('cancelled', 'returned') THEN
    NEW.reprint_required := false;
    RETURN NEW;
  END IF;

  -- Only orders that have been printed can require a reprint
  IF NEW.printed_at IS NOT NULL AND NEW.printed_courier_snapshot IS NOT NULL THEN
    v_curr_snap := public.build_order_courier_snapshot(NEW);
    v_diffs := public.get_order_courier_print_diff(v_curr_snap, NEW.printed_courier_snapshot);

    IF jsonb_array_length(v_diffs) > 0 THEN
      NEW.reprint_required := true;
    ELSE
      NEW.reprint_required := false;
    END IF;
  ELSE
    NEW.reprint_required := false;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS trg_orders_check_reprint_required ON public.orders;

CREATE TRIGGER trg_orders_check_reprint_required
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_order_reprint_required();

-- 4. Update public.mark_orders_as_printed() RPC function
CREATE OR REPLACE FUNCTION public.mark_orders_as_printed(p_order_numbers text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
  v_order record;
BEGIN
  IF NOT (
    (SELECT current_user IN ('postgres', 'service_role'))
    OR (SELECT coalesce(auth.jwt()->>'role', '') = 'service_role')
    OR (SELECT private.is_staff())
  ) THEN
    RAISE EXCEPTION 'Access denied: staff privileges required';
  END IF;

  IF p_order_numbers IS NULL OR array_length(p_order_numbers, 1) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_order IN
    SELECT id, order_number, printed_at
      FROM public.orders
     WHERE order_number = ANY(p_order_numbers)
        OR id::text = ANY(p_order_numbers)
       FOR UPDATE
  LOOP
    UPDATE public.orders
       SET printed_at = now(),
           printed_courier_snapshot = public.build_order_courier_snapshot(orders),
           reprint_required = false
     WHERE id = v_order.id;

    INSERT INTO public.order_events (order_id, event_type, message)
    VALUES (
      v_order.id,
      'label_printed',
      CASE WHEN v_order.printed_at IS NULL THEN 'Thermal shipping label printed'
           ELSE 'Thermal shipping label reprinted'
      END
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_order_reprint_required() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_order_reprint_required() TO service_role;

GRANT EXECUTE ON FUNCTION public.mark_orders_as_printed(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_orders_as_printed(text[]) TO service_role;

-- 5. Backfill existing orders
UPDATE public.orders
   SET reprint_required = (
     printed_at IS NOT NULL
     AND printed_courier_snapshot IS NOT NULL
     AND status NOT IN ('cancelled', 'returned')
     AND jsonb_array_length(public.get_order_courier_print_diff(public.build_order_courier_snapshot(orders), printed_courier_snapshot)) > 0
   );

COMMIT;
