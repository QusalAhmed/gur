-- =============================================================================
-- Migration: Admin PWA Web Push Subscriptions & Notification Push Tracking
-- Timestamp: 20261117000001_admin_pwa_push_subscriptions.sql
-- Description:
--   1. Creates public.admin_push_subscriptions to store per-device Web Push
--      subscriptions linked to authenticated staff members (or env admin-root).
--   2. Adds push_dispatched_at tracking column on public.notifications for
--      idempotent Web Push fan-out without duplicate delivery.
--   3. Backfills historical notifications so old entries are not re-pushed.
-- =============================================================================

-- 1. Track push dispatch status on public.notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_dispatched_at timestamptz;

-- Backfill existing notifications so enabling Web Push does not replay old alerts
UPDATE public.notifications
   SET push_dispatched_at = created_at
 WHERE push_dispatched_at IS NULL;

-- Partial index for fast lookup of undispatched notifications
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (created_at DESC)
  WHERE push_dispatched_at IS NULL;

-- 2. Admin Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     text NOT NULL,
  staff_email  text,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  device_label text,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_staff_id
  ON public.admin_push_subscriptions (staff_id);

CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_updated_at
  ON public.admin_push_subscriptions (updated_at DESC);

-- 3. Row Level Security (strict server-side management via service_role)
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.admin_push_subscriptions TO service_role;

-- 4. Maintain updated_at automatically
CREATE OR REPLACE FUNCTION private.touch_admin_push_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_admin_push_subscriptions_updated_at ON public.admin_push_subscriptions;
CREATE TRIGGER tr_admin_push_subscriptions_updated_at
  BEFORE UPDATE ON public.admin_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_admin_push_subscriptions_updated_at();
