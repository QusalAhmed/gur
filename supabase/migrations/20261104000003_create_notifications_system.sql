-- =============================================================================
-- Migration: Create Notifications System & Realtime Outbox
-- Timestamp: 20261104000003_create_notifications_system.sql
-- Description:
--   1. Creates public.notification_type enum
--   2. Creates public.notifications table with RLS and performance indexes
--   3. Enables Supabase Realtime publication on public.notifications
--   4. Creates database triggers on orders (order placed, status changed) and inventory_levels (low stock)
--   5. Provides 30-day read notifications auto-cleanup function
-- =============================================================================

-- 1. Notification Type Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM (
      'order_created',
      'order_status_changed',
      'low_stock',
      'customer_inquiry',
      'system_alert'
    );
  END IF;
END $$;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         public.notification_type NOT NULL DEFAULT 'order_created',
  title        text NOT NULL,
  message      text NOT NULL,
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read      boolean NOT NULL DEFAULT false,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON public.notifications (is_read, created_at DESC) 
  WHERE is_read = false;

-- 3. Row Level Security & Permissions
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS notifications_staff_select ON public.notifications;
CREATE POLICY notifications_staff_select ON public.notifications 
  FOR SELECT TO authenticated 
  USING ((SELECT private.is_staff()));

DROP POLICY IF EXISTS notifications_staff_update ON public.notifications;
CREATE POLICY notifications_staff_update ON public.notifications 
  FOR UPDATE TO authenticated 
  USING ((SELECT private.is_staff()));

DROP POLICY IF EXISTS notifications_staff_delete ON public.notifications;
CREATE POLICY notifications_staff_delete ON public.notifications 
  FOR DELETE TO authenticated 
  USING ((SELECT private.is_staff()));

DROP POLICY IF EXISTS notifications_staff_insert ON public.notifications;
CREATE POLICY notifications_staff_insert ON public.notifications 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- 4. Supabase Realtime Setup
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 5. Trigger: Orders Notification (Order Placed & Order Status Changed)
CREATE OR REPLACE FUNCTION private.handle_order_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_orders_notify ON public.orders;
CREATE TRIGGER tr_orders_notify
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_order_notification();

-- 6. Trigger: Low Inventory Alerts
CREATE OR REPLACE FUNCTION private.handle_inventory_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_variant_title text;
  v_product_title text;
  v_sku text;
BEGIN
  IF NEW.available <= NEW.reorder_point AND (OLD.available IS NULL OR OLD.available > OLD.reorder_point) THEN
    SELECT pv.title, p.title, pv.sku
      INTO v_variant_title, v_product_title, v_sku
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = NEW.variant_id;

    INSERT INTO public.notifications (type, title, message, data)
    VALUES (
      'low_stock',
      'Low stock alert',
      coalesce(v_product_title, 'Item') || ' (' || coalesce(v_variant_title, coalesce(v_sku, 'SKU')) || ') is low: ' || NEW.available || ' remaining',
      jsonb_build_object(
        'variant_id', NEW.variant_id,
        'sku', v_sku,
        'available', NEW.available,
        'reorder_point', NEW.reorder_point,
        'link', '/admin/inventory'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_inventory_low_stock_notify ON public.inventory_levels;
CREATE TRIGGER tr_inventory_low_stock_notify
  AFTER INSERT OR UPDATE OF on_hand, reserved, reorder_point ON public.inventory_levels
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_inventory_notification();

-- 7. 30-Day Auto Retention Function
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.notifications
   WHERE is_read = true
     AND created_at < (now() - interval '30 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

