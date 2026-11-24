-- =============================================================================
-- Migration: Add advance_paid column to orders & separate pre-delivery advance
--            from post-delivery total amount_paid across ledger, triggers, RPCs
-- Timestamp: 2026-11-25
-- =============================================================================

BEGIN;

-- 1. Add advance_paid to public.orders and is_advance to public.payments
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS advance_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK (advance_paid >= 0);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_advance boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_payments_order_advance
  ON public.payments (order_id, is_advance)
  WHERE status = 'succeeded';

-- 2. Backfill non-delivered orders: move pre-delivery amount_paid -> advance_paid
UPDATE public.orders
   SET advance_paid = amount_paid,
       amount_paid  = 0
 WHERE status <> 'delivered'
   AND amount_paid > 0;

-- 3. Auto-classify pre-delivery charges inserted into public.payments
CREATE OR REPLACE FUNCTION private.payments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status       public.order_status;
  v_delivered_at timestamptz;
BEGIN
  IF NEW.kind = 'charge' AND coalesce(NEW.provider, '') <> 'migration_backfill' THEN
    SELECT o.status, o.delivered_at
      INTO v_status, v_delivered_at
      FROM public.orders o
     WHERE o.id = NEW.order_id;

    IF FOUND AND v_status <> 'delivered' AND v_delivered_at IS NULL THEN
      NEW.is_advance := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_before_insert ON public.payments;
CREATE TRIGGER trg_payments_before_insert
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION private.payments_before_insert();

-- 4. Update trg_payments_sync function to keep advance_paid & amount_paid separated
CREATE OR REPLACE FUNCTION private.payments_sync_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id       uuid;
  v_adv_charged    numeric(14,2);
  v_post_charged   numeric(14,2);
  v_total_charged  numeric(14,2);
  v_refunded       numeric(14,2);
  v_total          numeric(14,2);
  v_order_status   public.order_status;
  v_delivered_at   timestamptz;
  v_is_delivered   boolean;
  v_advance        numeric(14,2);
  v_paid           numeric(14,2);
  v_effective_paid numeric(14,2);
  v_status         public.payment_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  SELECT coalesce(sum(p.amount) FILTER (WHERE p.kind = 'charge' AND p.status = 'succeeded' AND p.is_advance = true), 0),
         coalesce(sum(p.amount) FILTER (WHERE p.kind = 'charge' AND p.status = 'succeeded' AND p.is_advance = false), 0),
         coalesce(sum(p.amount) FILTER (WHERE p.kind = 'refund' AND p.status = 'succeeded'), 0)
    INTO v_adv_charged, v_post_charged, v_refunded
    FROM public.payments p
   WHERE p.order_id = v_order_id;

  SELECT o.grand_total, o.status, o.delivered_at
    INTO v_total, v_order_status, v_delivered_at
    FROM public.orders o
   WHERE o.id = v_order_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_total_charged := v_adv_charged + v_post_charged;
  v_is_delivered := (v_order_status = 'delivered' OR (v_order_status = 'returned' AND v_delivered_at IS NOT NULL));

  IF v_is_delivered THEN
    v_advance := v_adv_charged;
    v_paid := greatest(v_total_charged - v_refunded, 0);
    v_effective_paid := v_paid;
  ELSE
    v_advance := greatest(v_total_charged - v_refunded, 0);
    v_paid := 0;
    v_effective_paid := v_advance;
  END IF;

  v_status := (CASE
                 WHEN v_total_charged > 0 AND v_refunded >= v_total_charged THEN 'refunded'
                 WHEN v_refunded > 0                                        THEN 'partially_refunded'
                 WHEN v_effective_paid > 0 AND v_effective_paid >= v_total  THEN 'paid'
                 WHEN v_effective_paid > 0                                  THEN 'partially_paid'
                 ELSE 'unpaid'
               END)::public.payment_status;

  UPDATE public.orders o
     SET advance_paid   = v_advance,
         amount_paid    = v_paid,
         payment_status = v_status
   WHERE o.id = v_order_id
     AND (o.advance_paid IS DISTINCT FROM v_advance
          OR o.amount_paid IS DISTINCT FROM v_paid
          OR o.payment_status IS DISTINCT FROM v_status);

  RETURN NULL;
END;
$$;

-- 5. Update private.orders_before_update() to preserve amount_paid = 0 before delivery
CREATE OR REPLACE FUNCTION private.orders_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
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
      IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = new.id) THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: at least one order item is required before confirming order' USING errcode = 'P0001';
      END IF;

      IF new.customer_phone IS NULL OR new.customer_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
        RAISE EXCEPTION 'CUSTOMER_PHONE_REQUIRED: valid customer phone is required before confirming order' USING errcode = 'P0001';
      END IF;
    END IF;

    IF new.status = 'confirmed' THEN new.confirmed_at := coalesce(new.confirmed_at, now()); END IF;
    IF new.status = 'shipped'   THEN new.shipped_at   := coalesce(new.shipped_at,   now()); END IF;
    IF new.status = 'delivered' THEN
      new.delivered_at := coalesce(new.delivered_at, now());
      IF new.amount_paid = 0 AND new.advance_paid > 0 THEN
        new.amount_paid := new.advance_paid;
      END IF;
    END IF;
  END IF;

  IF new.status IN ('incomplete_order', 'pending', 'confirmed', 'processing', 'shipped') THEN
    new.amount_paid := 0;
  END IF;

  RETURN new;
END;
$$;

-- 6. Backfill missing payments ledger rows for existing orders with advance_paid / amount_paid
INSERT INTO public.payments (
  order_id, kind, method, provider, status, amount, is_advance, provider_txn_id, paid_at, created_at, updated_at
)
SELECT
  o.id,
  'charge'::public.payment_kind,
  coalesce(o.payment_method, 'cod'::public.payment_method),
  'migration_backfill',
  'succeeded'::public.payment_txn_status,
  o.advance_paid,
  true,
  'BACKFILL-ADV-' || o.id::text,
  coalesce(o.confirmed_at, o.placed_at, o.created_at),
  coalesce(o.confirmed_at, o.placed_at, o.created_at),
  now()
FROM public.orders o
WHERE o.advance_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
     WHERE p.order_id = o.id AND p.status = 'succeeded' AND p.is_advance = true
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.payments (
  order_id, kind, method, provider, status, amount, is_advance, provider_txn_id, paid_at, created_at, updated_at
)
SELECT
  o.id,
  'charge'::public.payment_kind,
  coalesce(o.payment_method, 'cod'::public.payment_method),
  'migration_backfill',
  'succeeded'::public.payment_txn_status,
  (o.amount_paid - o.advance_paid),
  false,
  'BACKFILL-DELIV-' || o.id::text,
  coalesce(o.delivered_at, o.placed_at, o.created_at),
  coalesce(o.delivered_at, o.placed_at, o.created_at),
  now()
FROM public.orders o
WHERE o.status = 'delivered'
  AND o.amount_paid > o.advance_paid
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
     WHERE p.order_id = o.id AND p.status = 'succeeded' AND p.is_advance = false
  )
ON CONFLICT DO NOTHING;

-- 7. Update courier snapshot helper to deduct advance_paid pre-delivery and amount_paid post-delivery
CREATE OR REPLACE FUNCTION public.build_order_courier_snapshot(p_order public.orders)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_cod numeric;
  v_effective_paid numeric;
BEGIN
  IF p_order.payment_status = 'paid' THEN
    v_cod := 0;
  ELSE
    v_effective_paid := CASE
      WHEN p_order.status = 'delivered' THEN COALESCE(p_order.amount_paid, 0)
      ELSE COALESCE(p_order.advance_paid, 0)
    END;
    v_cod := GREATEST(0, (COALESCE(p_order.grand_total, 0) - v_effective_paid));
  END IF;

  RETURN jsonb_build_object(
    'recipient_name', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'recipient_name'), ''), NULLIF(TRIM(p_order.customer_name), ''), ''),
    'phone', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'phone'), ''), NULLIF(TRIM(p_order.customer_phone), ''), ''),
    'alternative_phone', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'alternative_phone'), ''), ''),
    'address_line', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'address_line'), ''), ''),
    'district', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'district'), ''), ''),
    'division', COALESCE(NULLIF(TRIM(p_order.shipping_address->>'division'), ''), ''),
    'cod_amount', v_cod
  );
END;
$$;

-- 8. Update public.cancel_order() to guard against advance_paid > 0
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text default null)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_o     public.orders;
  v_staff boolean := coalesce(private.can_manage_orders(), false);
BEGIN
  SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND
     OR NOT (v_staff OR v_o.user_id = (SELECT auth.uid())
             OR (v_o.business_id IS NOT NULL AND private.is_business_member(v_o.business_id))) THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: no such order' USING errcode = 'P0001';
  END IF;
  IF NOT v_staff AND (v_o.status <> 'pending' OR v_o.amount_paid > 0 OR v_o.advance_paid > 0) THEN
    RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE: this order is already being processed or paid - please contact us' USING errcode = 'P0001';
  END IF;
  UPDATE public.orders
     SET status = 'cancelled', cancel_reason = left(nullif(trim(p_reason), ''), 500)
   WHERE id = p_order_id;
END;
$$;

-- 9. Update public.set_order_items() to guard against advance_paid > 0
CREATE OR REPLACE FUNCTION public.set_order_items(
  p_order_id        uuid,
  p_items           jsonb,
  p_price_overrides jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff     boolean := coalesce(private.can_manage_orders(), false);
  v_ord       public.orders;
  v_old_item  record;
  v_new_item  record;
  v_priced    jsonb;
  v_wh        uuid;
  v_track     boolean;
  v_backorder boolean;
  v_district  smallint;
BEGIN
  IF NOT v_staff THEN
    RAISE EXCEPTION 'FORBIDDEN: staff access required' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING errcode = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shipments WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_SHIPMENTS: cannot modify order lines after shipment' USING errcode = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments WHERE order_id = p_order_id AND status = 'succeeded')
     OR v_ord.amount_paid > 0
     OR v_ord.advance_paid > 0 THEN
    RAISE EXCEPTION 'ORDER_HAS_PAYMENTS: cannot modify order lines after payment has been recorded' USING errcode = 'P0001';
  END IF;

  IF v_ord.status IN ('shipped', 'delivered', 'cancelled', 'returned') THEN
    RAISE EXCEPTION 'ORDER_FINAL: order is % and cannot be edited', v_ord.status USING errcode = 'P0001';
  END IF;

  FOR v_old_item IN
    SELECT oi.variant_id, oi.warehouse_id, oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = p_order_id
  LOOP
    SELECT v.track_inventory INTO v_track
      FROM public.product_variants v
     WHERE v.id = v_old_item.variant_id;

    IF coalesce(v_track, false) THEN
      UPDATE public.inventory_levels
         SET reserved = greatest(reserved - v_old_item.quantity, 0),
             updated_at = now()
       WHERE variant_id = v_old_item.variant_id
         AND warehouse_id = v_old_item.warehouse_id;
    END IF;
  END LOOP;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    UPDATE public.orders
       SET subtotal = 0,
           discount_total = 0,
           shipping_total = 0,
           tax_total = 0,
           grand_total = 0,
           total_weight_kg = 0,
           updated_at = now()
     WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'item_count', 0, 'grand_total', 0);
  END IF;

  v_district := nullif(v_ord.shipping_address ->> 'district_id', '')::smallint;

  v_priced := private.price_cart(
    p_items,
    v_district,
    v_ord.shipping_method_id,
    v_ord.coupon_code,
    v_ord.user_id,
    v_ord.business_id,
    v_ord.customer_phone,
    p_price_overrides
  );

  SELECT w.id INTO v_wh FROM public.warehouses w WHERE w.is_default AND w.is_active;
  IF v_wh IS NULL THEN
    SELECT w.id INTO v_wh FROM public.warehouses w WHERE w.is_active LIMIT 1;
  END IF;

  FOR v_new_item IN
    SELECT x.variant_id, x.quantity
      FROM jsonb_to_recordset(v_priced -> 'items') AS x(variant_id uuid, quantity numeric)
  LOOP
    SELECT v.track_inventory, v.allow_backorder INTO v_track, v_backorder
      FROM public.product_variants v
     WHERE v.id = v_new_item.variant_id;

    IF coalesce(v_track, false) THEN
      UPDATE public.inventory_levels l
         SET reserved = l.reserved + v_new_item.quantity,
             updated_at = now()
       WHERE l.variant_id = v_new_item.variant_id
         AND l.warehouse_id = v_wh
         AND (v_backorder OR l.on_hand - l.reserved >= v_new_item.quantity);

      IF NOT FOUND THEN
        IF v_backorder THEN
          INSERT INTO public.inventory_levels AS l (variant_id, warehouse_id, reserved)
          VALUES (v_new_item.variant_id, v_wh, v_new_item.quantity)
          ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET reserved = l.reserved + excluded.reserved, updated_at = now();
        ELSE
          RAISE EXCEPTION 'OUT_OF_STOCK: not enough stock for variant %', v_new_item.variant_id USING errcode = 'P0001';
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.order_items (
    order_id, variant_id, product_id, warehouse_id, sku, product_name, variant_name,
    net_quantity, net_unit, quantity, unit_price, tax_rate, tax_amount, weight_grams
  )
  SELECT
    p_order_id, x.variant_id, x.product_id, v_wh, x.sku, x.product_name, x.variant_name,
    x.net_quantity, x.net_unit::public.uom, x.quantity, x.unit_price, x.tax_rate, x.tax_amount, x.weight_grams
  FROM jsonb_to_recordset(v_priced -> 'items') AS x(
    variant_id uuid, product_id uuid, sku text, product_name text, variant_name text,
    net_quantity numeric, net_unit text, quantity numeric, unit_price numeric,
    tax_rate numeric, tax_amount numeric, weight_grams integer
  );

  UPDATE public.orders
     SET subtotal        = (v_priced ->> 'subtotal')::numeric,
         discount_total  = (v_priced ->> 'discount_total')::numeric,
         shipping_total  = (v_priced ->> 'shipping_total')::numeric,
         tax_total       = (v_priced ->> 'tax_total')::numeric,
         grand_total     = (v_priced ->> 'grand_total')::numeric,
         total_weight_kg = (v_priced ->> 'total_weight_kg')::numeric,
         updated_at      = now()
   WHERE id = p_order_id;

  INSERT INTO public.order_events (order_id, event_type, to_value, message, actor_id)
  VALUES (
    p_order_id,
    'note_added',
    v_ord.status::text,
    'Order items updated by staff (new total: ৳' || (v_priced ->> 'grand_total') || ')',
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success',     true,
    'order_id',    p_order_id,
    'grand_total', (v_priced ->> 'grand_total')::numeric,
    'items',       v_priced -> 'items'
  );
END;
$$;

-- 10. Include advance_paid in private.order_to_json()
CREATE OR REPLACE FUNCTION private.order_to_json(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'payment_status', o.payment_status,
    'fulfillment_status', o.fulfillment_status, 'payment_method', o.payment_method, 'placed_at', o.placed_at,
    'currency', o.currency, 'subtotal', o.subtotal, 'discount_total', o.discount_total,
    'shipping_total', o.shipping_total, 'tax_total', o.tax_total, 'grand_total', o.grand_total,
    'advance_paid', o.advance_paid, 'amount_paid', o.amount_paid,
    'customer_name', o.customer_name, 'shipping_address', o.shipping_address, 'shipping_method', o.shipping_method_name,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'product_name', i.product_name, 'variant_name', i.variant_name, 'sku', i.sku, 'quantity', i.quantity,
                'unit_price', i.unit_price, 'line_total', i.line_total, 'shipped_quantity', i.shipped_quantity)
                ORDER BY i.created_at, i.id)
              FROM public.order_items i WHERE i.order_id = o.id), '[]'::jsonb),
    'shipments', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'status', s.status, 'carrier', s.carrier, 'tracking_number', s.tracking_number,
                'tracking_url', s.tracking_url, 'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at)
                ORDER BY s.created_at, s.id)
              FROM public.shipments s WHERE s.order_id = o.id), '[]'::jsonb),
    'timeline', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'event', e.event_type, 'to', e.to_value, 'message', e.message, 'at', e.created_at)
                ORDER BY e.created_at, e.id)
              FROM public.order_events e WHERE e.order_id = o.id), '[]'::jsonb))
  FROM public.orders o WHERE o.id = p_order_id
$$;

-- 11. Update public.admin_sales_daily view to sum delivered amount_paid + non-delivered advance_paid
CREATE OR REPLACE VIEW public.admin_sales_daily WITH (security_invoker = true) AS
SELECT (o.placed_at AT TIME ZONE 'Asia/Dhaka')::date AS day,
       count(*) AS orders,
       count(*) FILTER (WHERE o.status = 'cancelled') AS cancelled,
       sum(o.grand_total) FILTER (WHERE o.status NOT IN ('cancelled', 'returned')) AS revenue,
       sum(CASE WHEN o.status = 'delivered' THEN o.amount_paid ELSE o.advance_paid END) AS collected,
       round(avg(o.grand_total) FILTER (WHERE o.status NOT IN ('cancelled', 'returned')), 2) AS avg_order_value
  FROM public.orders o
 GROUP BY 1;

GRANT SELECT ON public.admin_sales_daily TO authenticated, service_role;

-- 12. Update public.place_order() credit terms outstanding check
CREATE OR REPLACE FUNCTION public.place_order(
  p_items              jsonb,
  p_customer           jsonb,
  p_shipping_address   jsonb,
  p_shipping_method_id uuid,
  p_payment_method     public.payment_method default 'cod',
  p_coupon_code        text default null,
  p_customer_note      text default null,
  p_business_id        uuid default null,
  p_billing_address    jsonb default null,
  p_attribution        jsonb default null,
  p_channel            text default 'web',
  p_for_user           uuid default null,
  p_quote_request_id   uuid default null,
  p_price_overrides    jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid    := (SELECT auth.uid());
  v_staff      boolean := coalesce(private.can_manage_orders(), false);
  v_customer   uuid;
  v_name       text;
  v_phone      text;
  v_email      text;
  v_district   smallint;
  v_dist_name  text;
  v_div_name   text;
  v_addr       jsonb;
  v_method     public.shipping_methods;
  v_priced     jsonb;
  v_total      numeric(14,2);
  v_wh         uuid;
  v_item       record;
  v_track      boolean;
  v_backorder  boolean;
  v_order      record;
  v_attr       jsonb;
  v_credit     numeric(14,2);
  v_terms      smallint;
  v_owed       numeric(14,2);
  v_due        date;
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL AND NOT v_staff
     AND coalesce((SELECT (s.value)::boolean FROM public.site_settings s WHERE s.key = 'checkout.guest_checkout_enabled'), true) = false THEN
    RAISE EXCEPTION 'LOGIN_REQUIRED: please sign in to place an order' USING errcode = 'P0001';
  END IF;
  IF NOT v_staff AND (p_channel <> 'web' OR p_for_user IS NOT NULL OR p_quote_request_id IS NOT NULL OR p_price_overrides IS NOT NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN: staff-only option' USING errcode = 'P0001';
  END IF;
  IF p_channel NOT IN ('web','phone','whatsapp','facebook','walk_in','admin') THEN
    RAISE EXCEPTION 'CHANNEL_INVALID: unknown sales channel' USING errcode = 'P0001';
  END IF;
  v_customer := CASE WHEN v_staff AND p_channel <> 'web' THEN p_for_user ELSE v_uid END;

  v_name  := nullif(trim(p_customer ->> 'name'), '');
  v_phone := private.normalize_phone(p_customer ->> 'phone');
  v_email := nullif(lower(trim(coalesce(p_customer ->> 'email', ''))), '');
  IF v_name IS NULL OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_INVALID: enter your name' USING errcode = 'P0001';
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'CUSTOMER_PHONE_INVALID: enter a valid mobile number' USING errcode = 'P0001';
  END IF;
  IF v_email IS NOT NULL AND v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'CUSTOMER_EMAIL_INVALID: enter a valid email address' USING errcode = 'P0001';
  END IF;

  IF p_shipping_method_id IS NULL THEN
    RAISE EXCEPTION 'SHIPPING_METHOD_INVALID: choose a delivery method' USING errcode = 'P0001';
  END IF;
  SELECT * INTO v_method FROM public.shipping_methods m WHERE m.id = p_shipping_method_id AND m.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIPPING_METHOD_INVALID: choose a delivery method' USING errcode = 'P0001';
  END IF;
  IF p_shipping_address IS NULL OR jsonb_typeof(p_shipping_address) <> 'object' THEN
    RAISE EXCEPTION 'ADDRESS_REQUIRED: enter the delivery address' USING errcode = 'P0001';
  END IF;
  v_district := nullif(p_shipping_address ->> 'district_id', '')::smallint;
  IF NOT v_method.is_pickup
     AND (v_district IS NULL OR nullif(trim(p_shipping_address ->> 'address_line'), '') IS NULL) THEN
    RAISE EXCEPTION 'ADDRESS_REQUIRED: district and address are required for delivery' USING errcode = 'P0001';
  END IF;
  IF v_district IS NOT NULL THEN
    SELECT g.name, d.name INTO v_dist_name, v_div_name
      FROM public.geo_districts g JOIN public.geo_divisions d ON d.id = g.division_id
     WHERE g.id = v_district;
    IF v_dist_name IS NULL THEN
      RAISE EXCEPTION 'ADDRESS_INVALID: unknown district' USING errcode = 'P0001';
    END IF;
  END IF;
  v_addr := jsonb_strip_nulls(jsonb_build_object(
    'recipient_name', coalesce(nullif(trim(p_shipping_address ->> 'recipient_name'), ''), v_name),
    'phone',          coalesce(private.normalize_phone(p_shipping_address ->> 'phone'), v_phone),
    'country_code',   'BD',
    'division',       v_div_name,
    'district_id',    v_district,
    'district',       v_dist_name,
    'upazila',        left(nullif(trim(p_shipping_address ->> 'upazila'), ''), 120),
    'address_line',   left(nullif(trim(p_shipping_address ->> 'address_line'), ''), 500),
    'postal_code',    left(nullif(trim(p_shipping_address ->> 'postal_code'), ''), 16),
    'landmark',       left(nullif(trim(p_shipping_address ->> 'landmark'), ''), 200)));

  IF p_business_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.business_accounts b
                      WHERE b.id = p_business_id AND b.status = 'approved'
                        AND (v_staff OR EXISTS (SELECT 1 FROM public.business_members m
                                                 WHERE m.business_id = b.id AND m.user_id = v_uid))) THEN
    RAISE EXCEPTION 'BUSINESS_NOT_ALLOWED: this business account cannot place orders' USING errcode = 'P0001';
  END IF;
  IF p_payment_method = 'credit_terms' AND p_business_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_NOT_ALLOWED: credit terms are for approved business accounts' USING errcode = 'P0001';
  END IF;
  IF p_payment_method = 'cash' AND NOT v_staff THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_NOT_ALLOWED: cash is for walk-in sales' USING errcode = 'P0001';
  END IF;
  IF p_payment_method = 'cod'
     AND coalesce((SELECT (s.value)::boolean FROM public.site_settings s WHERE s.key = 'checkout.cod_enabled'), true) = false THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_NOT_ALLOWED: cash on delivery is switched off' USING errcode = 'P0001';
  END IF;

  v_priced := private.price_cart(p_items, v_district, p_shipping_method_id, p_coupon_code, v_customer, p_business_id,
                                 v_phone, CASE WHEN v_staff THEN p_price_overrides END);
  v_total := (v_priced ->> 'grand_total')::numeric;

  IF p_payment_method = 'credit_terms' THEN
    SELECT b.credit_limit, b.payment_terms_days INTO v_credit, v_terms
      FROM public.business_accounts b WHERE b.id = p_business_id;
    SELECT coalesce(sum(o.grand_total - (CASE WHEN o.status = 'delivered' THEN o.amount_paid ELSE o.advance_paid END)), 0)
      INTO v_owed
      FROM public.orders o
     WHERE o.business_id = p_business_id AND o.status NOT IN ('cancelled','returned') AND o.payment_status <> 'paid';
    IF v_owed + v_total > v_credit THEN
      RAISE EXCEPTION 'CREDIT_LIMIT_EXCEEDED: this order would exceed the credit limit (outstanding %, limit %)', v_owed, v_credit
        USING errcode = 'P0001';
    END IF;
    v_due := current_date + v_terms;
  END IF;

  SELECT coalesce(jsonb_object_agg(k, to_jsonb(left(p_attribution ->> k, 500))), '{}'::jsonb) INTO v_attr
    FROM unnest(array['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                      'fbclid','fbp','fbc','gclid','referrer','landing_page']) AS k
   WHERE nullif(p_attribution ->> k, '') IS NOT NULL;

  SELECT w.id INTO v_wh FROM public.warehouses w WHERE w.is_default AND w.is_active;
  IF v_wh IS NULL THEN
    RAISE EXCEPTION 'NO_DEFAULT_WAREHOUSE: configure an active default warehouse' USING errcode = 'P0001';
  END IF;
  FOR v_item IN
    SELECT x.variant_id, x.quantity
      FROM jsonb_to_recordset(v_priced -> 'items') AS x(variant_id uuid, quantity numeric)
     ORDER BY x.variant_id
  LOOP
    SELECT v.track_inventory, v.allow_backorder INTO v_track, v_backorder
      FROM public.product_variants v WHERE v.id = v_item.variant_id;
    IF v_track THEN
      UPDATE public.inventory_levels l
         SET reserved = l.reserved + v_item.quantity, updated_at = now()
       WHERE l.variant_id = v_item.variant_id AND l.warehouse_id = v_wh
         AND (v_backorder OR l.on_hand - l.reserved >= v_item.quantity);
      IF NOT FOUND THEN
        IF v_backorder THEN
          INSERT INTO public.inventory_levels AS l (variant_id, warehouse_id, reserved)
          VALUES (v_item.variant_id, v_wh, v_item.quantity)
          ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET reserved = l.reserved + excluded.reserved, updated_at = now();
        ELSE
          RAISE EXCEPTION 'OUT_OF_STOCK: not enough stock for %',
            (SELECT v.sku FROM public.product_variants v WHERE v.id = v_item.variant_id) USING errcode = 'P0001';
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    user_id, business_id, quote_request_id, channel, payment_method,
    customer_name, customer_phone, customer_email, shipping_address, billing_address,
    shipping_method_id, shipping_method_name, coupon_code,
    subtotal, discount_total, shipping_total, tax_total, grand_total, total_weight_kg,
    customer_note, attribution, payment_due_date)
  VALUES (
    v_customer, p_business_id, p_quote_request_id, p_channel, p_payment_method,
    v_name, v_phone, v_email, v_addr, CASE WHEN jsonb_typeof(p_billing_address) = 'object' THEN p_billing_address END,
    v_method.id, v_method.name, v_priced ->> 'coupon_code',
    (v_priced ->> 'subtotal')::numeric, (v_priced ->> 'discount_total')::numeric, (v_priced ->> 'shipping_total')::numeric,
    (v_priced ->> 'tax_total')::numeric, v_total, (v_priced ->> 'total_weight_kg')::numeric,
    left(nullif(trim(p_customer_note), ''), 2000), v_attr, v_due)
  RETURNING id, order_number, public_token INTO v_order;

  INSERT INTO public.order_items (order_id, variant_id, product_id, warehouse_id, sku, product_name, variant_name,
                                  net_quantity, net_unit, quantity, unit_price, tax_rate, tax_amount, weight_grams)
  SELECT v_order.id, x.variant_id, x.product_id, v_wh, x.sku, x.product_name, x.variant_name,
         x.net_quantity, x.net_unit::public.uom, x.quantity, x.unit_price, x.tax_rate, x.tax_amount, x.weight_grams
    FROM jsonb_to_recordset(v_priced -> 'items') AS x(
           variant_id uuid, product_id uuid, sku text, product_name text, variant_name text,
           net_quantity numeric, net_unit text, quantity numeric, unit_price numeric,
           tax_rate numeric, tax_amount numeric, weight_grams integer);

  IF (v_priced ->> 'coupon_id') IS NOT NULL THEN
    UPDATE public.coupons SET used_count = used_count + 1
     WHERE id = (v_priced ->> 'coupon_id')::uuid
       AND (usage_limit_total IS NULL OR used_count < usage_limit_total);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'COUPON_INVALID: this code has just reached its usage limit' USING errcode = 'P0001';
    END IF;
    INSERT INTO public.coupon_redemptions (coupon_id, order_id, user_id, customer_phone, discount_amount)
    VALUES ((v_priced ->> 'coupon_id')::uuid, v_order.id, v_customer, v_phone, (v_priced ->> 'discount_total')::numeric);
  END IF;

  IF p_payment_method IN ('bkash','nagad','rocket','card','bank_transfer') AND v_total > 0 THEN
    INSERT INTO public.payments (order_id, kind, method, provider, status, amount, is_advance)
    VALUES (v_order.id, 'charge', p_payment_method, p_payment_method::text, 'initiated', v_total, true)
    RETURNING id INTO v_payment_id;
  END IF;

  IF p_quote_request_id IS NOT NULL THEN
    UPDATE public.quote_requests SET status = 'converted' WHERE id = p_quote_request_id;
  END IF;

  INSERT INTO public.order_events (order_id, event_type, to_value, message, actor_id)
  VALUES (v_order.id, 'placed', 'pending', 'Order placed', v_uid);

  INSERT INTO public.notification_outbox (channel, recipient, template, payload)
  VALUES ('sms', v_phone, 'order_placed',
          jsonb_build_object('order_number', v_order.order_number, 'grand_total', v_total, 'payment_method', p_payment_method));
  IF v_email IS NOT NULL THEN
    INSERT INTO public.notification_outbox (channel, recipient, template, payload)
    VALUES ('email', v_email, 'order_placed',
            jsonb_build_object('order_number', v_order.order_number, 'grand_total', v_total, 'public_token', v_order.public_token));
  END IF;

  RETURN jsonb_build_object(
    'order_id',                v_order.id,
    'order_number',            v_order.order_number,
    'public_token',            v_order.public_token,
    'grand_total',             v_total,
    'currency',                'BDT',
    'payment_method',          p_payment_method,
    'payment_id',              v_payment_id,
    'requires_online_payment', v_payment_id IS NOT NULL);
END;
$$;

-- 13. Update public.create_admin_order() to record advance_paid & sync payments
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
  v_db_status              text;
  v_payment_status         text;
  v_payment_method         text;
  v_advance_paid           numeric(12,2) := 0;
  v_raw_amount_paid        numeric(12,2) := 0;
  v_amount_paid            numeric(12,2) := 0;
  v_effective_paid         numeric(12,2) := 0;
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

  v_var_rec                record;
  v_is_combo               boolean := false;
  v_combo_comps            jsonb := '[]'::jsonb;
BEGIN
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

  v_channel := coalesce(nullif(trim(p_payload->>'channel'), ''), 'phone');
  IF v_channel NOT IN ('web', 'phone', 'whatsapp', 'admin', 'facebook', 'walk_in') THEN
    v_channel := 'phone';
  END IF;

  v_status := coalesce(nullif(trim(p_payload->>'status'), ''), 'confirmed');
  IF v_status NOT IN ('incomplete_order', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'partially_delivered', 'cancelled', 'returned') THEN
    v_status := 'confirmed';
  END IF;
  v_db_status := CASE WHEN v_status = 'partially_delivered' THEN 'delivered' ELSE v_status END;

  v_payment_status := coalesce(nullif(trim(p_payload->>'payment_status'), ''), 'unpaid');
  v_payment_method := coalesce(nullif(trim(p_payload->>'payment_method'), ''), 'cod');
  v_advance_paid := greatest(0, coalesce((p_payload->>'advance_paid')::numeric, 0));
  v_raw_amount_paid := greatest(0, coalesce((p_payload->>'amount_paid')::numeric, 0));

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

  v_courier_name := nullif(trim(p_payload->>'courier_name'), '');
  IF v_courier_name IS NOT NULL AND lower(v_courier_name) IN (
    'courier delivery', 'courier', 'courier service', 'home delivery',
    'standard delivery', 'delivery', 'inside dhaka home delivery',
    'outside dhaka delivery', 'কুরিয়ার ডেলিভারি'
  ) THEN
    v_courier_name := NULL;
  END IF;

  v_division := nullif(trim(p_payload->>'division'), '');
  v_district := nullif(trim(p_payload->>'district'), '');
  v_address_line := nullif(trim(p_payload->>'address_line'), '');
  v_customer_email := nullif(trim(p_payload->>'customer_email'), '');
  v_alt_phone := nullif(trim(p_payload->>'customer_alternative_phone'), '');
  v_recipient_name := nullif(trim(p_payload->>'shipping_recipient_name'), '');
  v_shipping_phone := nullif(trim(p_payload->>'shipping_phone'), '');

  v_customer_note := nullif(trim(coalesce(p_payload->>'customer_note', '')), '');
  v_staff_note := nullif(trim(p_payload->>'staff_note'), '');
  v_delivery_note := nullif(trim(p_payload->>'delivery_note'), '');
  v_packaging_note := nullif(trim(p_payload->>'packaging_note'), '');

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
    v_var_rec := NULL;

    IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~ '^[0-9a-f-]{36}$' THEN
      v_var_uuid := v_candidate_var_id::uuid;
      SELECT pv.id, pv.product_id, pv.name AS variant_name, pv.sku, pv.price, pv.weight_grams,
             p.name AS product_name, coalesce(pv.is_combo, false) AS is_combo
        INTO v_var_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE pv.id = v_var_uuid;
    ELSIF v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~ '^[0-9a-f-]{36}$' THEN
      v_prod_uuid := v_candidate_prod_id::uuid;
      SELECT pv.id, pv.product_id, pv.name AS variant_name, pv.sku, pv.price, pv.weight_grams,
             p.name AS product_name, coalesce(pv.is_combo, false) AS is_combo
        INTO v_var_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE p.id = v_prod_uuid
       ORDER BY pv.is_default DESC NULLS LAST, pv.sort_order ASC, pv.price ASC
       LIMIT 1;
    END IF;

    IF v_var_rec.id IS NOT NULL THEN
      IF v_unit_price <= 0 THEN
        v_unit_price := coalesce(v_var_rec.price, 0);
      END IF;
      v_is_combo := coalesce(v_var_rec.is_combo, false);
      v_subtotal := v_subtotal + (v_unit_price * v_qty);
      v_total_weight_grams := v_total_weight_grams + (coalesce(nullif(v_var_rec.weight_grams, 0), 1000) * v_qty);

      IF v_is_combo THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'component_variant_id', ci.component_variant_id,
                 'quantity', ci.quantity,
                 'component_name', p.name || ' (' || coalesce(pv.name, 'Standard') || ')',
                 'component_sku', pv.sku,
                 'weight_grams', coalesce(pv.weight_grams, 0)
               )), '[]'::jsonb)
          INTO v_combo_comps
          FROM public.combo_items ci
          JOIN public.product_variants pv ON pv.id = ci.component_variant_id
          JOIN public.products p ON p.id = pv.product_id
         WHERE ci.combo_variant_id = v_var_rec.id;
      END IF;

      v_resolved_items := v_resolved_items || jsonb_build_object(
        'product_id', v_var_rec.product_id,
        'variant_id', v_var_rec.id,
        'product_name', v_var_rec.product_name,
        'variant_name', coalesce(v_var_rec.variant_name, 'Standard'),
        'sku', coalesce(v_var_rec.sku, 'MOL-VAR'),
        'quantity', v_qty,
        'unit_price', v_unit_price,
        'weight_grams', coalesce(nullif(v_var_rec.weight_grams, 0), 1000),
        'is_combo', v_is_combo,
        'combo_components', v_combo_comps
      );
    ELSE
      RAISE EXCEPTION 'INVALID_PRODUCT: Product or variant does not exist in catalog'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_grand_total := greatest(0, (v_subtotal - v_discount_total + v_shipping_total));
  v_total_weight_kg := greatest(0.5, round((v_total_weight_grams::numeric / 1000.0), 2));

  -- Normalize advance_paid and amount_paid based on delivery status
  IF v_db_status = 'delivered' THEN
    IF v_raw_amount_paid > 0 THEN
      v_amount_paid := v_raw_amount_paid;
    ELSIF v_status = 'delivered' AND v_payment_status = 'paid' THEN
      v_amount_paid := v_grand_total;
    ELSE
      v_amount_paid := v_advance_paid;
    END IF;
    v_effective_paid := v_amount_paid;
  ELSE
    IF v_advance_paid = 0 AND v_raw_amount_paid > 0 THEN
      v_advance_paid := v_raw_amount_paid;
    END IF;
    v_amount_paid := 0;
    v_effective_paid := v_advance_paid;
  END IF;

  IF v_effective_paid > 0 AND v_effective_paid >= v_grand_total AND v_grand_total > 0 THEN
    v_payment_status := 'paid';
  ELSIF v_effective_paid > 0 THEN
    v_payment_status := 'partially_paid';
  ELSIF v_payment_status = 'paid' AND v_db_status = 'delivered' AND v_grand_total > 0 THEN
    v_amount_paid := v_grand_total;
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE phone = v_clean_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (phone, full_name, email, total_orders)
    VALUES (v_clean_phone, v_customer_name, v_customer_email, 1)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
       SET full_name = coalesce(nullif(v_customer_name, ''), full_name),
           email = coalesce(v_customer_email, email),
           total_orders = total_orders + 1,
           last_order_at = now()
     WHERE id = v_customer_id;
  END IF;

  v_shipping_address := jsonb_build_object(
    'division', coalesce(v_division, ''),
    'district', coalesce(v_district, ''),
    'address_line', coalesce(v_address_line, ''),
    'recipient_name', coalesce(v_recipient_name, v_customer_name),
    'phone', coalesce(v_shipping_phone, v_clean_phone),
    'alternative_phone', coalesce(v_alt_phone, '')
  );

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
    advance_paid,
    amount_paid,
    delivered_at,
    currency,
    total_weight_kg,
    customer_note,
    attribution
  ) VALUES (
    v_db_status::public.order_status,
    v_payment_status::public.payment_status,
    v_payment_method::public.payment_method,
    v_channel,
    CASE WHEN v_status = 'delivered' THEN 'fulfilled'::public.fulfillment_status ELSE 'unfulfilled'::public.fulfillment_status END,
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
    v_advance_paid,
    v_amount_paid,
    CASE WHEN v_db_status = 'delivered' THEN now() ELSE NULL END,
    'BDT',
    v_total_weight_kg,
    v_customer_note,
    coalesce(p_payload->'attribution', '{}'::jsonb)
  )
  RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;

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
      (v_item->>'weight_grams')::int,
      coalesce((v_item->>'is_combo')::boolean, false),
      coalesce(v_item->'combo_components', '[]'::jsonb)
    );
  END LOOP;

  -- Record advance & post-delivery payments into ledger
  IF v_advance_paid > 0 THEN
    INSERT INTO public.payments (order_id, kind, method, provider, status, amount, is_advance, paid_at)
    VALUES (v_order_id, 'charge', v_payment_method::public.payment_method, 'manual', 'succeeded', v_advance_paid, true, now());
  END IF;

  IF v_db_status = 'delivered' AND v_amount_paid > v_advance_paid THEN
    INSERT INTO public.payments (order_id, kind, method, provider, status, amount, is_advance, paid_at)
    VALUES (v_order_id, 'charge', v_payment_method::public.payment_method, 'manual', 'succeeded', (v_amount_paid - v_advance_paid), false, now());
  END IF;

  IF v_staff_note IS NOT NULL AND length(v_staff_note) > 0 THEN
    INSERT INTO public.order_notes (order_id, order_number, note, type, author)
    VALUES (v_order_id, v_order_number, v_staff_note, 'internal', 'Staff');
  END IF;
  IF v_delivery_note IS NOT NULL AND length(v_delivery_note) > 0 THEN
    INSERT INTO public.order_notes (order_id, order_number, note, type, author)
    VALUES (v_order_id, v_order_number, v_delivery_note, 'delivery', 'Staff');
  END IF;
  IF v_packaging_note IS NOT NULL AND length(v_packaging_note) > 0 THEN
    INSERT INTO public.order_notes (order_id, order_number, note, type, author)
    VALUES (v_order_id, v_order_number, v_packaging_note, 'packaging', 'Staff');
  END IF;

  IF v_db_status IN ('confirmed', 'processing', 'shipped') THEN
    PERFORM private.reserve_order_stock(v_order_id);
  END IF;

  INSERT INTO public.order_events (order_id, event_type, message, actor_id)
  VALUES (
    v_order_id,
    'created',
    'Manual order created by staff (' || upper(v_channel) || ')' || coalesce(' via ' || v_courier_name, ''),
    v_caller_uid
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_token', v_public_token,
    'status', v_db_status,
    'channel', v_channel,
    'subtotal', v_subtotal,
    'shipping_total', v_shipping_total,
    'discount_total', v_discount_total,
    'grand_total', v_grand_total,
    'advance_paid', v_advance_paid,
    'amount_paid', v_amount_paid,
    'total_weight_kg', v_total_weight_kg,
    'item_count', jsonb_array_length(v_resolved_items)
  );
END;
$$;

COMMIT;
