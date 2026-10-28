-- =============================================================================
-- MOLASSES STORE · migration 2 of 3 · SECURITY
-- Deny by default, then open exactly what each role needs.
--
-- Roles
--   anon          visitors (storefront, guest checkout through RPC, RFQ / contact forms)
--   authenticated signed-in customers AND staff (staff are told apart by staff_members)
--   service_role  your server code / webhooks (bypasses RLS, still needs GRANTs)
--
-- Supabase no longer auto-exposes new public tables to the Data API (default for new projects
-- since 30 May 2026, enforced on every existing project from 30 Oct 2026), so every grant
-- below is explicit. This migration works the same under the old and the new default.
-- Policies use (select auth.uid()) / (select private.fn()) so Postgres evaluates them
-- once per statement instead of once per row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. START FROM ZERO
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;                       -- policies call the helpers below
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.current_staff_role(), private.is_staff(), private.is_owner(), private.is_admin(),
  private.is_manager(), private.can_manage_content(), private.can_manage_orders(),
  private.is_business_member(uuid), private.is_approved_business_member()
  to authenticated;

-- every table: RLS on (no policy = no access)
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 1. TABLE PRIVILEGES  (RLS below decides which ROWS; these decide which verbs)
-- -----------------------------------------------------------------------------
-- public storefront data: everyone reads, staff write (policies restrict writers)
grant select on
  public.geo_divisions, public.geo_districts, public.delivery_zones, public.shipping_methods, public.shipping_rates,
  public.categories, public.products, public.product_variants, public.price_tiers, public.product_images,
  public.documents, public.product_reviews, public.posts, public.faqs, public.site_settings
  to anon, authenticated;
grant insert, update, delete on
  public.geo_divisions, public.geo_districts, public.delivery_zones, public.shipping_methods, public.shipping_rates,
  public.categories, public.products, public.product_variants, public.price_tiers, public.product_images,
  public.documents, public.posts, public.faqs, public.site_settings, public.product_reviews
  to authenticated;

-- people
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path, account_type, preferred_language, marketing_opt_in) on public.profiles to authenticated;
grant select, insert, update, delete on public.staff_members, public.business_members, public.addresses, public.cart_items to authenticated;
grant select, insert, update on public.business_accounts to authenticated;

-- stock & traceability (staff only)
grant select, insert, update, delete on public.suppliers, public.batches, public.warehouses to authenticated;
grant select on public.inventory_levels to authenticated;
grant update (reorder_point) on public.inventory_levels to authenticated;
grant select, insert on public.stock_movements to authenticated;

-- selling
grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
grant select, update on public.orders to authenticated;                 -- orders are INSERTed only by place_order()
grant select on public.order_items to authenticated;
grant select, insert on public.order_events to authenticated;
grant select, insert, update on public.payments, public.shipments to authenticated;
grant select, insert on public.shipment_items to authenticated;

-- inbound forms
grant insert on public.quote_requests, public.contact_messages to anon;
grant select, insert, update on public.quote_requests, public.contact_messages to authenticated;

-- back office
grant select, insert, delete on public.staff_notes to authenticated;
grant select on public.audit_log to authenticated;
grant select, update on public.notification_outbox to authenticated;
-- payment_logs: no grants to anon / authenticated on purpose

-- server code (secret key): RLS is bypassed, privileges are not
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- -----------------------------------------------------------------------------
-- 2. POLICIES · geography, delivery, shipping
-- -----------------------------------------------------------------------------
create policy geo_divisions_read  on public.geo_divisions for select to anon, authenticated using (true);
create policy geo_divisions_write on public.geo_divisions for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy geo_districts_read  on public.geo_districts for select to anon, authenticated using (true);
create policy geo_districts_write on public.geo_districts for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy delivery_zones_read  on public.delivery_zones for select to anon, authenticated using (is_active);
create policy delivery_zones_write on public.delivery_zones for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy shipping_methods_read  on public.shipping_methods for select to anon, authenticated using (is_active);
create policy shipping_methods_write on public.shipping_methods for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy shipping_rates_read  on public.shipping_rates for select to anon, authenticated using (is_active);
create policy shipping_rates_write on public.shipping_rates for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

-- -----------------------------------------------------------------------------
-- 3. POLICIES · people
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.can_manage_orders()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- (rows are created by the on_auth_user_created trigger, deleted by cascade from auth.users)

create policy staff_members_select on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy staff_members_insert on public.staff_members for insert to authenticated
  with check ((select private.is_owner()) or ((select private.is_admin()) and role <> 'owner'));
create policy staff_members_update on public.staff_members for update to authenticated
  using      ((select private.is_owner()) or ((select private.is_admin()) and role <> 'owner'))
  with check ((select private.is_owner()) or ((select private.is_admin()) and role <> 'owner'));
create policy staff_members_delete on public.staff_members for delete to authenticated
  using ((select private.is_owner()) or ((select private.is_admin()) and role <> 'owner'));

create policy business_accounts_select on public.business_accounts for select to authenticated
  using (created_by = (select auth.uid()) or (select private.is_business_member(id)) or (select private.can_manage_orders()));
create policy business_accounts_apply on public.business_accounts for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'pending' and credit_limit = 0
              and payment_terms_days = 0 and approved_by is null and approved_at is null);
create policy business_accounts_manage on public.business_accounts for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy business_members_select on public.business_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_business_member(business_id)) or (select private.can_manage_orders()));
create policy business_members_write on public.business_members for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy addresses_own on public.addresses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and business_id is null);
create policy addresses_business_read on public.addresses for select to authenticated
  using (business_id is not null and (select private.is_business_member(business_id)));
create policy addresses_staff_read on public.addresses for select to authenticated
  using ((select private.can_manage_orders()));
create policy addresses_staff_business_write on public.addresses for all to authenticated
  using (business_id is not null and (select private.is_manager()))
  with check (business_id is not null and (select private.is_manager()));

create policy cart_items_own on public.cart_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. POLICIES · catalog
-- -----------------------------------------------------------------------------
create policy categories_read  on public.categories for select to anon, authenticated using (is_active);
create policy categories_write on public.categories for all to authenticated
  using ((select private.can_manage_content())) with check ((select private.can_manage_content()));

create policy products_read  on public.products for select to anon, authenticated using (status = 'active');
create policy products_write on public.products for all to authenticated
  using ((select private.can_manage_content())) with check ((select private.can_manage_content()));

create policy product_variants_read on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p
                                where p.id = product_variants.product_id and p.status = 'active'));
create policy product_variants_write on public.product_variants for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy price_tiers_read on public.price_tiers for select to anon, authenticated
  using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                  where v.id = price_tiers.variant_id and v.is_active and p.status = 'active'));
create policy price_tiers_write on public.price_tiers for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy product_images_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'active'));
create policy product_images_write on public.product_images for all to authenticated
  using ((select private.can_manage_content())) with check ((select private.can_manage_content()));

create policy documents_read_public on public.documents for select to anon, authenticated
  using (is_public and product_id is not null
         and exists (select 1 from public.products p where p.id = documents.product_id and p.status = 'active'));
create policy documents_read_buyers on public.documents for select to authenticated        -- approved B2B accounts also see non-public spec sheets / COAs
  using ((select private.is_approved_business_member())
         and (product_id is null or exists (select 1 from public.products p where p.id = documents.product_id and p.status = 'active')));
create policy documents_write on public.documents for all to authenticated
  using ((select private.can_manage_content())) with check ((select private.can_manage_content()));

create policy product_reviews_read_approved on public.product_reviews for select to anon, authenticated using (status = 'approved');
create policy product_reviews_read_own      on public.product_reviews for select to authenticated using (user_id = (select auth.uid()));
create policy product_reviews_insert_own    on public.product_reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy product_reviews_update_own    on public.product_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy product_reviews_delete_own    on public.product_reviews for delete to authenticated using (user_id = (select auth.uid()));
create policy product_reviews_moderate      on public.product_reviews for all to authenticated
  using ((select private.can_manage_orders())) with check ((select private.can_manage_orders()));

create policy posts_read  on public.posts for select to anon, authenticated
  using (status = 'published' and (published_at is null or published_at <= now()));
create policy posts_write on public.posts for all to authenticated
  using ((select private.can_manage_content())) with check ((select private.can_manage_content()));

create policy faqs_read  on public.faqs for select to anon, authenticated using (is_active);
create policy faqs_write on public.faqs for all to authenticated
  using ((select private.can_manage_content())) with check ((select private.can_manage_content()));

-- -----------------------------------------------------------------------------
-- 5. POLICIES · lots & inventory (staff only; cost data never leaves these tables)
-- -----------------------------------------------------------------------------
create policy suppliers_read   on public.suppliers  for select to authenticated using ((select private.is_staff()));
create policy suppliers_write  on public.suppliers  for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy batches_read     on public.batches    for select to authenticated using ((select private.is_staff()));
create policy batches_write    on public.batches    for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy warehouses_read  on public.warehouses for select to authenticated using ((select private.is_staff()));
create policy warehouses_write on public.warehouses for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy inventory_levels_read    on public.inventory_levels for select to authenticated using ((select private.is_staff()));
create policy inventory_levels_reorder on public.inventory_levels for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy stock_movements_read   on public.stock_movements for select to authenticated using ((select private.is_staff()));
create policy stock_movements_insert on public.stock_movements for insert to authenticated with check ((select private.is_manager()));

-- -----------------------------------------------------------------------------
-- 6. POLICIES · orders & everything attached to them
-- -----------------------------------------------------------------------------
create policy coupons_manage on public.coupons for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy coupon_redemptions_read on public.coupon_redemptions for select to authenticated using ((select private.is_manager()));

create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid())
         or (business_id is not null and (select private.is_business_member(business_id)))
         or (select private.can_manage_orders()));
create policy orders_update_staff on public.orders for update to authenticated
  using ((select private.can_manage_orders())) with check ((select private.can_manage_orders()));

-- children are visible exactly when their order is (the nested SELECT is itself filtered by orders_select)
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));
create policy order_events_select on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_events.order_id));
create policy order_events_insert on public.order_events for insert to authenticated
  with check ((select private.can_manage_orders()));

create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = payments.order_id));
create policy payments_insert on public.payments for insert to authenticated with check ((select private.can_manage_orders()));
create policy payments_update on public.payments for update to authenticated
  using ((select private.can_manage_orders())) with check ((select private.can_manage_orders()));

create policy shipments_select on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = shipments.order_id));
create policy shipments_insert on public.shipments for insert to authenticated with check ((select private.can_manage_orders()));
create policy shipments_update on public.shipments for update to authenticated
  using ((select private.can_manage_orders())) with check ((select private.can_manage_orders()));
create policy shipment_items_select on public.shipment_items for select to authenticated
  using (exists (select 1 from public.shipments s where s.id = shipment_items.shipment_id));
create policy shipment_items_insert on public.shipment_items for insert to authenticated
  with check ((select private.can_manage_orders()));

-- -----------------------------------------------------------------------------
-- 7. POLICIES · inbound forms (RFQ, contact) and back office
-- -----------------------------------------------------------------------------
create policy quote_requests_insert_anon on public.quote_requests for insert to anon
  with check (user_id is null and business_id is null and status = 'new' and assigned_to is null
              and quoted_total is null and quote_valid_until is null and quote_reply is null);
create policy quote_requests_insert_auth on public.quote_requests for insert to authenticated
  with check (((user_id = (select auth.uid())
                and (business_id is null or (select private.is_business_member(business_id)))
                and status = 'new' and assigned_to is null and quoted_total is null
                and quote_valid_until is null and quote_reply is null))
              or (select private.can_manage_orders()));
create policy quote_requests_select on public.quote_requests for select to authenticated
  using (user_id = (select auth.uid())
         or (business_id is not null and (select private.is_business_member(business_id)))
         or (select private.can_manage_orders()));
create policy quote_requests_update on public.quote_requests for update to authenticated
  using ((select private.can_manage_orders())) with check ((select private.can_manage_orders()));

create policy contact_messages_insert_anon on public.contact_messages for insert to anon
  with check (user_id is null and status = 'new');
create policy contact_messages_insert_auth on public.contact_messages for insert to authenticated
  with check ((user_id is null or user_id = (select auth.uid())) and status = 'new');
create policy contact_messages_select on public.contact_messages for select to authenticated
  using ((select private.can_manage_orders()));
create policy contact_messages_update on public.contact_messages for update to authenticated
  using ((select private.can_manage_orders())) with check ((select private.can_manage_orders()));

create policy staff_notes_select on public.staff_notes for select to authenticated using ((select private.is_staff()));
create policy staff_notes_insert on public.staff_notes for insert to authenticated with check ((select private.is_staff()));
create policy staff_notes_delete on public.staff_notes for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

create policy site_settings_read_public on public.site_settings for select to anon, authenticated using (is_public);
create policy site_settings_admin on public.site_settings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy audit_log_read on public.audit_log for select to authenticated using ((select private.is_admin()));
create policy notification_outbox_read on public.notification_outbox for select to authenticated using ((select private.is_admin()));
create policy notification_outbox_update on public.notification_outbox for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
-- payment_logs: RLS enabled, deliberately no policy -> only the service role can touch it

-- -----------------------------------------------------------------------------
-- 8. STORAGE
--    catalog-images    public   product / category / post pictures
--    documents-public  public   spec sheets and certificates anyone may download
--    documents-private private  COAs, MSDS ... for approved B2B accounts (signed URLs)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog-images',    'catalog-images',    true,  5242880,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('documents-public',  'documents-public',  true,  10485760, array['application/pdf','image/jpeg','image/png']),
  ('documents-private', 'documents-private', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy catalog_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('catalog-images','documents-public'));
create policy catalog_content_write on storage.objects for all to authenticated
  using      (bucket_id in ('catalog-images','documents-public') and (select private.can_manage_content()))
  with check (bucket_id in ('catalog-images','documents-public') and (select private.can_manage_content()));
create policy private_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documents-private' and ((select private.is_approved_business_member()) or (select private.is_staff())));
create policy private_docs_write on storage.objects for all to authenticated
  using      (bucket_id = 'documents-private' and (select private.is_manager()))
  with check (bucket_id = 'documents-private' and (select private.is_manager()));

-- -----------------------------------------------------------------------------
-- 9. FIRST OWNER  (run once in the SQL Editor after you have signed up in your app;
--    the SQL Editor runs as postgres, so RLS does not block this bootstrap insert)
-- -----------------------------------------------------------------------------
--   insert into public.staff_members (user_id, role)
--   select id, 'owner' from auth.users where email = 'you@example.com';
