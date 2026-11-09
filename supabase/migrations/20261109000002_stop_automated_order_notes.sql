-- Migration: 20261109000002_stop_automated_order_notes.sql
-- Description: Disables all automatic note generation into public.order_notes so only manual staff notes exist.
-- Also cleans up historical auto-generated notes (Steadfast Courier Bot and System notes).

-- 1. Clean up existing auto-generated notes from public.order_notes
DELETE FROM public.order_notes
 WHERE author IN ('Steadfast Courier Bot', 'System');

-- 2. Update public.process_storefront_order to stop adding automated order_notes
CREATE OR REPLACE FUNCTION public.process_storefront_order(
  p_order_id          uuid DEFAULT NULL,
  p_status            text DEFAULT 'pending', -- 'incomplete_order' or 'pending'
  p_customer_phone    text DEFAULT NULL,
  p_customer_name     text DEFAULT NULL,
  p_delivery_zone     text DEFAULT NULL,     -- 'inside_dhaka' or 'outside_dhaka'
  p_address_line      text DEFAULT NULL,
  p_customer_note     text DEFAULT NULL,
  p_items             jsonb DEFAULT '[]'::jsonb,
  p_division          text DEFAULT NULL,
  p_district          text DEFAULT NULL,
  p_courier_name      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone               text;
  v_raw_digits          text;
  v_final_status        text;
  v_existing            public.orders%ROWTYPE;
  v_order_id            uuid;
  v_order_number        text;
  v_resolved_customer_name text;
  v_resolved_address_line  text;
  v_resolved_customer_note text;
  v_resolved_district   text := '';
  v_resolved_division   text := '';
  v_resolved_method_name text := NULL;
  v_base_shipping       numeric(14,2) := 0;
  v_shipping_total      numeric(14,2) := 0;
  v_subtotal            numeric(14,2) := 0;
  v_grand_total         numeric(14,2) := 0;
  v_shipping_address    jsonb;
  v_item_count          integer := 0;
  v_item                jsonb;
  v_resolved_items      jsonb := '[]'::jsonb;
  v_resolved_item       jsonb;
  v_qty                 numeric(12,3);
  v_unit_price          numeric(12,2);
  v_db_price            numeric(12,2);
  v_tier_price          numeric(12,2);
  v_valid_product_id    uuid;
  v_valid_variant_id    uuid;
  v_candidate_prod_id   text;
  v_candidate_var_id    text;
  v_sku                 text;
  v_prod_name           text;
  v_var_name            text;
  v_was_incomplete      boolean := false;
  v_was_pending         boolean := false;
  v_has_other_orders    boolean := false;
  v_other_order_numbers text[] := '{}';
  v_other_orders_json   jsonb := '[]'::jsonb;
BEGIN
  -- 1. Validate & normalize phone number (Supports: +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX)
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

  -- 3. Lookup existing order with row-level lock based on phone number and status:
  IF v_final_status = 'pending' THEN
    -- Rule 1: If there is another pending order with the same phone number, select it to update
    SELECT * INTO v_existing
      FROM public.orders
     WHERE customer_phone = v_phone
       AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;

    IF v_existing.id IS NOT NULL THEN
      v_was_pending := true;
    END IF;

    -- Rule 2: If no pending order, but there is an incomplete order with the same phone number, select it to update and upgrade
    IF v_existing.id IS NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE customer_phone = v_phone
         AND status = 'incomplete_order'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE;

      IF v_existing.id IS NOT NULL THEN
        v_was_incomplete := true;
      END IF;
    END IF;
  ELSE
    -- If status = incomplete_order (auto-save), check by explicit p_order_id or latest incomplete_order
    IF p_order_id IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.orders WHERE id = p_order_id FOR UPDATE;
    END IF;

    IF v_existing.id IS NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE customer_phone = v_phone
         AND status = 'incomplete_order'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE;

      IF v_existing.id IS NOT NULL THEN
        v_was_incomplete := true;
      END IF;
    END IF;
  END IF;

  -- Rule 3 check: Determine if customer phone has other orders
  SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at DESC), '{}'),
         coalesce(jsonb_agg(jsonb_build_object(
           'order_number', o.order_number,
           'status', o.status,
           'created_at', o.created_at
         ) ORDER BY o.created_at DESC), '[]'::jsonb)
    INTO v_other_order_numbers, v_other_orders_json
    FROM public.orders o
   WHERE o.customer_phone = v_phone
     AND (v_existing.id IS NULL OR o.id <> v_existing.id);

  v_has_other_orders := (cardinality(v_other_order_numbers) > 0);

  -- 4. Calculate authoritative shipping total from shipping zones
  IF p_delivery_zone = 'inside_dhaka' THEN
    SELECT coalesce(base_fee, 70.00), coalesce(name, 'Inside Dhaka')
      INTO v_base_shipping, v_resolved_method_name
      FROM public.shipping_zones
     WHERE zone_type = 'inside_dhaka'
     LIMIT 1;
    IF v_base_shipping IS NULL THEN
      v_base_shipping := 70.00;
      v_resolved_method_name := 'Inside Dhaka';
    END IF;
  ELSIF p_delivery_zone = 'outside_dhaka' THEN
    SELECT coalesce(base_fee, 130.00), coalesce(name, 'Outside Dhaka')
      INTO v_base_shipping, v_resolved_method_name
      FROM public.shipping_zones
     WHERE zone_type = 'outside_dhaka'
     LIMIT 1;
    IF v_base_shipping IS NULL THEN
      v_base_shipping := 130.00;
      v_resolved_method_name := 'Outside Dhaka';
    END IF;
  ELSIF v_existing.id IS NOT NULL THEN
    v_base_shipping := coalesce(v_existing.shipping_total, 0);
  END IF;

  -- 5. Calculate items subtotal and count WITH AUTHORITATIVE PRICE VERIFICATION
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    v_item_count := jsonb_array_length(p_items);
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_candidate_prod_id := nullif(trim(v_item ->> 'product_id'), '');
      v_candidate_var_id  := nullif(trim(v_item ->> 'variant_id'), '');
      v_valid_product_id  := NULL;
      v_valid_variant_id  := NULL;
      v_db_price          := NULL;
      v_tier_price        := NULL;
      v_unit_price        := NULL;

      v_qty := greatest(1, coalesce((v_item ->> 'quantity')::numeric, 1));
      v_prod_name := coalesce(nullif(trim(v_item ->> 'product_name'), ''), 'খেজুরের খাঁটি গুড়');
      v_var_name  := coalesce(nullif(trim(v_item ->> 'variant_name'), ''), '1 Pack');

      -- Step A: Validate variant_id if provided as UUID and fetch its price + product_id
      IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id, product_id, price
          INTO v_valid_variant_id, v_valid_product_id, v_db_price
          FROM public.product_variants
         WHERE id = v_candidate_var_id::uuid;
      END IF;

      -- Step B: If product_id not resolved from variant, check candidate product_id UUID
      IF v_valid_product_id IS NULL AND v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_valid_product_id FROM public.products WHERE id = v_candidate_prod_id::uuid;
      END IF;

      -- Step C: If product_id still not resolved, match by product name
      IF v_valid_product_id IS NULL AND v_prod_name IS NOT NULL THEN
        SELECT id INTO v_valid_product_id
          FROM public.products
         WHERE name ILIKE '%' || v_prod_name || '%'
            OR name_bn ILIKE '%' || v_prod_name || '%'
            OR v_prod_name ILIKE '%' || name || '%'
         LIMIT 1;
      END IF;

      -- Step D: If product is valid but variant was not found, resolve its default or active variant
      IF v_valid_product_id IS NOT NULL AND v_valid_variant_id IS NULL THEN
        SELECT id, price
          INTO v_valid_variant_id, v_db_price
          FROM public.product_variants
         WHERE product_id = v_valid_product_id AND is_active
         ORDER BY is_default DESC, sort_order ASC, price ASC
         LIMIT 1;
      END IF;

      -- Step E: Fallback to default active store product if completely unknown
      IF v_valid_product_id IS NULL THEN
        SELECT id INTO v_valid_product_id
          FROM public.products
         WHERE status = 'active'
         ORDER BY created_at ASC
         LIMIT 1;

        IF v_valid_product_id IS NOT NULL THEN
          SELECT id, price
            INTO v_valid_variant_id, v_db_price
            FROM public.product_variants
           WHERE product_id = v_valid_product_id AND is_active
           ORDER BY is_default DESC, price ASC
           LIMIT 1;
        END IF;
      END IF;

      -- Step F: Price Tier lookup (quantity-based discount tiers)
      IF v_valid_product_id IS NOT NULL THEN
        SELECT unit_price
          INTO v_tier_price
          FROM public.price_tiers
         WHERE product_id = v_valid_product_id
           AND (variant_id IS NULL OR variant_id = v_valid_variant_id)
           AND v_qty >= min_quantity
           AND (max_quantity IS NULL OR v_qty <= max_quantity)
         ORDER BY (variant_id IS NOT NULL) DESC, min_quantity DESC
         LIMIT 1;
      END IF;

      -- Authoritative Unit Price Resolution:
      -- Priority 1: Volume Price Tier
      -- Priority 2: Database Variant Price
      -- Priority 3: Fallback client price or standard ৳600
      v_unit_price := coalesce(
        v_tier_price,
        v_db_price,
        nullif((v_item ->> 'unit_price')::numeric, 0),
        600.00
      );

      v_sku := coalesce(nullif(trim(v_item ->> 'sku'), ''), 'GUR-STD');

      -- Accumulate subtotal
      v_subtotal := v_subtotal + (v_unit_price * v_qty);

      -- Build verified resolved item
      v_resolved_items := v_resolved_items || jsonb_build_object(
        'product_id', v_valid_product_id,
        'variant_id', v_valid_variant_id,
        'sku', v_sku,
        'product_name', v_prod_name,
        'variant_name', v_var_name,
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'line_total', (v_unit_price * v_qty)
      );
    END LOOP;
  ELSIF v_existing.id IS NOT NULL THEN
    v_subtotal := coalesce(v_existing.subtotal, 0);
  END IF;

  v_shipping_total := v_base_shipping;
  v_grand_total := v_subtotal + v_shipping_total;

  -- 6. Resolve customer & address details
  v_resolved_customer_name := coalesce(
    nullif(trim(p_customer_name), ''),
    v_existing.customer_name,
    'সম্মানিত গ্রাহক'
  );

  v_resolved_address_line := coalesce(
    nullif(trim(p_address_line), ''),
    v_existing.shipping_address ->> 'address_line',
    'ঠিকানা উল্লেখ নেই'
  );

  v_resolved_customer_note := coalesce(
    nullif(trim(p_customer_note), ''),
    v_existing.customer_note
  );

  v_resolved_district := coalesce(
    nullif(trim(p_district), ''),
    v_existing.shipping_address ->> 'district',
    CASE WHEN p_delivery_zone = 'inside_dhaka' THEN 'Dhaka' ELSE '' END
  );

  v_resolved_division := coalesce(
    nullif(trim(p_division), ''),
    v_existing.shipping_address ->> 'division',
    CASE WHEN p_delivery_zone = 'inside_dhaka' THEN 'Dhaka' ELSE '' END
  );

  v_shipping_address := jsonb_build_object(
    'recipient_name', v_resolved_customer_name,
    'phone', v_phone,
    'address_line', v_resolved_address_line,
    'district', v_resolved_district,
    'division', v_resolved_division,
    'delivery_zone', coalesce(p_delivery_zone, v_existing.shipping_address ->> 'delivery_zone')
  );

  -- 7. Upsert Order Header
  IF v_existing.id IS NOT NULL THEN
    v_order_id := v_existing.id;
    v_order_number := v_existing.order_number;

    UPDATE public.orders
       SET status                   = v_final_status,
           customer_name            = v_resolved_customer_name,
           customer_phone           = v_phone,
           shipping_phone           = v_phone,
           customer_note            = v_resolved_customer_note,
           shipping_address         = v_shipping_address,
           subtotal                 = v_subtotal,
           shipping_total           = v_shipping_total,
           grand_total              = v_grand_total,
           shipping_method_name     = coalesce(v_resolved_method_name, shipping_method_name),
           courier_name             = coalesce(nullif(trim(p_courier_name), ''), courier_name, 'Steadfast'),
           payment_method           = 'cod',
           channel                  = coalesce(channel, 'web'),
           attribution              = jsonb_set(
             coalesce(attribution, '{}'::jsonb),
             '{has_other_orders}',
             to_jsonb(v_has_other_orders)
           ),
           metadata                 = jsonb_set(
             jsonb_set(
               coalesce(metadata, '{}'::jsonb),
               '{other_order_numbers}',
               to_jsonb(v_other_order_numbers)
             ),
             '{zero_items_phone_order}', (v_item_count = 0)
           ),
           updated_at               = now()
     WHERE id = v_order_id;
  ELSE
    v_order_id := gen_random_uuid();
    v_order_number := 'MOL-' || to_char(now(), 'YYMM') || '-' || lpad((nextval('public.order_number_seq'::regclass))::text, 5, '0');

    INSERT INTO public.orders (
      id,
      order_number,
      status,
      customer_name,
      customer_phone,
      shipping_phone,
      customer_note,
      shipping_address,
      subtotal,
      shipping_total,
      grand_total,
      shipping_method_name,
      courier_name,
      payment_method,
      channel,
      attribution,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      v_order_id,
      v_order_number,
      v_final_status,
      v_resolved_customer_name,
      v_phone,
      v_phone,
      v_resolved_customer_note,
      v_shipping_address,
      v_subtotal,
      v_shipping_total,
      v_grand_total,
      v_resolved_method_name,
      coalesce(nullif(trim(p_courier_name), ''), 'Steadfast'),
      'cod',
      'web',
      jsonb_build_object(
        'has_other_orders', v_has_other_orders,
        'phone', v_phone,
        'source', 'storefront_v2'
      ),
      jsonb_build_object(
        'other_order_numbers', to_jsonb(v_other_order_numbers),
        'zero_items_phone_order', (v_item_count = 0),
        'other_orders', v_other_orders_json
      ),
      now(),
      now()
    );
  END IF;

  -- Replace Order Items with authoritatively verified items
  IF jsonb_array_length(v_resolved_items) > 0 THEN
    DELETE FROM public.order_items WHERE order_id = v_order_id;

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
        unit_price
      ) VALUES (
        v_order_id,
        nullif(v_resolved_item ->> 'product_id', '')::uuid,
        nullif(v_resolved_item ->> 'variant_id', '')::uuid,
        v_resolved_item ->> 'sku',
        v_resolved_item ->> 'product_name',
        v_resolved_item ->> 'variant_name',
        (v_resolved_item ->> 'quantity')::numeric,
        (v_resolved_item ->> 'unit_price')::numeric
      );
    END LOOP;
  END IF;

  -- 8. Log Events in order_events (NO automated order_notes inserted)
  IF v_was_incomplete AND v_final_status = 'pending' THEN
    INSERT INTO public.order_events (order_id, event_type, from_value, to_value, message)
    VALUES (
      v_order_id,
      'status_change',
      'incomplete_order',
      'pending',
      'Incomplete order upgraded to pending upon customer order submission'
    );
  ELSIF v_was_pending AND v_final_status = 'pending' THEN
    INSERT INTO public.order_events (order_id, event_type, to_value, message)
    VALUES (
      v_order_id,
      'updated',
      'pending',
      'পেন্ডিং অর্ডারের তথ্য ও আইটেম নতুন সাবমিশন অনুযায়ী আপডেট করা হয়েছে (' || v_item_count::text || 'টি আইটেম, মোট ৳' || v_grand_total::text || ')'
    );
  END IF;

  -- 9. Return structured order result with verified totals
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', v_final_status,
    'grand_total', v_grand_total,
    'subtotal', v_subtotal,
    'shipping_total', v_shipping_total,
    'customer_name', v_resolved_customer_name,
    'phone', v_phone,
    'delivery_zone', p_delivery_zone,
    'was_pending_updated', v_was_pending,
    'was_incomplete_upgraded', v_was_incomplete,
    'has_other_orders', v_has_other_orders,
    'other_order_numbers', to_jsonb(v_other_order_numbers)
  );
END $$;
