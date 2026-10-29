-- =============================================================================
-- Migration: Enforce Order Items Before Moving to Confirmed or Higher
-- Prevents updating order status to confirmed, processing, shipped, or delivered
-- unless at least one line item exists in public.order_items.
-- =============================================================================

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

    -- Enforce customer details and order items before moving to confirmed or higher
    IF array_position(v_flow, new.status::text) >= array_position(v_flow, 'confirmed'::text) THEN
      -- Require at least one order line item
      IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = new.id) THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: at least one order item is required before confirming order' USING errcode = 'P0001';
      END IF;

      -- Require customer name
      IF new.customer_name IS NULL OR char_length(trim(new.customer_name)) < 1 THEN
        RAISE EXCEPTION 'CUSTOMER_NAME_REQUIRED: customer name is required before confirming order' USING errcode = 'P0001';
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
