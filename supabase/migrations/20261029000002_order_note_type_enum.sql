-- =============================================================================
-- Migration: Order Note Types Enum Architecture
-- 1. Create enum public.order_note_type (internal, delivery, packaging + aliases)
-- 2. Convert public.order_notes.type to public.order_note_type
-- 3. Strip [Delivery Note] / [Packaging Note] / [Internal Note] prefixes from note
-- =============================================================================

-- Step 0: Drop the dependent view first (it blocks ALTER COLUMN TYPE)
DROP VIEW IF EXISTS public.notes;

-- Step 1: Drop ALL check constraints that involve order_notes.type
-- (not just one hard-coded name, and scoped to the public schema)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid
     AND a.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.order_notes'::regclass
      AND con.contype = 'c'
      AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE public.order_notes DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Step 2: Migrate legacy customer notes to orders.customer_note
-- (type::text so this still works if the migration is re-run after the enum conversion)
UPDATE public.orders o
SET customer_note = n.note
FROM public.order_notes n
WHERE n.order_id = o.id
  AND n.type::text = 'customer'
  AND (o.customer_note IS NULL OR o.customer_note = '')
  AND n.note IS NOT NULL AND trim(n.note) <> '';

DELETE FROM public.order_notes WHERE type::text = 'customer';

-- Step 3: Clean bracket prefixes and normalize type
UPDATE public.order_notes
SET
  type = 'delivery',
  note = trim(regexp_replace(note, '^\[Delivery Note\]\s*', '', 'i'))
WHERE note ILIKE '[Delivery Note]%' OR type::text IN ('delivery', 'delivery_note');

UPDATE public.order_notes
SET
  type = 'packaging',
  note = trim(regexp_replace(note, '^\[Packaging Note\]\s*', '', 'i'))
WHERE note ILIKE '[Packaging Note]%' OR type::text IN ('packaging', 'packaging_note');

UPDATE public.order_notes
SET
  type = 'internal',
  note = trim(regexp_replace(note, '^\[Internal Note\]\s*', '', 'i'))
WHERE note ILIKE '[Internal Note]%' OR type::text IN ('internal', 'staff', 'internal_staff_note');

-- Step 4: Create the enum if it doesn't exist; otherwise add any missing values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'order_note_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.order_note_type AS ENUM (
      'internal',
      'delivery',
      'packaging',
      'internal_staff_note',
      'delivery_note',
      'packaging_note'
    );
  ELSE
    ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'internal';
    ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'delivery';
    ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'packaging';
    ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'internal_staff_note';
    ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'delivery_note';
    ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'packaging_note';
  END IF;
END $$;

-- Step 5: Convert the column (cast through text so it's safe on re-runs too)
ALTER TABLE public.order_notes
  ALTER COLUMN type DROP DEFAULT;

ALTER TABLE public.order_notes
  ALTER COLUMN type TYPE public.order_note_type
  USING (
    CASE
      WHEN type::text IN ('delivery', 'delivery_note')   THEN 'delivery'::public.order_note_type
      WHEN type::text IN ('packaging', 'packaging_note') THEN 'packaging'::public.order_note_type
      ELSE 'internal'::public.order_note_type
    END
  );

ALTER TABLE public.order_notes
  ALTER COLUMN type SET DEFAULT 'internal'::public.order_note_type;

-- Step 6: Permissions
GRANT USAGE ON TYPE public.order_note_type TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO anon, authenticated, service_role;

-- Step 7: Recreate the view (dropping it also dropped its grants)
CREATE VIEW public.notes
WITH (security_invoker = true) AS
SELECT
  id,
  order_id,
  order_number,
  type,
  author,
  note,
  created_at
FROM public.order_notes;

GRANT SELECT ON public.notes TO anon, authenticated, service_role;