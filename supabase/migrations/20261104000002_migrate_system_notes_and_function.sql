-- =============================================================================
-- Migration: Migrate System Notes and Update Storefront Order Function
-- 1. Migrate existing system-authored internal notes to 'system' note type
-- 2. Update public.process_storefront_order function to log system notes as 'system'
-- 3. Ensure permissions and view public.notes are up to date
-- =============================================================================

-- Step 1: Migrate existing notes authored by System or prefixed with [System Note]
UPDATE public.order_notes
SET
  type = 'system'::public.order_note_type,
  note = trim(regexp_replace(note, '^\[System Note\]\s*', '', 'i'))
WHERE
  type::text IN ('system', 'system_note')
  OR note ILIKE '[System Note]%'
  OR (author = 'System' AND type::text = 'internal');

-- Step 2: Ensure view public.notes references the updated enum
CREATE OR REPLACE VIEW public.notes
WITH (security_invoker = true) AS
SELECT
  id,
  order_id,
  order_number,
  type,
  author,
  note,
  created_at
FROM public.order_notes;

GRANT SELECT ON public.notes TO anon, authenticated, service_role;

-- Step 3: Update public.process_storefront_order to write notes with type 'system'
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
  v_was_incomplete      boolean := false;
  v_was_pending         boolean := false;
  v_has_other_orders    boolean := false;
  v_other_order_numbers text[] := '{}';
  v_other_orders_json   jsonb := '[]'::jsonb;
  v_other_rec           record;
  v_derived_note        text;
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
    END IF;
  END IF;

  -- Fallback check by p_order_id if not yet matched
  IF v_existing.id IS NULL AND p_order_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_existing.id IS NOT NULL THEN
      IF v_existing.status::text = 'pending' THEN
        v_was_pending := true;
      ELSIF v_existing.status::text = 'incomplete_order' THEN
        v_was_incomplete := true;
      END IF;
    END IF;
  END IF;

  -- Rule 3: If found order is already confirmed/processing/shipped/delivered/cancelled etc.,
  -- do NOT overwrite it! Treat as fresh order to store in DB.
  IF v_existing.id IS NOT NULL AND v_existing.status::text NOT IN ('incomplete_order', 'pending') THEN
    v_existing := NULL;
    v_was_incomplete := false;
    v_was_pending := false;
  END IF;

  -- Status transition guard: never step backwards from pending to incomplete_order
  IF v_existing.id IS NOT NULL AND v_existing.status::text = 'pending' AND v_final_status = 'incomplete_order' THEN
    v_final_status := 'pending';
  END IF;

  -- Rule 3 check: Check for any other existing orders with this phone number
  SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at DESC), '{}'),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id,
           'order_number', o.order_number,
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

  -- 4. Customer Data SSOT: strictly preserve customer inputs; never inject synthetic defaults
  v_resolved_customer_name := coalesce(nullif(trim(p_customer_name), ''), v_existing.customer_name);
  v_resolved_customer_note := coalesce(nullif(trim(p_customer_note), ''), v_existing.customer_note);
  v_resolved_address_line  := coalesce(nullif(trim(p_address_line), ''), (v_existing.shipping_address ->> 'address_line'));

  -- Preserve division, district, courier name without setting default values when left empty
  v_resolved_district      := coalesce(nullif(trim(p_district), ''), (v_existing.shipping_address ->> 'district'), '');
  v_resolved_division      := coalesce(nullif(trim(p_division), ''), (v_existing.shipping_address ->> 'division'), '');
  v_resolved_method_name   := coalesce(nullif(trim(p_courier_name), ''), v_existing.shipping_method_name);

  -- Delivery zone & shipping fee resolution (sets shipping fee ONLY, never injects dummy division/district/courier)
  IF p_delivery_zone IS NOT NULL AND trim(p_delivery_zone) <> '' THEN
    IF p_delivery_zone = 'inside_dhaka' THEN
      v_base_shipping := 70;
    ELSE
      v_base_shipping := 130;
    END IF;
  ELSIF v_existing.id IS NOT NULL THEN
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
    -- Rule 3: Insert brand new order row if no active pending/incomplete order
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
        'initial_status', v_final_status,
        'has_other_orders', v_has_other_orders,
        'other_order_numbers', to_jsonb(v_other_order_numbers),
        'other_orders', v_other_orders_json
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

  -- 8. Requirement 1 & 2: Log Notes & Events (System Notes)
  IF v_was_incomplete AND v_final_status = 'pending' THEN
    -- Rule 2: Incomplete order updated and upgraded to pending -> write system note about this upgradation
    INSERT INTO public.order_notes (
      order_id,
      order_number,
      type,
      author,
      note,
      created_at
    ) VALUES (
      v_order_id,
      v_order_number,
      'system',
      'System',
      'Incomplete order upgraded to pending upon customer order submission (' || v_item_count::text || ' items, total ৳' || v_grand_total::text || ')',
      now()
    );

    INSERT INTO public.order_events (order_id, event_type, from_value, to_value, message)
    VALUES (
      v_order_id,
      'status_change',
      'incomplete_order',
      'pending',
      'Incomplete order upgraded to pending upon customer order submission'
    );
  ELSIF v_was_pending AND v_final_status = 'pending' THEN
    -- Rule 1: Pending order updated based on new order data
    INSERT INTO public.order_events (order_id, event_type, to_value, message)
    VALUES (
      v_order_id,
      'updated',
      'pending',
      'পেন্ডিং অর্ডারের তথ্য ও আইটেম নতুন সাবমিশন অনুযায়ী আপডেট করা হয়েছে (' || v_item_count::text || 'টি আইটেম, মোট ৳' || v_grand_total::text || ')'
    );

    INSERT INTO public.order_notes (
      order_id,
      order_number,
      type,
      author,
      note,
      created_at
    ) VALUES (
      v_order_id,
      v_order_number,
      'system',
      'System',
      'Pending order updated with new items and delivery details from customer submission.',
      now()
    );
  END IF;

  -- Rule 3: Note if customer phone has other existing orders with specific details (e.g. other order: delivered, note: old customer)
  IF (v_existing.id IS NULL OR v_was_incomplete) AND v_has_other_orders THEN
    FOR v_other_rec IN
      SELECT o.order_number, o.status::text AS status
        FROM public.orders o
       WHERE o.customer_phone = v_phone
         AND o.id <> v_order_id
       ORDER BY o.created_at DESC
       LIMIT 5
    LOOP
      IF v_other_rec.status = 'delivered' THEN
        v_derived_note := 'old customer';
      ELSIF v_other_rec.status = 'returned' THEN
        v_derived_note := 'returned order';
      ELSIF v_other_rec.status = 'cancelled' THEN
        v_derived_note := 'cancelled order';
      ELSIF v_other_rec.status = 'shipped' THEN
        v_derived_note := 'order in transit';
      ELSIF v_other_rec.status = 'processing' THEN
        v_derived_note := 'processing order';
      ELSIF v_other_rec.status = 'confirmed' THEN
        v_derived_note := 'confirmed order';
      ELSIF v_other_rec.status = 'pending' THEN
        v_derived_note := 'pending order';
      ELSIF v_other_rec.status = 'incomplete_order' THEN
        v_derived_note := 'incomplete order';
      ELSE
        v_derived_note := 'previous order';
      END IF;

      INSERT INTO public.order_notes (
        order_id,
        order_number,
        type,
        author,
        note,
        created_at
      ) VALUES (
        v_order_id,
        v_order_number,
        'system',
        'System',
        'Other order ' || coalesce(v_other_rec.order_number, '') || ': ' || v_other_rec.status || ', note: ' || v_derived_note,
        now()
      );
    END LOOP;
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
    'delivery_zone', p_delivery_zone,
    'was_pending_updated', v_was_pending,
    'was_incomplete_upgraded', v_was_incomplete,
    'has_other_orders', v_has_other_orders,
    'other_order_numbers', to_jsonb(v_other_order_numbers)
  );
END $$;

-- Allow anon, authenticated, and service_role to execute the procedure
GRANT EXECUTE ON FUNCTION public.process_storefront_order(uuid, text, text, text, text, text, text, jsonb, text, text, text) TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.order_note_type TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO anon, authenticated, service_role;

