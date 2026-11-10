-- Migration: 20261109000009_reconcile_combined_reservations.sql
-- Description:
-- Reconciles order_stock_reservations so each active order reservation reflects the
-- exact combined outstanding demand from both combo components and standard order_items.

DO $$
DECLARE
  v_wh uuid;
BEGIN
  SELECT id INTO v_wh FROM public.warehouses WHERE is_default AND is_active LIMIT 1;
  IF v_wh IS NOT NULL THEN
    WITH combo_demands AS (
      SELECT oi.order_id,
             (c ->> 'component_variant_id')::uuid AS variant_id,
             v_wh AS warehouse_id,
             sum((oi.quantity - coalesce(oi.shipped_quantity, 0)) * (c ->> 'quantity')::numeric) AS quantity
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        CROSS JOIN jsonb_array_elements(oi.combo_components) AS c
       WHERE o.status IN ('pending', 'confirmed', 'processing')
         AND oi.is_combo = true
         AND jsonb_typeof(oi.combo_components) = 'array'
         AND jsonb_array_length(oi.combo_components) > 0
         AND (c ->> 'component_variant_id') IS NOT NULL
         AND (oi.quantity - coalesce(oi.shipped_quantity, 0)) > 0
         AND coalesce((c ->> 'quantity')::numeric, 0) > 0
       GROUP BY oi.order_id, (c ->> 'component_variant_id')::uuid
    ),
    standard_demands AS (
      SELECT oi.order_id,
             oi.variant_id,
             v_wh AS warehouse_id,
             sum(oi.quantity - coalesce(oi.shipped_quantity, 0)) AS quantity
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
       WHERE o.status IN ('pending', 'confirmed', 'processing')
         AND oi.is_combo = false
         AND oi.variant_id IS NOT NULL
         AND (oi.quantity - coalesce(oi.shipped_quantity, 0)) > 0
       GROUP BY oi.order_id, oi.variant_id
    ),
    combined_demands AS (
      SELECT order_id, variant_id, warehouse_id, sum(quantity) AS quantity
        FROM (
          SELECT order_id, variant_id, warehouse_id, quantity FROM combo_demands
          UNION ALL
          SELECT order_id, variant_id, warehouse_id, quantity FROM standard_demands
        ) all_demands
       GROUP BY order_id, variant_id, warehouse_id
    )
    INSERT INTO public.order_stock_reservations (order_id, variant_id, warehouse_id, quantity)
    SELECT order_id, variant_id, warehouse_id, quantity
      FROM combined_demands
     WHERE quantity > 0
    ON CONFLICT (order_id, variant_id, warehouse_id)
    DO UPDATE SET quantity = EXCLUDED.quantity;
  END IF;
END $$;
