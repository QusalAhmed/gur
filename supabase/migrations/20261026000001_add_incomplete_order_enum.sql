-- =============================================================================
-- Migration Step 1: Add 'incomplete_order' to public.order_status enum
-- NOTE: In PostgreSQL, adding an enum value must be committed in its own
-- transaction before the new value can be referenced in any constraints or policies.
-- =============================================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'incomplete_order' BEFORE 'pending';
