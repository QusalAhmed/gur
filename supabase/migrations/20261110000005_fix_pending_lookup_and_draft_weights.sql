-- =============================================================================
-- Migration: Fix pending lookup privacy, draft shipping total and total weight
-- 1. Returns detail-free pending_order_exists for phone-only pending lookup
--    without exposing order details or customer info when p_order_id is null.
-- 2. Preserves v_existing.shipping_total on draft updates when p_delivery_zone
--    is omitted.
-- 3. Preserves v_existing.total_weight_kg when v_item_count is zero.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_storefront_order(
  p_order_id          uuid DEFAULT NULL,
  p_status            text DEFAULT 'pending',
  p_customer_phone    text DEFAULT NULL,
  p_customer_name     text DEFAULT NULL,
  p_delivery_zone     text DEFAULT NULL,
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
  v_total_weight_grams  integer := 0;
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
  v_is_combo            boolean := false;
  v_item_weight_grams   integer := 0;
  v_combo_components    jsonb := '[]'::jsonb;
  v_calc_combo_weight   integer := 0;
  v_was_incomplete      boolean := false;
  v_was_pending         boolean := false;
  v_has_other_orders    boolean := false;
  v_other_order_numbers text[] := '{}';
  v_other_orders_json   jsonb := '[]'::jsonb;
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

  -- 3. Lookup existing order with row-level lock based on phone number and status
  IF v_final_status = 'incomplete_order' THEN
    -- A queued draft save MUST NOT overwrite an existing pending order.
    IF p_order_id IS NOT NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE id = p_order_id
         AND customer_phone = v_phone
         AND status = 'pending'
       LIMIT 1;
    END IF;

    IF v_existing.id IS NOT NULL THEN
      -- Existing pending order owned by customer matching p_order_id.
      -- Return existing pending order safely without modifying line items, totals, or stock.
      SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at DESC), '{}'),
             coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id,
               'status', o.status,
               'note', CASE
                 WHEN o.status::text = 'delivered' THEN 'old customer'
                 WHEN o.status::text = 'returned' THEN 'returned order'
                 WHEN o.status::text = 'cancelled' THEN 'cancelled order'
                 WHEN o.status::text = 'shipped' THEN 'order in transit'
                 WHEN o.status::text = 'processing' THEN 'processing order'
                 WHEN o.status::text = 'confirmed' THEN 'confirmed order'
                 WHEN o.status::text = 'pending' THEN 'pending order'
                 WHEN o.status::text = 'incomplete_order' THEN 'incomplete order'
                 ELSE 'previous order'
               END,
               'placed_at', o.placed_at,
               'created_at', o.created_at,
               'grand_total', o.grand_total
             ) ORDER BY o.created_at DESC), '[]'::jsonb)
        INTO v_other_order_numbers, v_other_orders_json
        FROM public.orders o
       WHERE o.customer_phone = v_phone
         AND (p_order_id IS NULL OR o.id <> p_order_id)
         AND o.id <> v_existing.id;

      IF array_length(v_other_order_numbers, 1) > 0 THEN
        v_has_other_orders := true;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing.id,
        'order_number', v_existing.order_number,
        'status', 'pending',
        'grand_total', v_existing.grand_total,
        'subtotal', v_existing.subtotal,
        'shipping_total', v_existing.shipping_total,
        'customer_name', v_existing.customer_name,
        'phone', v_existing.customer_phone,
        'item_count', 0,
        'was_pending_updated', false,
        'was_incomplete_upgraded', false,
        'has_other_orders', v_has_other_orders
      );
    ELSE
      -- Check if any pending order exists for this phone without owning p_order_id
      SELECT * INTO v_existing
        FROM public.orders
       WHERE customer_phone = v_phone
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1;

      IF v_existing.id IS NOT NULL THEN
        -- Matched by phone only: return pending_order_exists: true without leaking order details, totals, or customer name
        RETURN jsonb_build_object(
          'success', true,
          'pending_order_exists', true,
          'status', 'pending',
          'phone', v_phone,
          'item_count', 0,
          'was_pending_updated', false,
          'was_incomplete_upgraded', false
        );
      END IF;
    END IF;

    -- Lookup existing incomplete_order to update (strictly requires p_order_id ownership proof)
    IF p_order_id IS NOT NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE id = p_order_id
         AND customer_phone = v_phone
         AND status = 'incomplete_order'
       LIMIT 1
       FOR UPDATE;
    END IF;

    -- Note: Require established ownership proof (p_order_id) to update an existing draft.
    -- Without p_order_id, do NOT select or disclose an existing draft; create a separate order instead.
    IF v_existing.id IS NOT NULL THEN
      v_was_incomplete := true;
    END IF;

  ELSE
    -- Explicit submission / resubmission (p_status = 'pending')
    -- If updating by p_order_id: strictly select only pending or incomplete_order belonging to customer
    IF p_order_id IS NOT NULL THEN
      SELECT * INTO v_existing
        FROM public.orders
       WHERE id = p_order_id
         AND customer_phone = v_phone
         AND status IN ('pending', 'incomplete_order')
       LIMIT 1
       FOR UPDATE;

      IF v_existing.id IS NOT NULL THEN
        IF v_existing.status = 'pending' THEN
          v_was_pending := true;
        ELSIF v_existing.status = 'incomplete_order' THEN
          v_was_incomplete := true;
        END IF;
      END IF;
    END IF;

    IF v_existing.id IS NULL THEN
      -- Check if customer already has a pending order (deduplication safeguard)
      SELECT * INTO v_existing
        FROM public.orders
       WHERE customer_phone = v_phone
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1;

      IF v_existing.id IS NOT NULL THEN
        -- Matched by phone only without verified ownership (p_order_id):
        -- Return detail-free pending_order_exists result rather than adopting or exposing the pending order
        RETURN jsonb_build_object(
          'success', true,
          'pending_order_exists', true,
          'status', 'pending',
          'phone', v_phone,
          'item_count', 0,
          'was_pending_updated', false,
          'was_incomplete_upgraded', false
        );
      END IF;
    END IF;
  END IF;

  -- 4. Calculate Other Historical Orders Insights
  SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at DESC), '{}'),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id,
           'status', o.status,
           'note', CASE
             WHEN o.status::text = 'delivered' THEN 'old customer'
             WHEN o.status::text = 'returned' THEN 'returned order'
             WHEN o.status::text = 'cancelled' THEN 'cancelled order'
             WHEN o.status::text = 'shipped' THEN 'order in transit'
             WHEN o.status::text = 'processing' THEN 'processing order'
             WHEN o.status::text = 'confirmed' THEN 'confirmed order'
             WHEN o.status::text = 'pending' THEN 'pending order'
             WHEN o.status::text = 'incomplete_order' THEN 'incomplete order'
             ELSE 'previous order'
           END,
           'placed_at', o.placed_at,
           'created_at', o.created_at,
           'grand_total', o.grand_total
         ) ORDER BY o.created_at DESC), '[]'::jsonb)
    INTO v_other_order_numbers, v_other_orders_json
    FROM public.orders o
   WHERE o.customer_phone = v_phone
     AND (v_existing.id IS NULL OR o.id <> v_existing.id);

  IF array_length(v_other_order_numbers, 1) > 0 THEN
    v_has_other_orders := true;
  END IF;

  -- 5. Validate & Authoritatively Price Line Items
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := coalesce((v_item ->> 'quantity')::numeric, 1);
      IF v_qty <= 0 THEN
        v_qty := 1;
      END IF;

      v_candidate_var_id := trim(v_item ->> 'variant_id');
      v_candidate_prod_id := trim(v_item ->> 'product_id');
      v_prod_name := trim(v_item ->> 'product_name');
      v_var_name := trim(v_item ->> 'variant_name');

      v_valid_product_id := NULL;
      v_valid_variant_id := NULL;
      v_db_price := NULL;
      v_is_combo := false;
      v_item_weight_grams := 0;

      -- Step A: Validate variant_id if provided as UUID
      IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id, product_id, price, coalesce(is_combo, false), coalesce(weight_grams, 0)
          INTO v_valid_variant_id, v_valid_product_id, v_db_price, v_is_combo, v_item_weight_grams
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
        SELECT id, price, coalesce(is_combo, false), coalesce(weight_grams, 0)
          INTO v_valid_variant_id, v_db_price, v_is_combo, v_item_weight_grams
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
         ORDER BY sort_order ASC, created_at DESC
         LIMIT 1;

        IF v_valid_product_id IS NOT NULL AND v_valid_variant_id IS NULL THEN
          SELECT id, price, coalesce(is_combo, false), coalesce(weight_grams, 0)
            INTO v_valid_variant_id, v_db_price, v_is_combo, v_item_weight_grams
            FROM public.product_variants
           WHERE product_id = v_valid_product_id AND is_active
           ORDER BY is_default DESC, sort_order ASC, price ASC
           LIMIT 1;
        END IF;
      END IF;

      -- Check volume price tiers
      v_unit_price := v_db_price;
      IF v_valid_variant_id IS NOT NULL THEN
        SELECT unit_price INTO v_tier_price
          FROM public.price_tiers
         WHERE variant_id = v_valid_variant_id
           AND min_qty <= v_qty
         ORDER BY min_qty DESC
         LIMIT 1;

        IF v_tier_price IS NOT NULL THEN
          v_unit_price := v_tier_price;
        END IF;
      END IF;

      -- Fallback to client supplied price if catalog price missing
      IF v_unit_price IS NULL THEN
        v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
      END IF;

      -- Resolve SKU and canonical names
      IF v_valid_variant_id IS NOT NULL THEN
        SELECT pv.sku, p.name, pv.name
          INTO v_sku, v_prod_name, v_var_name
          FROM public.product_variants pv
          JOIN public.products p ON p.id = pv.product_id
         WHERE pv.id = v_valid_variant_id;
      END IF;

      -- Step F: Check and populate combo components if this item is a combo
      v_combo_components := '[]'::jsonb;
      IF v_is_combo AND v_valid_variant_id IS NOT NULL THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', ci.id,
          'combo_variant_id', ci.combo_variant_id,
          'component_variant_id', ci.component_variant_id,
          'product_id', cp.id,
          'product_name', cp.name,
          'product_name_bn', cp.name_bn,
          'variant_name', cv.name,
          'variant_name_bn', cv.name_bn,
          'sku', cv.sku,
          'quantity', ci.quantity,
          'unit_price', cv.price,
          'line_total', round(cv.price * ci.quantity, 2),
          'weight_grams', coalesce(cv.weight_grams, 0),
          'pack_type', cv.pack_type
        ) ORDER BY ci.sort_order ASC, ci.created_at ASC), '[]'::jsonb)
          INTO v_combo_components
          FROM public.combo_items ci
          JOIN public.product_variants cv ON cv.id = ci.component_variant_id
          JOIN public.products cp ON cp.id = cv.product_id
         WHERE ci.combo_variant_id = v_valid_variant_id;

        -- Calculate cumulative weight of combo components if variant weight is missing/zero
        IF v_item_weight_grams = 0 AND jsonb_array_length(v_combo_components) > 0 THEN
          SELECT coalesce(sum((elem->>'weight_grams')::integer * (elem->>'quantity')::integer), 0)
            INTO v_calc_combo_weight
            FROM jsonb_array_elements(v_combo_components) AS elem;
          v_item_weight_grams := v_calc_combo_weight;
        END IF;
      END IF;

      v_subtotal := v_subtotal + (v_qty * v_unit_price);
      v_total_weight_grams := v_total_weight_grams + (v_qty * coalesce(v_item_weight_grams, 0))::integer;
      v_item_count := v_item_count + 1;

      v_resolved_items := v_resolved_items || jsonb_build_array(jsonb_build_object(
        'product_id', v_valid_product_id,
        'variant_id', v_valid_variant_id,
        'sku', v_sku,
        'product_name', coalesce(v_prod_name, 'খেজুরের খাঁটি গুড়'),
        'variant_name', coalesce(v_var_name, '1 Pack'),
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'weight_grams', v_item_weight_grams,
        'is_combo', v_is_combo,
        'combo_components', v_combo_components
      ));
    END LOOP;
  END IF;

  -- 6. Shipping & Address Calculation
  IF p_delivery_zone = 'inside_dhaka' THEN
    v_base_shipping := 70;
  ELSIF p_delivery_zone = 'outside_dhaka' THEN
    v_base_shipping := 130;
  ELSE
    v_base_shipping := 0;
  END IF;

  -- Only charge shipping if there are items; if zone omitted on draft update, retain stored delivery charge
  IF v_item_count > 0 THEN
    IF p_delivery_zone IS NOT NULL AND trim(p_delivery_zone) <> '' THEN
      v_shipping_total := v_base_shipping;
    ELSE
      v_shipping_total := coalesce(v_existing.shipping_total, v_base_shipping);
    END IF;
  ELSE
    v_shipping_total := 0;
  END IF;

  -- Resolve shipping method name only when courier name is supplied or delivery zone is nonblank
  IF p_courier_name IS NOT NULL AND length(trim(p_courier_name)) > 0 THEN
    v_resolved_method_name := trim(p_courier_name);
  ELSIF v_shipping_total > 0 AND p_delivery_zone IS NOT NULL AND length(trim(p_delivery_zone)) > 0 THEN
    IF p_delivery_zone = 'inside_dhaka' THEN
      v_resolved_method_name := 'Inside Dhaka Home Delivery';
    ELSE
      v_resolved_method_name := 'Outside Dhaka Delivery';
    END IF;
  ELSE
    v_resolved_method_name := NULL;
  END IF;

  -- Calculate grand total: When v_item_count = 0 on update, preserve existing financial totals
  IF v_existing.id IS NOT NULL AND v_item_count = 0 THEN
    v_subtotal := coalesce(v_existing.subtotal, 0);
    v_shipping_total := coalesce(v_existing.shipping_total, 0);
    v_grand_total := coalesce(v_existing.grand_total, 0);
  ELSE
    v_grand_total := v_subtotal + v_shipping_total;
  END IF;

  -- Build address JSON
  v_resolved_address_line := coalesce(nullif(trim(p_address_line), ''), v_existing.shipping_address->>'address_line');
  v_resolved_district := coalesce(nullif(trim(p_district), ''), v_existing.shipping_address->>'district', '');
  v_resolved_division := coalesce(nullif(trim(p_division), ''), v_existing.shipping_address->>'division', '');
  v_resolved_customer_name := coalesce(nullif(trim(p_customer_name), ''), v_existing.customer_name);
  v_resolved_customer_note := coalesce(nullif(trim(p_customer_note), ''), v_existing.customer_note);

  v_shipping_address := jsonb_build_object(
    'phone', coalesce(v_existing.shipping_address->>'phone', v_phone),
    'recipient_name', coalesce(v_resolved_customer_name, v_existing.shipping_address->>'recipient_name', ''),
    'address_line', coalesce(v_resolved_address_line, ''),
    'city', CASE
      WHEN p_delivery_zone = 'inside_dhaka' THEN 'Dhaka'
      WHEN p_delivery_zone IS NOT NULL AND length(trim(p_delivery_zone)) > 0 THEN ''
      ELSE coalesce(v_existing.shipping_address->>'city', '')
    END,
    'zone', coalesce(nullif(trim(p_delivery_zone), ''), v_existing.shipping_address->>'zone'),
    'district', v_resolved_district,
    'division', v_resolved_division
  );

  -- Execute Insert or Update
  IF v_existing.id IS NOT NULL THEN
    v_order_id := v_existing.id;
    v_order_number := v_existing.order_number;

    UPDATE public.orders
    SET
      status = v_final_status::public.order_status,
      customer_name = v_resolved_customer_name,
      shipping_address = v_shipping_address,
      shipping_method_name = coalesce(v_resolved_method_name, v_existing.shipping_method_name),
      subtotal = v_subtotal,
      shipping_total = v_shipping_total,
      tax_total = CASE WHEN v_item_count = 0 THEN coalesce(v_existing.tax_total, 0) ELSE 0 END,
      discount_total = CASE WHEN v_item_count = 0 THEN coalesce(v_existing.discount_total, 0) ELSE 0 END,
      grand_total = v_grand_total,
      total_weight_kg = CASE WHEN v_item_count = 0 THEN coalesce(v_existing.total_weight_kg, 0) ELSE round(v_total_weight_grams / 1000.0, 3) END,
      customer_note = v_resolved_customer_note,
      attribution = jsonb_build_object(
        'source', 'direct_storefront_web',
        'client_timestamp', now()::text,
        'zero_items_phone_order', to_jsonb(v_item_count = 0),
        'last_sync_status', v_final_status,
        'was_pending_updated', v_was_pending,
        'was_incomplete_upgraded', v_was_incomplete,
        'has_other_orders', v_has_other_orders,
        'other_order_numbers', to_jsonb(v_other_order_numbers),
        'other_orders', v_other_orders_json
      ),
      updated_at = now()
    WHERE id = v_order_id;
  ELSE
    INSERT INTO public.orders (
      status,
      channel,
      payment_status,
      fulfillment_status,
      payment_method,
      currency,
      customer_name,
      customer_phone,
      shipping_phone,
      shipping_address,
      shipping_method_name,
      subtotal,
      shipping_total,
      tax_total,
      discount_total,
      grand_total,
      total_weight_kg,
      amount_paid,
      customer_note,
      attribution
    ) VALUES (
      v_final_status::public.order_status,
      'web',
      'unpaid',
      'unfulfilled',
      'cod',
      'BDT',
      v_resolved_customer_name,
      v_phone,
      v_phone,
      v_shipping_address,
      v_resolved_method_name,
      v_subtotal,
      v_shipping_total,
      0,
      0,
      v_grand_total,
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
    RETURNING id, order_number INTO v_order_id, v_order_number;
  END IF;

  -- 7. Synchronize Line Items & Manage Stock Reservations
  IF v_item_count > 0 THEN
    -- If updating an order that already had stock reserved, release old reservations before re-inserting
    IF v_existing.id IS NOT NULL AND v_was_pending THEN
      PERFORM private.release_order_stock(v_order_id);
    END IF;

    -- If updating, remove old items first
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
        weight_grams,
        is_combo,
        combo_components
      ) VALUES (
        v_order_id,
        nullif(v_resolved_item ->> 'product_id', '')::uuid,
        nullif(v_resolved_item ->> 'variant_id', '')::uuid,
        v_resolved_item ->> 'sku',
        v_resolved_item ->> 'product_name',
        v_resolved_item ->> 'variant_name',
        (v_resolved_item ->> 'quantity')::numeric,
        (v_resolved_item ->> 'unit_price')::numeric,
        (v_resolved_item ->> 'weight_grams')::integer,
        coalesce((v_resolved_item ->> 'is_combo')::boolean, false),
        coalesce(v_resolved_item -> 'combo_components', '[]'::jsonb)
      );
    END LOOP;

    -- If final status is pending, reserve stock authoritatively
    IF v_final_status = 'pending' THEN
      PERFORM private.reserve_order_stock(v_order_id);
    END IF;
  END IF;

  -- 8. Log Events
  IF v_was_incomplete AND v_final_status = 'pending' THEN
    INSERT INTO public.order_events (order_id, event_type, from_value, to_value, message)
    VALUES (
      v_order_id,
      'status_change',
      'incomplete_order',
      'pending',
      'Incomplete order upgraded to pending upon customer order submission'
    );
  END IF;

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
    'item_count', v_item_count,
    'was_pending_updated', v_was_pending,
    'was_incomplete_upgraded', v_was_incomplete,
    'has_other_orders', v_has_other_orders
  );
END;
$$;
