-- =============================================================================
-- Migration: Fix Product Catalog & Storage Privileges and RLS Policies for Anon Role
-- Resolves PostgreSQL Error 42501 (permission denied for table products / storage)
-- Run this directly in the Supabase Dashboard SQL Editor
-- =============================================================================

-- 1. Table-level Verb Grants for anon, authenticated, and service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated, service_role;

-- 2. RLS Policies for public.products
DROP POLICY IF EXISTS products_read ON public.products;
DROP POLICY IF EXISTS products_write ON public.products;
DROP POLICY IF EXISTS products_select_all ON public.products;
DROP POLICY IF EXISTS products_insert_all ON public.products;
DROP POLICY IF EXISTS products_update_all ON public.products;
DROP POLICY IF EXISTS products_delete_all ON public.products;

CREATE POLICY products_select_all ON public.products
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

CREATE POLICY products_insert_all ON public.products
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY products_update_all ON public.products
  FOR UPDATE TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY products_delete_all ON public.products
  FOR DELETE TO anon, authenticated, service_role
  USING (true);

-- 3. RLS Policies for public.product_variants
DROP POLICY IF EXISTS product_variants_read ON public.product_variants;
DROP POLICY IF EXISTS product_variants_write ON public.product_variants;
DROP POLICY IF EXISTS product_variants_select_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_insert_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_update_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_delete_all ON public.product_variants;

CREATE POLICY product_variants_select_all ON public.product_variants
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

CREATE POLICY product_variants_insert_all ON public.product_variants
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY product_variants_update_all ON public.product_variants
  FOR UPDATE TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY product_variants_delete_all ON public.product_variants
  FOR DELETE TO anon, authenticated, service_role
  USING (true);

-- 4. RLS Policies for public.product_images
DROP POLICY IF EXISTS product_images_read ON public.product_images;
DROP POLICY IF EXISTS product_images_write ON public.product_images;
DROP POLICY IF EXISTS product_images_select_all ON public.product_images;
DROP POLICY IF EXISTS product_images_insert_all ON public.product_images;
DROP POLICY IF EXISTS product_images_update_all ON public.product_images;
DROP POLICY IF EXISTS product_images_delete_all ON public.product_images;

CREATE POLICY product_images_select_all ON public.product_images
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

CREATE POLICY product_images_insert_all ON public.product_images
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY product_images_update_all ON public.product_images
  FOR UPDATE TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY product_images_delete_all ON public.product_images
  FOR DELETE TO anon, authenticated, service_role
  USING (true);

-- 5. RLS Policies for public.categories
DROP POLICY IF EXISTS categories_read ON public.categories;
DROP POLICY IF EXISTS categories_write ON public.categories;
DROP POLICY IF EXISTS categories_select_all ON public.categories;
DROP POLICY IF EXISTS categories_insert_all ON public.categories;
DROP POLICY IF EXISTS categories_update_all ON public.categories;
DROP POLICY IF EXISTS categories_delete_all ON public.categories;

CREATE POLICY categories_select_all ON public.categories
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

CREATE POLICY categories_insert_all ON public.categories
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY categories_update_all ON public.categories
  FOR UPDATE TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY categories_delete_all ON public.categories
  FOR DELETE TO anon, authenticated, service_role
  USING (true);

-- 6. Storage Bucket & Policies for catalog-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalog-images', 'catalog-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS catalog_public_read ON storage.objects;
DROP POLICY IF EXISTS catalog_content_write ON storage.objects;
DROP POLICY IF EXISTS catalog_images_anon_select ON storage.objects;
DROP POLICY IF EXISTS catalog_images_anon_insert ON storage.objects;
DROP POLICY IF EXISTS catalog_images_anon_update ON storage.objects;
DROP POLICY IF EXISTS catalog_images_anon_delete ON storage.objects;

CREATE POLICY catalog_images_anon_select ON storage.objects
  FOR SELECT TO anon, authenticated, service_role
  USING (bucket_id = 'catalog-images');

CREATE POLICY catalog_images_anon_insert ON storage.objects
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (bucket_id = 'catalog-images');

CREATE POLICY catalog_images_anon_update ON storage.objects
  FOR UPDATE TO anon, authenticated, service_role
  USING (bucket_id = 'catalog-images')
  WITH CHECK (bucket_id = 'catalog-images');

CREATE POLICY catalog_images_anon_delete ON storage.objects
  FOR DELETE TO anon, authenticated, service_role
  USING (bucket_id = 'catalog-images');
