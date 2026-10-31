-- Migration: Add customer_alternative_phone to public.orders
-- Allows capturing and verifying secondary/alternative contact numbers for deliveries and tracking.

-- 1. Add customer_alternative_phone column to public.orders (nullable)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_alternative_phone text;

-- 2. Add check constraint (must be null or valid E.164 phone)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_alternative_phone_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_alternative_phone_check
  CHECK (customer_alternative_phone IS NULL OR customer_alternative_phone ~ '^\+[1-9][0-9]{7,14}$');

-- 3. Create index for fast phone search & lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_alt_phone
  ON public.orders (customer_alternative_phone);

-- 4. Create trigger to normalize customer_alternative_phone to E.164 on insert/update
DROP TRIGGER IF EXISTS trg_orders_alt_phone ON public.orders;
CREATE TRIGGER trg_orders_alt_phone
  BEFORE INSERT OR UPDATE OF customer_alternative_phone ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.normalize_phone_trigger('customer_alternative_phone');

-- 5. Update track_order RPC to allow matching by either primary customer_phone OR customer_alternative_phone
CREATE OR REPLACE FUNCTION public.track_order(p_order_number text, p_phone text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_normalized text;
BEGIN
  v_normalized := private.normalize_phone(p_phone);
  SELECT o.id INTO v_id FROM public.orders o
   WHERE o.order_number = upper(trim(p_order_number))
     AND (
       (o.customer_phone IS NOT NULL AND o.customer_phone = v_normalized)
       OR (o.customer_alternative_phone IS NOT NULL AND o.customer_alternative_phone = v_normalized)
     );

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: check the order number and phone number' USING errcode = 'P0001';
  END IF;

  RETURN private.order_to_json(v_id);
END $$;

GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated, service_role;

