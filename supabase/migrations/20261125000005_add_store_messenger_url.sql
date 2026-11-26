-- =============================================================================
-- Migration: 20261125000005_add_store_messenger_url.sql
-- Description:
--   Seeds public.site_settings with store.messenger_url so storefront
--   "Chat on Messenger" buttons open https://m.me/1469306489588846 by default
--   and can be customized or cleared (saved empty to hide) from Admin Settings.
-- =============================================================================

BEGIN;

INSERT INTO public.site_settings (key, value, description, is_public)
VALUES (
  'store.messenger_url',
  '"https://m.me/1469306489588846"'::jsonb,
  'Public Facebook Messenger chat URL (empty string hides storefront Messenger buttons)',
  true
)
ON CONFLICT (key) DO UPDATE
  SET is_public = true,
      description = EXCLUDED.description;

COMMIT;
