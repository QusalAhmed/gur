-- =============================================================================
-- MOLASSES STORE · migration 3 of 3 · FUNCTIONS & VIEWS
-- The API surface of the shop. Prices are NEVER taken from the browser: the
-- client sends variant ids + quantities, the database prices the cart, reserves
-- stock and writes the order in one transaction.
--
-- Errors are raised as  CODE: human message  (SQLSTATE P0001), e.g.
--   CART_EMPTY, VARIANT_UNAVAILABLE, BELOW_MIN_QTY, QTY_STEP, MAX_QTY, OUT_OF_STOCK,
--   COUPON_INVALID, COUPON_MIN_ORDER, COUPON_ALREADY_USED, SHIPPING_METHOD_INVALID,
--   NO_SHIPPING_RATE (-> offer the quote form), ADDRESS_REQUIRED, CREDIT_LIMIT_EXCEEDED ...
-- Match on the prefix before the colon in your UI.
--
-- place_order / preview_cart / track_order are callable by anonymous visitors (guest checkout).
-- Put a CAPTCHA (e.g. Cloudflare Turnstile) or rate limit in front of them, for example by
-- calling place_order from a Next.js server action after verifying the token.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRICING ENGINE (internal) - one function used by preview_cart and place_order,
--    so the number the customer sees is the number the order gets.
-- -----------------------------------------------------------------------------
create function private.price_cart(
  p_items              jsonb,                 -- [{"variant_id": uuid, "quantity": number}, ...]
  p_district_id        smallint,
  p_shipping_method_id uuid,
  p_coupon_code        text    default null,
  p_user_id            uuid    default null,
  p_business_id        uuid    default null,
  p_phone              text    default null,  -- E.164, for per-customer coupon limits of guests
  p_price_overrides    jsonb   default null   -- staff only: {"<variant_id>": 31.50}
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_line       record;
  v_lines      jsonb := '[]'::jsonb;
  v_unit_price numeric(12,2);
  v_line_sub   numeric(14,2);
  v_line_tax   numeric(14,2);
  v_subtotal   numeric(14,2) := 0;
  v_tax        numeric(14,2) := 0;
  v_weight_g   numeric := 0;
  v_weight_kg  numeric(12,3);
  v_discount   numeric(14,2) := 0;
  v_shipping   numeric(14,2) := 0;
  v_method     public.shipping_methods;
  v_rate       public.shipping_rates;
  v_zone       smallint;
  v_coupon     public.coupons;
  v_has_coupon boolean := false;
  v_used       integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY: the cart has no items' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'CART_TOO_LARGE: at most 100 lines per order' using errcode = 'P0001';
  end if;

  -- 1) lines (duplicates of one variant are merged)
  for v_line in
    with req as (
      select i.variant_id, sum(i.quantity) as quantity
        from jsonb_to_recordset(p_items) as i(variant_id uuid, quantity numeric)
       group by i.variant_id
    )
    select req.variant_id, req.quantity,
           v.sku, v.name as variant_name, v.price, v.min_order_qty, v.order_qty_step, v.max_order_qty,
           v.weight_grams, v.net_quantity, v.net_unit, v.is_active as variant_active,
           p.id as product_id, p.name as product_name, p.status as product_status, p.tax_rate
      from req
      left join public.product_variants v on v.id = req.variant_id
      left join public.products p on p.id = v.product_id
     order by req.variant_id
  loop
    if v_line.sku is null or not v_line.variant_active or v_line.product_status <> 'active' then
      raise exception 'VARIANT_UNAVAILABLE: % is not available', coalesce(v_line.variant_id::text, 'item') using errcode = 'P0001';
    end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'QUANTITY_INVALID: % needs a quantity above zero', v_line.sku using errcode = 'P0001';
    end if;
    if v_line.quantity < v_line.min_order_qty then
      raise exception 'BELOW_MIN_QTY: % needs at least %', v_line.sku, v_line.min_order_qty using errcode = 'P0001';
    end if;
    if mod(v_line.quantity, v_line.order_qty_step) <> 0 then
      raise exception 'QTY_STEP: % must be ordered in multiples of %', v_line.sku, v_line.order_qty_step using errcode = 'P0001';
    end if;
    if v_line.max_order_qty is not null and v_line.quantity > v_line.max_order_qty then
      raise exception 'MAX_QTY: % allows at most % per order', v_line.sku, v_line.max_order_qty using errcode = 'P0001';
    end if;

    -- negotiated override (staff) > volume tier > list price
    v_unit_price := null;
    if p_price_overrides is not null then
      v_unit_price := nullif(p_price_overrides ->> v_line.variant_id::text, '')::numeric;
      if v_unit_price < 0 then
        raise exception 'PRICE_INVALID: negative price override' using errcode = 'P0001';
      end if;
    end if;
    if v_unit_price is null then
      select t.unit_price into v_unit_price
        from public.price_tiers t
       where t.variant_id = v_line.variant_id and t.min_qty <= v_line.quantity
       order by t.min_qty desc limit 1;
    end if;
    v_unit_price := coalesce(v_unit_price, v_line.price);

    v_line_sub := round(v_line.quantity * v_unit_price, 2);
    v_line_tax := round(v_line_sub * v_line.tax_rate / 100, 2);   -- VAT on the pre-discount amount (prices are tax-exclusive)
    v_subtotal := v_subtotal + v_line_sub;
    v_tax      := v_tax + v_line_tax;
    v_weight_g := v_weight_g + v_line.quantity * v_line.weight_grams;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_line.variant_id, 'product_id', v_line.product_id, 'sku', v_line.sku,
      'product_name', v_line.product_name, 'variant_name', v_line.variant_name,
      'net_quantity', v_line.net_quantity, 'net_unit', v_line.net_unit,
      'quantity', v_line.quantity, 'unit_price', v_unit_price, 'tax_rate', v_line.tax_rate,
      'tax_amount', v_line_tax, 'line_subtotal', v_line_sub, 'weight_grams', v_line.weight_grams));
  end loop;

  -- 2) coupon
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from public.coupons c where c.code = upper(trim(p_coupon_code));
    if not found or not v_coupon.is_active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at   is not null and v_coupon.ends_at   <= now())
       or (v_coupon.usage_limit_total is not null and v_coupon.used_count >= v_coupon.usage_limit_total) then
      raise exception 'COUPON_INVALID: this code is not valid' using errcode = 'P0001';
    end if;
    if v_subtotal < v_coupon.min_order_amount then
      raise exception 'COUPON_MIN_ORDER: spend at least % to use this code', v_coupon.min_order_amount using errcode = 'P0001';
    end if;
    if v_coupon.business_only and p_business_id is null then
      raise exception 'COUPON_BUSINESS_ONLY: this code is for approved business accounts' using errcode = 'P0001';
    end if;
    if p_user_id is not null or p_phone is not null then
      select count(*) into v_used
        from public.coupon_redemptions r
       where r.coupon_id = v_coupon.id
         and ((p_user_id is not null and r.user_id = p_user_id)
           or (p_phone   is not null and r.customer_phone = p_phone));
      if v_used >= v_coupon.usage_limit_per_customer then
        raise exception 'COUPON_ALREADY_USED: you have already used this code' using errcode = 'P0001';
      end if;
    end if;
    v_has_coupon := true;
    v_discount := case v_coupon.discount_type
                    when 'percentage'   then round(v_subtotal * v_coupon.value / 100, 2)
                    when 'fixed_amount' then v_coupon.value
                    else 0 end;
    if v_coupon.max_discount_amount is not null and v_discount > v_coupon.max_discount_amount then
      v_discount := v_coupon.max_discount_amount;
    end if;
    v_discount := least(v_discount, v_subtotal);
  end if;

  -- 3) shipping (optional while the customer is still browsing the cart)
  v_weight_kg := round(v_weight_g / 1000, 3);
  if p_shipping_method_id is not null then
    select * into v_method from public.shipping_methods m where m.id = p_shipping_method_id and m.is_active;
    if not found then
      raise exception 'SHIPPING_METHOD_INVALID: choose a delivery method' using errcode = 'P0001';
    end if;
    select g.zone_id into v_zone from public.geo_districts g where g.id = p_district_id;

    select * into v_rate
      from public.shipping_rates r
     where r.method_id = v_method.id and r.is_active
       and (r.zone_id is null or r.zone_id = v_zone)
       and r.min_weight_kg <= v_weight_kg
       and (r.max_weight_kg is null or v_weight_kg < r.max_weight_kg)
     order by (r.zone_id is null), r.min_weight_kg desc      -- zone-specific rate beats the catch-all
     limit 1;
    if not found then
      raise exception 'NO_SHIPPING_RATE: no delivery rate for this destination and weight - please request a quote' using errcode = 'P0001';
    end if;

    v_shipping := round(v_rate.base_fee + v_rate.per_kg_fee * v_weight_kg, 2);
    if v_rate.free_over_amount is not null and (v_subtotal - v_discount) >= v_rate.free_over_amount then
      v_shipping := 0;
    end if;
    if v_has_coupon and v_coupon.discount_type = 'free_shipping' then
      v_shipping := 0;
    end if;
  end if;

  return jsonb_build_object(
    'currency',             'BDT',
    'items',                v_lines,
    'subtotal',             v_subtotal,
    'discount_total',       v_discount,
    'shipping_total',       v_shipping,
    'tax_total',            v_tax,
    'grand_total',          v_subtotal - v_discount + v_shipping + v_tax,
    'total_weight_kg',      v_weight_kg,
    'shipping_method_id',   v_method.id,
    'shipping_method_name', v_method.name,
    'eta_days_min',         v_rate.eta_days_min,
    'eta_days_max',         v_rate.eta_days_max,
    'coupon_id',            case when v_has_coupon then v_coupon.id end,
    'coupon_code',          case when v_has_coupon then v_coupon.code end);
end $$;

-- -----------------------------------------------------------------------------
-- 2. CART PREVIEW (cart page / checkout summary)
-- -----------------------------------------------------------------------------
create function public.preview_cart(
  p_items              jsonb,
  p_district_id        smallint default null,
  p_shipping_method_id uuid     default null,
  p_coupon_code        text     default null,
  p_business_id        uuid     default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_business_id is not null and not private.is_business_member(p_business_id) then
    p_business_id := null;                       -- only matters for business-only coupons
  end if;
  return private.price_cart(p_items, p_district_id, p_shipping_method_id, p_coupon_code,
                            (select auth.uid()), p_business_id, null, null);
end $$;

-- -----------------------------------------------------------------------------
-- 3. CHECKOUT
-- -----------------------------------------------------------------------------
create function public.place_order(
  p_items              jsonb,                      -- [{"variant_id": "...", "quantity": 2}]
  p_customer           jsonb,                      -- {"name": "...", "phone": "01712345678", "email": "..."}
  p_shipping_address   jsonb,                      -- {"recipient_name","phone","district_id","upazila","address_line","postal_code","landmark"}
  p_shipping_method_id uuid,
  p_payment_method     public.payment_method default 'cod',
  p_coupon_code        text    default null,
  p_customer_note      text    default null,
  p_business_id        uuid    default null,       -- order on behalf of an APPROVED business account you belong to
  p_billing_address    jsonb   default null,
  p_attribution        jsonb   default null,       -- {"utm_source","utm_medium","utm_campaign","fbclid","fbp","fbc",...} (whitelisted)
  p_channel            text    default 'web',      -- staff only: phone | whatsapp | facebook | walk_in | admin
  p_for_user           uuid    default null,       -- staff only: customer to attach the order to (NULL = guest order)
  p_quote_request_id   uuid    default null,       -- staff only: marks the RFQ as converted
  p_price_overrides    jsonb   default null        -- staff only: negotiated unit prices {"<variant_id>": 31.50}
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid        uuid    := (select auth.uid());
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
begin
  -- who may do what
  if v_uid is null and not v_staff
     and coalesce((select (s.value)::boolean from public.site_settings s where s.key = 'checkout.guest_checkout_enabled'), true) = false then
    raise exception 'LOGIN_REQUIRED: please sign in to place an order' using errcode = 'P0001';
  end if;
  if not v_staff and (p_channel <> 'web' or p_for_user is not null or p_quote_request_id is not null or p_price_overrides is not null) then
    raise exception 'FORBIDDEN: staff-only option' using errcode = 'P0001';
  end if;
  if p_channel not in ('web','phone','whatsapp','facebook','walk_in','admin') then
    raise exception 'CHANNEL_INVALID: unknown sales channel' using errcode = 'P0001';
  end if;
  v_customer := case when v_staff and p_channel <> 'web' then p_for_user else v_uid end;

  -- customer
  v_name  := nullif(trim(p_customer ->> 'name'), '');
  v_phone := private.normalize_phone(p_customer ->> 'phone');
  v_email := nullif(lower(trim(coalesce(p_customer ->> 'email', ''))), '');
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'CUSTOMER_NAME_INVALID: enter your name' using errcode = 'P0001';
  end if;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'CUSTOMER_PHONE_INVALID: enter a valid mobile number' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'CUSTOMER_EMAIL_INVALID: enter a valid email address' using errcode = 'P0001';
  end if;

  -- delivery
  if p_shipping_method_id is null then
    raise exception 'SHIPPING_METHOD_INVALID: choose a delivery method' using errcode = 'P0001';
  end if;
  select * into v_method from public.shipping_methods m where m.id = p_shipping_method_id and m.is_active;
  if not found then
    raise exception 'SHIPPING_METHOD_INVALID: choose a delivery method' using errcode = 'P0001';
  end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' then
    raise exception 'ADDRESS_REQUIRED: enter the delivery address' using errcode = 'P0001';
  end if;
  v_district := nullif(p_shipping_address ->> 'district_id', '')::smallint;
  if not v_method.is_pickup
     and (v_district is null or nullif(trim(p_shipping_address ->> 'address_line'), '') is null) then
    raise exception 'ADDRESS_REQUIRED: district and address are required for delivery' using errcode = 'P0001';
  end if;
  if v_district is not null then
    select g.name, d.name into v_dist_name, v_div_name
      from public.geo_districts g join public.geo_divisions d on d.id = g.division_id
     where g.id = v_district;
    if v_dist_name is null then
      raise exception 'ADDRESS_INVALID: unknown district' using errcode = 'P0001';
    end if;
  end if;
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

  -- business account & payment method rules
  if p_business_id is not null
     and not exists (select 1 from public.business_accounts b
                      where b.id = p_business_id and b.status = 'approved'
                        and (v_staff or exists (select 1 from public.business_members m
                                                 where m.business_id = b.id and m.user_id = v_uid))) then
    raise exception 'BUSINESS_NOT_ALLOWED: this business account cannot place orders' using errcode = 'P0001';
  end if;
  if p_payment_method = 'credit_terms' and p_business_id is null then
    raise exception 'PAYMENT_METHOD_NOT_ALLOWED: credit terms are for approved business accounts' using errcode = 'P0001';
  end if;
  if p_payment_method = 'cash' and not v_staff then
    raise exception 'PAYMENT_METHOD_NOT_ALLOWED: cash is for walk-in sales' using errcode = 'P0001';
  end if;
  if p_payment_method = 'cod'
     and coalesce((select (s.value)::boolean from public.site_settings s where s.key = 'checkout.cod_enabled'), true) = false then
    raise exception 'PAYMENT_METHOD_NOT_ALLOWED: cash on delivery is switched off' using errcode = 'P0001';
  end if;

  -- price the cart (server-side, always)
  v_priced := private.price_cart(p_items, v_district, p_shipping_method_id, p_coupon_code, v_customer, p_business_id,
                                 v_phone, case when v_staff then p_price_overrides end);
  v_total := (v_priced ->> 'grand_total')::numeric;

  if p_payment_method = 'credit_terms' then
    select b.credit_limit, b.payment_terms_days into v_credit, v_terms
      from public.business_accounts b where b.id = p_business_id;
    select coalesce(sum(o.grand_total - o.amount_paid), 0) into v_owed
      from public.orders o
     where o.business_id = p_business_id and o.status not in ('cancelled','returned') and o.payment_status <> 'paid';
    if v_owed + v_total > v_credit then
      raise exception 'CREDIT_LIMIT_EXCEEDED: this order would exceed the credit limit (outstanding %, limit %)', v_owed, v_credit
        using errcode = 'P0001';
    end if;
    v_due := current_date + v_terms;
  end if;

  select coalesce(jsonb_object_agg(k, to_jsonb(left(p_attribution ->> k, 500))), '{}'::jsonb) into v_attr
    from unnest(array['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                      'fbclid','fbp','fbc','gclid','referrer','landing_page']) as k
   where nullif(p_attribution ->> k, '') is not null;

  -- reserve stock atomically (one conditional UPDATE per line, in a stable order -> no deadlocks, no overselling)
  select w.id into v_wh from public.warehouses w where w.is_default and w.is_active;
  if v_wh is null then
    raise exception 'NO_DEFAULT_WAREHOUSE: configure an active default warehouse' using errcode = 'P0001';
  end if;
  for v_item in
    select x.variant_id, x.quantity
      from jsonb_to_recordset(v_priced -> 'items') as x(variant_id uuid, quantity numeric)
     order by x.variant_id
  loop
    select v.track_inventory, v.allow_backorder into v_track, v_backorder
      from public.product_variants v where v.id = v_item.variant_id;
    if v_track then
      update public.inventory_levels l
         set reserved = l.reserved + v_item.quantity, updated_at = now()
       where l.variant_id = v_item.variant_id and l.warehouse_id = v_wh
         and (v_backorder or l.on_hand - l.reserved >= v_item.quantity);
      if not found then
        if v_backorder then
          insert into public.inventory_levels as l (variant_id, warehouse_id, reserved)
          values (v_item.variant_id, v_wh, v_item.quantity)
          on conflict (variant_id, warehouse_id) do update set reserved = l.reserved + excluded.reserved, updated_at = now();
        else
          raise exception 'OUT_OF_STOCK: not enough stock for %',
            (select v.sku from public.product_variants v where v.id = v_item.variant_id) using errcode = 'P0001';
        end if;
      end if;
    end if;
  end loop;

  -- the order
  insert into public.orders (
    user_id, business_id, quote_request_id, channel, payment_method,
    customer_name, customer_phone, customer_email, shipping_address, billing_address,
    shipping_method_id, shipping_method_name, coupon_code,
    subtotal, discount_total, shipping_total, tax_total, grand_total, total_weight_kg,
    customer_note, attribution, payment_due_date)
  values (
    v_customer, p_business_id, p_quote_request_id, p_channel, p_payment_method,
    v_name, v_phone, v_email, v_addr, case when jsonb_typeof(p_billing_address) = 'object' then p_billing_address end,
    v_method.id, v_method.name, v_priced ->> 'coupon_code',
    (v_priced ->> 'subtotal')::numeric, (v_priced ->> 'discount_total')::numeric, (v_priced ->> 'shipping_total')::numeric,
    (v_priced ->> 'tax_total')::numeric, v_total, (v_priced ->> 'total_weight_kg')::numeric,
    left(nullif(trim(p_customer_note), ''), 2000), v_attr, v_due)
  returning id, order_number, public_token into v_order;

  insert into public.order_items (order_id, variant_id, product_id, warehouse_id, sku, product_name, variant_name,
                                  net_quantity, net_unit, quantity, unit_price, tax_rate, tax_amount, weight_grams)
  select v_order.id, x.variant_id, x.product_id, v_wh, x.sku, x.product_name, x.variant_name,
         x.net_quantity, x.net_unit::public.uom, x.quantity, x.unit_price, x.tax_rate, x.tax_amount, x.weight_grams
    from jsonb_to_recordset(v_priced -> 'items') as x(
           variant_id uuid, product_id uuid, sku text, product_name text, variant_name text,
           net_quantity numeric, net_unit text, quantity numeric, unit_price numeric,
           tax_rate numeric, tax_amount numeric, weight_grams integer);

  if (v_priced ->> 'coupon_id') is not null then
    update public.coupons set used_count = used_count + 1
     where id = (v_priced ->> 'coupon_id')::uuid
       and (usage_limit_total is null or used_count < usage_limit_total);
    if not found then
      raise exception 'COUPON_INVALID: this code has just reached its usage limit' using errcode = 'P0001';
    end if;
    insert into public.coupon_redemptions (coupon_id, order_id, user_id, customer_phone, discount_amount)
    values ((v_priced ->> 'coupon_id')::uuid, v_order.id, v_customer, v_phone, (v_priced ->> 'discount_total')::numeric);
  end if;

  -- online methods get a payment attempt the app can attach the gateway session to
  if p_payment_method in ('bkash','nagad','rocket','card','bank_transfer') and v_total > 0 then
    insert into public.payments (order_id, kind, method, provider, status, amount)
    values (v_order.id, 'charge', p_payment_method, p_payment_method::text, 'initiated', v_total)
    returning id into v_payment_id;
  end if;

  if p_quote_request_id is not null then
    update public.quote_requests set status = 'converted' where id = p_quote_request_id;
  end if;

  insert into public.order_events (order_id, event_type, to_value, message, actor_id)
  values (v_order.id, 'placed', 'pending', 'Order placed', v_uid);

  insert into public.notification_outbox (channel, recipient, template, payload)
  values ('sms', v_phone, 'order_placed',
          jsonb_build_object('order_number', v_order.order_number, 'grand_total', v_total, 'payment_method', p_payment_method));
  if v_email is not null then
    insert into public.notification_outbox (channel, recipient, template, payload)
    values ('email', v_email, 'order_placed',
            jsonb_build_object('order_number', v_order.order_number, 'grand_total', v_total, 'public_token', v_order.public_token));
  end if;

  return jsonb_build_object(
    'order_id',                v_order.id,
    'order_number',            v_order.order_number,
    'public_token',            v_order.public_token,
    'grand_total',             v_total,
    'currency',                'BDT',
    'payment_method',          p_payment_method,
    'payment_id',              v_payment_id,
    'requires_online_payment', v_payment_id is not null);
end $$;

-- customers can cancel while the order is still 'pending' and unpaid; staff any time before shipping
create function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_o     public.orders;
  v_staff boolean := coalesce(private.can_manage_orders(), false);
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found
     or not (v_staff or v_o.user_id = (select auth.uid())
             or (v_o.business_id is not null and private.is_business_member(v_o.business_id))) then
    raise exception 'ORDER_NOT_FOUND: no such order' using errcode = 'P0001';
  end if;
  if not v_staff and (v_o.status <> 'pending' or v_o.amount_paid > 0) then
    raise exception 'ORDER_NOT_CANCELLABLE: this order is already being processed or paid - please contact us' using errcode = 'P0001';
  end if;
  update public.orders
     set status = 'cancelled', cancel_reason = left(nullif(trim(p_reason), ''), 500)
   where id = p_order_id;
end $$;

-- -----------------------------------------------------------------------------
-- 4. ORDER LOOKUP FOR GUESTS (no account needed)
-- -----------------------------------------------------------------------------
create function private.order_to_json(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'payment_status', o.payment_status,
    'fulfillment_status', o.fulfillment_status, 'payment_method', o.payment_method, 'placed_at', o.placed_at,
    'currency', o.currency, 'subtotal', o.subtotal, 'discount_total', o.discount_total,
    'shipping_total', o.shipping_total, 'tax_total', o.tax_total, 'grand_total', o.grand_total, 'amount_paid', o.amount_paid,
    'customer_name', o.customer_name, 'shipping_address', o.shipping_address, 'shipping_method', o.shipping_method_name,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                'product_name', i.product_name, 'variant_name', i.variant_name, 'sku', i.sku, 'quantity', i.quantity,
                'unit_price', i.unit_price, 'line_total', i.line_total, 'shipped_quantity', i.shipped_quantity)
                order by i.created_at, i.id)
              from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'shipments', coalesce((select jsonb_agg(jsonb_build_object(
                'status', s.status, 'carrier', s.carrier, 'tracking_number', s.tracking_number,
                'tracking_url', s.tracking_url, 'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at)
                order by s.created_at, s.id)
              from public.shipments s where s.order_id = o.id), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object(
                'event', e.event_type, 'to', e.to_value, 'message', e.message, 'at', e.created_at)
                order by e.created_at, e.id)
              from public.order_events e where e.order_id = o.id), '[]'::jsonb))
  from public.orders o where o.id = p_order_id
$$;

-- "Track my order": order number + the phone number used at checkout
create function public.track_order(p_order_number text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  select o.id into v_id from public.orders o
   where o.order_number = upper(trim(p_order_number)) and o.customer_phone = private.normalize_phone(p_phone);
  if v_id is null then
    raise exception 'ORDER_NOT_FOUND: check the order number and phone number' using errcode = 'P0001';
  end if;
  return private.order_to_json(v_id);
end $$;

-- confirmation page / emailed link: /order/<public_token>
create function public.get_order_by_token(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  select o.id into v_id from public.orders o where o.public_token = p_token;
  if v_id is null then
    raise exception 'ORDER_NOT_FOUND: no such order' using errcode = 'P0001';
  end if;
  return private.order_to_json(v_id);
end $$;

-- -----------------------------------------------------------------------------
-- 5. STOREFRONT VIEWS & SEARCH (security_invoker: RLS of the caller applies)
-- -----------------------------------------------------------------------------
create view public.product_cards with (security_invoker = true) as
select p.id, p.slug, p.name, p.name_bn, p.summary, p.summary_bn,
       p.category_id, c.slug as category_slug, c.name as category_name, c.name_bn as category_name_bn,
       p.source, p.grade, p.uses, p.certifications, p.is_featured, p.sort_order,
       p.rating_avg, p.rating_count, p.published_at,
       min(v.price)                              as price_from,
       bool_or(v.stock_status <> 'out_of_stock') as in_stock,
       (select i.storage_path from public.product_images i
         where i.product_id = p.id order by i.is_primary desc, i.sort_order, i.created_at limit 1) as image_path
  from public.products p
  left join public.categories c on c.id = p.category_id
  join public.product_variants v on v.product_id = p.id and v.is_active
 where p.status = 'active'
 group by p.id, c.id;

create function public.search_products(p_query text, p_limit integer default 24, p_offset integer default 0)
returns setof public.product_cards
language sql stable set search_path = '' as $$
  select pc.*
    from public.product_cards pc
    join public.products p on p.id = pc.id
   cross join lateral (
         select websearch_to_tsquery('simple', p_query) as tsq,
                '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat) q
   where nullif(trim(p_query), '') is not null
     and (p.search @@ q.tsq or p.name ilike q.pat or p.name_bn ilike q.pat)
   order by ts_rank_cd(p.search, q.tsq) desc, p.name
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- "scan the QR code on the jar": public lot lookup with the lab results (released / expired lots only)
create function public.lot_lookup(p_lot_code text)
returns table (lot_code text, product_name text, product_name_bn text, product_slug text, status public.batch_status,
               produced_on date, best_before date, brix numeric, total_sugar_pct numeric, moisture_pct numeric,
               ash_pct numeric, ph numeric, density_kg_per_l numeric, tested_on date)
language sql stable security definer set search_path = '' as $$
  select b.lot_code, p.name, p.name_bn, p.slug::text, b.status, b.produced_on, b.best_before, b.brix,
         b.total_sugar_pct, b.moisture_pct, b.ash_pct, b.ph, b.density_kg_per_l, b.tested_on
    from public.batches b
    join public.products p on p.id = b.product_id
   where b.lot_code = upper(trim(p_lot_code)) and b.status in ('released','expired')
   limit 1
$$;

-- -----------------------------------------------------------------------------
-- 6. BACK-OFFICE VIEWS (staff only through RLS) & HOUSEKEEPING
-- -----------------------------------------------------------------------------
create view public.admin_low_stock with (security_invoker = true) as
select v.id as variant_id, v.sku, p.name as product_name, v.name as variant_name, w.code as warehouse,
       l.on_hand, l.reserved, l.available, l.reorder_point
  from public.inventory_levels l
  join public.product_variants v on v.id = l.variant_id
  join public.products p on p.id = v.product_id
  join public.warehouses w on w.id = l.warehouse_id
 where v.track_inventory and l.available <= greatest(l.reorder_point, v.low_stock_threshold);

create view public.admin_sales_daily with (security_invoker = true) as
select (o.placed_at at time zone 'Asia/Dhaka')::date                                              as day,
       count(*)                                                                                   as orders,
       count(*) filter (where o.status = 'cancelled')                                             as cancelled,
       sum(o.grand_total) filter (where o.status not in ('cancelled','returned'))                 as revenue,
       sum(o.amount_paid)                                                                         as collected,
       round(avg(o.grand_total) filter (where o.status not in ('cancelled','returned')), 2)       as avg_order_value
  from public.orders o
 group by 1;

-- cancels online-payment orders that were never paid, which also releases their reserved stock.
-- Schedule it with pg_cron (Dashboard > Integrations > Cron):
--   select cron.schedule('expire-unpaid-orders', '*/10 * * * *', $$ select private.expire_stale_orders(60) $$);
create function private.expire_stale_orders(p_minutes integer default 60)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with stale as (
    update public.orders o
       set status = 'cancelled', cancel_reason = 'Online payment was not completed in time'
     where o.status = 'pending' and o.payment_status = 'unpaid'
       and o.payment_method in ('bkash','nagad','rocket','card')
       and o.placed_at < now() - make_interval(mins => p_minutes)
       and not exists (select 1 from public.payments p where p.order_id = o.id and p.status in ('pending','succeeded'))
    returning 1)
  select count(*) into v_count from stale;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- 7. WHO MAY CALL WHAT
-- -----------------------------------------------------------------------------
-- functions created in this migration start with PostgreSQL's default EXECUTE-for-everyone:
-- close the private schema again and re-open only the helpers that RLS policies call
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.current_staff_role(), private.is_staff(), private.is_owner(), private.is_admin(),
  private.is_manager(), private.can_manage_content(), private.can_manage_orders(),
  private.is_business_member(uuid), private.is_approved_business_member()
  to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.preview_cart(jsonb, smallint, uuid, text, uuid)                 to anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb, uuid, public.payment_method, text, text, uuid,
                                             jsonb, jsonb, text, uuid, uuid, jsonb)               to anon, authenticated;
grant execute on function public.cancel_order(uuid, text)                                         to authenticated;
grant execute on function public.track_order(text, text)                                          to anon, authenticated;
grant execute on function public.get_order_by_token(uuid)                                         to anon, authenticated;
grant execute on function public.search_products(text, integer, integer)                          to anon, authenticated;
grant execute on function public.lot_lookup(text)                                                 to anon, authenticated;
grant execute on all functions in schema public to service_role;

grant select on public.product_cards                         to anon, authenticated, service_role;
grant select on public.admin_low_stock, public.admin_sales_daily to authenticated, service_role;
