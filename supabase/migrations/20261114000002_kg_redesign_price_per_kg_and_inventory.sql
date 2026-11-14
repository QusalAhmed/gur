-- Migration: 20261114000002_kg_redesign_price_per_kg_and_inventory.sql
-- Description: Kilogram (KG) redesign: add price_per_kg to products, standardize variant weight_grams,
--              clean up variant display names to Bengali/English weights, enforce strict flat-rate pricing,
--              and auto-sync variant prices on base rate updates.

-- 1. Add price_per_kg to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_per_kg numeric(12,2) CHECK (price_per_kg >= 0);

COMMENT ON COLUMN public.products.price_per_kg IS 'Base sales price per kilogram (৳/kg). All non-combo variant prices derive from this base rate.';

-- 2. Backfill price_per_kg on products from existing 1kg active variants or known base prices
UPDATE public.products p
   SET price_per_kg = coalesce(
     (
       SELECT round(v.price / nullif(coalesce(nullif(v.weight_grams, 0) / 1000.0, v.net_quantity, 1.0), 0), 2)
         FROM public.product_variants v
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND coalesce(v.is_combo, false) = false
        ORDER BY v.is_default DESC, v.price ASC
        LIMIT 1
     ),
     CASE 
       WHEN p.name ILIKE '%chocolate%' THEN 600.00
       WHEN p.name ILIKE '%coconut%' THEN 550.00
       WHEN p.name ILIKE '%first cut%' THEN 500.00
       WHEN p.name ILIKE '%nut%' THEN 500.00
       WHEN p.name ILIKE '%patali%' THEN 400.00
       WHEN p.name ILIKE '%liquid%' OR p.name ILIKE '%grainy%' THEN 350.00
       ELSE 400.00
     END
   )
 WHERE p.price_per_kg IS NULL;

-- 3. Standardize weight_grams and net_unit on product_variants
UPDATE public.product_variants
   SET net_unit = 'kg',
       weight_grams = CASE
         WHEN net_quantity > 0 THEN round(net_quantity * 1000)::integer
         WHEN name ILIKE '%0.5%' OR name ILIKE '%500%' THEN 500
         WHEN name ILIKE '%2%' AND name ILIKE '%kg%' THEN 2000
         WHEN name ILIKE '%3%' AND name ILIKE '%kg%' THEN 3000
         WHEN name ILIKE '%4%' AND name ILIKE '%kg%' THEN 4000
         WHEN name ILIKE '%5%' AND name ILIKE '%kg%' THEN 5000
         ELSE 1000
       END
 WHERE coalesce(is_combo, false) = false
   AND (weight_grams IS NULL OR weight_grams <= 0);

-- Backfill combo variant weights based on their combo_items recipe
UPDATE public.product_variants pv
   SET net_unit = 'kg',
       weight_grams = ci_summary.total_weight_grams,
       net_quantity = round(ci_summary.total_weight_grams / 1000.0, 3)
  FROM (
    SELECT ci.combo_variant_id,
           coalesce(sum(ci.quantity * coalesce(nullif(comp_pv.weight_grams, 0), round(comp_pv.net_quantity * 1000), 1000)), 0)::integer AS total_weight_grams
      FROM public.combo_items ci
      JOIN public.product_variants comp_pv ON comp_pv.id = ci.component_variant_id
     GROUP BY ci.combo_variant_id
  ) ci_summary
 WHERE pv.id = ci_summary.combo_variant_id
   AND pv.is_combo = true;

-- Fallback for any combo variant without recipes (e.g. 3kg combos)
UPDATE public.product_variants
   SET weight_grams = CASE
         WHEN name ILIKE '%3kg%' OR name_bn ILIKE '%৩%কেজি%' THEN 3000
         WHEN name ILIKE '%4kg%' OR name_bn ILIKE '%৪%কেজি%' THEN 4000
         ELSE 3000
       END,
       net_quantity = CASE
         WHEN name ILIKE '%3kg%' OR name_bn ILIKE '%৩%কেজি%' THEN 3.000
         WHEN name ILIKE '%4kg%' OR name_bn ILIKE '%৪%কেজি%' THEN 4.000
         ELSE 3.000
       END,
       net_unit = 'kg'
 WHERE is_combo = true AND (weight_grams IS NULL OR weight_grams <= 0);

-- 4. Clean up variant names to remove generic "Standard Pack" text
UPDATE public.product_variants
   SET name = '1 kg',
       name_bn = '১ কেজি'
 WHERE coalesce(is_combo, false) = false
   AND (name ILIKE '%Standard Pack (1kg)%' OR name ILIKE '%Standard Pack (1 kg)%');

UPDATE public.product_variants
   SET name = '0.5 kg (500g)',
       name_bn = '৫০০ গ্রাম'
 WHERE coalesce(is_combo, false) = false
   AND (name ILIKE '%Standard Pack (0.5kg)%' OR name ILIKE '%Standard Pack (0.5 kg)%');

-- 5. Synchronize variant prices using strict flat-rate pricing: (weight_grams / 1000.0) * price_per_kg
UPDATE public.product_variants v
   SET price = round((coalesce(nullif(v.weight_grams, 0) / 1000.0, v.net_quantity, 1.0)) * p.price_per_kg, 2),
       updated_at = now()
  FROM public.products p
 WHERE v.product_id = p.id
   AND coalesce(v.is_combo, false) = false
   AND p.price_per_kg IS NOT NULL;

-- 6. Trigger to automatically synchronize variant prices whenever a product's price_per_kg changes
CREATE OR REPLACE FUNCTION public.sync_product_variant_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.price_per_kg IS DISTINCT FROM OLD.price_per_kg AND NEW.price_per_kg IS NOT NULL THEN
    UPDATE public.product_variants
       SET price = round((coalesce(nullif(weight_grams, 0) / 1000.0, net_quantity, 1.0)) * NEW.price_per_kg, 2),
           updated_at = now()
     WHERE product_id = NEW.id
       AND coalesce(is_combo, false) = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_variant_prices ON public.products;
CREATE TRIGGER trg_sync_product_variant_prices
  AFTER UPDATE OF price_per_kg ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_variant_prices();

-- 7. Ensure process_storefront_order uses exact weight_grams and strict price validation
-- Re-executes process_storefront_order with guaranteed weight_grams fallback resolution
CREATE OR REPLACE FUNCTION public.process_storefront_order(
  p_order_id                 uuid DEFAULT NULL,
  p_status                   text DEFAULT 'pending', -- 'incomplete_order' or 'pending'
  p_customer_phone           text DEFAULT NULL,
  p_customer_name            text DEFAULT NULL,
  p_customer_email           text DEFAULT NULL,
  p_customer_address         text DEFAULT NULL,
  p_customer_division        text DEFAULT NULL,
  p_customer_district        text DEFAULT NULL,
  p_customer_upazila         text DEFAULT NULL,
  p_customer_postal_code     text DEFAULT NULL,
  p_shipping_method_id       text DEFAULT NULL,
  p_shipping_cost            numeric DEFAULT 0,
  p_customer_note            text DEFAULT NULL,
  p_items                    jsonb DEFAULT '[]'::jsonb, -- array of {product_id, variant_id, quantity, unit_price}
  p_applied_coupon_id        uuid DEFAULT NULL,
  p_discount_total           numeric DEFAULT 0,
  p_payment_method           text DEFAULT 'cod',
  p_paid_at                  timestamptz DEFAULT NULL,
  p_estimated_delivery_date  timestamptz DEFAULT NULL,
  p_actual_delivery_date     timestamptz DEFAULT NULL,
  p_delivery_time_slot       text DEFAULT NULL,
  p_tracking_number          text DEFAULT NULL,
  p_status_reason            text DEFAULT NULL,
  p_rescheduled_count        integer DEFAULT 0,
  p_cancel_reason            text DEFAULT NULL,
  p_cancelled_at             timestamptz DEFAULT NULL,
  p_reopened_at              timestamptz DEFAULT NULL,
  p_replacement_order_id     uuid DEFAULT NULL,
  p_reschedule_history       jsonb DEFAULT '[]'::jsonb,
  p_order_notes              jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing               public.orders%ROWTYPE;
  v_order_id               uuid;
  v_order_number           text;
  v_public_token           uuid;
  v_clean_phone            text;
  v_customer_id            uuid;
  v_default_wh             uuid;
  v_subtotal               numeric(14,2) := 0;
  v_grand_total            numeric(14,2) := 0;
  v_total_weight_grams     integer := 0;
  v_shipping_address       jsonb;
  v_item_count             integer := 0;
  v_item                   jsonb;
  v_resolved_items         jsonb := '[]'::jsonb;
  v_resolved_item          jsonb;
  v_candidate_var_id       text;
  v_candidate_prod_id      text;
  v_valid_variant_id       uuid;
  v_valid_product_id       uuid;
  v_db_price               numeric(12,2);
  v_prod_price_per_kg      numeric(12,2);
  v_unit_price             numeric(12,2);
  v_tier_price             numeric(12,2);
  v_item_weight_grams      integer := 0;
  v_is_combo               boolean := false;
  v_combo_components       jsonb := '[]'::jsonb;
  v_calc_combo_weight      integer := 0;
  v_prod_name              text;
  v_var_name               text;
  v_sku                    text;
  v_qty                    numeric(12,3);
  v_resolved_customer_note text;
  v_authoritative_delivery_fee numeric(12,2) := 0;
  v_zone                   text;
  v_config_inside_fee      numeric(12,2) := 70.00;
  v_config_outside_fee     numeric(12,2) := 130.00;
  v_config_free_enabled    boolean := false;
  v_config_free_threshold  numeric(12,2) := 0.00;
  v_setting_val            text;
BEGIN
  -- Normalize customer phone
  v_clean_phone := trim(coalesce(p_customer_phone, ''));
  IF v_clean_phone ~ '^[0-9+ -]{7,25}$' THEN
    v_clean_phone := regexp_replace(v_clean_phone, '[^0-9+]', '', 'g');
  ELSE
    v_clean_phone := NULL;
  END IF;

  -- 1. Identify or create customer record
  IF v_clean_phone IS NOT NULL AND v_clean_phone <> '' THEN
    SELECT id INTO v_customer_id
      FROM public.customers
     WHERE phone = v_clean_phone
     LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (phone, name, email, default_address, default_division, default_district, default_upazila, default_postal_code)
      VALUES (
        v_clean_phone,
        nullif(trim(p_customer_name), ''),
        nullif(trim(p_customer_email), ''),
        nullif(trim(p_customer_address), ''),
        nullif(trim(p_customer_division), ''),
        nullif(trim(p_customer_district), ''),
        nullif(trim(p_customer_upazila), ''),
        nullif(trim(p_customer_postal_code), '')
      )
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  -- Check existing order if ID provided
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders WHERE id = p_order_id;
  END IF;

  -- Resolve default warehouse
  SELECT id INTO v_default_wh FROM public.warehouses WHERE is_default = true AND is_active = true LIMIT 1;
  IF v_default_wh IS NULL THEN
    SELECT id INTO v_default_wh FROM public.warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- 2. Process order items & compute exact weights
  IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := greatest(1, coalesce((v_item ->> 'quantity')::numeric, 1));
      v_candidate_var_id := trim(v_item ->> 'variant_id');
      v_candidate_prod_id := trim(v_item ->> 'product_id');

      v_valid_variant_id := NULL;
      v_valid_product_id := NULL;
      v_db_price := NULL;
      v_is_combo := false;
      v_item_weight_grams := 0;

      IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT pv.id, pv.product_id, pv.price, coalesce(pv.is_combo, false),
               coalesce(nullif(pv.weight_grams, 0), round(coalesce(pv.net_quantity, 1.0) * 1000)::integer, 1000)
          INTO v_valid_variant_id, v_valid_product_id, v_db_price, v_is_combo, v_item_weight_grams
          FROM public.product_variants pv
         WHERE pv.id = v_candidate_var_id::uuid;
      END IF;

      IF v_valid_product_id IS NULL AND v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_valid_product_id FROM public.products WHERE id = v_candidate_prod_id::uuid;
      END IF;

      IF v_valid_variant_id IS NULL AND v_valid_product_id IS NOT NULL THEN
        SELECT pv.id, pv.price, coalesce(pv.is_combo, false),
               coalesce(nullif(pv.weight_grams, 0), round(coalesce(pv.net_quantity, 1.0) * 1000)::integer, 1000)
          INTO v_valid_variant_id, v_db_price, v_is_combo, v_item_weight_grams
          FROM public.product_variants pv
         WHERE pv.product_id = v_valid_product_id
         ORDER BY pv.price ASC
         LIMIT 1;
      END IF;

      IF v_valid_variant_id IS NOT NULL AND v_valid_product_id IS NOT NULL THEN
        SELECT p.name, coalesce(pv.name, '1 kg'), pv.sku, p.price_per_kg
          INTO v_prod_name, v_var_name, v_sku, v_prod_price_per_kg
          FROM public.products p
          JOIN public.product_variants pv ON pv.id = v_valid_variant_id
         WHERE p.id = v_valid_product_id;
      ELSE
        v_prod_name := coalesce(nullif(trim(v_item ->> 'product_name'), ''), 'খেজুরের খাঁটি গুড়');
        v_var_name := coalesce(nullif(trim(v_item ->> 'variant_name'), ''), '১ কেজি');
        v_sku := 'DEFAULT';
        IF v_item_weight_grams <= 0 THEN
          v_item_weight_grams := 1000;
        END IF;
      END IF;

      -- Check volume price tiers
      v_tier_price := NULL;
      IF v_valid_variant_id IS NOT NULL THEN
        SELECT pt.unit_price INTO v_tier_price
          FROM public.price_tiers pt
         WHERE pt.variant_id = v_valid_variant_id
           AND pt.min_qty <= v_qty
         ORDER BY pt.min_qty DESC
         LIMIT 1;
      END IF;

      IF v_tier_price IS NOT NULL AND v_tier_price > 0 THEN
        v_unit_price := v_tier_price;
      ELSIF v_db_price IS NOT NULL AND v_db_price >= 0 THEN
        v_unit_price := v_db_price;
      ELSE
        v_unit_price := greatest(0, coalesce((v_item ->> 'unit_price')::numeric, 0));
      END IF;

      -- Resolve combo components if combo variant
      v_combo_components := '[]'::jsonb;
      IF v_is_combo AND v_valid_variant_id IS NOT NULL THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'component_variant_id', ci.component_variant_id,
                 'quantity', ci.quantity,
                 'component_name', p.name || ' (' || coalesce(pv.name, '1 kg') || ')',
                 'component_sku', pv.sku,
                 'weight_grams', coalesce(nullif(pv.weight_grams, 0), 1000)
               )), '[]'::jsonb),
               coalesce(sum(ci.quantity * coalesce(nullif(pv.weight_grams, 0), 1000)), 0)::integer
          INTO v_combo_components, v_calc_combo_weight
          FROM public.combo_items ci
          JOIN public.product_variants pv ON pv.id = ci.component_variant_id
          JOIN public.products p ON p.id = pv.product_id
         WHERE ci.combo_variant_id = v_valid_variant_id;

        IF v_calc_combo_weight > 0 THEN
          v_item_weight_grams := v_calc_combo_weight;
        END IF;
      END IF;

      v_resolved_items := v_resolved_items || jsonb_build_array(jsonb_build_object(
        'product_id', v_valid_product_id,
        'variant_id', v_valid_variant_id,
        'product_name', v_prod_name,
        'variant_name', v_var_name,
        'sku', v_sku,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'line_total', round(v_qty * v_unit_price, 2),
        'weight_grams', v_item_weight_grams,
        'is_combo', v_is_combo,
        'combo_components', v_combo_components
      ));

      v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
      v_total_weight_grams := v_total_weight_grams + (v_item_weight_grams * v_qty::integer);
      v_item_count := v_item_count + 1;
    END LOOP;
  END IF;

  -- 3. Calculate authoritative courier delivery fee
  SELECT coalesce(nullif(trim(value::text), ''), '70')::numeric INTO v_config_inside_fee
    FROM public.site_settings WHERE key = 'shipping.inside_dhaka_fee';
  SELECT coalesce(nullif(trim(value::text), ''), '130')::numeric INTO v_config_outside_fee
    FROM public.site_settings WHERE key = 'shipping.outside_dhaka_fee';
  SELECT (value::text = 'true' OR value::text = '"true"') INTO v_config_free_enabled
    FROM public.site_settings WHERE key = 'shipping.free_delivery_enabled';
  SELECT coalesce(nullif(trim(value::text), ''), '0')::numeric INTO v_config_free_threshold
    FROM public.site_settings WHERE key = 'shipping.free_delivery_threshold';

  IF lower(trim(coalesce(p_customer_district, ''))) = 'dhaka' OR lower(trim(coalesce(p_customer_division, ''))) = 'dhaka' THEN
    v_zone := 'inside_dhaka';
  ELSE
    v_zone := 'outside_dhaka';
  END IF;

  IF v_config_free_enabled AND v_config_free_threshold > 0 AND v_subtotal >= v_config_free_threshold THEN
    v_authoritative_delivery_fee := 0;
  ELSIF v_zone = 'inside_dhaka' THEN
    v_authoritative_delivery_fee := coalesce(v_config_inside_fee, 70);
  ELSE
    v_authoritative_delivery_fee := coalesce(v_config_outside_fee, 130);
  END IF;

  v_grand_total := v_subtotal + v_authoritative_delivery_fee;

  -- Build shipping address jsonb
  v_shipping_address := jsonb_build_object(
    'recipient_name', coalesce(nullif(trim(p_customer_name), ''), 'Customer'),
    'phone', coalesce(v_clean_phone, ''),
    'address', coalesce(nullif(trim(p_customer_address), ''), ''),
    'division', coalesce(nullif(trim(p_customer_division), ''), ''),
    'district', coalesce(nullif(trim(p_customer_district), ''), ''),
    'upazila', coalesce(nullif(trim(p_customer_upazila), ''), ''),
    'postal_code', coalesce(nullif(trim(p_customer_postal_code), ''), '')
  );

  v_resolved_customer_note := nullif(trim(p_customer_note), '');

  -- 4. Insert or Update Order
  IF v_existing.id IS NOT NULL THEN
    v_order_id := v_existing.id;
    v_order_number := v_existing.order_number;
    v_public_token := v_existing.public_token;

    UPDATE public.orders
       SET status = coalesce(p_status, v_existing.status),
           customer_phone = coalesce(v_clean_phone, v_existing.customer_phone),
           customer_name = coalesce(nullif(trim(p_customer_name), ''), v_existing.customer_name),
           customer_id = coalesce(v_customer_id, v_existing.customer_id),
           shipping_address = v_shipping_address,
           subtotal = v_subtotal,
           shipping_total = v_authoritative_delivery_fee,
           grand_total = v_grand_total,
           total_weight_kg = CASE WHEN v_item_count = 0 THEN coalesce(v_existing.total_weight_kg, 0) ELSE round(v_total_weight_grams / 1000.0, 3) END,
           customer_note = v_resolved_customer_note,
           updated_at = now()
     WHERE id = v_order_id;
  ELSE
    v_order_id := gen_random_uuid();
    v_public_token := gen_random_uuid();
    v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(v_order_id::text, '-', ''), 1, 6));

    INSERT INTO public.orders (
      id, order_number, public_token, status, customer_phone, customer_name, customer_id,
      shipping_address, subtotal, shipping_total, discount_total, grand_total, total_weight_kg,
      amount_paid, customer_note, attribution, payment_method
    )
    VALUES (
      v_order_id, v_order_number, v_public_token, p_status, v_clean_phone,
      coalesce(nullif(trim(p_customer_name), ''), 'Customer'), v_customer_id,
      v_shipping_address, v_subtotal, v_authoritative_delivery_fee, 0, v_grand_total,
      round(v_total_weight_grams / 1000.0, 3), 0, v_resolved_customer_note,
      jsonb_build_object('source', 'direct_storefront_web', 'client_timestamp', now()::text),
      p_payment_method
    );
  END IF;

  -- 5. Insert order items
  IF v_item_count > 0 THEN
    DELETE FROM public.order_items WHERE order_id = v_order_id;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku,
      quantity, unit_price, line_total, weight_grams, net_quantity, net_unit,
      is_combo, combo_components, warehouse_id
    )
    SELECT v_order_id,
           (it ->> 'product_id')::uuid,
           (it ->> 'variant_id')::uuid,
           (it ->> 'product_name'),
           (it ->> 'variant_name'),
           (it ->> 'sku'),
           (it ->> 'quantity')::numeric,
           (it ->> 'unit_price')::numeric,
           (it ->> 'line_total')::numeric,
           (it ->> 'weight_grams')::integer,
           round((it ->> 'weight_grams')::numeric / 1000.0, 3),
           'kg'::public.uom,
           (it ->> 'is_combo')::boolean,
           (it -> 'combo_components'),
           v_default_wh
      FROM jsonb_array_elements(v_resolved_items) AS it;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_token', v_public_token,
    'subtotal', v_subtotal,
    'delivery_fee', v_authoritative_delivery_fee,
    'grand_total', v_grand_total,
    'total_weight_kg', round(v_total_weight_grams / 1000.0, 3),
    'items_count', v_item_count
  );
END;
$$;
