-- =============================================================================
-- Migration: Remove Molasses Source from Products and Database
-- Drops column 'source' from public.products, recreates product_cards view,
-- and drops the molasses_source enum type.
-- =============================================================================

-- 1. Drop dependent search function and product_cards view
DROP FUNCTION IF EXISTS public.search_products(text, integer, integer);
DROP VIEW IF EXISTS public.product_cards CASCADE;

-- 2. Drop column source from public.products
ALTER TABLE public.products DROP COLUMN IF EXISTS source CASCADE;

-- 3. Drop type molasses_source enum
DROP TYPE IF EXISTS public.molasses_source CASCADE;

-- 4. Recreate product_cards view without source column
CREATE VIEW public.product_cards WITH (security_invoker = true) AS
SELECT p.id, p.slug, p.name, p.name_bn, p.summary, p.summary_bn,
       p.category_id, c.slug AS category_slug, c.name AS category_name, c.name_bn AS category_name_bn,
       p.grade, p.uses, p.certifications, p.is_featured, p.sort_order,
       p.rating_avg, p.rating_count, p.published_at,
       min(v.price)                              AS price_from,
       bool_or(v.stock_status <> 'out_of_stock') AS in_stock,
       (SELECT i.storage_path FROM public.product_images i
         WHERE i.product_id = p.id ORDER BY i.is_primary DESC, i.sort_order, i.created_at LIMIT 1) AS image_path
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  JOIN public.product_variants v ON v.product_id = p.id AND v.is_active
 WHERE p.status = 'active'
 GROUP BY p.id, c.id;

-- 5. Re-grant privileges on product_cards
GRANT SELECT ON public.product_cards TO anon, authenticated, service_role;

-- 6. Recreate search_products function
CREATE OR REPLACE FUNCTION public.search_products(p_query text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS SETOF public.product_cards
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pc.*
    FROM public.product_cards pc
    JOIN public.products p ON p.id = pc.id
   CROSS JOIN LATERAL (
         SELECT websearch_to_tsquery('simple', p_query) AS tsq,
                '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pat) q
   WHERE nullif(trim(p_query), '') IS NOT NULL
     AND (p.search @@ q.tsq OR p.name ilike q.pat OR p.name_bn ilike q.pat)
   ORDER BY ts_rank_cd(p.search, q.tsq) DESC, p.name
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, integer, integer) TO anon, authenticated, service_role;

