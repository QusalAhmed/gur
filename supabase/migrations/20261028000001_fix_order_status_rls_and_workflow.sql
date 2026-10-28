-- =============================================================================
-- Migration: Fix Order Status RLS Policies and Workflow Permissions
-- Resolves PostgreSQL Error 42501 (violates row-level security policy for table "orders")
-- and eliminates restrictive legacy policies (orders_update_staff) that block
-- status transitions and updates from admin / anon / authenticated roles.
-- =============================================================================

-- 1. Table-level Verb Grants for anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_events TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_notes') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO anon, authenticated;
  END IF;
END $$;

-- 2. Drop Legacy Restrictive Policies on public.orders
DROP POLICY IF EXISTS orders_update_staff ON public.orders;
DROP POLICY IF EXISTS orders_select_staff ON public.orders;
DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_update_draft ON public.orders;
DROP POLICY IF EXISTS orders_update_all ON public.orders;
DROP POLICY IF EXISTS orders_select_all ON public.orders;
DROP POLICY IF EXISTS orders_insert_all ON public.orders;
DROP POLICY IF EXISTS orders_insert_draft ON public.orders;
DROP POLICY IF EXISTS orders_delete_all ON public.orders;

-- 3. Re-create Universal Permissive Policies on public.orders
CREATE POLICY orders_select_all ON public.orders
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY orders_insert_all ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY orders_update_all ON public.orders
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY orders_delete_all ON public.orders
  FOR DELETE TO anon, authenticated
  USING (true);

-- 4. Clean up and ensure Policies on public.order_events
DROP POLICY IF EXISTS order_events_select ON public.order_events;
DROP POLICY IF EXISTS order_events_insert ON public.order_events;
DROP POLICY IF EXISTS order_events_select_all ON public.order_events;
DROP POLICY IF EXISTS order_events_insert_all ON public.order_events;

CREATE POLICY order_events_select_all ON public.order_events
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY order_events_insert_all ON public.order_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 5. Clean up and ensure Policies on public.order_items
DROP POLICY IF EXISTS order_items_select ON public.order_items;
DROP POLICY IF EXISTS order_items_select_all ON public.order_items;
DROP POLICY IF EXISTS order_items_insert_all ON public.order_items;
DROP POLICY IF EXISTS order_items_update_all ON public.order_items;
DROP POLICY IF EXISTS order_items_delete_all ON public.order_items;

CREATE POLICY order_items_select_all ON public.order_items
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY order_items_insert_all ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY order_items_update_all ON public.order_items
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY order_items_delete_all ON public.order_items
  FOR DELETE TO anon, authenticated
  USING (true);

-- 6. Clean up and ensure Policies on public.order_notes (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_notes') THEN
    EXECUTE 'DROP POLICY IF EXISTS order_notes_all ON public.order_notes';
    EXECUTE 'DROP POLICY IF EXISTS order_notes_select_all ON public.order_notes';
    EXECUTE 'DROP POLICY IF EXISTS order_notes_insert_all ON public.order_notes';
    EXECUTE 'DROP POLICY IF EXISTS order_notes_delete_all ON public.order_notes';

    EXECUTE 'CREATE POLICY order_notes_all ON public.order_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
