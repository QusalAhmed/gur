-- =============================================================================
-- Migration Step 2: Relax constraints, triggers, and define RLS for draft orders
-- Prerequisite: Migration Step 1 (adding 'incomplete_order' enum) must be committed first.
-- =============================================================================

-- 1. RELAX CONSTRAINTS FOR DRAFT ORDERS (incomplete_order & pending)
ALTER TABLE public.orders ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;

-- Drop previous hard check constraints on customer_name & customer_phone
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name IN ('customer_name', 'customer_phone')
  LOOP
    IF r.constraint_name NOT LIKE '%pkey%' AND r.constraint_name NOT LIKE '%fkey%' THEN
      EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END IF;
  END LOOP;
END $$;

-- Re-add conditional check constraints allowing nulls for draft stages
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_name_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_name_check
  CHECK (
    status IN ('incomplete_order', 'pending')
    OR (customer_name IS NOT NULL AND char_length(customer_name) BETWEEN 1 AND 120)
  );

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_phone_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_phone_check
  CHECK (
    status IN ('incomplete_order', 'pending')
    OR (customer_phone IS NOT NULL AND customer_phone ~ '^\+[1-9][0-9]{7,14}$')
  );

-- 2. UPDATE STATE MACHINE TRIGGER TO INCLUDE 'incomplete_order' AND ENFORCE DETAILS UPON CONFIRMATION
CREATE OR REPLACE FUNCTION private.orders_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
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

    -- Enforce customer details before moving to confirmed or higher
    IF array_position(v_flow, new.status::text) >= array_position(v_flow, 'confirmed'::text) THEN
      IF new.customer_name IS NULL OR char_length(trim(new.customer_name)) < 1 THEN
        RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED: customer name is required before confirming order' USING errcode = 'P0001';
      END IF;
      IF new.customer_phone IS NULL OR new.customer_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
        RAISE EXCEPTION 'CUSTOMER_PHONE_REQUIRED: valid customer phone is required before confirming order' USING errcode = 'P0001';
      END IF;
    END IF;

    IF new.status = 'confirmed' THEN new.confirmed_at := coalesce(new.confirmed_at, now()); END IF;
    IF new.status = 'shipped'   THEN new.shipped_at   := coalesce(new.shipped_at,   now()); END IF;
    IF new.status = 'delivered' THEN new.delivered_at := coalesce(new.delivered_at, now()); END IF;
  END IF;
  RETURN new;
END $$;

-- 3. TIMELINE EVENT TRIGGER FOR DIRECT INSERTS
CREATE OR REPLACE FUNCTION private.orders_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.order_events (order_id, event_type, to_value, message, actor_id)
  VALUES (
    new.id,
    'placed',
    new.status::text,
    CASE
      WHEN new.status = 'incomplete_order' THEN 'Incomplete draft order recorded'
      WHEN new.status = 'pending' THEN 'Pending order draft created'
      ELSE 'Order placed'
    END,
    auth.uid()
  );
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_orders_after_insert ON public.orders;
CREATE TRIGGER trg_orders_after_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.orders_after_insert();

-- 4. PERMISSIONS & RLS POLICIES FOR ORDERS, ITEMS, AND EVENTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT SELECT, INSERT ON public.order_events TO anon, authenticated;

-- Allow reading all orders directly from Supabase
DROP POLICY IF EXISTS orders_select_all ON public.orders;
DROP POLICY IF EXISTS orders_select_draft ON public.orders;
CREATE POLICY orders_select_all ON public.orders
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow inserting draft orders directly
DROP POLICY IF EXISTS orders_insert_draft ON public.orders;
CREATE POLICY orders_insert_draft ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (status IN ('incomplete_order', 'pending'));

-- Allow updating orders directly
DROP POLICY IF EXISTS orders_update_all ON public.orders;
DROP POLICY IF EXISTS orders_update_draft ON public.orders;
CREATE POLICY orders_update_all ON public.orders
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow deleting orders directly
DROP POLICY IF EXISTS orders_delete_all ON public.orders;
CREATE POLICY orders_delete_all ON public.orders
  FOR DELETE TO anon, authenticated
  USING (true);

-- Allow reading order items directly
DROP POLICY IF EXISTS order_items_select_all ON public.order_items;
CREATE POLICY order_items_select_all ON public.order_items
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow reading and logging order events directly
DROP POLICY IF EXISTS order_events_select_all ON public.order_events;
CREATE POLICY order_events_select_all ON public.order_events
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS order_events_insert_all ON public.order_events;
CREATE POLICY order_events_insert_all ON public.order_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
