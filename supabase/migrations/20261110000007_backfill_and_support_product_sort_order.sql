-- Migration: Backfill and support product sort_order
-- Timestamp: 20261110000007

-- 1. Create index for fast retrieval of sorted products by status and sort_order
CREATE INDEX IF NOT EXISTS idx_products_status_sort_order_created 
ON public.products (status, sort_order ASC, created_at DESC);

-- 2. Backfill existing products with sequential 1-based order matching their current storefront display
WITH ranked_all AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY 
             CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC,
             sort_order ASC, 
             created_at DESC
         ) AS new_order
  FROM public.products
)
UPDATE public.products p
SET sort_order = ra.new_order
FROM ranked_all ra
WHERE p.id = ra.id;

-- 3. Atomic RPC function to batch reorder products by IDs array
CREATE OR REPLACE FUNCTION public.reorder_products(p_ordered_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_order int := 1;
  v_count int := 0;
BEGIN
  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No product IDs provided');
  END IF;

  FOREACH v_id IN ARRAY p_ordered_ids
  LOOP
    UPDATE public.products
    SET sort_order = v_order,
        updated_at = now()
    WHERE id = v_id;
    
    v_order := v_order + 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_products(uuid[]) TO authenticated, service_role, anon;
