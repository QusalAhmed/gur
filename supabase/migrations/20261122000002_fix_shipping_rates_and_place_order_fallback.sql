-- =============================================================================
-- Migration: 20261122000002_fix_shipping_rates_and_place_order_fallback.sql
-- Description:
-- 1. Inserts baseline universal shipping rates for Pickup and Courier:
--    - Pickup: ৳0 fee across all zones
--    - Courier Inside Dhaka: ৳80 fee (Zone: Dhaka)
--    - Courier Outside Dhaka: ৳130 catch-all fee (Zone: NULL)
-- 2. Updates private.price_cart to gracefully fall back to site_settings
--    (shipping.inside_dhaka_fee / shipping.outside_dhaka_fee) and ৳0 for pickup
--    rather than throwing NO_SHIPPING_RATE (P0001).
-- 3. Exposes public.reserve_order_stock(uuid) with SECURITY DEFINER
--    to allow manual admin orders and workflows to reserve stock cleanly.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. BASELINE SHIPPING RATES
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_pickup_id  uuid;
  v_courier_id uuid;
  v_dhaka_zone smallint;
BEGIN
  SELECT id INTO v_pickup_id FROM public.shipping_methods WHERE code = 'pickup' LIMIT 1;
  SELECT id INTO v_courier_id FROM public.shipping_methods WHERE code = 'courier' LIMIT 1;
  SELECT id INTO v_dhaka_zone FROM public.delivery_zones WHERE name = 'Dhaka' LIMIT 1;

  -- 1) Pickup rate (0 BDT for all weights and zones)
  IF v_pickup_id IS NOT NULL THEN
    INSERT INTO public.shipping_rates (
      method_id, zone_id, min_weight_kg, max_weight_kg,
      base_fee, per_kg_fee, eta_days_min, eta_days_max, is_active
    ) VALUES (
      v_pickup_id, NULL, 0, NULL,
      0, 0, 0, 1, true
    )
    ON CONFLICT (method_id, zone_id, min_weight_kg)
    DO UPDATE SET
      base_fee = 0,
      per_kg_fee = 0,
      is_active = true,
      updated_at = now();
  END IF;

  -- 2) Courier Inside Dhaka
  IF v_courier_id IS NOT NULL AND v_dhaka_zone IS NOT NULL THEN
    INSERT INTO public.shipping_rates (
      method_id, zone_id, min_weight_kg, max_weight_kg,
      base_fee, per_kg_fee, eta_days_min, eta_days_max, is_active
    ) VALUES (
      v_courier_id, v_dhaka_zone, 0, NULL,
      80, 0, 1, 2, true
    )
    ON CONFLICT (method_id, zone_id, min_weight_kg)
    DO UPDATE SET
      base_fee = 80,
      per_kg_fee = 0,
      is_active = true,
      updated_at = now();
  END IF;

  -- 3) Courier Outside Dhaka (Catch-all)
  IF v_courier_id IS NOT NULL THEN
    INSERT INTO public.shipping_rates (
      method_id, zone_id, min_weight_kg, max_weight_kg,
      base_fee, per_kg_fee, eta_days_min, eta_days_max, is_active
    ) VALUES (
      v_courier_id, NULL, 0, NULL,
      130, 0, 2, 4, true
    )
    ON CONFLICT (method_id, zone_id, min_weight_kg)
    DO UPDATE SET
      base_fee = 130,
      per_kg_fee = 0,
      is_active = true,
      updated_at = now();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. UPDATE private.price_cart WITH RESILIENT FALLBACK
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.price_cart(
  p_items              jsonb,                 -- [{"variant_id": uuid, "quantity": number}, ...]
  p_district_id        smallint,
  p_shipping_method_id uuid,
  p_coupon_code        text    default null,
  p_user_id            uuid    default null,
  p_business_id        uuid    default null,
  p_phone              text    default null,  -- E.164, for per-customer coupon limits of guests
  p_price_overrides    jsonb   default null   -- staff only: {"<variant_id>": 31.50}
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_line                    record;
  v_lines                   jsonb := '[]'::jsonb;
  v_unit_price              numeric(12,2);
  v_line_sub                numeric(14,2);
  v_line_tax                numeric(14,2);
  v_subtotal                numeric(14,2) := 0;
  v_tax                     numeric(14,2) := 0;
  v_weight_g                numeric := 0;
  v_weight_kg               numeric(12,3);
  v_discount                numeric(14,2) := 0;
  v_shipping                numeric(14,2) := 0;
  v_method                  public.shipping_methods;
  v_rate                    public.shipping_rates;
  v_zone                    smallint;
  v_dhaka_zone              smallint;
  v_coupon                  public.coupons;
  v_has_coupon              boolean := false;
  v_used                    integer;
  v_free_delivery_enabled   boolean := false;
  v_free_delivery_threshold numeric(14,2) := 0;
  v_inside_fee              numeric(14,2) := 80;
  v_outside_fee             numeric(14,2) := 130;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY: the cart has no items' USING errcode = 'P0001';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'CART_TOO_LARGE: at most 100 lines per order' USING errcode = 'P0001';
  END IF;

  -- 1) lines (duplicates of one variant are merged)
  FOR v_line IN
    WITH req AS (
      SELECT i.variant_id, sum(i.quantity) AS quantity
        FROM jsonb_to_recordset(p_items) AS i(variant_id uuid, quantity numeric)
       GROUP BY i.variant_id
    )
    SELECT req.variant_id, req.quantity,
           v.sku, v.name AS variant_name, v.price, v.min_order_qty, v.order_qty_step, v.max_order_qty,
           v.weight_grams, v.net_quantity, v.net_unit, v.is_active AS variant_active,
           p.id AS product_id, p.name AS product_name, p.status AS product_status, p.tax_rate
      FROM req
      LEFT JOIN public.product_variants v ON v.id = req.variant_id
      LEFT JOIN public.products p ON p.id = v.product_id
     ORDER BY req.variant_id
  LOOP
    IF v_line.sku IS NULL OR NOT v_line.variant_active OR v_line.product_status <> 'active' THEN
      RAISE EXCEPTION 'VARIANT_UNAVAILABLE: % is not available', coalesce(v_line.variant_id::text, 'item') USING errcode = 'P0001';
    END IF;
    IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'QUANTITY_INVALID: % needs a quantity above zero', v_line.sku USING errcode = 'P0001';
    END IF;
    IF v_line.quantity < v_line.min_order_qty THEN
      RAISE EXCEPTION 'BELOW_MIN_QTY: % needs at least %', v_line.sku, v_line.min_order_qty USING errcode = 'P0001';
    END IF;
    IF mod(v_line.quantity, v_line.order_qty_step) <> 0 THEN
      RAISE EXCEPTION 'QTY_STEP: % must be ordered in multiples of %', v_line.sku, v_line.order_qty_step USING errcode = 'P0001';
    END IF;
    IF v_line.max_order_qty IS NOT NULL AND v_line.quantity > v_line.max_order_qty THEN
      RAISE EXCEPTION 'MAX_QTY: % allows at most % per order', v_line.sku, v_line.max_order_qty USING errcode = 'P0001';
    END IF;

    -- negotiated override (staff) > volume tier > list price
    v_unit_price := NULL;
    IF p_price_overrides IS NOT NULL THEN
      v_unit_price := nullif(p_price_overrides ->> v_line.variant_id::text, '')::numeric;
      IF v_unit_price < 0 THEN
        RAISE EXCEPTION 'PRICE_INVALID: negative price override' USING errcode = 'P0001';
      END IF;
    END IF;
    IF v_unit_price IS NULL THEN
      SELECT t.unit_price INTO v_unit_price
        FROM public.price_tiers t
       WHERE t.variant_id = v_line.variant_id AND t.min_qty <= v_line.quantity
       ORDER BY t.min_qty DESC LIMIT 1;
    END IF;
    v_unit_price := coalesce(v_unit_price, v_line.price);

    v_line_sub := round(v_line.quantity * v_unit_price, 2);
    v_line_tax := round(v_line_sub * v_line.tax_rate / 100, 2);   -- VAT on the pre-discount amount
    v_subtotal := v_subtotal + v_line_sub;
    v_tax      := v_tax + v_line_tax;
    v_weight_g := v_weight_g + v_line.quantity * v_line.weight_grams;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line.variant_id, 'product_id', v_line.product_id, 'sku', v_line.sku,
      'product_name', v_line.product_name, 'variant_name', v_line.variant_name,
      'net_quantity', v_line.net_quantity, 'net_unit', v_line.net_unit,
      'quantity', v_line.quantity, 'unit_price', v_unit_price, 'tax_rate', v_line.tax_rate,
      'tax_amount', v_line_tax, 'line_subtotal', v_line_sub, 'weight_grams', v_line.weight_grams));
  END LOOP;

  -- 2) coupon
  IF nullif(trim(coalesce(p_coupon_code, '')), '') IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons c WHERE c.code = upper(trim(p_coupon_code));
    IF NOT FOUND OR NOT v_coupon.is_active
       OR (v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now())
       OR (v_coupon.ends_at   IS NOT NULL AND v_coupon.ends_at   <= now())
       OR (v_coupon.usage_limit_total IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit_total) THEN
      RAISE EXCEPTION 'COUPON_INVALID: this code is not valid' USING errcode = 'P0001';
    END IF;
    IF v_subtotal < v_coupon.min_order_amount THEN
      RAISE EXCEPTION 'COUPON_MIN_ORDER: spend at least % to use this code', v_coupon.min_order_amount USING errcode = 'P0001';
    END IF;
    IF v_coupon.business_only AND p_business_id IS NULL THEN
      RAISE EXCEPTION 'COUPON_BUSINESS_ONLY: this code is for approved business accounts' USING errcode = 'P0001';
    END IF;
    IF p_user_id IS NOT NULL OR p_phone IS NOT NULL THEN
      SELECT count(*) INTO v_used
        FROM public.coupon_redemptions r
       WHERE r.coupon_id = v_coupon.id
         AND ((p_user_id IS NOT NULL AND r.user_id = p_user_id)
           OR (p_phone   IS NOT NULL AND r.customer_phone = p_phone));
      IF v_used >= v_coupon.usage_limit_per_customer THEN
        RAISE EXCEPTION 'COUPON_ALREADY_USED: you have already used this code' USING errcode = 'P0001';
      END IF;
    END IF;
    v_has_coupon := true;
    v_discount := CASE v_coupon.discount_type
                    WHEN 'percentage'   THEN round(v_subtotal * v_coupon.value / 100, 2)
                    WHEN 'fixed_amount' THEN v_coupon.value
                    ELSE 0 END;
    IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
    v_discount := least(v_discount, v_subtotal);
  END IF;

  -- 3) shipping (optional while the customer is still browsing the cart)
  v_weight_kg := round(v_weight_g / 1000, 3);
  IF p_shipping_method_id IS NOT NULL THEN
    SELECT * INTO v_method FROM public.shipping_methods m WHERE m.id = p_shipping_method_id AND m.is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SHIPPING_METHOD_INVALID: choose a delivery method' USING errcode = 'P0001';
    END IF;
    SELECT g.zone_id INTO v_zone FROM public.geo_districts g WHERE g.id = p_district_id;
    SELECT z.id INTO v_dhaka_zone FROM public.delivery_zones z WHERE z.name = 'Dhaka' LIMIT 1;

    -- Query matching rate band (zone-specific beats catch-all)
    SELECT * INTO v_rate
      FROM public.shipping_rates r
     WHERE r.method_id = v_method.id AND r.is_active
       AND (r.zone_id IS NULL OR r.zone_id = v_zone)
       AND r.min_weight_kg <= v_weight_kg
       AND (r.max_weight_kg IS NULL OR v_weight_kg < r.max_weight_kg)
     ORDER BY (r.zone_id IS NULL), r.min_weight_kg DESC
     LIMIT 1;

    IF FOUND THEN
      v_shipping := round(v_rate.base_fee + v_rate.per_kg_fee * v_weight_kg, 2);
      IF v_rate.free_over_amount IS NOT NULL AND (v_subtotal - v_discount) >= v_rate.free_over_amount THEN
        v_shipping := 0;
      END IF;
    ELSE
      -- RESILIENT FALLBACK: Never throw NO_SHIPPING_RATE if default settings exist
      IF v_method.is_pickup THEN
        v_shipping := 0;
      ELSE
        -- Load central site settings
        SELECT coalesce((s.value)::boolean, false) INTO v_free_delivery_enabled
          FROM public.site_settings s WHERE s.key = 'shipping.free_delivery_enabled';
        SELECT coalesce((s.value)::numeric, 0) INTO v_free_delivery_threshold
          FROM public.site_settings s WHERE s.key = 'shipping.free_delivery_threshold';
        SELECT coalesce((s.value)::numeric, 80) INTO v_inside_fee
          FROM public.site_settings s WHERE s.key = 'shipping.inside_dhaka_fee';
        SELECT coalesce((s.value)::numeric, 130) INTO v_outside_fee
          FROM public.site_settings s WHERE s.key = 'shipping.outside_dhaka_fee';

        IF v_free_delivery_enabled AND v_free_delivery_threshold > 0 AND (v_subtotal - v_discount) >= v_free_delivery_threshold THEN
          v_shipping := 0;
        ELSIF v_dhaka_zone IS NOT NULL AND v_zone = v_dhaka_zone THEN
          v_shipping := v_inside_fee;
        ELSE
          v_shipping := v_outside_fee;
        END IF;
      END IF;
    END IF;

    -- Coupon free shipping override
    IF v_has_coupon AND v_coupon.discount_type = 'free_shipping' THEN
      v_shipping := 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'currency',             'BDT',
    'items',                v_lines,
    'subtotal',             v_subtotal,
    'discount_total',       v_discount,
    'shipping_total',       v_shipping,
    'tax_total',            v_tax,
    'grand_total',          v_subtotal - v_discount + v_shipping + v_tax,
    'total_weight_kg',      v_weight_kg,
    'shipping_method_id',   v_method.id,
    'shipping_method_name', v_method.name,
    'eta_days_min',         coalesce(v_rate.eta_days_min, CASE WHEN v_method.is_pickup THEN 0 WHEN v_zone = v_dhaka_zone THEN 1 ELSE 2 END),
    'eta_days_max',         coalesce(v_rate.eta_days_max, CASE WHEN v_method.is_pickup THEN 0 WHEN v_zone = v_dhaka_zone THEN 2 ELSE 4 END),
    'coupon_id',            CASE WHEN v_has_coupon THEN v_coupon.id END,
    'coupon_code',          CASE WHEN v_has_coupon THEN v_coupon.code END);
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. EXPOSE public.reserve_order_stock FOR DIRECT MANUAL ORDERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_order_id IS NOT NULL THEN
    PERFORM private.reserve_order_stock(p_order_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_order_stock(uuid) TO authenticated, service_role;

COMMIT;
