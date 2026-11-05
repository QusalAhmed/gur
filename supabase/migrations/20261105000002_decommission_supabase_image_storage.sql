-- Migration: Decommission Supabase Storage for catalog images
-- Date: 2026-11-05
-- All product, category, and site assets have been completely migrated to ImageKit CDN (https://ik.imagekit.io/qusal).
-- This migration cleanly removes the legacy catalog-images storage policies.

DROP POLICY IF EXISTS "catalog_images_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "catalog_images_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "catalog_images_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "catalog_images_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "catalog_public_read" ON storage.objects;
DROP POLICY IF EXISTS "catalog_content_write" ON storage.objects;
