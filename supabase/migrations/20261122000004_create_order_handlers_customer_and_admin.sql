-- =============================================================================
-- Migration: Create Order Handlers for Customer and Admin Staff
-- Timestamp: 2026-11-22
--
-- Creates two dedicated, atomic database RPC handlers:
-- 1. public.create_customer_order(p_payload jsonb):
--    - Callable by anon, authenticated, and service_role.
--    - Enforces authoritative server catalog pricing (ignores client price).
--    - Automatically calculates delivery fee from settings and destination.
--    - Restricts status to 'pending' or 'incomplete_order'.
--    - Atomic stock reservation and customer record linkage.
--
-- 2. public.create_admin_order(p_payload jsonb):
--    - Callable by authenticated staff (verified via staff_members) & service_role.
--    - Accepts manual delivery charge without automated override.
--    - Allows custom status (confirmed, processing, etc.) and sales channels.
--    - Records advance payments, notes, and optional courier assignment.
--    - Atomic stock reservation and customer record linkage.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CUSTOMER ORDER HANDLER
-- =============================================================================
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
  v_line_total             numeric(12,2);
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
  v_prod_rec               record;
  v_is_combo               boolean := false;
  v_combo_comps            jsonb := '[]'::jsonb;

  -- Settings & Shipping calculation
  v_free_shipping_enabled  boolean := false;
  v_free_threshold         numeric(12,2) := 0;
  v_val_text               text;
  v_rate_rec               record;
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

  -- 2. Customer Name
  v_customer_name := trim(coalesce(p_payload->>'customer_name', p_payload->>'name', ''));
  IF length(v_customer_name) < 2 THEN
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

  IF jsonb_array_length(v_items) > 50 THEN
    RAISE EXCEPTION 'TOO_MANY_ITEMS: Maximum 50 product items allowed per order'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_item_idx IN 0 .. (jsonb_array_length(v_items) - 1) LOOP
    v_item := v_items->v_item_idx;
    v_candidate_prod_id := nullif(trim(v_item->>'product_id'), '');
    v_candidate_var_id := nullif(trim(v_item->>'variant_id'), '');
    v_qty := greatest(1, coalesce((v_item->>'quantity')::int, 1));
    v_unit_price := 0;
    v_is_combo := false;
    v_combo_comps := '[]'::jsonb;

    -- Attempt variant lookup
    IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~ '^[0-9a-f-]{36}$' THEN
      v_var_uuid := v_candidate_var_id::uuid;
      SELECT pv.id, pv.product_id, pv.title, pv.sku, pv.price, pv.weight_grams,
             p.name AS product_name, p.is_combo, p.combo_components
        INTO v_var_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE pv.id = v_var_uuid;

      IF FOUND THEN
        v_unit_price := coalesce(v_var_rec.price, 0);
        v_is_combo := coalesce(v_var_rec.is_combo, false);
        v_combo_comps := coalesce(v_var_rec.combo_components, '[]'::jsonb);
        v_line_total := v_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;
        v_total_weight_grams := v_total_weight_grams + (coalesce(v_var_rec.weight_grams, 1000) * v_qty);

        v_resolved_items := v_resolved_items || jsonb_build_object(
          'product_id', v_var_rec.product_id,
          'variant_id', v_var_rec.id,
          'product_name', v_var_rec.product_name,
          'variant_name', v_var_rec.title,
          'sku', coalesce(v_var_rec.sku, 'MOL-VAR'),
          'quantity', v_qty,
          'unit_price', v_unit_price,
          'line_total', v_line_total,
          'weight_grams', coalesce(v_var_rec.weight_grams, 1000),
          'is_combo', v_is_combo,
          'combo_components', v_combo_comps
        );
        CONTINUE;
      END IF;
    END IF;

    -- Fallback product lookup
    IF v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~ '^[0-9a-f-]{36}$' THEN
      v_prod_uuid := v_candidate_prod_id::uuid;
      SELECT p.id, p.name, p.sku, p.price_per_kg, p.net_weight_grams, p.is_combo, p.combo_components
        INTO v_prod_rec
        FROM public.products p
       WHERE p.id = v_prod_uuid;

      IF FOUND THEN
        v_unit_price := coalesce(v_prod_rec.price_per_kg, 0);
        v_is_combo := coalesce(v_prod_rec.is_combo, false);
        v_combo_comps := coalesce(v_prod_rec.combo_components, '[]'::jsonb);
        v_line_total := v_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;
        v_total_weight_grams := v_total_weight_grams + (coalesce(v_prod_rec.net_weight_grams, 1000) * v_qty);

        v_resolved_items := v_resolved_items || jsonb_build_object(
          'product_id', v_prod_rec.id,
          'variant_id', NULL,
          'product_name', v_prod_rec.name,
          'variant_name', 'Standard',
          'sku', coalesce(v_prod_rec.sku, 'MOL-PROD'),
          'quantity', v_qty,
          'unit_price', v_unit_price,
          'line_total', v_line_total,
          'weight_grams', coalesce(v_prod_rec.net_weight_grams, 1000),
          'is_combo', v_is_combo,
          'combo_components', v_combo_comps
        );
        CONTINUE;
      END IF;
    END IF;

    RAISE EXCEPTION 'INVALID_PRODUCT: Product or variant does not exist or has been discontinued'
      USING ERRCODE = 'P0001';
  END LOOP;

  -- 7. Calculate Authoritative Delivery Charge
  v_total_weight_kg := greatest(0.5, round((v_total_weight_grams::numeric / 1000.0), 2));

  -- Check free shipping policy from settings
  SELECT value INTO v_val_text FROM public.settings WHERE key = 'shipping.free_delivery_enabled' LIMIT 1;
  IF v_val_text IS NOT NULL AND lower(trim(v_val_text)) IN ('true', '1', 'yes') THEN
    v_free_shipping_enabled := true;
  END IF;

  SELECT value INTO v_val_text FROM public.settings WHERE key = 'shipping.free_delivery_threshold' LIMIT 1;
  IF v_val_text IS NOT NULL AND v_val_text ~ '^\d+(\.\d+)?$' THEN
    v_free_threshold := v_val_text::numeric;
  END IF;

  IF v_free_shipping_enabled AND v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_shipping_total := 0;
  ELSE
    -- Authoritative rate lookup by district
    IF v_district IS NOT NULL AND lower(trim(v_district)) IN ('dhaka', 'ঢাকা') THEN
      SELECT rate INTO v_shipping_total
        FROM public.shipping_rates
       WHERE is_active = true AND lower(destination) LIKE '%dhaka%'
       ORDER BY min_weight_kg ASC LIMIT 1;
      v_shipping_total := coalesce(v_shipping_total, 80);
    ELSE
      SELECT rate INTO v_shipping_total
        FROM public.shipping_rates
       WHERE is_active = true AND (lower(destination) LIKE '%outside%' OR lower(destination) LIKE '%all%')
       ORDER BY min_weight_kg ASC LIMIT 1;
      v_shipping_total := coalesce(v_shipping_total, 130);
    END IF;
  END IF;

  v_grand_total := v_subtotal + v_shipping_total;

  -- 8. Customer Record Linkage
  SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_clean_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (phone, name, total_orders)
    VALUES (v_clean_phone, v_customer_name, 1)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET name = coalesce(nullif(v_customer_name, ''), name),
           total_orders = total_orders + 1,
           last_order_at = now()
     WHERE id = v_customer_id;
  END IF;

  -- 9. Shipping Address JSON
  v_shipping_address := jsonb_build_object(
    'division', coalesce(v_division, ''),
    'district', coalesce(v_district, ''),
    'address_line', coalesce(v_address_line, ''),
    'recipient_name', v_customer_name,
    'phone', v_clean_phone
  );

  -- 10. Check Draft Upgrade
  IF p_payload->>'order_id' IS NOT NULL AND (p_payload->>'order_id') ~ '^[0-9a-f-]{36}$' THEN
    v_existing_order_id := (p_payload->>'order_id')::uuid;
    SELECT * INTO v_existing_order FROM public.orders WHERE id = v_existing_order_id;
    IF FOUND AND v_existing_order.status = 'incomplete_order' AND v_existing_order.customer_phone = v_clean_phone THEN
      v_is_upgrade := true;
      v_order_id := v_existing_order.id;
      v_order_number := v_existing_order.order_number;
      v_public_token := v_existing_order.public_token;

      UPDATE public.orders
         SET status = v_target_status,
             customer_name = v_customer_name,
             customer_id = v_customer_id,
             shipping_address = v_shipping_address,
             shipping_total = v_shipping_total,
             subtotal = v_subtotal,
             grand_total = v_grand_total,
             total_weight_kg = v_total_weight_kg,
             customer_note = coalesce(v_customer_note, customer_note),
             payment_method = v_payment_method,
             attribution = coalesce(p_payload->'attribution', attribution),
             updated_at = now()
       WHERE id = v_order_id;

      DELETE FROM public.order_items WHERE order_id = v_order_id;
    END IF;
  END IF;

  -- Fresh Order Insert if not upgrade
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
      shipping_method_name,
      subtotal,
      discount_total,
      shipping_total,
      grand_total,
      amount_paid,
      currency,
      total_weight_kg,
      customer_note,
      attribution
    ) VALUES (
      v_target_status,
      'unpaid',
      v_payment_method,
      'web',
      'unfulfilled',
      v_customer_id,
      v_clean_phone,
      v_customer_name,
      v_shipping_address,
      NULL, -- No courier partner assigned initially
      v_subtotal,
      0,
      v_shipping_total,
      v_grand_total,
      0,
      'BDT',
      v_total_weight_kg,
      v_customer_note,
      coalesce(p_payload->'attribution', '{}'::jsonb)
    )
    RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;
  END IF;

  -- 11. Insert Order Items
  FOR v_item_idx IN 0 .. (jsonb_array_length(v_resolved_items) - 1) LOOP
    v_item := v_resolved_items->v_item_idx;
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      sku,
      quantity,
      unit_price,
      line_total,
      weight_grams,
      is_combo,
      combo_components
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      nullif(v_item->>'variant_id', '')::uuid,
      v_item->>'product_name',
      v_item->>'variant_name',
      v_item->>'sku',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric,
      (v_item->>'weight_grams')::int,
      coalesce((v_item->>'is_combo')::boolean, false),
      coalesce(v_item->'combo_components', '[]'::jsonb)
    );
  END LOOP;

  -- 12. Reserve Stock for Pending Orders
  IF v_target_status = 'pending' THEN
    PERFORM private.reserve_order_stock(v_order_id);
  END IF;

  -- 13. Log Order Event
  INSERT INTO public.order_events (order_id, event_type, message, actor)
  VALUES (
    v_order_id,
    'placed',
    CASE WHEN v_is_upgrade THEN 'Incomplete draft upgraded to pending order by customer'
         ELSE 'Order placed by customer via web storefront' END,
    'Customer'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_token', v_public_token,
    'status', v_target_status,
    'subtotal', v_subtotal,
    'shipping_total', v_shipping_total,
    'grand_total', v_grand_total,
    'total_weight_kg', v_total_weight_kg,
    'item_count', jsonb_array_length(v_resolved_items),
    'is_upgrade', v_is_upgrade
  );
END;
$$;

-- Permissions for Customer Order Handler
REVOKE ALL ON FUNCTION public.create_customer_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb) TO anon, authenticated, service_role;


-- =============================================================================
-- 2. ADMIN STAFF ORDER HANDLER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_admin_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid             uuid;
  v_raw_phone              text;
  v_clean_phone            text;
  v_customer_name          text;
  v_customer_email         text;
  v_alt_phone              text;
  v_shipping_phone         text;
  v_recipient_name         text;
  v_division               text;
  v_district               text;
  v_address_line           text;
  v_shipping_total         numeric(12,2);
  v_discount_total         numeric(12,2) := 0;
  v_channel                text;
  v_status                 text;
  v_payment_status         text;
  v_payment_method         text;
  v_amount_paid            numeric(12,2) := 0;
  v_courier_name           text;
  v_customer_note          text;
  v_staff_note             text;
  v_delivery_note          text;
  v_packaging_note         text;

  v_items                  jsonb;
  v_item                   jsonb;
  v_item_idx               int;
  v_candidate_prod_id      text;
  v_candidate_var_id       text;
  v_prod_uuid              uuid;
  v_var_uuid               uuid;
  v_qty                    int;
  v_unit_price             numeric(12,2);
  v_line_total             numeric(12,2);
  v_subtotal               numeric(12,2) := 0;
  v_grand_total            numeric(12,2) := 0;
  v_total_weight_grams     int := 0;
  v_total_weight_kg        numeric(6,2) := 1.0;
  v_resolved_items         jsonb := '[]'::jsonb;
  v_order_id               uuid;
  v_order_number           text;
  v_public_token           uuid;
  v_customer_id            uuid;
  v_shipping_address       jsonb;

  -- Catalog lookup records
  v_var_rec                record;
  v_prod_rec               record;
  v_is_combo               boolean := false;
  v_combo_comps            jsonb := '[]'::jsonb;
BEGIN
  -- 1. Authorization Check: Must be service_role OR staff member
  IF auth.role() <> 'service_role' THEN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Authentication required to create admin orders'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.staff_members
       WHERE user_id = v_caller_uid
         AND role IN ('owner', 'admin', 'manager', 'support', 'staff')
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: Staff privileges required to execute create_admin_order'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Customer Phone & Name
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

  v_customer_name := trim(coalesce(p_payload->>'customer_name', p_payload->>'name', ''));
  IF length(v_customer_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER_NAME: Customer name must be at least 2 characters'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Sales Channel & Order Status
  v_channel := coalesce(nullif(trim(p_payload->>'channel'), ''), 'phone');
  IF v_channel NOT IN ('web', 'phone', 'whatsapp', 'admin', 'facebook', 'walk_in') THEN
    v_channel := 'phone';
  END IF;

  v_status := coalesce(nullif(trim(p_payload->>'status'), ''), 'confirmed');
  IF v_status NOT IN ('incomplete_order', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'partially_delivered', 'cancelled', 'returned') THEN
    v_status := 'confirmed';
  END IF;

  -- 4. Payment Details
  v_payment_status := coalesce(nullif(trim(p_payload->>'payment_status'), ''), 'unpaid');
  v_payment_method := coalesce(nullif(trim(p_payload->>'payment_method'), ''), 'cod');
  v_amount_paid := greatest(0, coalesce((p_payload->>'amount_paid')::numeric, 0));

  -- 5. Delivery Charge & Discount (Admin specified, never overwritten automatically)
  IF p_payload->>'shipping_total' IS NULL OR trim(p_payload->>'shipping_total') = '' THEN
    RAISE EXCEPTION 'SHIPPING_TOTAL_REQUIRED: Please specify delivery charge (enter 0 for free delivery or pickup)'
      USING ERRCODE = 'P0001';
  END IF;
  v_shipping_total := coalesce((p_payload->>'shipping_total')::numeric, 0);
  IF v_shipping_total < 0 THEN
    RAISE EXCEPTION 'INVALID_SHIPPING: Delivery charge cannot be negative'
      USING ERRCODE = 'P0001';
  END IF;

  v_discount_total := greatest(0, coalesce((p_payload->>'discount_total')::numeric, 0));

  -- 6. Courier Name (Sanitized against generic placeholders)
  v_courier_name := nullif(trim(p_payload->>'courier_name'), '');
  IF v_courier_name IS NOT NULL AND lower(v_courier_name) IN (
    'courier delivery', 'courier', 'courier service', 'home delivery',
    'standard delivery', 'delivery', 'inside dhaka home delivery',
    'outside dhaka delivery', 'কুরিয়ার ডেলিভারি'
  ) THEN
    v_courier_name := NULL;
  END IF;

  -- 7. Address & Contact Fields
  v_division := nullif(trim(p_payload->>'division'), '');
  v_district := nullif(trim(p_payload->>'district'), '');
  v_address_line := nullif(trim(p_payload->>'address_line'), '');
  v_customer_email := nullif(trim(p_payload->>'customer_email'), '');
  v_alt_phone := nullif(trim(p_payload->>'customer_alternative_phone'), '');
  v_recipient_name := nullif(trim(p_payload->>'shipping_recipient_name'), '');
  v_shipping_phone := nullif(trim(p_payload->>'shipping_phone'), '');

  v_customer_note := nullif(trim(p_payload->>'customer_note'), '');
  v_staff_note := nullif(trim(p_payload->>'staff_note'), '');
  v_delivery_note := nullif(trim(p_payload->>'delivery_note'), '');
  v_packaging_note := nullif(trim(p_payload->>'packaging_note'), '');

  -- 8. Items Resolution
  v_items := p_payload->'items';
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS: Order must contain at least one product item'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_item_idx IN 0 .. (jsonb_array_length(v_items) - 1) LOOP
    v_item := v_items->v_item_idx;
    v_candidate_prod_id := nullif(trim(v_item->>'product_id'), '');
    v_candidate_var_id := nullif(trim(v_item->>'variant_id'), '');
    v_qty := greatest(1, coalesce((v_item->>'quantity')::int, 1));
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    v_is_combo := false;
    v_combo_comps := '[]'::jsonb;

    IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~ '^[0-9a-f-]{36}$' THEN
      v_var_uuid := v_candidate_var_id::uuid;
      SELECT pv.id, pv.product_id, pv.title, pv.sku, pv.price, pv.weight_grams,
             p.name AS product_name, p.is_combo, p.combo_components
        INTO v_var_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE pv.id = v_var_uuid;

      IF FOUND THEN
        IF v_unit_price <= 0 THEN
          v_unit_price := coalesce(v_var_rec.price, 0);
        END IF;
        v_is_combo := coalesce(v_var_rec.is_combo, false);
        v_combo_comps := coalesce(v_var_rec.combo_components, '[]'::jsonb);
        v_line_total := v_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;
        v_total_weight_grams := v_total_weight_grams + (coalesce(v_var_rec.weight_grams, 1000) * v_qty);

        v_resolved_items := v_resolved_items || jsonb_build_object(
          'product_id', v_var_rec.product_id,
          'variant_id', v_var_rec.id,
          'product_name', v_var_rec.product_name,
          'variant_name', v_var_rec.title,
          'sku', coalesce(v_var_rec.sku, 'MOL-VAR'),
          'quantity', v_qty,
          'unit_price', v_unit_price,
          'line_total', v_line_total,
          'weight_grams', coalesce(v_var_rec.weight_grams, 1000),
          'is_combo', v_is_combo,
          'combo_components', v_combo_comps
        );
        CONTINUE;
      END IF;
    END IF;

    IF v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~ '^[0-9a-f-]{36}$' THEN
      v_prod_uuid := v_candidate_prod_id::uuid;
      SELECT p.id, p.name, p.sku, p.price_per_kg, p.net_weight_grams, p.is_combo, p.combo_components
        INTO v_prod_rec
        FROM public.products p
       WHERE p.id = v_prod_uuid;

      IF FOUND THEN
        IF v_unit_price <= 0 THEN
          v_unit_price := coalesce(v_prod_rec.price_per_kg, 0);
        END IF;
        v_is_combo := coalesce(v_prod_rec.is_combo, false);
        v_combo_comps := coalesce(v_prod_rec.combo_components, '[]'::jsonb);
        v_line_total := v_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;
        v_total_weight_grams := v_total_weight_grams + (coalesce(v_prod_rec.net_weight_grams, 1000) * v_qty);

        v_resolved_items := v_resolved_items || jsonb_build_object(
          'product_id', v_prod_rec.id,
          'variant_id', NULL,
          'product_name', v_prod_rec.name,
          'variant_name', 'Standard',
          'sku', coalesce(v_prod_rec.sku, 'MOL-PROD'),
          'quantity', v_qty,
          'unit_price', v_unit_price,
          'line_total', v_line_total,
          'weight_grams', coalesce(v_prod_rec.net_weight_grams, 1000),
          'is_combo', v_is_combo,
          'combo_components', v_combo_comps
        );
        CONTINUE;
      END IF;
    END IF;

    RAISE EXCEPTION 'INVALID_PRODUCT: Product or variant does not exist in catalog'
      USING ERRCODE = 'P0001';
  END LOOP;

  v_grand_total := greatest(0, (v_subtotal - v_discount_total + v_shipping_total));
  v_total_weight_kg := greatest(0.5, round((v_total_weight_grams::numeric / 1000.0), 2));

  -- 9. Customer Record Linkage
  SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_clean_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (phone, name, email, total_orders)
    VALUES (v_clean_phone, v_customer_name, v_customer_email, 1)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET name = coalesce(nullif(v_customer_name, ''), name),
           email = coalesce(v_customer_email, email),
           total_orders = total_orders + 1,
           last_order_at = now()
     WHERE id = v_customer_id;
  END IF;

  -- 10. Shipping Address JSON
  v_shipping_address := jsonb_build_object(
    'division', coalesce(v_division, ''),
    'district', coalesce(v_district, ''),
    'address_line', coalesce(v_address_line, ''),
    'recipient_name', coalesce(v_recipient_name, v_customer_name),
    'phone', coalesce(v_shipping_phone, v_clean_phone),
    'alternative_phone', coalesce(v_alt_phone, '')
  );

  -- 11. Insert Order
  INSERT INTO public.orders (
    status,
    payment_status,
    payment_method,
    channel,
    fulfillment_status,
    customer_id,
    customer_phone,
    customer_name,
    customer_email,
    customer_alternative_phone,
    shipping_phone,
    shipping_address,
    shipping_method_name,
    subtotal,
    discount_total,
    shipping_total,
    grand_total,
    amount_paid,
    currency,
    total_weight_kg,
    customer_note,
    attribution
  ) VALUES (
    v_status,
    v_payment_status,
    v_payment_method,
    v_channel,
    'unfulfilled',
    v_customer_id,
    v_clean_phone,
    v_customer_name,
    v_customer_email,
    v_alt_phone,
    coalesce(v_shipping_phone, v_clean_phone),
    v_shipping_address,
    v_courier_name,
    v_subtotal,
    v_discount_total,
    v_shipping_total,
    v_grand_total,
    v_amount_paid,
    'BDT',
    v_total_weight_kg,
    v_customer_note,
    coalesce(p_payload->'attribution', '{}'::jsonb)
  )
  RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;

  -- 12. Insert Order Items
  FOR v_item_idx IN 0 .. (jsonb_array_length(v_resolved_items) - 1) LOOP
    v_item := v_resolved_items->v_item_idx;
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      sku,
      quantity,
      unit_price,
      line_total,
      weight_grams,
      is_combo,
      combo_components
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      nullif(v_item->>'variant_id', '')::uuid,
      v_item->>'product_name',
      v_item->>'variant_name',
      v_item->>'sku',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric,
      (v_item->>'weight_grams')::int,
      coalesce((v_item->>'is_combo')::boolean, false),
      coalesce(v_item->'combo_components', '[]'::jsonb)
    );
  END LOOP;

  -- 13. Order Notes Insertion
  IF v_staff_note IS NOT NULL AND length(v_staff_note) > 0 THEN
    INSERT INTO public.order_notes (order_id, order_number, note, text, type, author_name)
    VALUES (v_order_id, v_order_number, v_staff_note, v_staff_note, 'internal', 'Staff');
  END IF;
  IF v_delivery_note IS NOT NULL AND length(v_delivery_note) > 0 THEN
    INSERT INTO public.order_notes (order_id, order_number, note, text, type, author_name)
    VALUES (v_order_id, v_order_number, v_delivery_note, v_delivery_note, 'delivery', 'Staff');
  END IF;
  IF v_packaging_note IS NOT NULL AND length(v_packaging_note) > 0 THEN
    INSERT INTO public.order_notes (order_id, order_number, note, text, type, author_name)
    VALUES (v_order_id, v_order_number, v_packaging_note, v_packaging_note, 'packaging', 'Staff');
  END IF;

  -- 14. Stock Reservation for Confirmed / Processing Orders
  IF v_status IN ('confirmed', 'processing', 'shipped') THEN
    PERFORM private.reserve_order_stock(v_order_id);
  END IF;

  -- 15. Order Event Logging
  INSERT INTO public.order_events (order_id, event_type, message, actor)
  VALUES (
    v_order_id,
    'created',
    'Manual order created by staff (' || upper(v_channel) || ')' || coalesce(' via ' || v_courier_name, ''),
    'Staff'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_token', v_public_token,
    'status', v_status,
    'channel', v_channel,
    'subtotal', v_subtotal,
    'shipping_total', v_shipping_total,
    'discount_total', v_discount_total,
    'grand_total', v_grand_total,
    'amount_paid', v_amount_paid,
    'total_weight_kg', v_total_weight_kg,
    'item_count', jsonb_array_length(v_resolved_items)
  );
END;
$$;

-- Permissions for Admin Staff Order Handler
REVOKE ALL ON FUNCTION public.create_admin_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_order(jsonb) TO authenticated, service_role;

COMMIT;
