-- =============================================================================
-- Migration: Supplier Purchases & Cash Payments Ledger
-- Timestamp: 20261112000001
--
-- Extends public.suppliers with supplier_type and opening_balance, and adds:
--   - public.supplier_purchases       (deliveries/purchases without formal bills)
--   - public.supplier_purchase_items  (1+ catalog or custom product lines)
--   - public.supplier_payments        (cash-first payouts, advances, partial pays)
--   - public.supplier_balances        (security_invoker view for running balances)
-- Restricted via RLS strictly to owner, admin, and manager (private.is_manager()).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. EXTEND public.suppliers
-- -----------------------------------------------------------------------------
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_type text NOT NULL DEFAULT 'gachi'
    CHECK (supplier_type IN ('gachi', 'mill', 'packaging', 'trader', 'other')),
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 2. NUMBER SEQUENCES
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS private.supplier_purchase_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS private.supplier_payment_seq  START 1001;

-- -----------------------------------------------------------------------------
-- 3. TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE public.supplier_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number text NOT NULL UNIQUE,
  supplier_id     uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  purchase_date   date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  subtotal        numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  extra_charges   numeric(14,2) NOT NULL DEFAULT 0 CHECK (extra_charges >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount    numeric(14,2) GENERATED ALWAYS AS (greatest(subtotal + extra_charges - discount_amount, 0)) STORED,
  notes           text CHECK (char_length(notes) <= 2000),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  void_reason     text CHECK (char_length(void_reason) <= 500),
  voided_at       timestamptz,
  voided_by       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by      uuid DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'active' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL))
);

CREATE INDEX supplier_purchases_supplier_date_idx
  ON public.supplier_purchases (supplier_id, purchase_date DESC, created_at DESC);
CREATE INDEX supplier_purchases_status_date_idx
  ON public.supplier_purchases (status, purchase_date DESC);

CREATE TABLE public.supplier_purchase_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id       uuid NOT NULL REFERENCES public.supplier_purchases (id) ON DELETE CASCADE,
  product_id        uuid REFERENCES public.products (id) ON DELETE SET NULL,
  variant_id        uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  item_name         text NOT NULL CHECK (char_length(trim(item_name)) BETWEEN 1 AND 200),
  quantity          numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit              text NOT NULL DEFAULT 'kg' CHECK (char_length(trim(unit)) BETWEEN 1 AND 24),
  unit_price        numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total        numeric(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
  stock_movement_id bigint REFERENCES public.stock_movements (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_purchase_items_purchase_idx
  ON public.supplier_purchase_items (purchase_id);
CREATE INDEX supplier_purchase_items_variant_idx
  ON public.supplier_purchase_items (variant_id) WHERE variant_id IS NOT NULL;

CREATE TABLE public.supplier_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL UNIQUE,
  supplier_id    uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  purchase_id    uuid REFERENCES public.supplier_purchases (id) ON DELETE SET NULL,
  payment_date   date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  paid_by        text CHECK (char_length(paid_by) <= 120),
  reference      text CHECK (char_length(reference) <= 120),
  notes          text CHECK (char_length(notes) <= 2000),
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  void_reason    text CHECK (char_length(void_reason) <= 500),
  voided_at      timestamptz,
  voided_by      uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by     uuid DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'active' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL))
);

CREATE INDEX supplier_payments_supplier_date_idx
  ON public.supplier_payments (supplier_id, payment_date DESC, created_at DESC);
CREATE INDEX supplier_payments_purchase_idx
  ON public.supplier_payments (purchase_id) WHERE purchase_id IS NOT NULL;
CREATE INDEX supplier_payments_status_date_idx
  ON public.supplier_payments (status, payment_date DESC);

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS (numbering, subtotal sync, updated_at, audit_log)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.supplier_purchases_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.purchase_number IS NULL OR trim(new.purchase_number) = '' THEN
    new.purchase_number := private.next_number('PUR', 'private.supplier_purchase_seq'::regclass);
  END IF;
  RETURN new;
END $$;

CREATE TRIGGER trg_supplier_purchases_number
  BEFORE INSERT ON public.supplier_purchases
  FOR EACH ROW EXECUTE FUNCTION private.supplier_purchases_before_insert();

CREATE OR REPLACE FUNCTION private.supplier_payments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.payment_number IS NULL OR trim(new.payment_number) = '' THEN
    new.payment_number := private.next_number('PAY', 'private.supplier_payment_seq'::regclass);
  END IF;
  RETURN new;
END $$;

CREATE TRIGGER trg_supplier_payments_number
  BEFORE INSERT ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION private.supplier_payments_before_insert();

CREATE OR REPLACE FUNCTION private.sync_supplier_purchase_subtotal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase_id uuid;
BEGIN
  v_purchase_id := CASE WHEN tg_op = 'DELETE' THEN old.purchase_id ELSE new.purchase_id END;
  UPDATE public.supplier_purchases p
     SET subtotal = coalesce((
       SELECT round(sum(i.line_total), 2)
         FROM public.supplier_purchase_items i
        WHERE i.purchase_id = v_purchase_id
     ), 0)
   WHERE p.id = v_purchase_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_supplier_purchase_items_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_purchase_items
  FOR EACH ROW EXECUTE FUNCTION private.sync_supplier_purchase_subtotal();

CREATE TRIGGER trg_supplier_purchases_updated_at
  BEFORE UPDATE ON public.supplier_purchases
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER trg_supplier_payments_updated_at
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER trg_suppliers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER trg_supplier_purchases_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_purchases
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER trg_supplier_purchase_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_purchase_items
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

CREATE TRIGGER trg_supplier_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

-- -----------------------------------------------------------------------------
-- 5. BALANCES VIEW (security_invoker = true so RLS on child tables applies)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.supplier_balances
WITH (security_invoker = true) AS
SELECT
  s.id AS supplier_id,
  s.opening_balance,
  coalesce(pu.total_purchased, 0)::numeric(14,2) AS total_purchased,
  coalesce(pa.total_paid, 0)::numeric(14,2) AS total_paid,
  (s.opening_balance + coalesce(pu.total_purchased, 0) - coalesce(pa.total_paid, 0))::numeric(14,2) AS net_balance,
  coalesce(pu.purchase_count, 0)::integer AS purchase_count,
  coalesce(pa.payment_count, 0)::integer AS payment_count,
  GREATEST(pu.last_purchase_date, pa.last_payment_date) AS last_activity_date
FROM public.suppliers s
LEFT JOIN (
  SELECT
    supplier_id,
    sum(total_amount) AS total_purchased,
    count(*) AS purchase_count,
    max(purchase_date) AS last_purchase_date
  FROM public.supplier_purchases
  WHERE status = 'active'
  GROUP BY supplier_id
) pu ON pu.supplier_id = s.id
LEFT JOIN (
  SELECT
    supplier_id,
    sum(amount) AS total_paid,
    count(*) AS payment_count,
    max(payment_date) AS last_payment_date
  FROM public.supplier_payments
  WHERE status = 'active'
  GROUP BY supplier_id
) pa ON pa.supplier_id = s.id;

-- -----------------------------------------------------------------------------
-- 6. SECURITY: PRIVILEGES & RLS (manager / admin / owner only)
-- -----------------------------------------------------------------------------
ALTER TABLE public.supplier_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.supplier_purchases, public.supplier_purchase_items, public.supplier_payments, public.supplier_balances
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_purchases, public.supplier_purchase_items, public.supplier_payments
  TO authenticated;
GRANT SELECT ON public.supplier_balances TO authenticated;

GRANT ALL ON public.supplier_purchases, public.supplier_purchase_items, public.supplier_payments, public.supplier_balances
  TO service_role;

CREATE POLICY supplier_purchases_manager ON public.supplier_purchases
  FOR ALL TO authenticated
  USING ((SELECT private.is_manager()))
  WITH CHECK ((SELECT private.is_manager()));

CREATE POLICY supplier_purchase_items_manager ON public.supplier_purchase_items
  FOR ALL TO authenticated
  USING ((SELECT private.is_manager()))
  WITH CHECK ((SELECT private.is_manager()));

CREATE POLICY supplier_payments_manager ON public.supplier_payments
  FOR ALL TO authenticated
  USING ((SELECT private.is_manager()))
  WITH CHECK ((SELECT private.is_manager()));

COMMIT;
