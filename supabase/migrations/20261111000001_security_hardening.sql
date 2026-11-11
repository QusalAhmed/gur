-- =============================================================================
-- Migration: Comprehensive Database Security Hardening (Phase 2 Step 6)
-- Timestamp: 20261111000001
--
-- Remediates live audit findings across all 49 public tables, 6 public views,
-- storage policies, and SQL functions:
--   1. Eliminates all overly permissive (`USING (true)` / `WITH CHECK (true)`)
--      and anonymous/public write or PII-read RLS policies introduced after the
--      baseline security migration.
--   2. Resets table, sequence, and view privileges from zero (`REVOKE ALL`) and
--      grants strictly minimal privileges per role (`anon`, `authenticated`,
--      `service_role`), locking down `admin_*`, `notes`, `orders`, `order_items`,
--      `order_events`, `order_notes`, `order_stock_reservations`, `staff_notes`,
--      `notifications`, `customer_delivery_reports`, `storefront_inquiries`,
--      `sms_logs`, `outbox_events`, and `courier_webhook_logs`.
--   3. Pins `SET search_path = ''` on all functions missing an empty search_path
--      and adds internal authorization checks to privileged `SECURITY DEFINER`
--      routines (`reorder_products`, `set_product_sort_order`,
--      `cleanup_old_notifications`), plus returns `public_token` from
--      `process_storefront_order` only on newly created / ownership-verified
--      orders while keeping `pending_order_exists` responses PII/token-free.
--   4. Revokes `EXECUTE` on sensitive/server-only RPCs and `private.*` helpers
--      from `PUBLIC` and `anon`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENSURE RLS IS ENABLED ON ALL PUBLIC TABLES
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ALIGN private.can_manage_orders() WITH OTHER ROLE HELPERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_manage_orders()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    coalesce(private.current_staff_role() IN ('owner', 'admin', 'manager', 'support'), false)
    OR current_user IN ('postgres', 'service_role')
    OR coalesce((SELECT auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. DROP PERMISSIVE / INSECURE POLICIES & RESTORE LEAST-PRIVILEGE RLS
-- -----------------------------------------------------------------------------

-- 3A. Catalog: categories, products, product_variants, product_images, combo_items
DROP POLICY IF EXISTS categories_select_all ON public.categories;
DROP POLICY IF EXISTS categories_insert_all ON public.categories;
DROP POLICY IF EXISTS categories_update_all ON public.categories;
DROP POLICY IF EXISTS categories_delete_all ON public.categories;
DROP POLICY IF EXISTS categories_read ON public.categories;
DROP POLICY IF EXISTS categories_write ON public.categories;

CREATE POLICY categories_read ON public.categories
  FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY categories_write ON public.categories
  FOR ALL TO authenticated
  USING ((SELECT private.can_manage_content()))
  WITH CHECK ((SELECT private.can_manage_content()));

DROP POLICY IF EXISTS products_select_all ON public.products;
DROP POLICY IF EXISTS products_insert_all ON public.products;
DROP POLICY IF EXISTS products_update_all ON public.products;
DROP POLICY IF EXISTS products_delete_all ON public.products;
DROP POLICY IF EXISTS products_read ON public.products;
DROP POLICY IF EXISTS products_write ON public.products;

CREATE POLICY products_read ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY products_write ON public.products
  FOR ALL TO authenticated
  USING ((SELECT private.can_manage_content()))
  WITH CHECK ((SELECT private.can_manage_content()));

DROP POLICY IF EXISTS product_variants_select_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_insert_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_update_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_delete_all ON public.product_variants;
DROP POLICY IF EXISTS product_variants_read ON public.product_variants;
DROP POLICY IF EXISTS product_variants_write ON public.product_variants;

CREATE POLICY product_variants_read ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_variants.product_id AND p.status = 'active'
    )
  );

CREATE POLICY product_variants_write ON public.product_variants
  FOR ALL TO authenticated
  USING ((SELECT private.is_manager()))
  WITH CHECK ((SELECT private.is_manager()));

DROP POLICY IF EXISTS product_images_select_all ON public.product_images;
DROP POLICY IF EXISTS product_images_insert_all ON public.product_images;
DROP POLICY IF EXISTS product_images_update_all ON public.product_images;
DROP POLICY IF EXISTS product_images_delete_all ON public.product_images;
DROP POLICY IF EXISTS product_images_read ON public.product_images;
DROP POLICY IF EXISTS product_images_write ON public.product_images;

CREATE POLICY product_images_read ON public.product_images
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.id = product_images.product_id AND p.status = 'active'
    )
  );

CREATE POLICY product_images_write ON public.product_images
  FOR ALL TO authenticated
  USING ((SELECT private.can_manage_content()))
  WITH CHECK ((SELECT private.can_manage_content()));

DROP POLICY IF EXISTS combo_items_select_all ON public.combo_items;
DROP POLICY IF EXISTS combo_items_select_active ON public.combo_items;
DROP POLICY IF EXISTS combo_items_select_staff ON public.combo_items;
DROP POLICY IF EXISTS combo_items_insert_admin ON public.combo_items;
DROP POLICY IF EXISTS combo_items_update_admin ON public.combo_items;
DROP POLICY IF EXISTS combo_items_delete_admin ON public.combo_items;

CREATE POLICY combo_items_select_active ON public.combo_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.product_variants cv
        JOIN public.products cp ON cp.id = cv.product_id
       WHERE cv.id = combo_items.combo_variant_id
         AND cv.is_active
         AND cp.status = 'active'
    )
  );

CREATE POLICY combo_items_select_staff ON public.combo_items
  FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));

CREATE POLICY combo_items_insert_admin ON public.combo_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_content()) OR (SELECT private.is_admin()));

CREATE POLICY combo_items_update_admin ON public.combo_items
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_content()) OR (SELECT private.is_admin()))
  WITH CHECK ((SELECT private.can_manage_content()) OR (SELECT private.is_admin()));

CREATE POLICY combo_items_delete_admin ON public.combo_items
  FOR DELETE TO authenticated
  USING ((SELECT private.can_manage_content()) OR (SELECT private.is_admin()));

-- 3B. Orders & child tables (strictly owner / business member / order staff; anon has zero access)
DROP POLICY IF EXISTS orders_select_all ON public.orders;
DROP POLICY IF EXISTS orders_insert_all ON public.orders;
DROP POLICY IF EXISTS orders_insert_draft ON public.orders;
DROP POLICY IF EXISTS orders_update_all ON public.orders;
DROP POLICY IF EXISTS orders_delete_all ON public.orders;
DROP POLICY IF EXISTS orders_update_draft ON public.orders;
DROP POLICY IF EXISTS orders_select_staff ON public.orders;
DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_update_staff ON public.orders;

CREATE POLICY orders_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (business_id IS NOT NULL AND (SELECT private.is_business_member(business_id)))
    OR (SELECT private.can_manage_orders())
  );

CREATE POLICY orders_update_staff ON public.orders
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_orders()))
  WITH CHECK ((SELECT private.can_manage_orders()));

DROP POLICY IF EXISTS order_items_select_all ON public.order_items;
DROP POLICY IF EXISTS order_items_insert_all ON public.order_items;
DROP POLICY IF EXISTS order_items_update_all ON public.order_items;
DROP POLICY IF EXISTS order_items_delete_all ON public.order_items;
DROP POLICY IF EXISTS order_items_select ON public.order_items;

CREATE POLICY order_items_select ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    )
  );

DROP POLICY IF EXISTS order_events_select_all ON public.order_events;
DROP POLICY IF EXISTS order_events_insert_all ON public.order_events;
DROP POLICY IF EXISTS order_events_select ON public.order_events;
DROP POLICY IF EXISTS order_events_insert ON public.order_events;

CREATE POLICY order_events_select ON public.order_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id
    )
  );

CREATE POLICY order_events_insert ON public.order_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_orders()));

DROP POLICY IF EXISTS order_notes_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_select_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_insert_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_update_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_delete_all ON public.order_notes;
DROP POLICY IF EXISTS order_notes_select ON public.order_notes;
DROP POLICY IF EXISTS order_notes_insert ON public.order_notes;
DROP POLICY IF EXISTS order_notes_update ON public.order_notes;
DROP POLICY IF EXISTS order_notes_delete ON public.order_notes;

CREATE POLICY order_notes_select ON public.order_notes
  FOR SELECT TO authenticated
  USING ((SELECT private.can_manage_orders()));

CREATE POLICY order_notes_insert ON public.order_notes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_manage_orders()));

CREATE POLICY order_notes_update ON public.order_notes
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_orders()))
  WITH CHECK ((SELECT private.can_manage_orders()));

CREATE POLICY order_notes_delete ON public.order_notes
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- 3C. Back-office notes & alerts
DROP POLICY IF EXISTS staff_notes_all ON public.staff_notes;

DROP POLICY IF EXISTS notifications_select_all ON public.notifications;
DROP POLICY IF EXISTS notifications_staff_select ON public.notifications;
DROP POLICY IF EXISTS notifications_staff_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_staff_update ON public.notifications;
DROP POLICY IF EXISTS notifications_staff_delete ON public.notifications;

CREATE POLICY notifications_staff_select ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT private.is_staff()));

CREATE POLICY notifications_staff_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()));

CREATE POLICY notifications_staff_update ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_staff()))
  WITH CHECK ((SELECT private.is_staff()));

CREATE POLICY notifications_staff_delete ON public.notifications
  FOR DELETE TO authenticated
  USING ((SELECT private.is_staff()));

-- 3D. Customer delivery fraud reports (staff only; never anon or arbitrary auth user)
DROP POLICY IF EXISTS "Allow anon to read customer delivery reports" ON public.customer_delivery_reports;
DROP POLICY IF EXISTS "Allow authenticated staff to read customer delivery reports" ON public.customer_delivery_reports;
DROP POLICY IF EXISTS "Allow authenticated staff to write customer delivery reports" ON public.customer_delivery_reports;
DROP POLICY IF EXISTS customer_delivery_reports_staff_select ON public.customer_delivery_reports;
DROP POLICY IF EXISTS customer_delivery_reports_staff_write ON public.customer_delivery_reports;

CREATE POLICY customer_delivery_reports_staff_select ON public.customer_delivery_reports
  FOR SELECT TO authenticated
  USING ((SELECT private.can_manage_orders()));

CREATE POLICY customer_delivery_reports_staff_write ON public.customer_delivery_reports
  FOR ALL TO authenticated
  USING ((SELECT private.can_manage_orders()))
  WITH CHECK ((SELECT private.can_manage_orders()));

-- 3E. Storefront inquiries (contains visitor phones, IPs, UAs, fbp/fbc; written/read via service_role server actions + staff RLS)
DROP POLICY IF EXISTS "Allow public insert of storefront inquiries" ON public.storefront_inquiries;
DROP POLICY IF EXISTS "Allow select of storefront inquiries by ref_code" ON public.storefront_inquiries;
DROP POLICY IF EXISTS "Allow staff update of storefront inquiries" ON public.storefront_inquiries;
DROP POLICY IF EXISTS storefront_inquiries_staff_select ON public.storefront_inquiries;
DROP POLICY IF EXISTS storefront_inquiries_staff_update ON public.storefront_inquiries;
DROP POLICY IF EXISTS storefront_inquiries_staff_delete ON public.storefront_inquiries;

CREATE POLICY storefront_inquiries_staff_select ON public.storefront_inquiries
  FOR SELECT TO authenticated
  USING ((SELECT private.can_manage_orders()));

CREATE POLICY storefront_inquiries_staff_update ON public.storefront_inquiries
  FOR UPDATE TO authenticated
  USING ((SELECT private.can_manage_orders()))
  WITH CHECK ((SELECT private.can_manage_orders()));

CREATE POLICY storefront_inquiries_staff_delete ON public.storefront_inquiries
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

-- 3F. SMS logs & Transactional Outbox (staff / admin only; server actions/workers use service_role)
DROP POLICY IF EXISTS "Allow authenticated users to insert sms_logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read sms_logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow service role full access to sms_logs" ON public.sms_logs;
DROP POLICY IF EXISTS sms_logs_staff_select ON public.sms_logs;
DROP POLICY IF EXISTS sms_logs_staff_insert ON public.sms_logs;

CREATE POLICY sms_logs_staff_select ON public.sms_logs
  FOR SELECT TO authenticated
  USING ((SELECT private.can_manage_orders()));

CREATE POLICY sms_logs_staff_insert ON public.sms_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Allow authenticated read outbox_events" ON public.outbox_events;
DROP POLICY IF EXISTS "Allow authenticated insert outbox_events" ON public.outbox_events;
DROP POLICY IF EXISTS "Allow authenticated update outbox_events" ON public.outbox_events;
DROP POLICY IF EXISTS "Allow service role full access to outbox_events" ON public.outbox_events;
DROP POLICY IF EXISTS outbox_events_admin_all ON public.outbox_events;

CREATE POLICY outbox_events_admin_all ON public.outbox_events
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

-- -----------------------------------------------------------------------------
-- 4. REVOKE & RE-GRANT TABLE, VIEW & SEQUENCE PRIVILEGES FROM ZERO
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 4A. Public read-only storefront catalog & reference tables/views
GRANT SELECT ON
  public.geo_divisions,
  public.geo_districts,
  public.delivery_zones,
  public.shipping_methods,
  public.shipping_rates,
  public.categories,
  public.products,
  public.product_variants,
  public.combo_items,
  public.price_tiers,
  public.product_images,
  public.documents,
  public.product_reviews,
  public.posts,
  public.faqs,
  public.site_settings,
  public.product_cards
  TO anon, authenticated;

-- 4B. Catalog & content writes (restricted by RLS to content/manager/admin staff)
GRANT INSERT, UPDATE, DELETE ON
  public.geo_divisions,
  public.geo_districts,
  public.delivery_zones,
  public.shipping_methods,
  public.shipping_rates,
  public.categories,
  public.products,
  public.product_variants,
  public.combo_items,
  public.price_tiers,
  public.product_images,
  public.documents,
  public.posts,
  public.faqs,
  public.site_settings,
  public.product_reviews
  TO authenticated;

-- 4C. Customer / Staff Profiles & Business Accounts (authenticated only)
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, avatar_path, account_type, preferred_language, marketing_opt_in) ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.staff_members,
  public.business_members,
  public.addresses,
  public.cart_items
  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_accounts TO authenticated;

-- 4D. Inventory & Traceability (authenticated staff via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.suppliers,
  public.batches,
  public.warehouses
  TO authenticated;
GRANT SELECT ON public.inventory_levels TO authenticated;
GRANT UPDATE (reorder_point) ON public.inventory_levels TO authenticated;
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT SELECT ON public.order_stock_reservations TO authenticated;

-- 4E. Orders, Fulfillment, Delivery Reports, Inquiries, Outbox & Logs (authenticated via RLS; ZERO anon grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments, public.shipments TO authenticated;
GRANT SELECT, INSERT ON public.shipment_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_delivery_reports TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.storefront_inquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.sms_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outbox_events TO authenticated;
GRANT SELECT ON public.courier_webhook_logs TO authenticated;

-- 4F. Staff Back-Office Views (SELECT only for authenticated; underlying tables enforce staff RLS via security_invoker)
GRANT SELECT ON
  public.admin_low_stock,
  public.admin_sales_daily,
  public.admin_batch_stock,
  public.admin_incomplete_orders,
  public.notes
  TO authenticated, service_role;

-- 4G. Inbound RFQ & Contact Forms
GRANT INSERT ON public.quote_requests, public.contact_messages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.quote_requests, public.contact_messages TO authenticated;

-- 4H. Audit & Staff Notes
GRANT SELECT, INSERT, DELETE ON public.staff_notes TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, UPDATE ON public.notification_outbox TO authenticated;
-- payment_logs intentionally receives zero grants for anon or authenticated

-- 4I. Service Role full server privileges
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- -----------------------------------------------------------------------------
-- 5. HARDEN FUNCTIONS (search_path = '', INTERNAL AUTH & TOKEN RETURN)
-- -----------------------------------------------------------------------------

-- 5A. Pin empty search_path on courier snapshot helpers
CREATE OR REPLACE FUNCTION public.build_order_courier_snapshot(p_order public.orders)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_cod numeric;
BEGIN
  IF p_order.payment_status = 'paid' THEN
    v_cod := 0;
  ELSE
    v_cod := GREATEST(0, (COALESCE(p_order.grand_total, 0) - COALESCE(p_order.amount_paid, 0)));
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

CREATE OR REPLACE FUNCTION public.get_order_courier_print_diff(p_current jsonb, p_printed jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_diffs jsonb := '[]'::jsonb;
  v_curr_name text := COALESCE(p_current->>'recipient_name', '');
  v_prev_name text := COALESCE(p_printed->>'recipient_name', '');
  v_curr_phone text := COALESCE(p_current->>'phone', '');
  v_prev_phone text := COALESCE(p_printed->>'phone', '');
  v_curr_alt_phone text := COALESCE(p_current->>'alternative_phone', '');
  v_prev_alt_phone text := COALESCE(p_printed->>'alternative_phone', '');
  v_curr_addr text := COALESCE(p_current->>'address_line', '');
  v_prev_addr text := COALESCE(p_printed->>'address_line', '');
  v_curr_dist text := COALESCE(p_current->>'district', '');
  v_prev_dist text := COALESCE(p_printed->>'district', '');
  v_curr_div text := COALESCE(p_current->>'division', '');
  v_prev_div text := COALESCE(p_printed->>'division', '');
  v_curr_cod numeric := COALESCE((p_current->>'cod_amount')::numeric, 0);
  v_prev_cod numeric := COALESCE((p_printed->>'cod_amount')::numeric, 0);
BEGIN
  IF p_printed IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF v_curr_name <> v_prev_name THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Recipient Name',
      'old', CASE WHEN v_prev_name = '' THEN '(Empty)' ELSE v_prev_name END,
      'new', CASE WHEN v_curr_name = '' THEN '(Empty)' ELSE v_curr_name END
    );
  END IF;

  IF v_curr_phone <> v_prev_phone THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Contact Phone',
      'old', CASE WHEN v_prev_phone = '' THEN '(Empty)' ELSE v_prev_phone END,
      'new', CASE WHEN v_curr_phone = '' THEN '(Empty)' ELSE v_curr_phone END
    );
  END IF;

  IF v_curr_alt_phone <> v_prev_alt_phone THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Alternative Phone',
      'old', CASE WHEN v_prev_alt_phone = '' THEN '(None)' ELSE v_prev_alt_phone END,
      'new', CASE WHEN v_curr_alt_phone = '' THEN '(None)' ELSE v_curr_alt_phone END
    );
  END IF;

  IF (v_curr_addr <> v_prev_addr) OR (v_curr_dist <> v_prev_dist) OR (v_curr_div <> v_prev_div) THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'Delivery Address',
      'old', TRIM(CONCAT_WS(', ', NULLIF(v_prev_addr, ''), NULLIF(v_prev_dist, ''), NULLIF(v_prev_div, ''))),
      'new', TRIM(CONCAT_WS(', ', NULLIF(v_curr_addr, ''), NULLIF(v_curr_dist, ''), NULLIF(v_curr_div, '')))
    );
  END IF;

  IF v_curr_cod <> v_prev_cod THEN
    v_diffs := v_diffs || jsonb_build_object(
      'field', 'COD Amount',
      'old', '৳' || v_prev_cod::text,
      'new', '৳' || v_curr_cod::text
    );
  END IF;

  RETURN v_diffs;
END;
$$;

-- 5B. Add internal admin check to notification cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT (
    (SELECT current_user IN ('postgres', 'service_role'))
    OR (SELECT coalesce(auth.jwt()->>'role', '') = 'service_role')
    OR (SELECT private.is_admin())
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: admin privileges required' USING errcode = 'P0001';
  END IF;

  DELETE FROM public.notifications
   WHERE is_read = true
     AND created_at < (now() - interval '30 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 5C. Fix search_path = '' & add internal staff auth checks to product sorting RPCs
CREATE OR REPLACE FUNCTION public.reorder_products(p_ordered_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_order int := 1;
  v_count int := 0;
BEGIN
  IF NOT (
    (SELECT current_user IN ('postgres', 'service_role'))
    OR (SELECT coalesce(auth.jwt()->>'role', '') = 'service_role')
    OR (SELECT private.can_manage_content())
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: content management privileges required' USING errcode = 'P0001';
  END IF;

  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No product IDs provided');
  END IF;

  FOREACH v_id IN ARRAY p_ordered_ids
  LOOP
    UPDATE public.products
       SET sort_order = v_order,
           updated_at = now()
     WHERE id = v_id;

    v_order := v_order + 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_sort_order(p_product_id uuid, p_new_order integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_order int;
BEGIN
  IF NOT (
    (SELECT current_user IN ('postgres', 'service_role'))
    OR (SELECT coalesce(auth.jwt()->>'role', '') = 'service_role')
    OR (SELECT private.can_manage_content())
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: content management privileges required' USING errcode = 'P0001';
  END IF;

  IF p_new_order < 1 THEN
    p_new_order := 1;
  END IF;

  SELECT sort_order INTO v_old_order
    FROM public.products
   WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_old_order = p_new_order THEN
    RETURN;
  END IF;

  IF p_new_order < v_old_order THEN
    UPDATE public.products
       SET sort_order = sort_order + 1
     WHERE sort_order >= p_new_order
       AND sort_order < v_old_order
       AND id <> p_product_id;
  ELSE
    UPDATE public.products
       SET sort_order = sort_order - 1
     WHERE sort_order <= p_new_order
       AND sort_order > v_old_order
       AND id <> p_product_id;
  END IF;

  UPDATE public.products
     SET sort_order = p_new_order,
         updated_at = now()
   WHERE id = p_product_id;
END;
$$;

-- 5D. Update process_storefront_order to return public_token ONLY for newly created or ownership-verified orders
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
  v_public_token        uuid;
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
        'public_token', v_existing.public_token,
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
        -- Matched by phone only: return pending_order_exists without leaking order details or public_token
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

    IF v_existing.id IS NOT NULL THEN
      v_was_incomplete := true;
    END IF;

  ELSE
    -- Explicit submission / resubmission (p_status = 'pending')
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
        -- Matched by phone only without verified ownership (p_order_id): do not disclose details or public_token
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

      IF v_candidate_var_id IS NOT NULL AND v_candidate_var_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id, product_id, price, coalesce(is_combo, false), coalesce(weight_grams, 0)
          INTO v_valid_variant_id, v_valid_product_id, v_db_price, v_is_combo, v_item_weight_grams
          FROM public.product_variants
         WHERE id = v_candidate_var_id::uuid;
      END IF;

      IF v_valid_product_id IS NULL AND v_candidate_prod_id IS NOT NULL AND v_candidate_prod_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_valid_product_id FROM public.products WHERE id = v_candidate_prod_id::uuid;
      END IF;

      IF v_valid_product_id IS NULL AND v_prod_name IS NOT NULL THEN
        SELECT id INTO v_valid_product_id
          FROM public.products
         WHERE name ILIKE '%' || v_prod_name || '%'
            OR name_bn ILIKE '%' || v_prod_name || '%'
            OR v_prod_name ILIKE '%' || name || '%'
         LIMIT 1;
      END IF;

      IF v_valid_product_id IS NOT NULL AND v_valid_variant_id IS NULL THEN
        SELECT id, price, coalesce(is_combo, false), coalesce(weight_grams, 0)
          INTO v_valid_variant_id, v_db_price, v_is_combo, v_item_weight_grams
          FROM public.product_variants
         WHERE product_id = v_valid_product_id AND is_active
         ORDER BY is_default DESC, sort_order ASC, price ASC
         LIMIT 1;
      END IF;

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

      IF v_unit_price IS NULL THEN
        v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
      END IF;

      IF v_valid_variant_id IS NOT NULL THEN
        SELECT pv.sku, p.name, pv.name
          INTO v_sku, v_prod_name, v_var_name
          FROM public.product_variants pv
          JOIN public.products p ON p.id = pv.product_id
         WHERE pv.id = v_valid_variant_id;
      END IF;

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

  IF v_item_count > 0 THEN
    IF p_delivery_zone IS NOT NULL AND trim(p_delivery_zone) <> '' THEN
      v_shipping_total := v_base_shipping;
    ELSE
      v_shipping_total := coalesce(v_existing.shipping_total, v_base_shipping);
    END IF;
  ELSE
    v_shipping_total := 0;
  END IF;

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

  IF v_existing.id IS NOT NULL AND v_item_count = 0 THEN
    v_subtotal := coalesce(v_existing.subtotal, 0);
    v_shipping_total := coalesce(v_existing.shipping_total, 0);
    v_grand_total := coalesce(v_existing.grand_total, 0);
  ELSE
    v_grand_total := v_subtotal + v_shipping_total;
  END IF;

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
    v_public_token := v_existing.public_token;

    UPDATE public.orders
       SET status = v_final_status::public.order_status,
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
    RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;
  END IF;

  -- 7. Synchronize Line Items & Manage Stock Reservations
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
    'public_token', v_public_token,
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

-- -----------------------------------------------------------------------------
-- 6. LOCK DOWN FUNCTION EXECUTE PERMISSIONS (private & public schemas)
-- -----------------------------------------------------------------------------
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  private.current_staff_role(),
  private.is_staff(),
  private.is_owner(),
  private.is_admin(),
  private.is_manager(),
  private.can_manage_content(),
  private.can_manage_orders(),
  private.is_business_member(uuid),
  private.is_approved_business_member()
  TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.admin_kpis(timestamptz, timestamptz),
  public.admin_sales_breakdown(timestamptz, timestamptz, text),
  public.admin_sales_series(timestamptz, timestamptz, text),
  public.admin_top_products(timestamptz, timestamptz, integer),
  public.assign_invoice_number(uuid),
  public.build_order_courier_snapshot(public.orders),
  public.cancel_order(uuid, text),
  public.get_order_courier_print_diff(jsonb, jsonb),
  public.lot_lookup(text),
  public.mark_orders_as_printed(text[]),
  public.preview_cart(jsonb, smallint, uuid, text, uuid),
  public.reorder_products(uuid[]),
  public.search_products(text, integer, integer),
  public.set_order_items(uuid, jsonb, jsonb),
  public.set_product_sort_order(uuid, integer)
  TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
