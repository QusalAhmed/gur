-- =============================================================================
-- Migration: Track Order Printed State & Alert When Shipped Without Reprint
-- Timestamp: 20261104000005_track_order_printed_and_reprint_alert.sql
-- Description:
--   1. Adds printed_at and printed_courier_snapshot columns to public.orders
--   2. Provides helper function public.build_order_courier_snapshot()
--   3. Provides helper function public.get_order_courier_print_diff()
--   4. Updates private.handle_order_notification() to generate a system_alert
--      notification and order event if an order is marked 'shipped' after its
--      courier details changed without being reprinted.
--   5. Creates RPC function public.mark_orders_as_printed() for recording
--      and refreshing the print snapshot when thermal labels are generated.
-- =============================================================================

-- 1. Add Columns to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS printed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS printed_courier_snapshot jsonb DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_printed_at
  ON public.orders (printed_at DESC)
  WHERE printed_at IS NOT NULL;

-- 2. Helper: Build Courier Snapshot from Order Record
CREATE OR REPLACE FUNCTION public.build_order_courier_snapshot(p_order public.orders)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cod numeric;
BEGIN
  IF p_order.payment_status = 'paid' THEN
    v_cod := 0;
  ELSE
    v_cod := GREATEST(0, (COALESCE(p_order.grand_total, 0) - COALESCE(p_order.amount_paid, 0)));
  END IF;

  RETURN jsonb_build_object(
    'recipient_name', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'recipient_name'), ''), NULLIF(TRIM(p_order.customer_name), ''), ''),
    'phone', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'phone'), ''), NULLIF(TRIM(p_order.customer_phone), ''), ''),
    'alternative_phone', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'alternative_phone'), ''), ''),
    'address_line', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'address_line'), ''), ''),
    'district', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'district'), ''), ''),
    'division', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'division'), ''), ''),
    'cod_amount', v_cod
  );
END;
$$;

-- 3. Helper: Compute Courier Differences Between Current & Printed Snapshots
CREATE OR REPLACE FUNCTION public.get_order_courier_print_diff(p_current jsonb, p_printed jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_diffs jsonb := '[]'::jsonb;
  v_curr_name text := COALESCE(p_current->>'recipient_name', '');
  v_prev_name text := COALESCE(p_printed->>'recipient_name', '');
  v_curr_phone text := COALESCE(p_current->>'phone', '');
  v_prev_phone text := COALESCE(p_printed->>'phone', '');
  v_curr_alt_phone text := COALESCE(p_current->>'alternative_phone', '');
  v_prev_alt_phone text := COALESCE(p_printed->>'alternative_phone', '');
  v_curr_addr text := COALESCE(p_current->>'address_line', '');
  v_prev_addr text := COALESCE(p_printed->>'address_line', '');
  v_curr_dist text := COALESCE(p_current->>'district', '');
  v_prev_dist text := COALESCE(p_printed->>'district', '');
  v_curr_div text := COALESCE(p_current->>'division', '');
  v_prev_div text := COALESCE(p_printed->>'division', '');
  v_curr_cod numeric := COALESCE((p_current->>'cod_amount')::numeric, 0);
  v_prev_cod numeric := COALESCE((p_printed->>'cod_amount')::numeric, 0);
BEGIN
  IF p_printed IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF v_curr_name <> v_prev_name THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Recipient Name',
      'old', CASE WHEN v_prev_name = '' THEN '(Empty)' ELSE v_prev_name END,
      'new', CASE WHEN v_curr_name = '' THEN '(Empty)' ELSE v_curr_name END
    );
  END IF;

  IF v_curr_phone <> v_prev_phone THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Contact Phone',
      'old', CASE WHEN v_prev_phone = '' THEN '(Empty)' ELSE v_prev_phone END,
      'new', CASE WHEN v_curr_phone = '' THEN '(Empty)' ELSE v_curr_phone END
    );
  END IF;

  IF v_curr_alt_phone <> v_prev_alt_phone THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Alternative Phone',
      'old', CASE WHEN v_prev_alt_phone = '' THEN '(None)' ELSE v_prev_alt_phone END,
      'new', CASE WHEN v_curr_alt_phone = '' THEN '(None)' ELSE v_curr_alt_phone END
    );
  END IF;

  IF (v_curr_addr <> v_prev_addr) OR (v_curr_dist <> v_prev_dist) OR (v_curr_div <> v_prev_div) THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Delivery Address',
      'old', TRIM(CONCAT_WS(', ', NULLIF(v_prev_addr, ''), NULLIF(v_prev_dist, ''), NULLIF(v_prev_div, ''))),
      'new', TRIM(CONCAT_WS(', ', NULLIF(v_curr_addr, ''), NULLIF(v_curr_dist, ''), NULLIF(v_curr_div, '')))
    );
  END IF;

  IF v_curr_cod <> v_prev_cod THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'COD Amount',
      'old', '৳' || v_prev_cod::text,
      'new', '৳' || v_curr_cod::text
    );
  END IF;

  RETURN v_diffs;
END;
$$;

-- 4. Update Trigger Function: private.handle_order_notification()
CREATE OR REPLACE FUNCTION private.handle_order_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_curr_snap jsonb;
  v_diffs jsonb;
  v_diff_summary text := '';
  v_item jsonb;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.notifications (type, title, message, data)
    VALUES (
      'order_created',
      'New order placed',
      NEW.order_number || ' · ৳' || NEW.grand_total::numeric(14,2)::text || ' from ' || coalesce(nullif(trim(NEW.customer_name), ''), 'Customer'),
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'amount', NEW.grand_total,
        'customer_name', NEW.customer_name,
        'channel', NEW.channel,
        'link', '/admin/orders?search=' || NEW.order_number
      )
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Standard status transition notification
      INSERT INTO public.notifications (type, title, message, data)
      VALUES (
        'order_status_changed',
        'Order ' || NEW.order_number || ' updated',
        'Status changed from ' || OLD.status::text || ' to ' || NEW.status::text,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'previous_status', OLD.status::text,
          'status', NEW.status::text,
          'link', '/admin/orders?search=' || NEW.order_number
        )
      );

      -- Check if moving to 'shipped' with outdated printed courier label
      IF NEW.status = 'shipped' AND NEW.printed_at IS NOT NULL AND NEW.printed_courier_snapshot IS NOT NULL THEN
        v_curr_snap := public.build_order_courier_snapshot(NEW);
        v_diffs := public.get_order_courier_print_diff(v_curr_snap, NEW.printed_courier_snapshot);

        IF jsonb_array_length(v_diffs) > 0 THEN
          FOR v_item IN SELECT * FROM jsonb_array_elements(v_diffs)
          LOOP
            IF v_diff_summary <> '' THEN
              v_diff_summary := v_diff_summary || '; ';
            END IF;
            v_diff_summary := v_diff_summary || (v_item->>'field') || ': ' || (v_item->>'old') || ' → ' || (v_item->>'new');
          END LOOP;

          -- 1. Realtime notification in admin notifications center
          INSERT INTO public.notifications (type, title, message, data)
          VALUES (
            'system_alert',
            '⚠️ Order ' || NEW.order_number || ' shipped without reprint',
            'Courier details changed after printing: ' || v_diff_summary || '. Physical label may be outdated!',
            jsonb_build_object(
              'alert_subtype', 'outdated_label_shipped',
              'order_id', NEW.id,
              'order_number', NEW.order_number,
              'diffs', v_diffs,
              'summary', v_diff_summary,
              'printed_at', NEW.printed_at,
              'reprint_url', '/admin/orders/print?ids=' || NEW.order_number || '&format=58mm',
              'link', '/admin/orders?search=' || NEW.order_number
            )
          );

          -- 2. Audit event in order history
          INSERT INTO public.order_events (order_id, event_type, message)
          VALUES (
            NEW.id,
            'shipped_without_reprint',
            'Marked as Shipped with outdated label! Changes since print: ' || v_diff_summary
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. RPC Function: public.mark_orders_as_printed()
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
       FOR UPDATE
  LOOP
    UPDATE public.orders
       SET printed_at = now(),
           printed_courier_snapshot = public.build_order_courier_snapshot(orders)
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

GRANT EXECUTE ON FUNCTION public.build_order_courier_snapshot(public.orders) TO authenticated;
GRANT EXECUTE ON FUNCTION public.build_order_courier_snapshot(public.orders) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_order_courier_print_diff(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_courier_print_diff(jsonb, jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.mark_orders_as_printed(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_orders_as_printed(text[]) TO service_role;
