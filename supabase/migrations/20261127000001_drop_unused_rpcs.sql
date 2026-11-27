-- =============================================================================
-- Migration: Drop unused legacy & superseded SQL RPC functions
-- Description:
--   Safely removes 10 unused public RPCs and 1 unscheduled private housekeeping
--   function verified to have zero callers in application code, SQL triggers,
--   views, or pg_cron jobs. Uses RESTRICT so PostgreSQL aborts if any DB
--   object depends on them.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.create_customer_order(jsonb) RESTRICT;
DROP FUNCTION IF EXISTS public.create_admin_order(jsonb) RESTRICT;
DROP FUNCTION IF EXISTS public.place_order(
  jsonb,
  jsonb,
  jsonb,
  uuid,
  public.payment_method,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  text,
  uuid,
  uuid,
  jsonb
) RESTRICT;
DROP FUNCTION IF EXISTS public.preview_cart(jsonb, smallint, uuid, text, uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.set_order_items(uuid, jsonb, jsonb) RESTRICT;
DROP FUNCTION IF EXISTS public.track_order(text, text) RESTRICT;
DROP FUNCTION IF EXISTS public.get_order_by_token(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.search_products(text, integer, integer) RESTRICT;
DROP FUNCTION IF EXISTS public.lot_lookup(text) RESTRICT;
DROP FUNCTION IF EXISTS public.cleanup_old_notifications() RESTRICT;
DROP FUNCTION IF EXISTS private.expire_stale_orders(integer) RESTRICT;

COMMIT;
