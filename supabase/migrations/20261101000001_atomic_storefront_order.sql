-- =============================================================================
-- Migration: Atomic Storefront Order Transaction (public.process_storefront_order)
-- Description: Executes order creation/updating and item synchronization inside
--              a single atomic PostgreSQL transaction. If any step fails,
--              PostgreSQL rolls back all changes so the database is never left
--              in a partial or corrupted state.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_storefront_order(
  p_order_id          uuid DEFAULT NULL,
  p_status            text DEFAULT 'pending', -- 'incomplete_order' or 'pending'
  p_customer_phone    text DEFAULT NULL,
  p_customer_name     text DEFAULT NULL,
  p_delivery_zone     text DEFAULT NULL,     -- 'inside_dhaka' or 'outside_dhaka'
  p_address_line      text DEFAULT NULL,
  p_customer_note     text DEFAULT NULL,
  p_items             jsonb DEFAULT '[]'::jsonb
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
  v_existing            record;
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
  v_qty                 numeric(12,3);
  v_unit_price          numeric(12,2);
  v_valid_product_id    uuid;
  v_valid_variant_id    uuid;
  v_candidate_prod_id   text;
  v_candidate_var_id    text;
  v_sku                 text;
  v_prod_name           text;
  v_var_name            text;
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

  -- 3. Lookup existing draft order with row-level lock
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders WHERE id = p_order_id FOR UPDATE;
  END IF;

  IF v_existing.id IS NULL THEN
    SELECT * INTO v_existing
      FROM public.orders
     WHERE customer_phone = v_phone
       AND status = 'incomplete_order'
       AND created_at >= (now() - interval '24 hours')
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;
  END IF;

  -- If found order is already confirmed/shipped/cancelled etc., do not mutate it - start fresh order
  IF v_existing.id IS NOT NULL AND v_existing.status::text NOT IN ('incomplete_order', 'pending') THEN
    v_existing := NULL;
  END IF;

  -- Status transition guard: never step backwards from pending to incomplete_order
  IF v_existing.id IS NOT NULL AND v_existing.status::text = 'pending' AND v_final_status = 'incomplete_order' THEN
    v_final_status := 'pending';
  END IF;

  -- 4. Customer Data SSOT: strictly preserve customer inputs; never inject synthetic names/notes
  v_resolved_customer_name := coalesce(nullif(trim(p_customer_name), ''), v_existing.customer_name);
  v_resolved_customer_note := coalesce(nullif(trim(p_customer_note), ''), v_existing.customer_note);
  v_resolved_address_line  := coalesce(nullif(trim(p_address_line), ''), (v_existing.shipping_address ->> 'address_line'));

  -- Delivery zone & shipping fee resolution
  IF p_delivery_zone IS NOT NULL AND trim(p_delivery_zone) <> '' THEN
    IF p_delivery_zone = 'inside_dhaka' THEN
      v_resolved_district := 'Dhaka';
      v_resolved_division := 'Dhaka';
      v_base_shipping := 70;
      v_resolved_method_name := 'কুরিয়ার হোম ডেলিভারি (ঢাকার ভেতরে - ৳৭০)';
    ELSE
      v_resolved_district := 'Outside Dhaka';
      v_resolved_division := 'Bangladesh';
      v_base_shipping := 130;
      v_resolved_method_name := 'কুরিয়ার হোম ডেলিভারি (ঢাকার বাইরে - ৳১৩০)';
    END IF;
  ELSIF v_existing.id IS NOT NULL AND v_existing.shipping_address IS NOT NULL THEN
    v_resolved_district := coalesce(v_existing.shipping_address ->> 'district', '');
    v_resolved_division := coalesce(v_existing.shipping_address ->> 'division', '');
    v_resolved_method_name := v_existing.shipping_method_name;
    v_base_shipping := coalesce(v_existing.shipping_total, 0);
  END IF;

  -- 5. Calculate items subtotal and count
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    v_item_count := jsonb_array_length(p_items);
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := greatest(1, coalesce((v_item ->> 'quantity')::numeric, 1));
      v_unit_price := greatest(0, coalesce((v_item ->> 'unit_price')::numeric, 0));
      v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
    END LOOP;
  END IF;

  IF v_item_count > 0 THEN
    IF p_delivery_zone IS NOT NULL AND trim(p_delivery_zone) <> '' THEN
      v_shipping_total := v_base_shipping;
    ELSE
      v_shipping_total := coalesce(v_existing.shipping_total, v_base_shipping);
    END IF;
  ELSE
    v_shipping_total := 0;
  END IF;

  v_grand_total := round(v_subtotal + v_shipping_total, 2);

  v_shipping_address := jsonb_build_object(
    'phone', v_phone,
    'recipient_name', coalesce(v_resolved_customer_name, ''),
    'address_line', coalesce(v_resolved_address_line, ''),
    'district', v_resolved_district,
    'division', v_resolved_division
  );

  -- 6. Upsert Order (inside the atomic transaction)
  IF v_existing.id IS NOT NULL THEN
    v_order_id := v_existing.id;
    v_order_number := v_existing.order_number;

    UPDATE public.orders SET
      status = v_final_status::public.order_status,
      customer_name = v_resolved_customer_name,
      customer_phone = v_phone,
      shipping_phone = v_phone,
      shipping_address = v_shipping_address,
      shipping_method_name = v_resolved_method_name,
      subtotal = v_subtotal,
      shipping_total = v_shipping_total,
      tax_total = 0,
      discount_total = 0,
      grand_total = v_grand_total,
      customer_note = v_resolved_customer_note,
      attribution = jsonb_build_object(
        'source', 'direct_storefront_web',
        'client_timestamp', now()::text,
        'zero_items_phone_order', (v_item_count = 0),
        'last_sync_status', v_final_status
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
      0,
      v_resolved_customer_note,
      jsonb_build_object(
        'source', 'direct_storefront_web',
        'client_timestamp', now()::text,
        'zero_items_phone_order', (v_item_count = 0),
        'initial_status', v_final_status
      )
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;
  END IF;

  -- 7. Synchronize Line Items atomically
  IF v_item_count > 0 THEN
    -- If updating, remove old items first
    IF v_existing.id IS NOT NULL THEN
      DELETE FROM public.order_items WHERE order_id = v_order_id;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_candidate_prod_id := nullif(trim(v_item ->> 'product_id'), '');
      v_candidate_var_id := nullif(trim(v_item ->> 'variant_id'), '');
      v_valid_product_id := NULL;
      v_valid_variant_id := NULL;

      -- Validate foreign keys safely
      IF v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_valid_product_id FROM public.products WHERE id = v_candidate_prod_id::uuid;
      END IF;

      IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_valid_variant_id FROM public.product_variants WHERE id = v_candidate_var_id::uuid;
      END IF;

      v_qty := greatest(1, coalesce((v_item ->> 'quantity')::numeric, 1));
      v_unit_price := greatest(0, coalesce((v_item ->> 'unit_price')::numeric, 0));
      v_prod_name := coalesce(nullif(trim(v_item ->> 'product_name'), ''), 'খেজুরের খাঁটি গুড়');
      v_var_name := coalesce(nullif(trim(v_item ->> 'variant_name'), ''), '1 Pack');

      v_sku := 'GUR-' || coalesce(
        nullif(regexp_replace(v_var_name, '[^a-zA-Z0-9]', '', 'g'), ''),
        nullif(regexp_replace(v_prod_name, '[^a-zA-Z0-9]', '', 'g'), ''),
        'STD'
      );
      v_sku := upper(substr(v_sku, 1, 14));

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
        v_valid_product_id,
        v_valid_variant_id,
        v_sku,
        v_prod_name,
        v_var_name,
        v_qty,
        v_unit_price
      );
    END LOOP;
  END IF;

  -- 8. Log transition event when promoting from incomplete_order to pending
  IF v_existing.id IS NOT NULL AND v_existing.status::text = 'incomplete_order' AND v_final_status = 'pending' THEN
    INSERT INTO public.order_events (order_id, event_type, to_value, message)
    VALUES (
      v_order_id,
      'placed',
      'pending',
      'গ্রাহক ওয়েবসাইট থেকে অর্ডার নিশ্চিত করেছেন (' || v_item_count::text || 'টি আইটেম, মোট ৳' || v_grand_total::text || ')'
    );
  END IF;

  -- 9. Return structured order result
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
    'delivery_zone', p_delivery_zone
  );
END $$;

-- Allow anon and authenticated roles to execute the procedure
GRANT EXECUTE ON FUNCTION public.process_storefront_order(uuid, text, text, text, text, text, text, jsonb) TO anon, authenticated, service_role;

