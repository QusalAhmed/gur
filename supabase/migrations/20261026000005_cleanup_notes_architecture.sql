-- =============================================================================
-- Migration: Clean Up Notes Architecture to Single Source of Truth (SSOT)
-- 1. Drops redundant 'notes' JSONB column from public.orders (if it exists)
-- 2. Ensures public.order_notes table is the sole authoritative store for staff notes
-- 3. Grants full permissions and enables RLS policies for anon and authenticated
-- =============================================================================

-- 1. Remove redundant JSONB notes column from public.orders
ALTER TABLE public.orders DROP COLUMN IF EXISTS notes;

-- 2. Ensure public.order_notes table exists with relational foreign key
CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  type text NOT NULL DEFAULT 'internal' CHECK (type IN ('customer', 'internal')),
  author text NOT NULL DEFAULT 'Admin Staff',
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. High-performance querying indexes
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_number ON public.order_notes(order_number);
CREATE INDEX IF NOT EXISTS idx_order_notes_type ON public.order_notes(type);
CREATE INDEX IF NOT EXISTS idx_order_notes_created_at ON public.order_notes(created_at desc);

-- 4. Permissions & Row Level Security
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO anon, authenticated;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_notes_all ON public.order_notes;
CREATE POLICY order_notes_all ON public.order_notes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
