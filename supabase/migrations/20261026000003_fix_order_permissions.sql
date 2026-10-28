-- =============================================================================
-- Migration: Fix Order & Order Items Privileges and RLS Policies for Anon Role
-- Resolves PostgreSQL Error 42501 (permission denied for table order_items)
-- Run this directly in the Supabase Dashboard SQL Editor
-- =============================================================================

-- 1. Table-level Verb Grants for anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_events TO anon, authenticated;

-- 2. RLS Policies for public.order_items
DROP POLICY IF EXISTS order_items_select_all ON public.order_items;
CREATE POLICY order_items_select_all ON public.order_items
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS order_items_insert_all ON public.order_items;
CREATE POLICY order_items_insert_all ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS order_items_update_all ON public.order_items;
CREATE POLICY order_items_update_all ON public.order_items
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS order_items_delete_all ON public.order_items;
CREATE POLICY order_items_delete_all ON public.order_items
  FOR DELETE TO anon, authenticated
  USING (true);

-- 3. RLS Policies for public.orders
DROP POLICY IF EXISTS orders_select_all ON public.orders;
CREATE POLICY orders_select_all ON public.orders
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS orders_insert_draft ON public.orders;
CREATE POLICY orders_insert_draft ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS orders_update_all ON public.orders;
CREATE POLICY orders_update_all ON public.orders
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orders_delete_all ON public.orders;
CREATE POLICY orders_delete_all ON public.orders
  FOR DELETE TO anon, authenticated
  USING (true);

-- 4. RLS Policies for public.order_events
DROP POLICY IF EXISTS order_events_select_all ON public.order_events;
CREATE POLICY order_events_select_all ON public.order_events
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS order_events_insert_all ON public.order_events;
CREATE POLICY order_events_insert_all ON public.order_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
