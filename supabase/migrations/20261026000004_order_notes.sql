-- =============================================================================
-- Migration: Support Two Types of Order Notes (Customer Notes & Internal Staff Notes)
-- 1. Adds 'notes' JSONB column to public.orders for instant sync and offline resilience
-- 2. Creates 'order_notes' table for normalized relational storage & audit
-- 3. Grants permissions and configures RLS policies for anon and authenticated roles
-- =============================================================================

-- 1. Ensure public.orders has customer_note and notes JSONB columns
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_note text;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS notes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Create normalized public.order_notes table
CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  type text NOT NULL CHECK (type IN ('customer', 'internal')),
  author text NOT NULL DEFAULT 'Admin Staff',
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_number ON public.order_notes(order_number);
CREATE INDEX IF NOT EXISTS idx_order_notes_type ON public.order_notes(type);
CREATE INDEX IF NOT EXISTS idx_order_notes_created_at ON public.order_notes(created_at desc);

-- 3. Table-level Verb Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_notes TO anon, authenticated;

-- 4. Enable Row Level Security
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for public.order_notes
DROP POLICY IF EXISTS order_notes_select_all ON public.order_notes;
CREATE POLICY order_notes_select_all ON public.order_notes
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS order_notes_insert_all ON public.order_notes;
CREATE POLICY order_notes_insert_all ON public.order_notes
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS order_notes_update_all ON public.order_notes;
CREATE POLICY order_notes_update_all ON public.order_notes
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS order_notes_delete_all ON public.order_notes;
CREATE POLICY order_notes_delete_all ON public.order_notes
  FOR DELETE TO anon, authenticated
  USING (true);

-- 6. RLS Policies for public.staff_notes
ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_notes_all ON public.staff_notes;
CREATE POLICY staff_notes_all ON public.staff_notes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
