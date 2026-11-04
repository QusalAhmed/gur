-- =============================================================================
-- Migration: Add System Notification for Incomplete Orders (Draft Leads)
-- Timestamp: 20261104000007_notify_incomplete_orders.sql
-- Description:
--   Updates private.handle_order_notification() so that:
--   1. On INSERT with status = 'incomplete_order': generates a 'system_alert'
--      notification titled 'Incomplete order lead' with customer phone & cart total
--   2. On INSERT with status <> 'incomplete_order': generates 'order_created'
--      notification titled 'New order placed'
--   3. On UPDATE transitioning from 'incomplete_order' to 'pending'/'confirmed':
--      generates 'order_created' notification titled 'New order placed'
--   4. Preserves status change notifications & shipped label reprint alerts
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
    IF NEW.status = 'incomplete_order' THEN
      -- Incomplete order lead / abandoned checkout notification
      INSERT INTO public.notifications (type, title, message, data)
      VALUES (
        'system_alert',
        'Incomplete order lead',
        NEW.order_number || ' · Draft lead from ' || v_customer_display || v_amount_suffix,
        jsonb_build_object(
          'alert_subtype', 'incomplete_order_lead',
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'amount', NEW.grand_total,
          'customer_name', NEW.customer_name,
          'customer_phone', NEW.customer_phone,
          'status', 'incomplete_order',
          'channel', NEW.channel,
          'link', '/admin/orders?search=' || NEW.order_number || '&status=incomplete_order'
        )
      );
    ELSE
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

      -- Normal status change between active order statuses
      ELSIF OLD.status <> 'incomplete_order' THEN
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

