-- =============================================================================
-- Migration: 20261120000001_create_customer_call_lists.sql
-- Description:
-- 1. Creates call_list_status and call_item_status enums.
-- 2. Adds 'call_reminder' to notification_type enum.
-- 3. Creates public.call_lists table.
-- 4. Creates public.call_list_items table.
-- 5. Creates public.call_logs table.
-- 6. Adds trigger to keep call_lists total_contacts and completed_contacts in sync.
-- 7. Adds RLS policies for staff access.
-- 8. Adds tables to supabase_realtime publication.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_list_status') THEN
    CREATE TYPE public.call_list_status AS ENUM (
      'active',
      'paused',
      'completed',
      'archived'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_item_status') THEN
    CREATE TYPE public.call_item_status AS ENUM (
      'pending',
      'no_answer',
      'call_later',
      'reached_interested',
      'reached_not_interested',
      'reached_ordered',
      'wrong_number'
    );
  END IF;
END $$;

-- Add 'call_reminder' to notification_type if not present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'call_reminder';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. CREATE public.call_lists TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_lists (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL CHECK (char_length(trim(title)) >= 1),
  description          text,
  status               public.call_list_status NOT NULL DEFAULT 'active',
  created_by           uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assigned_to          uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  total_contacts       integer NOT NULL DEFAULT 0 CHECK (total_contacts >= 0),
  completed_contacts   integer NOT NULL DEFAULT 0 CHECK (completed_contacts >= 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_lists_status ON public.call_lists (status);
CREATE INDEX IF NOT EXISTS idx_call_lists_assigned_to ON public.call_lists (assigned_to);
CREATE INDEX IF NOT EXISTS idx_call_lists_created_at ON public.call_lists (created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. CREATE public.call_list_items TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_list_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id              uuid NOT NULL REFERENCES public.call_lists (id) ON DELETE CASCADE,
  customer_id          uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  assigned_to          uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status               public.call_item_status NOT NULL DEFAULT 'pending',
  callback_at          timestamptz,
  attempt_count        integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_called_at       timestamptz,
  last_called_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_call_list_customer UNIQUE (list_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_call_list_items_list_id ON public.call_list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_call_list_items_customer_id ON public.call_list_items (customer_id);
CREATE INDEX IF NOT EXISTS idx_call_list_items_status ON public.call_list_items (status);
CREATE INDEX IF NOT EXISTS idx_call_list_items_callback_at ON public.call_list_items (callback_at);
CREATE INDEX IF NOT EXISTS idx_call_list_items_assigned_to ON public.call_list_items (assigned_to);

-- -----------------------------------------------------------------------------
-- 4. CREATE public.call_logs TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_list_item_id    uuid NOT NULL REFERENCES public.call_list_items (id) ON DELETE CASCADE,
  called_by            uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  outcome              public.call_item_status NOT NULL,
  notes                text,
  callback_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_item_id ON public.call_logs (call_list_item_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON public.call_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. TRIGGER FUNCTION TO SYNC CALL LIST STATS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_call_list_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  v_list_id := COALESCE(NEW.list_id, OLD.list_id);
  IF v_list_id IS NOT NULL THEN
    UPDATE public.call_lists
       SET total_contacts = (
             SELECT count(*)
               FROM public.call_list_items
              WHERE list_id = v_list_id
           ),
           completed_contacts = (
             SELECT count(*)
               FROM public.call_list_items
              WHERE list_id = v_list_id
                AND status IN ('reached_interested', 'reached_not_interested', 'reached_ordered', 'wrong_number')
           ),
           updated_at = now()
     WHERE id = v_list_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_call_list_stats ON public.call_list_items;
CREATE TRIGGER trg_sync_call_list_stats
  AFTER INSERT OR UPDATE OF status, list_id OR DELETE ON public.call_list_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_call_list_stats();

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY & PERMISSIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.call_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role has full access to call_lists" ON public.call_lists;
CREATE POLICY "Service role has full access to call_lists"
  ON public.call_lists FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to call_list_items" ON public.call_list_items;
CREATE POLICY "Service role has full access to call_list_items"
  ON public.call_list_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to call_logs" ON public.call_logs;
CREATE POLICY "Service role has full access to call_logs"
  ON public.call_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Staff access
DROP POLICY IF EXISTS "Staff can manage call_lists" ON public.call_lists;
CREATE POLICY "Staff can manage call_lists"
  ON public.call_lists FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff can manage call_list_items" ON public.call_list_items;
CREATE POLICY "Staff can manage call_list_items"
  ON public.call_list_items FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff can manage call_logs" ON public.call_logs;
CREATE POLICY "Staff can manage call_logs"
  ON public.call_logs FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_lists TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_list_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. REALTIME PUBLICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_lists;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_list_items;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
