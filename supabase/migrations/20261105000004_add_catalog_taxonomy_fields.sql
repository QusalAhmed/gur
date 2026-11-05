-- Migration: Add Google Product Category and Product Type for Meta Catalog & Ads
-- Supports Meta / Facebook Catalog Batch API requirements and custom product set organization

-- 1. Add taxonomy fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS google_product_category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS product_type text DEFAULT NULL;

-- 2. Add taxonomy fields to categories table for category-level fallbacks
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS google_product_category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS product_type text DEFAULT NULL;

-- 3. Populate default taxonomy on categories
UPDATE public.categories
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Date Palm Jaggery'
WHERE slug = 'jaggery' OR name ILIKE '%jaggery%' OR name_bn ILIKE '%গুড়%';

-- 4. Seed and update existing products with precise Google product categories and product types
-- Patali Gur (পাঙালি / পাটালি গুড়)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Date Palm Jaggery > Patali Gur'
WHERE slug = 'patali-gur';

-- First Cut Patali (প্রথম কাটের পাটালি)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Date Palm Jaggery > First Cut Patali'
WHERE slug = 'first-cut-patali';

-- Nut Jaggery (বাদাম গুড়)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Specialty Jaggery > Nut Jaggery'
WHERE slug = 'nut-jaggery';

-- Coconut Jaggery (নারিকেল গুড়)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Specialty Jaggery > Coconut Jaggery'
WHERE slug = 'coconut-jaggery';

-- Liquid Gur (পাতলা ঝোলা গুড়)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Liquid Jaggery > Thin Jhola Gur'
WHERE slug = 'liquid-gur';

-- Grainy Liquid Gur (দানাদার ঝোলা গুড়)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Liquid Jaggery > Granular Jhola Gur'
WHERE slug = 'grainy-liquid-gur';

-- Chocolate / Sandesh Gur (চকলেট গুড় / সন্দেশ গুড়)
UPDATE public.products
SET
  google_product_category = 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses',
  product_type = 'Food & Beverage > Pantry > Sweeteners > Flavored Jaggery > Sandesh Gur'
WHERE slug = 'chocolate-gur';

-- Catch-all for any other products without google_product_category or product_type
UPDATE public.products
SET
  google_product_category = COALESCE(google_product_category, 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Molasses'),
  product_type = COALESCE(product_type, 'Food & Beverage > Pantry > Sweeteners > Date Palm Jaggery')
WHERE google_product_category IS NULL OR product_type IS NULL;

