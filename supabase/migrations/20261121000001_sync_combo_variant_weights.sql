-- Migration: 20261121000001_sync_combo_variant_weights.sql
-- Description: Automatically synchronize combo variant total weights and net quantities from combo_items

-- 1. Function to recalculate combo variant weight from its recipe items
CREATE OR REPLACE FUNCTION public.sync_combo_variant_weight_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_combo_var_id uuid;
  v_total_weight_grams integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_combo_var_id := OLD.combo_variant_id;
  ELSE
    v_combo_var_id := NEW.combo_variant_id;
  END IF;

  IF v_combo_var_id IS NOT NULL THEN
    SELECT coalesce(sum(ci.quantity * coalesce(nullif(comp_pv.weight_grams, 0), round(comp_pv.net_quantity * 1000), 1000)), 0)::integer
      INTO v_total_weight_grams
      FROM public.combo_items ci
      JOIN public.product_variants comp_pv ON comp_pv.id = ci.component_variant_id
     WHERE ci.combo_variant_id = v_combo_var_id;

    IF v_total_weight_grams > 0 THEN
      UPDATE public.product_variants
         SET weight_grams = v_total_weight_grams,
             net_quantity = round(v_total_weight_grams / 1000.0, 3),
             net_unit = 'kg',
             updated_at = now()
       WHERE id = v_combo_var_id
         AND is_combo = true;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Trigger on public.combo_items
DROP TRIGGER IF EXISTS trg_sync_combo_variant_weight ON public.combo_items;
CREATE TRIGGER trg_sync_combo_variant_weight
AFTER INSERT OR UPDATE OR DELETE ON public.combo_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_combo_variant_weight_trigger();

-- 3. Backfill/recalculate all existing combo variants in product_variants
UPDATE public.product_variants pv
   SET net_unit = 'kg',
       weight_grams = ci_summary.total_weight_grams,
       net_quantity = round(ci_summary.total_weight_grams / 1000.0, 3),
       updated_at = now()
  FROM (
    SELECT ci.combo_variant_id,
           coalesce(sum(ci.quantity * coalesce(nullif(comp_pv.weight_grams, 0), round(comp_pv.net_quantity * 1000), 1000)), 0)::integer AS total_weight_grams
      FROM public.combo_items ci
      JOIN public.product_variants comp_pv ON comp_pv.id = ci.component_variant_id
     GROUP BY ci.combo_variant_id
  ) ci_summary
 WHERE pv.id = ci_summary.combo_variant_id
   AND pv.is_combo = true;
