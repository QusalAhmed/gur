-- Migration: Add store.imo_url to site_settings
-- Stores the configurable IMO deep-link URL for the storefront contact section.
-- is_public = true so the storefront can read it without auth.

INSERT INTO public.site_settings (key, value, is_public, updated_at)
VALUES (
  'store.imo_url',
  '"https://s.imoim.net/H1lfS1"'::jsonb,
  true,
  now()
)
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      is_public  = EXCLUDED.is_public,
      updated_at = EXCLUDED.updated_at;
