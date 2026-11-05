-- =============================================================================
-- Migration: Add Foil and Box to pack_type enum
-- 1. Adds 'foil' and 'box' to public.pack_type enum
-- =============================================================================

ALTER TYPE public.pack_type ADD VALUE IF NOT EXISTS 'foil';
ALTER TYPE public.pack_type ADD VALUE IF NOT EXISTS 'box';

