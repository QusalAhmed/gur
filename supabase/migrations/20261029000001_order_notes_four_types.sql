-- =============================================================================
-- Migration: Support 4 Types of Order Notes and Strict Table Separation
-- 1. Internal staff note (about order update and status) -> stored in notes table
-- 2. Customer note (for seller, written while ordering product) -> stored in orders.customer_note column
-- 3. Delivery note for delivery man -> stored in notes table
-- 4. Packaging note for checking while packaging -> stored in notes table
-- =============================================================================

-- 1. Ensure public.orders has customer_note column with adequate length
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_note text;

-- 2. Update public.order_notes check constraint to support all note types
DO $$
BEGIN
  -- Drop existing type check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'order_notes' AND constraint_name = 'order_notes_type_check'
  ) THEN
    ALTER TABLE public.order_notes DROP CONSTRAINT order_notes_type_check;
  END IF;

  -- Add updated constraint permitting internal, delivery, packaging, customer, staff
  ALTER TABLE public.order_notes 
    ADD CONSTRAINT order_notes_type_check 
    CHECK (type IN ('internal', 'delivery', 'packaging', 'customer', 'staff'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Notice updating order_notes_type_check: %', SQLERRM;
END $$;

-- 3. Migrate any legacy customer notes in order_notes to orders.customer_note column
UPDATE public.orders o
SET customer_note = n.note
FROM public.order_notes n
WHERE n.order_id = o.id
  AND n.type = 'customer'
  AND (o.customer_note IS NULL OR o.customer_note = '')
  AND n.note IS NOT NULL AND trim(n.note) <> '';

-- 4. Clean up customer notes from order_notes table (SSOT: customer note belongs in orders.customer_note)
DELETE FROM public.order_notes WHERE type = 'customer';

-- 5. Ensure public.notes view exists mapping directly to order_notes
CREATE OR REPLACE VIEW public.notes AS
SELECT 
  id,
  order_id,
  order_number,
  type,
  author,
  note,
  created_at
FROM public.order_notes;

-- 6. Indices for high-performance querying
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_number ON public.order_notes(order_number);
CREATE INDEX IF NOT EXISTS idx_order_notes_type ON public.order_notes(type);
CREATE INDEX IF NOT EXISTS idx_order_notes_created_at ON public.order_notes(created_at desc);

-- 7. Table Permissions for anon, authenticated, service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated, service_role;

-- 8. Row Level Security on public.order_notes
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_notes_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_select_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_insert_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_update_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_delete_all ON public.order_notes;

CREATE POLICY order_notes_all ON public.order_notes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
