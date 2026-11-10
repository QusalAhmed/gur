-- Migration: 20261109000005_backfill_combo_order_items.sql
-- Description: Backfills existing order items that are combo bundles with their component snapshots.
-- 1. Updates order_items where variant_id references an is_combo product_variant.
-- 2. Ensures get_combo_details generates accurate snapshots for historical orders.

DO $$
BEGIN
  -- 1. Update order_items where variant_id is already linked to an is_combo variant
  UPDATE public.order_items oi
  SET is_combo = true,
      combo_components = public.get_combo_details(oi.variant_id)
  FROM public.product_variants pv
  WHERE oi.variant_id = pv.id
    AND pv.is_combo = true
    AND (
      oi.is_combo = false 
      OR oi.combo_components = '[]'::jsonb 
      OR oi.combo_components IS NULL
    );

  -- 2. If any item is marked is_combo or matches combo_items table, populate components
  UPDATE public.order_items oi
  SET is_combo = true,
      combo_components = public.get_combo_details(ci.combo_variant_id)
  FROM public.combo_items ci
  WHERE oi.variant_id = ci.combo_variant_id
    AND (oi.is_combo = false OR oi.combo_components = '[]'::jsonb OR oi.combo_components IS NULL);

END $$;
