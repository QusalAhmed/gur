-- =============================================================================
-- Migration: Remove Immediate Incomplete Order Lead Notification on Insert
-- Timestamp: 20261122000001_remove_immediate_incomplete_order_notification.sql
-- Description:
--   Updates private.handle_order_notification() so that:
--   1. On INSERT with status = 'incomplete_order', NO notification is generated immediately.
--      Incomplete/abandoned orders will only notify after 5 minutes of inactivity via Inngest.
--   2. Preserves 'order_created' notification on INSERT for regular orders.
--   3. Preserves 'order_created' notification when an incomplete draft upgrades to 'pending'.
--   4. Preserves outdated courier label reprint alerts on 'shipped'.
-- =============================================================================

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
  v_customer_display text;
  v_amount_suffix text := '';
BEGIN
  -- Determine clean customer display name
  v_customer_display := coalesce(
    nullif(trim(NEW.customer_name), ''),
    nullif(trim(NEW.customer_phone), ''),
    'Customer'
  );

  IF coalesce(NEW.grand_total, 0) > 0 THEN
    v_amount_suffix := ' (৳' || NEW.grand_total::numeric(14,2)::text || ')';
  END IF;

  -- CASE 1: Order INSERT
  IF (TG_OP = 'INSERT') THEN
    -- Incomplete draft orders do NOT generate immediate notifications.
    -- Abandoned leads are notified after 5 minutes of inactivity by the Inngest background worker.
    IF NEW.status <> 'incomplete_order' THEN
      -- Completed / Pending order placed directly
      INSERT INTO public.notifications (type, title, message, data)
      VALUES (
        'order_created',
        'New order placed',
        NEW.order_number || ' · ৳' || NEW.grand_total::numeric(14,2)::text || ' from ' || v_customer_display,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'amount', NEW.grand_total,
          'customer_name', NEW.customer_name,
          'customer_phone', NEW.customer_phone,
          'status', NEW.status::text,
          'channel', NEW.channel,
          'link', '/admin/orders?search=' || NEW.order_number
        )
      );
    END IF;

  -- CASE 2: Order UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN

      -- Transition from incomplete draft lead to actual active order
      IF OLD.status = 'incomplete_order' AND NEW.status IN ('pending', 'confirmed', 'processing') THEN
        INSERT INTO public.notifications (type, title, message, data)
        VALUES (
          'order_created',
          'New order placed',
          NEW.order_number || ' · ৳' || NEW.grand_total::numeric(14,2)::text || ' from ' || v_customer_display,
          jsonb_build_object(
            'order_id', NEW.id,
            'order_number', NEW.order_number,
            'amount', NEW.grand_total,
            'customer_name', NEW.customer_name,
            'customer_phone', NEW.customer_phone,
            'status', NEW.status::text,
            'channel', NEW.channel,
            'link', '/admin/orders?search=' || NEW.order_number
          )
        );
      END IF;

      -- Check if moving to 'shipped' with outdated printed courier label (Reprint Alert)
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
            'outdated_label_shipped',
            'Order shipped with outdated courier label. Changes detected: ' || v_diff_summary
          );
        END IF;
      END IF;

    END IF;
  END IF;
  RETURN NEW;
END;
$$;
