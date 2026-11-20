-- Migration: 20261120000001_remove_price_per_kg_and_sync_trigger.sql
-- Description: Remove the Base Rate per Kilogram (price_per_kg) system and its sync trigger,
-- restoring independent manual pricing for all product variants.

-- 1. Drop the auto-synchronization trigger if exists
DROP TRIGGER IF EXISTS trg_sync_product_variant_prices ON public.products;

-- 2. Drop the synchronization function if exists
DROP FUNCTION IF EXISTS public.sync_product_variant_prices();

-- 3. Drop price_per_kg column from products table
ALTER TABLE public.products
  DROP COLUMN IF EXISTS price_per_kg;
