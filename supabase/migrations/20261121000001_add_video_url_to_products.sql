-- Migration: Add optional video_url to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.products.video_url IS 'Optional YouTube or Vimeo video URL for product showcase in carousel';
