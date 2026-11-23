-- =============================================================================
-- Migration: 20261123000001_do_not_default_customer_name.sql
-- Description:
-- 1. Updates public.process_storefront_order:
--    - Never default customer name to 'Customer' if customer left it blank.
--    - Sets orders.customer_name and customers.full_name to NULL when blank.
--    - Ignores legacy 'Customer' placeholder from existing drafts.
-- 2. Updates public.create_customer_order:
--    - Never require customer name (optional field); only check min length if provided.
--    - Never default customer name to 'Customer'.
-- 3. Updates orders_customer_name_check constraint:
--    - Allows customer_name to be NULL for any status, validating length only if non-null.
-- 4. Updates private.orders_before_update:
--    - Removes hard CUSTOMER_NAME_REQUIRED check on confirmation so orders with blank customer names can advance cleanly.
-- 5. Backfills / cleans existing records where customer_name or full_name was auto-set to 'Customer'.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. RELAX orders_customer_name_check CHECK CONSTRAINT
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_name_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_name_check
  CHECK (
    customer_name IS NULL
    OR (char_length(trim(customer_name)) BETWEEN 1 AND 120)
  );

-- -----------------------------------------------------------------------------
-- 2. UPDATE private.orders_before_update()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.orders_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_flow CONSTANT text[] := ARRAY['incomplete_order','pending','confirmed','processing','shipped','delivered'];
BEGIN
  IF new.order_number IS DISTINCT FROM old.order_number
     OR new.public_token IS DISTINCT FROM old.public_token
     OR new.currency     IS DISTINCT FROM old.currency THEN
    RAISE EXCEPTION 'ORDER_IMMUTABLE: order_number, public_token and currency cannot change' USING errcode = 'P0001';
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    IF old.status IN ('cancelled','returned') THEN
      RAISE EXCEPTION 'ORDER_FINAL: order is already %', old.status USING errcode = 'P0001';
    ELSIF new.status = 'cancelled' THEN
      IF old.status IN ('shipped','delivered') THEN
        RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE: order is already %', old.status USING errcode = 'P0001';
      END IF;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    ELSIF new.status = 'returned' THEN
      IF old.status NOT IN ('shipped','delivered') THEN
        RAISE EXCEPTION 'ORDER_NOT_RETURNABLE: order is still %', old.status USING errcode = 'P0001';
      END IF;
    ELSIF array_position(v_flow, new.status::text) <= array_position(v_flow, old.status::text) THEN
      RAISE EXCEPTION 'ORDER_STATUS_BACKWARDS: % -> %', old.status, new.status USING errcode = 'P0001';
    END IF;

    -- Enforce order items and phone details before moving to confirmed or higher
    IF array_position(v_flow, new.status::text) >= array_position(v_flow, 'confirmed'::text) THEN
      -- Require at least one order line item
      IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = new.id) THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: at least one order item is required before confirming order' USING errcode = 'P0001';
      END IF;

      -- Require valid Bangladeshi phone
      IF new.customer_phone IS NULL OR new.customer_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
        RAISE EXCEPTION 'CUSTOMER_PHONE_REQUIRED: valid customer phone is required before confirming order' USING errcode = 'P0001';
      END IF;
    END IF;

    IF new.status = 'confirmed' THEN new.confirmed_at := coalesce(new.confirmed_at, now()); END IF;
    IF new.status = 'shipped'   THEN new.shipped_at   := coalesce(new.shipped_at,   now()); END IF;
    IF new.status = 'delivered' THEN new.delivered_at := coalesce(new.delivered_at, now()); END IF;
  END IF;
  RETURN new;
END $$;

-- -----------------------------------------------------------------------------
-- 3. UPDATE STOREFRONT HANDLER: public.process_storefront_order()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_storefront_order(
  p_order_id                 uuid DEFAULT NULL,
  p_status                   text DEFAULT 'pending',
  p_customer_phone           text DEFAULT NULL,
  p_customer_name            text DEFAULT NULL,
  p_delivery_zone            text DEFAULT NULL,
  p_address_line             text DEFAULT NULL,
  p_customer_note            text DEFAULT NULL,
  p_items                    jsonb DEFAULT '[]'::jsonb,
  p_division                 text DEFAULT NULL,
  p_district                 text DEFAULT NULL,
  p_courier_name             text DEFAULT NULL,
  p_expected_shipping_total  numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone                  text;
  v_raw_digits             text;
  v_final_status           text;
  v_existing               public.orders%ROWTYPE;
  v_order_id               uuid;
  v_order_number           text;
  v_public_token           uuid;
  v_customer_id            uuid;
  v_matched_user_id        uuid;
  v_resolved_customer_name text;
  v_resolved_address_line  text;
  v_resolved_customer_note text;
  v_resolved_district      text := '';
  v_resolved_division      text := '';
  v_resolved_method_name   text := NULL;
  v_inside_fee             numeric(14,2) := 70;
  v_outside_fee            numeric(14,2) := 130;
  v_free_shipping_enabled  boolean := false;
  v_free_shipping_threshold numeric(14,2) := 0;
  v_base_shipping          numeric(14,2) := 0;
  v_shipping_total         numeric(14,2) := 0;
  v_subtotal               numeric(14,2) := 0;
  v_grand_total            numeric(14,2) := 0;
  v_total_weight_grams     integer := 0;
  v_shipping_address       jsonb;
  v_item_count             integer := 0;
  v_item                   jsonb;
  v_resolved_items         jsonb := '[]'::jsonb;
  v_resolved_item          jsonb;
  v_qty                    numeric(12,3);
  v_unit_price             numeric(12,2);
  v_tier_price             numeric(12,2);
  v_valid_product_id       uuid;
  v_valid_variant_id       uuid;
  v_candidate_prod_id      text;
  v_candidate_var_id       text;
  v_sku                    text;
  v_prod_name              text;
  v_var_name               text;
  v_is_combo               boolean := false;
  v_item_weight_grams      integer := 0;
  v_combo_components       jsonb := '[]'::jsonb;
  v_calc_combo_weight      integer := 0;
  v_was_incomplete         boolean := false;
  v_was_pending            boolean := false;
  v_has_other_orders       boolean := false;
  v_other_order_numbers    text[] := '{}';
  v_other_orders_json      jsonb := '[]'::jsonb;
  v_var_rec                record;
BEGIN
  -- 1. Validate & normalize phone number
  v_raw_digits := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  IF v_raw_digits ~ '^1[3-9]\d{8}$' THEN
    v_phone := '+880' || v_raw_digits;
  ELSIF v_raw_digits ~ '^01[3-9]\d{8}$' THEN
    v_phone := '+88' || v_raw_digits;
  ELSIF v_raw_digits ~ '^8801[3-9]\d{8}$' THEN
    v_phone := '+' || v_raw_digits;
  ELSE
    RAISE EXCEPTION 'INVALID_PHONE: Valid Bangladeshi mobile phone number required' USING errcode = 'P0001';
  END IF;

  -- 2. Validate target status
  v_final_status := coalesce(nullif(trim(p_status), ''), 'pending');
  IF v_final_status NOT IN ('incomplete_order', 'pending') THEN
    v_final_status := 'pending';
  END IF;

  -- 3. Lookup existing order with row-level lock ONLY when p_order_id ownership matches
  IF v_final_status = 'incomplete_order' THEN
    IF p_order_id IS NOT NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE id = p_order_id
         AND customer_phone = v_phone
         FOR UPDATE;

      IF FOUND AND v_existing.status::text = 'pending' THEN
        SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at DESC), '{}'),
               coalesce(jsonb_agg(
                 jsonb_build_object(
                   'order_number', o.order_number,
                   'status', o.status,
                   'grand_total', o.grand_total,
                   'item_count', (SELECT coalesce(sum(quantity), 0) FROM public.order_items WHERE order_id = o.id),
                   'created_at', o.created_at
                 ) ORDER BY o.created_at DESC
               ), '[]'::jsonb)
          INTO v_other_order_numbers, v_other_orders_json
          FROM public.orders o
         WHERE o.customer_phone = v_phone
           AND o.id <> v_existing.id;

        IF array_length(v_other_order_numbers, 1) > 0 THEN
          v_has_other_orders := true;
        END IF;

        RETURN jsonb_build_object(
          'success', true,
          'order_id', v_existing.id,
          'order_number', v_existing.order_number,
          'public_token', v_existing.public_token,
          'customer_id', v_existing.customer_id,
          'status', 'pending',
          'grand_total', v_existing.grand_total,
          'subtotal', v_existing.subtotal,
          'shipping_total', v_existing.shipping_total,
          'customer_name', v_existing.customer_name,
          'phone', v_existing.customer_phone,
          'item_count', 0,
          'was_pending_updated', false,
          'was_incomplete_upgraded', false,
          'has_other_orders', v_has_other_orders,
          'other_orders', v_other_orders_json,
          'other_order_numbers', to_jsonb(v_other_order_numbers)
        );
      END IF;
    END IF;
  ELSE
    IF p_order_id IS NOT NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE id = p_order_id
         AND customer_phone = v_phone
         FOR UPDATE;
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status::text = 'incomplete_order' THEN
      v_was_incomplete := true;
    ELSIF v_existing.status::text = 'pending' THEN
      v_was_pending := true;
    END IF;
  END IF;

  -- 4. Calculate Other Historical Orders Insights
  SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at DESC), '{}'),
         coalesce(jsonb_agg(
           jsonb_build_object(
             'order_number', o.order_number,
             'status', o.status,
             'grand_total', o.grand_total,
             'item_count', (SELECT coalesce(sum(quantity), 0) FROM public.order_items WHERE order_id = o.id),
             'created_at', o.created_at
           ) ORDER BY o.created_at DESC
         ), '[]'::jsonb)
    INTO v_other_order_numbers, v_other_orders_json
    FROM public.orders o
   WHERE o.customer_phone = v_phone
     AND (v_existing.id IS NULL OR o.id <> v_existing.id);

  IF array_length(v_other_order_numbers, 1) > 0 THEN
    v_has_other_orders := true;
  END IF;

  -- 5. Customer Record Upsert (Never default customer name if left blank)
  v_resolved_customer_name := coalesce(
    nullif(trim(p_customer_name), ''),
    nullif(trim(v_existing.customer_name), 'Customer')
  );

  SELECT id INTO v_matched_user_id
    FROM public.profiles
   WHERE phone = v_phone
   LIMIT 1;

  SELECT id INTO v_customer_id
    FROM public.customers
   WHERE phone = v_phone
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (phone, full_name, user_id, total_orders)
    VALUES (v_phone, v_resolved_customer_name, v_matched_user_id, 0)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET full_name = coalesce(
             nullif(trim(v_resolved_customer_name), ''),
             nullif(trim(full_name), 'Customer')
           ),
           user_id = coalesce(v_matched_user_id, user_id),
           updated_at = now()
     WHERE id = v_customer_id;
  END IF;

  -- 6. Resolve Items & Authoritative Pricing
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := coalesce((v_item ->> 'quantity')::numeric, 1);
      IF v_qty <= 0 THEN v_qty := 1; END IF;

      v_candidate_prod_id := nullif(trim(v_item ->> 'product_id'), '');
      v_candidate_var_id  := nullif(trim(v_item ->> 'variant_id'), '');
      v_valid_product_id  := NULL;
      v_valid_variant_id  := NULL;
      v_sku               := NULL;
      v_prod_name         := NULL;
      v_var_name          := NULL;
      v_is_combo          := false;
      v_item_weight_grams := 0;
      v_combo_components  := '[]'::jsonb;
      v_unit_price        := 0;
      v_var_rec           := NULL;

      IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~ '^[0-9a-f-]{36}$' THEN
        SELECT pv.id, pv.product_id, pv.name AS variant_name, pv.sku, pv.price, pv.weight_grams,
               p.name AS product_name, coalesce(pv.is_combo, false) AS is_combo
          INTO v_var_rec
          FROM public.product_variants pv
          JOIN public.products p ON p.id = pv.product_id
         WHERE pv.id = v_candidate_var_id::uuid;
      ELSIF v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~ '^[0-9a-f-]{36}$' THEN
        SELECT pv.id, pv.product_id, pv.name AS variant_name, pv.sku, pv.price, pv.weight_grams,
               p.name AS product_name, coalesce(pv.is_combo, false) AS is_combo
          INTO v_var_rec
          FROM public.product_variants pv
          JOIN public.products p ON p.id = pv.product_id
         WHERE p.id = v_candidate_prod_id::uuid
         ORDER BY pv.is_default DESC NULLS LAST, pv.sort_order ASC, pv.price ASC
         LIMIT 1;
      END IF;

      IF v_var_rec.id IS NOT NULL THEN
        v_valid_variant_id  := v_var_rec.id;
        v_valid_product_id  := v_var_rec.product_id;
        v_prod_name         := v_var_rec.product_name;
        v_var_name          := coalesce(v_var_rec.variant_name, 'Standard');
        v_sku               := coalesce(v_var_rec.sku, 'MOL-VAR');
        v_item_weight_grams := coalesce(nullif(v_var_rec.weight_grams, 0), 1000);
        v_is_combo          := coalesce(v_var_rec.is_combo, false);

        -- Check tiered pricing
        SELECT pt.unit_price INTO v_tier_price
          FROM public.price_tiers pt
         WHERE pt.variant_id = v_valid_variant_id
           AND pt.min_qty <= v_qty
         ORDER BY pt.min_qty DESC
         LIMIT 1;

        IF v_tier_price IS NOT NULL AND v_tier_price > 0 THEN
          v_unit_price := v_tier_price;
        ELSE
          v_unit_price := coalesce(v_var_rec.price, 0);
        END IF;

        IF v_is_combo THEN
          SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'component_variant_id', ci.component_variant_id,
                   'quantity', ci.quantity,
                   'component_name', p.name || ' (' || coalesce(pv.name, 'Standard') || ')',
                   'component_sku', pv.sku,
                   'weight_grams', coalesce(pv.weight_grams, 0)
                 )), '[]'::jsonb),
                 coalesce(sum(ci.quantity * coalesce(pv.weight_grams, 0)), 0)::integer
            INTO v_combo_components, v_calc_combo_weight
            FROM public.combo_items ci
            JOIN public.product_variants pv ON pv.id = ci.component_variant_id
            JOIN public.products p ON p.id = pv.product_id
           WHERE ci.combo_variant_id = v_valid_variant_id;

          IF v_calc_combo_weight > 0 THEN
            v_item_weight_grams := v_calc_combo_weight;
          END IF;
        END IF;

        v_total_weight_grams := v_total_weight_grams + round(v_item_weight_grams * v_qty);
        v_subtotal := v_subtotal + round(v_unit_price * v_qty, 2);

        v_resolved_items := v_resolved_items || jsonb_build_object(
          'product_id', v_valid_product_id,
          'variant_id', v_valid_variant_id,
          'sku', v_sku,
          'product_name', v_prod_name,
          'variant_name', v_var_name,
          'quantity', v_qty,
          'unit_price', v_unit_price,
          'is_combo', v_is_combo,
          'combo_components', v_combo_components,
          'weight_grams', v_item_weight_grams
        );
      END IF;
    END LOOP;
  END IF;

  -- 7. Shipping Rates Calculation
  v_resolved_district := coalesce(nullif(trim(p_district), ''), v_existing.shipping_address->>'district', '');
  v_resolved_division := coalesce(nullif(trim(p_division), ''), v_existing.shipping_address->>'division', '');

  SELECT coalesce((value #>> '{}')::numeric, 80) INTO v_inside_fee
    FROM public.site_settings WHERE key IN ('shipping.inside_dhaka_fee', 'shipping.inside_dhaka_delivery_fee') LIMIT 1;
  SELECT coalesce((value #>> '{}')::numeric, 130) INTO v_outside_fee
    FROM public.site_settings WHERE key IN ('shipping.outside_dhaka_fee', 'shipping.outside_dhaka_delivery_fee') LIMIT 1;
  SELECT coalesce((value #>> '{}')::boolean, false) INTO v_free_shipping_enabled
    FROM public.site_settings WHERE key = 'shipping.free_delivery_enabled' LIMIT 1;
  SELECT coalesce((value #>> '{}')::numeric, 0) INTO v_free_shipping_threshold
    FROM public.site_settings WHERE key = 'shipping.free_delivery_threshold' LIMIT 1;

  IF lower(trim(v_resolved_district)) = 'dhaka' OR lower(trim(p_delivery_zone)) = 'inside_dhaka' THEN
    v_base_shipping := coalesce(v_inside_fee, 80);
  ELSE
    v_base_shipping := coalesce(v_outside_fee, 130);
  END IF;

  IF v_free_shipping_enabled AND v_free_shipping_threshold > 0 AND v_subtotal >= v_free_shipping_threshold THEN
    v_shipping_total := 0;
  ELSIF p_expected_shipping_total IS NOT NULL AND p_expected_shipping_total >= 0 THEN
    v_shipping_total := p_expected_shipping_total;
  ELSE
    v_shipping_total := v_base_shipping;
  END IF;

  v_grand_total := v_subtotal + v_shipping_total;

  v_shipping_address := jsonb_build_object(
    'recipient_name', coalesce(v_resolved_customer_name, ''),
    'phone', v_phone,
    'address_line', coalesce(nullif(trim(p_address_line), ''), v_existing.shipping_address->>'address_line', ''),
    'division', v_resolved_division,
    'district', v_resolved_district,
    'zone', coalesce(nullif(trim(p_delivery_zone), ''), v_existing.shipping_address->>'zone', '')
  );

  v_resolved_customer_note := coalesce(nullif(trim(p_customer_note), ''), v_existing.customer_note);

  IF p_courier_name IS NOT NULL AND length(trim(p_courier_name)) > 0 THEN
    v_resolved_method_name := trim(p_courier_name);
    IF lower(v_resolved_method_name) IN ('courier delivery', 'courier', 'courier service', 'home delivery', 'delivery') THEN
      v_resolved_method_name := NULL;
    END IF;
  ELSE
    v_resolved_method_name := NULL;
  END IF;

  -- 8. Upsert or Insert Order Record
  IF v_existing.id IS NOT NULL THEN
    v_order_id := v_existing.id;
    v_order_number := v_existing.order_number;
    v_public_token := v_existing.public_token;

    UPDATE public.orders
       SET status                   = v_final_status::public.order_status,
           customer_name            = v_resolved_customer_name,
           customer_id              = v_customer_id,
           shipping_address         = v_shipping_address,
           shipping_method_name     = v_resolved_method_name,
           subtotal                 = v_subtotal,
           grand_total              = v_grand_total,
           shipping_total           = v_shipping_total,
           total_weight_kg          = round(v_total_weight_grams / 1000.0, 3),
           customer_note            = v_resolved_customer_note,
           attribution              = jsonb_set(
                                        coalesce(attribution, '{}'::jsonb),
                                        '{other_order_numbers}',
                                        to_jsonb(v_other_order_numbers)
                                      ),
           updated_at               = now()
     WHERE id = v_order_id;
  ELSE
    INSERT INTO public.orders (
      status,
      payment_status,
      payment_method,
      channel,
      fulfillment_status,
      customer_id,
      customer_phone,
      customer_name,
      shipping_address,
      shipping_method_name,
      subtotal,
      discount_total,
      shipping_total,
      grand_total,
      currency,
      total_weight_kg,
      amount_paid,
      customer_note,
      attribution
    ) VALUES (
      v_final_status::public.order_status,
      'unpaid'::public.payment_status,
      'cod'::public.payment_method,
      'web',
      'unfulfilled'::public.fulfillment_status,
      v_customer_id,
      v_phone,
      v_resolved_customer_name,
      v_shipping_address,
      v_resolved_method_name,
      v_subtotal,
      0,
      v_shipping_total,
      v_grand_total,
      'BDT',
      round(v_total_weight_grams / 1000.0, 3),
      0,
      v_resolved_customer_note,
      jsonb_build_object(
        'source', 'direct_storefront_web',
        'client_timestamp', now()::text,
        'zero_items_phone_order', to_jsonb(v_item_count = 0),
        'initial_status', v_final_status,
        'has_other_orders', v_has_other_orders,
        'other_order_numbers', to_jsonb(v_other_order_numbers),
        'other_orders', v_other_orders_json
      )
    )
    RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;
  END IF;

  -- 9. Synchronize Line Items & Manage Stock Reservations
  IF v_item_count > 0 THEN
    IF v_existing.id IS NOT NULL AND v_was_pending THEN
      PERFORM private.release_order_stock(v_order_id);
    END IF;

    IF v_existing.id IS NOT NULL THEN
      DELETE FROM public.order_items WHERE order_id = v_order_id;
    END IF;

    FOR v_resolved_item IN SELECT * FROM jsonb_array_elements(v_resolved_items)
    LOOP
      INSERT INTO public.order_items (
        order_id,
        product_id,
        variant_id,
        sku,
        product_name,
        variant_name,
        quantity,
        unit_price,
        is_combo,
        combo_components
      ) VALUES (
        v_order_id,
        (v_resolved_item ->> 'product_id')::uuid,
        (v_resolved_item ->> 'variant_id')::uuid,
        v_resolved_item ->> 'sku',
        v_resolved_item ->> 'product_name',
        v_resolved_item ->> 'variant_name',
        (v_resolved_item ->> 'quantity')::numeric,
        (v_resolved_item ->> 'unit_price')::numeric,
        coalesce((v_resolved_item ->> 'is_combo')::boolean, false),
        coalesce(v_resolved_item -> 'combo_components', '[]'::jsonb)
      );
    END LOOP;

    IF v_final_status = 'pending' THEN
      PERFORM private.reserve_order_stock(v_order_id);
    END IF;
  END IF;

  -- 10. Handler-Driven Notification: Emit 'order_created' exclusively when customer places a pending order
  IF v_final_status = 'pending' AND (v_existing.id IS NULL OR v_was_incomplete) THEN
    INSERT INTO public.notifications (type, title, message, data)
    VALUES (
      'order_created',
      'New order placed',
      v_order_number || ' · ৳' || v_grand_total::numeric(14,2)::text || ' from ' || coalesce(nullif(trim(v_resolved_customer_name), ''), v_phone),
      jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'amount', v_grand_total,
        'customer_name', v_resolved_customer_name,
        'customer_phone', v_phone,
        'status', 'pending',
        'channel', 'web',
        'link', '/admin/orders?search=' || v_order_number
      )
    );
  END IF;

  -- 11. Return authoritative result
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_token', v_public_token,
    'customer_id', v_customer_id,
    'status', v_final_status,
    'grand_total', v_grand_total,
    'subtotal', v_subtotal,
    'shipping_total', v_shipping_total,
    'customer_name', v_resolved_customer_name,
    'phone', v_phone,
    'delivery_zone', coalesce(nullif(trim(p_delivery_zone), ''), v_existing.shipping_address->>'zone'),
    'item_count', v_item_count,
    'was_pending_updated', v_was_pending,
    'was_incomplete_upgraded', v_was_incomplete,
    'has_other_orders', v_has_other_orders
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_storefront_order(uuid, text, text, text, text, text, text, jsonb, text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_storefront_order(uuid, text, text, text, text, text, text, jsonb, text, text, text, numeric) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. UPDATE STOREFRONT HANDLER: public.create_customer_order()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_customer_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_phone              text;
  v_clean_phone            text;
  v_customer_name          text;
  v_raw_status             text;
  v_target_status          text;
  v_payment_method         text;
  v_division               text;
  v_district               text;
  v_address_line           text;
  v_customer_note          text;
  v_coupon_code            text;
  v_existing_order_id      uuid;
  v_items                  jsonb;
  v_item                   jsonb;
  v_item_idx               int;
  v_candidate_prod_id      text;
  v_candidate_var_id       text;
  v_prod_uuid              uuid;
  v_var_uuid               uuid;
  v_qty                    int;
  v_unit_price             numeric(12,2);
  v_subtotal               numeric(12,2) := 0;
  v_shipping_total         numeric(12,2) := 0;
  v_grand_total            numeric(12,2) := 0;
  v_total_weight_grams     int := 0;
  v_total_weight_kg        numeric(6,2) := 1.0;
  v_resolved_items         jsonb := '[]'::jsonb;
  v_order_id               uuid;
  v_order_number           text;
  v_public_token           uuid;
  v_customer_id            uuid;
  v_shipping_address       jsonb;
  v_is_upgrade             boolean := false;
  v_existing_order         public.orders%ROWTYPE;

  -- Catalog lookup records
  v_var_rec                record;
  v_is_combo               boolean := false;
  v_combo_comps            jsonb := '[]'::jsonb;

  -- Settings & Shipping calculation
  v_inside_fee             numeric(12,2) := 80;
  v_outside_fee            numeric(12,2) := 130;
  v_free_shipping_enabled  boolean := false;
  v_free_threshold         numeric(12,2) := 0;
  v_val_text               text;
BEGIN
  -- 1. Validate and normalize phone number
  v_raw_phone := trim(coalesce(p_payload->>'customer_phone', p_payload->>'phone', ''));
  v_clean_phone := regexp_replace(v_raw_phone, '[\s-]', '', 'g');
  
  IF v_clean_phone ~ '^01[3-9]\d{8}$' THEN
    v_clean_phone := '+88' || v_clean_phone;
  ELSIF v_clean_phone ~ '^8801[3-9]\d{8}$' THEN
    v_clean_phone := '+' || v_clean_phone;
  ELSIF v_clean_phone ~ '^1[3-9]\d{8}$' THEN
    v_clean_phone := '+880' || v_clean_phone;
  END IF;

  IF v_clean_phone IS NULL OR NOT (v_clean_phone ~ '^\+8801[3-9]\d{8}$') THEN
    RAISE EXCEPTION 'INVALID_PHONE: Please provide a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Customer Name (Optional: do not require or default if customer left it blank)
  v_customer_name := nullif(trim(coalesce(p_payload->>'customer_name', p_payload->>'name', '')), '');
  IF v_customer_name IS NOT NULL AND length(v_customer_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_NAME: Customer name must be at least 2 characters'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Status restriction (customers can only create pending or incomplete_order)
  v_raw_status := coalesce(nullif(trim(p_payload->>'status'), ''), 'pending');
  IF v_raw_status NOT IN ('pending', 'incomplete_order') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Customer orders can only be pending or incomplete_order'
      USING ERRCODE = 'P0001';
  END IF;
  v_target_status := v_raw_status;

  -- 4. Payment Method
  v_payment_method := coalesce(nullif(trim(p_payload->>'payment_method'), ''), 'cod');
  IF v_payment_method NOT IN ('cod', 'bkash', 'nagad', 'rocket', 'card', 'bank_transfer', 'cash') THEN
    v_payment_method := 'cod';
  END IF;

  -- 5. Address Details
  v_division := nullif(trim(p_payload->>'division'), '');
  v_district := nullif(trim(p_payload->>'district'), '');
  v_address_line := nullif(trim(p_payload->>'address_line'), '');
  v_customer_note := nullif(trim(p_payload->>'customer_note'), '');
  v_coupon_code := nullif(trim(p_payload->>'coupon_code'), '');

  -- 6. Items Validation & Authoritative Catalog Price Lookup
  v_items := p_payload->'items';
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS: Order must contain at least one product item'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_item_idx IN 0 .. jsonb_array_length(v_items) - 1 LOOP
    v_item := v_items->v_item_idx;
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    IF v_qty <= 0 THEN v_qty := 1; END IF;

    v_candidate_var_id := trim(coalesce(v_item->>'variant_id', ''));
    v_candidate_prod_id := trim(coalesce(v_item->>'product_id', ''));
    v_var_rec := NULL;
    v_is_combo := false;
    v_combo_comps := '[]'::jsonb;

    IF v_candidate_var_id ~ '^[0-9a-f-]{36}$' THEN
      SELECT pv.id AS variant_id, pv.product_id, pv.sku, pv.price, pv.weight_grams,
             pv.name AS variant_name, p.name AS product_name, coalesce(pv.is_combo, false) AS is_combo
        INTO v_var_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE pv.id = v_candidate_var_id::uuid
         AND pv.is_active = true
         AND p.status = 'active';
    ELSIF v_candidate_prod_id ~ '^[0-9a-f-]{36}$' THEN
      SELECT pv.id AS variant_id, pv.product_id, pv.sku, pv.price, pv.weight_grams,
             pv.name AS variant_name, p.name AS product_name, coalesce(pv.is_combo, false) AS is_combo
        INTO v_var_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE pv.product_id = v_candidate_prod_id::uuid
         AND pv.is_active = true
         AND p.status = 'active'
       ORDER BY pv.is_default DESC NULLS LAST, pv.sort_order ASC, pv.price ASC
       LIMIT 1;
    END IF;

    IF v_var_rec IS NULL OR v_var_rec.variant_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PRODUCT: One or more selected items are no longer available'
        USING ERRCODE = 'P0001';
    END IF;

    v_unit_price := coalesce(v_var_rec.price, 0);
    v_is_combo := coalesce(v_var_rec.is_combo, false);

    IF v_is_combo THEN
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'component_variant_id', ci.component_variant_id,
               'quantity', ci.quantity,
               'component_name', cp.name || ' (' || coalesce(cpv.name, 'Standard') || ')',
               'component_sku', cpv.sku,
               'weight_grams', coalesce(cpv.weight_grams, 0)
             )), '[]'::jsonb),
             coalesce(sum(ci.quantity * coalesce(cpv.weight_grams, 0)), 0)::int
        INTO v_combo_comps, v_total_weight_grams
        FROM public.combo_items ci
        JOIN public.product_variants cpv ON cpv.id = ci.component_variant_id
        JOIN public.products cp ON cp.id = cpv.product_id
       WHERE ci.combo_variant_id = v_var_rec.variant_id;
    ELSE
      v_total_weight_grams := v_total_weight_grams + (coalesce(v_var_rec.weight_grams, 1000) * v_qty);
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    v_resolved_items := v_resolved_items || jsonb_build_object(
      'product_id', v_var_rec.product_id,
      'variant_id', v_var_rec.variant_id,
      'sku', coalesce(v_var_rec.sku, 'MOL-SKU'),
      'product_name', v_var_rec.product_name,
      'variant_name', coalesce(v_var_rec.variant_name, 'Standard'),
      'quantity', v_qty,
      'unit_price', v_unit_price,
      'is_combo', v_is_combo,
      'combo_components', v_combo_comps,
      'weight_grams', coalesce(v_var_rec.weight_grams, 1000)
    );
  END LOOP;

  v_total_weight_kg := round((greatest(v_total_weight_grams, 1000) / 1000.0)::numeric, 2);

  -- 7. Shipping Calculation
  SELECT value #>> '{}' INTO v_val_text FROM public.site_settings WHERE key = 'shipping.inside_dhaka_fee';
  IF v_val_text IS NOT NULL THEN v_inside_fee := v_val_text::numeric; END IF;
  SELECT value #>> '{}' INTO v_val_text FROM public.site_settings WHERE key = 'shipping.outside_dhaka_fee';
  IF v_val_text IS NOT NULL THEN v_outside_fee := v_val_text::numeric; END IF;
  SELECT value #>> '{}' INTO v_val_text FROM public.site_settings WHERE key = 'shipping.free_delivery_enabled';
  IF v_val_text IS NOT NULL THEN v_free_shipping_enabled := (v_val_text = 'true'); END IF;
  SELECT value #>> '{}' INTO v_val_text FROM public.site_settings WHERE key = 'shipping.free_delivery_threshold';
  IF v_val_text IS NOT NULL THEN v_free_threshold := v_val_text::numeric; END IF;

  IF v_free_shipping_enabled AND v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_shipping_total := 0;
  ELSE
    IF lower(coalesce(v_district, '')) = 'dhaka' OR lower(coalesce(v_division, '')) = 'dhaka' THEN
      v_shipping_total := coalesce(v_inside_fee, 80);
    ELSE
      v_shipping_total := coalesce(v_outside_fee, 130);
    END IF;
  END IF;

  v_grand_total := v_subtotal + v_shipping_total;

  -- 8. Customer Record Linkage
  SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_clean_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (phone, full_name, total_orders)
    VALUES (v_clean_phone, v_customer_name, 1)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET full_name = coalesce(v_customer_name, nullif(trim(full_name), 'Customer')),
           total_orders = total_orders + 1,
           last_order_at = now()
     WHERE id = v_customer_id;
  END IF;

  -- 9. Shipping Address JSON
  v_shipping_address := jsonb_build_object(
    'division', coalesce(v_division, ''),
    'district', coalesce(v_district, ''),
    'address_line', coalesce(v_address_line, ''),
    'recipient_name', coalesce(v_customer_name, ''),
    'phone', v_clean_phone
  );

  -- 10. Check Draft Upgrade
  IF p_payload->>'order_id' IS NOT NULL AND (p_payload->>'order_id') ~ '^[0-9a-f-]{36}$' THEN
    v_existing_order_id := (p_payload->>'order_id')::uuid;
    SELECT * INTO v_existing_order FROM public.orders WHERE id = v_existing_order_id;
    IF FOUND AND v_existing_order.status::text = 'incomplete_order' AND v_existing_order.customer_phone = v_clean_phone THEN
      v_is_upgrade := true;
      v_order_id := v_existing_order.id;
      v_order_number := v_existing_order.order_number;
      v_public_token := v_existing_order.public_token;

      UPDATE public.orders
         SET status = v_target_status::public.order_status,
             customer_name = v_customer_name,
             customer_id = v_customer_id,
             shipping_address = v_shipping_address,
             shipping_total = v_shipping_total,
             subtotal = v_subtotal,
             grand_total = v_grand_total,
             total_weight_kg = v_total_weight_kg,
             customer_note = v_customer_note,
             updated_at = now()
       WHERE id = v_order_id;

      DELETE FROM public.order_items WHERE order_id = v_order_id;
    END IF;
  END IF;

  -- 11. Fresh Order Insertion
  IF NOT v_is_upgrade THEN
    INSERT INTO public.orders (
      status,
      payment_status,
      payment_method,
      channel,
      fulfillment_status,
      customer_id,
      customer_phone,
      customer_name,
      shipping_address,
      subtotal,
      shipping_total,
      grand_total,
      currency,
      total_weight_kg,
      customer_note,
      attribution
    ) VALUES (
      v_target_status::public.order_status,
      'unpaid'::public.payment_status,
      v_payment_method::public.payment_method,
      'web',
      'unfulfilled'::public.fulfillment_status,
      v_customer_id,
      v_clean_phone,
      v_customer_name,
      v_shipping_address,
      v_subtotal,
      v_shipping_total,
      v_grand_total,
      'BDT',
      v_total_weight_kg,
      v_customer_note,
      jsonb_build_object(
        'source', 'customer_storefront_rpc',
        'coupon_code', v_coupon_code,
        'client_timestamp', now()::text
      )
    )
    RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;
  END IF;

  -- 12. Insert Order Items
  FOR v_item_idx IN 0 .. jsonb_array_length(v_resolved_items) - 1 LOOP
    v_item := v_resolved_items->v_item_idx;
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      sku,
      product_name,
      variant_name,
      quantity,
      unit_price,
      is_combo,
      combo_components
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      v_item->>'sku',
      v_item->>'product_name',
      v_item->>'variant_name',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      coalesce((v_item->>'is_combo')::boolean, false),
      coalesce(v_item->'combo_components', '[]'::jsonb)
    );
  END LOOP;

  -- 13. Reserve Inventory Stock
  IF v_target_status = 'pending' THEN
    PERFORM private.reserve_order_stock(v_order_id);
  END IF;

  -- 14. Notification: Exclusively when customer places a pending order
  IF v_target_status = 'pending' THEN
    INSERT INTO public.notifications (type, title, message, data)
    VALUES (
      'order_created',
      'নতুন অর্ডার গ্রহণ করা হয়েছে',
      v_order_number || ' · ৳' || v_grand_total::numeric(14,2)::text || ' from ' || coalesce(nullif(trim(v_customer_name), ''), v_clean_phone),
      jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'amount', v_grand_total,
        'customer_name', v_customer_name,
        'customer_phone', v_clean_phone,
        'status', 'pending',
        'channel', 'web',
        'link', '/admin/orders?search=' || v_order_number
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_token', v_public_token,
    'status', v_target_status,
    'grand_total', v_grand_total,
    'subtotal', v_subtotal,
    'shipping_total', v_shipping_total,
    'customer_name', v_customer_name,
    'phone', v_clean_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. HISTORICAL DATA CLEANUP: Remove auto-set 'Customer' placeholder
-- -----------------------------------------------------------------------------
UPDATE public.customers
   SET full_name = NULL
 WHERE full_name = 'Customer';

UPDATE public.orders
   SET customer_name = NULL
 WHERE customer_name = 'Customer';

UPDATE public.orders
   SET shipping_address = jsonb_set(shipping_address, '{recipient_name}', '""')
 WHERE shipping_address->>'recipient_name' = 'Customer';

COMMIT;
