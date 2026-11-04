-- =============================================================================
-- Migration: Add System Order Note Type to Enum
-- 1. Adds 'system' and alias 'system_note' to public.order_note_type enum
-- =============================================================================

ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'system';
ALTER TYPE public.order_note_type ADD VALUE IF NOT EXISTS 'system_note';

