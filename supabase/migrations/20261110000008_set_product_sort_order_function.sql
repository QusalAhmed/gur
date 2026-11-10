-- Migration: set_product_sort_order atomic shifting function
-- Timestamp: 20261110000008

CREATE OR REPLACE FUNCTION public.set_product_sort_order(p_product_id uuid, p_new_order int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_order int;
BEGIN
  IF p_new_order < 1 THEN
    p_new_order := 1;
  END IF;

  SELECT sort_order INTO v_old_order
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_old_order = p_new_order THEN
    RETURN;
  END IF;

  IF p_new_order < v_old_order THEN
    -- Moving to earlier position: shift intermediate products down (+1)
    UPDATE public.products
    SET sort_order = sort_order + 1
    WHERE sort_order >= p_new_order 
      AND sort_order < v_old_order 
      AND id <> p_product_id;
  ELSE
    -- Moving to later position: shift intermediate products up (-1)
    UPDATE public.products
    SET sort_order = sort_order - 1
    WHERE sort_order <= p_new_order 
      AND sort_order > v_old_order 
      AND id <> p_product_id;
  END IF;

  UPDATE public.products
  SET sort_order = p_new_order,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_product_sort_order(uuid, int) TO authenticated, service_role, anon;
