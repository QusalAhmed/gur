-- Migration: 20261109000005_backfill_combo_order_items.sql
-- Description: Backfills existing order items that are combo bundles with their component snapshots.
-- 1. Updates order_items where variant_id references an is_combo product_variant.
-- 2. Matches by product/variant title if variant_id was unlinked.
-- 3. Ensures get_combo_details generates accurate snapshots for historical orders.

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

  -- 2. Link variant_id and backfill for items matching combo variant by name if variant_id was null
  UPDATE public.order_items oi
  SET variant_id = pv.id,
      product_id = coalesce(oi.product_id, pv.product_id),
      is_combo = true,
      combo_components = public.get_combo_details(pv.id)
  FROM public.product_variants pv
  WHERE pv.is_combo = true
    AND oi.variant_id IS NULL
    AND (oi.variant_name = pv.name OR oi.product_name = pv.name)
    AND (
      oi.is_combo = false 
      OR oi.combo_components = '[]'::jsonb 
      OR oi.combo_components IS NULL
    );

  -- 3. If any item is marked is_combo but has empty components, attempt to match via combo_items table
  UPDATE public.order_items oi
  SET is_combo = true,
      combo_components = public.get_combo_details(ci.combo_variant_id)
  FROM public.combo_items ci
  WHERE oi.variant_id = ci.combo_variant_id
    AND (oi.is_combo = false OR oi.combo_components = '[]'::jsonb OR oi.combo_components IS NULL);

END $$;
