-- =============================================================================
-- Migration: Admin Reporting & Operations
-- 1. admin_kpis(p_from timestamptz, p_to timestamptz)
-- 2. admin_sales_series(p_from timestamptz, p_to timestamptz, p_bucket text)
-- 3. admin_top_products(p_from timestamptz, p_to timestamptz, p_limit integer)
-- 4. admin_sales_breakdown(p_from timestamptz, p_to timestamptz, p_dimension text)
-- 5. view public.admin_batch_stock
-- 6. view public.admin_incomplete_orders
-- 7. assign_invoice_number(p_order_id uuid)
-- 8. set_order_items(p_order_id uuid, p_items jsonb, p_price_overrides jsonb)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. KPI Aggregation Function
-- -----------------------------------------------------------------------------
create or replace function public.admin_kpis(
  p_from timestamptz default '-infinity'::timestamptz,
  p_to   timestamptz default 'infinity'::timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff             boolean := coalesce(private.is_staff(), false);
  v_orders_count      bigint  := 0;
  v_revenue           numeric(14,2) := 0;
  v_aov               numeric(14,2) := 0;
  v_collected         numeric(14,2) := 0;
  v_new_customers     bigint  := 0;
  v_checkouts_started bigint  := 0;
  v_conversion_rate   numeric(5,2)  := 0;
  v_low_stock_count   bigint  := 0;
begin
  if not v_staff then
    raise exception 'FORBIDDEN: staff access required' using errcode = 'P0001';
  end if;

  -- 1. Valid orders and revenue (excluding cancelled, returned, incomplete_order)
  select
    coalesce(count(*), 0),
    coalesce(sum(o.grand_total), 0)
  into v_orders_count, v_revenue
  from public.orders o
  where o.created_at >= p_from
    and o.created_at <= p_to
    and o.status not in ('cancelled', 'returned', 'incomplete_order');

  -- 2. Average Order Value (AOV)
  if v_orders_count > 0 then
    v_aov := round(v_revenue / v_orders_count, 2);
  else
    v_aov := 0;
  end if;

  -- 3. Collected Revenue (from succeeded charges in the period)
  select
    coalesce(sum(case when p.kind = 'charge' then p.amount else -p.amount end), 0)
  into v_collected
  from public.payments p
  where p.created_at >= p_from
    and p.created_at <= p_to
    and p.status = 'succeeded';

  -- 4. New Customer Signups
  select coalesce(count(*), 0)
  into v_new_customers
  from public.profiles pr
  where pr.created_at >= p_from
    and pr.created_at <= p_to;

  -- 5. Checkouts Started (all orders placed + incomplete checkouts recorded)
  select coalesce(count(*), 0)
  into v_checkouts_started
  from public.orders o
  where o.created_at >= p_from
    and o.created_at <= p_to;

  -- 6. Checkout-to-Order Conversion Rate
  if v_checkouts_started > 0 then
    v_conversion_rate := round((v_orders_count::numeric / v_checkouts_started::numeric) * 100, 2);
  else
    v_conversion_rate := 0;
  end if;

  -- 7. Low Stock Variant Count
  select coalesce(count(*), 0)
  into v_low_stock_count
  from public.product_variants pv
  where pv.is_active
    and pv.track_inventory
    and pv.stock_status = 'low_stock';

  return jsonb_build_object(
    'orders_count',      v_orders_count,
    'revenue',           v_revenue,
    'average_order',     v_aov,
    'amount_collected',  v_collected,
    'new_customers',     v_new_customers,
    'checkouts_started', v_checkouts_started,
    'conversion_rate',   v_conversion_rate,
    'low_stock_count',   v_low_stock_count
  );
end;
$$;

revoke all on function public.admin_kpis(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_kpis(timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Sales Time Series
-- -----------------------------------------------------------------------------
create or replace function public.admin_sales_series(
  p_from   timestamptz default (now() - interval '30 days'),
  p_to     timestamptz default now(),
  p_bucket text default 'day'
)
returns table (
  bucket_time  timestamptz,
  bucket_label text,
  orders_count bigint,
  revenue      numeric(14,2),
  collected    numeric(14,2)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_staff(), false) then
    raise exception 'FORBIDDEN: staff access required' using errcode = 'P0001';
  end if;

  return query
  with series as (
    select generate_series(
      date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, p_from),
      date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, p_to),
      case when p_bucket = 'week' then interval '1 week' else interval '1 day' end
    ) as b_time
  ),
  order_aggs as (
    select
      date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, o.created_at) as b_time,
      count(*) as ord_cnt,
      sum(o.grand_total) as rev
    from public.orders o
    where o.created_at >= p_from
      and o.created_at <= p_to
      and o.status not in ('cancelled', 'returned', 'incomplete_order')
    group by 1
  ),
  payment_aggs as (
    select
      date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, p.created_at) as b_time,
      sum(case when p.kind = 'charge' then p.amount else -p.amount end) as col
    from public.payments p
    where p.created_at >= p_from
      and p.created_at <= p_to
      and p.status = 'succeeded'
    group by 1
  )
  select
    s.b_time as bucket_time,
    to_char(s.b_time at time zone 'Asia/Dhaka', 'DD Mon') as bucket_label,
    coalesce(oa.ord_cnt, 0)::bigint as orders_count,
    coalesce(oa.rev, 0)::numeric(14,2) as revenue,
    coalesce(pa.col, 0)::numeric(14,2) as collected
  from series s
  left join order_aggs oa on oa.b_time = s.b_time
  left join payment_aggs pa on pa.b_time = s.b_time
  order by s.b_time asc;
end;
$$;

revoke all on function public.admin_sales_series(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_sales_series(timestamptz, timestamptz, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Top Products
-- -----------------------------------------------------------------------------
create or replace function public.admin_top_products(
  p_from  timestamptz default (now() - interval '30 days'),
  p_to    timestamptz default now(),
  p_limit integer default 5
)
returns table (
  product_id   uuid,
  product_name text,
  units_sold   numeric,
  revenue      numeric(14,2),
  order_count  bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_staff(), false) then
    raise exception 'FORBIDDEN: staff access required' using errcode = 'P0001';
  end if;

  return query
  select
    oi.product_id,
    oi.product_name,
    coalesce(sum(oi.quantity), 0) as units_sold,
    coalesce(sum(oi.unit_price * oi.quantity), 0)::numeric(14,2) as revenue,
    count(distinct oi.order_id)::bigint as order_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.created_at >= p_from
    and o.created_at <= p_to
    and o.status not in ('cancelled', 'returned', 'incomplete_order')
  group by oi.product_id, oi.product_name
  order by revenue desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_top_products(timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.admin_top_products(timestamptz, timestamptz, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Sales Breakdown by Dimension (status, channel, utm_source, district)
-- -----------------------------------------------------------------------------
create or replace function public.admin_sales_breakdown(
  p_from      timestamptz default (now() - interval '30 days'),
  p_to        timestamptz default now(),
  p_dimension text default 'status'
)
returns table (
  dimension_key   text,
  dimension_label text,
  orders_count    bigint,
  revenue         numeric(14,2)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_staff(), false) then
    raise exception 'FORBIDDEN: staff access required' using errcode = 'P0001';
  end if;

  if p_dimension = 'status' then
    return query
    select
      o.status::text as dimension_key,
      initcap(replace(o.status::text, '_', ' ')) as dimension_label,
      count(*)::bigint as orders_count,
      coalesce(sum(o.grand_total), 0)::numeric(14,2) as revenue
    from public.orders o
    where o.created_at >= p_from and o.created_at <= p_to
    group by o.status
    order by orders_count desc;

  elsif p_dimension = 'channel' then
    return query
    select
      coalesce(o.channel, 'web') as dimension_key,
      initcap(coalesce(o.channel, 'web')) as dimension_label,
      count(*)::bigint as orders_count,
      coalesce(sum(o.grand_total), 0)::numeric(14,2) as revenue
    from public.orders o
    where o.created_at >= p_from
      and o.created_at <= p_to
      and o.status not in ('cancelled', 'returned', 'incomplete_order')
    group by o.channel
    order by revenue desc;

  elsif p_dimension = 'utm_source' then
    return query
    select
      coalesce(nullif(trim(o.attribution ->> 'utm_source'), ''), 'Direct') as dimension_key,
      coalesce(nullif(trim(o.attribution ->> 'utm_source'), ''), 'Direct / Organic') as dimension_label,
      count(*)::bigint as orders_count,
      coalesce(sum(o.grand_total), 0)::numeric(14,2) as revenue
    from public.orders o
    where o.created_at >= p_from
      and o.created_at <= p_to
      and o.status not in ('cancelled', 'returned', 'incomplete_order')
    group by 1
    order by revenue desc;

  elsif p_dimension = 'district' then
    return query
    select
      coalesce(nullif(trim(o.shipping_address ->> 'district'), ''), 'Other') as dimension_key,
      coalesce(nullif(trim(o.shipping_address ->> 'district'), ''), 'Other Districts') as dimension_label,
      count(*)::bigint as orders_count,
      coalesce(sum(o.grand_total), 0)::numeric(14,2) as revenue
    from public.orders o
    where o.created_at >= p_from
      and o.created_at <= p_to
      and o.status not in ('cancelled', 'returned', 'incomplete_order')
    group by 1
    order by revenue desc;

  else
    raise exception 'INVALID_DIMENSION: valid dimensions are status, channel, utm_source, district'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.admin_sales_breakdown(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_sales_breakdown(timestamptz, timestamptz, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Remaining Quantity Per Lot from Stock Movements Ledger
-- -----------------------------------------------------------------------------
create or replace view public.admin_batch_stock with (security_invoker = true) as
select
  b.id as batch_id,
  b.lot_code,
  b.product_id,
  p.name as product_name,
  b.status as batch_status,
  b.best_before,
  b.received_on,
  coalesce(sum(m.quantity_delta), 0) as remaining_quantity,
  b.brix,
  b.ph,
  b.moisture_pct,
  b.density_kg_per_l,
  b.ash_pct
from public.batches b
join public.products p on p.id = b.product_id
left join public.stock_movements m on m.batch_id = b.id
group by b.id, b.lot_code, b.product_id, p.name, b.status, b.best_before, b.received_on,
         b.brix, b.ph, b.moisture_pct, b.density_kg_per_l, b.ash_pct;

grant select on public.admin_batch_stock to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Incomplete Checkouts Fast View
-- -----------------------------------------------------------------------------
create or replace view public.admin_incomplete_orders with (security_invoker = true) as
select
  o.id,
  o.order_number,
  o.created_at,
  o.updated_at,
  o.customer_name,
  o.customer_phone,
  o.customer_email,
  o.shipping_address,
  coalesce(o.shipping_address ->> 'district', 'Unknown') as district_name,
  o.grand_total,
  o.attribution,
  o.attribution ->> 'utm_campaign' as campaign,
  o.attribution ->> 'utm_source'   as source,
  (select count(*) from public.order_items oi where oi.order_id = o.id) as item_count,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_name', oi.product_name,
      'variant_name', oi.variant_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price
    )), '[]'::jsonb)
    from public.order_items oi
    where oi.order_id = o.id
  ) as items_summary,
  round(extract(epoch from (now() - o.created_at)) / 3600, 1) as age_hours
from public.orders o
where o.status = 'incomplete_order';

grant select on public.admin_incomplete_orders to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Sequence-backed Idempotent Invoice Number Generator
-- -----------------------------------------------------------------------------
create sequence if not exists public.order_invoice_seq start with 1001;

create or replace function public.assign_invoice_number(p_order_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ord     public.orders;
  v_seq     bigint;
  v_yymm    text;
  v_inv_num text;
begin
  if not coalesce(private.is_staff(), false) then
    raise exception 'FORBIDDEN: staff access required' using errcode = 'P0001';
  end if;

  select * into v_ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Idempotent: return existing invoice number if already assigned
  if v_ord.invoice_number is not null and trim(v_ord.invoice_number) <> '' then
    return v_ord.invoice_number;
  end if;

  -- Generate invoice number format: INV-YYMM-00001
  v_yymm := to_char(now() at time zone 'Asia/Dhaka', 'YYMM');
  v_seq := nextval('public.order_invoice_seq');
  v_inv_num := 'INV-' || v_yymm || '-' || lpad(v_seq::text, 5, '0');

  update public.orders
     set invoice_number = v_inv_num,
         invoiced_at    = coalesce(invoiced_at, now())
   where id = p_order_id;

  return v_inv_num;
end;
$$;

revoke all on function public.assign_invoice_number(uuid) from public, anon;
grant execute on function public.assign_invoice_number(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Atomic Order Item Modification with Stock Reservation Adjustment
-- -----------------------------------------------------------------------------
create or replace function public.set_order_items(
  p_order_id        uuid,
  p_items           jsonb,
  p_price_overrides jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff     boolean := coalesce(private.can_manage_orders(), false);
  v_ord       public.orders;
  v_old_item  record;
  v_new_item  record;
  v_priced    jsonb;
  v_wh        uuid;
  v_track     boolean;
  v_backorder boolean;
  v_district  smallint;
begin
  if not v_staff then
    raise exception 'FORBIDDEN: staff access required' using errcode = 'P0001';
  end if;

  select * into v_ord from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Refuse if already has shipments or paid
  if exists (select 1 from public.shipments where order_id = p_order_id) then
    raise exception 'ORDER_HAS_SHIPMENTS: cannot modify order lines after shipment' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.payments where order_id = p_order_id and status = 'succeeded')
     or v_ord.amount_paid > 0 then
    raise exception 'ORDER_HAS_PAYMENTS: cannot modify order lines after payment has been recorded' using errcode = 'P0001';
  end if;

  if v_ord.status in ('shipped', 'delivered', 'cancelled', 'returned') then
    raise exception 'ORDER_FINAL: order is % and cannot be edited', v_ord.status using errcode = 'P0001';
  end if;

  -- 1. Release previous stock reservations for all items in this order
  for v_old_item in
    select oi.variant_id, oi.warehouse_id, oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    select v.track_inventory into v_track
    from public.product_variants v
    where v.id = v_old_item.variant_id;

    if coalesce(v_track, false) then
      update public.inventory_levels
         set reserved = greatest(reserved - v_old_item.quantity, 0),
             updated_at = now()
       where variant_id = v_old_item.variant_id
         and warehouse_id = v_old_item.warehouse_id;
    end if;
  end loop;

  -- 2. Clear old items
  delete from public.order_items where order_id = p_order_id;

  -- If empty items provided, reset totals and exit
  if p_items is null or jsonb_array_length(p_items) = 0 then
    update public.orders
       set subtotal = 0,
           discount_total = 0,
           shipping_total = 0,
           tax_total = 0,
           grand_total = 0,
           total_weight_kg = 0,
           updated_at = now()
     where id = p_order_id;

    return jsonb_build_object('success', true, 'item_count', 0, 'grand_total', 0);
  end if;

  -- 3. Re-price cart server-side
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

  -- 4. Re-reserve stock for each item in default warehouse
  select w.id into v_wh from public.warehouses w where w.is_default and w.is_active;
  if v_wh is null then
    select w.id into v_wh from public.warehouses w where w.is_active limit 1;
  end if;

  for v_new_item in
    select x.variant_id, x.quantity
    from jsonb_to_recordset(v_priced -> 'items') as x(variant_id uuid, quantity numeric)
  loop
    select v.track_inventory, v.allow_backorder into v_track, v_backorder
    from public.product_variants v
    where v.id = v_new_item.variant_id;

    if coalesce(v_track, false) then
      update public.inventory_levels l
         set reserved = l.reserved + v_new_item.quantity,
             updated_at = now()
       where l.variant_id = v_new_item.variant_id
         and l.warehouse_id = v_wh
         and (v_backorder or l.on_hand - l.reserved >= v_new_item.quantity);

      if not found then
        if v_backorder then
          insert into public.inventory_levels as l (variant_id, warehouse_id, reserved)
          values (v_new_item.variant_id, v_wh, v_new_item.quantity)
          on conflict (variant_id, warehouse_id) do update set reserved = l.reserved + excluded.reserved, updated_at = now();
        else
          raise exception 'OUT_OF_STOCK: not enough stock for variant %', v_new_item.variant_id using errcode = 'P0001';
        end if;
      end if;
    end if;
  end loop;

  -- 5. Insert new order items
  insert into public.order_items (
    order_id, variant_id, product_id, warehouse_id, sku, product_name, variant_name,
    net_quantity, net_unit, quantity, unit_price, tax_rate, tax_amount, weight_grams
  )
  select
    p_order_id, x.variant_id, x.product_id, v_wh, x.sku, x.product_name, x.variant_name,
    x.net_quantity, x.net_unit::public.uom, x.quantity, x.unit_price, x.tax_rate, x.tax_amount, x.weight_grams
  from jsonb_to_recordset(v_priced -> 'items') as x(
    variant_id uuid, product_id uuid, sku text, product_name text, variant_name text,
    net_quantity numeric, net_unit text, quantity numeric, unit_price numeric,
    tax_rate numeric, tax_amount numeric, weight_grams integer
  );

  -- 6. Update order totals
  update public.orders
     set subtotal        = (v_priced ->> 'subtotal')::numeric,
         discount_total  = (v_priced ->> 'discount_total')::numeric,
         shipping_total  = (v_priced ->> 'shipping_total')::numeric,
         tax_total       = (v_priced ->> 'tax_total')::numeric,
         grand_total     = (v_priced ->> 'grand_total')::numeric,
         total_weight_kg = (v_priced ->> 'total_weight_kg')::numeric,
         updated_at      = now()
   where id = p_order_id;

  -- 7. Add internal timeline note
  insert into public.order_events (order_id, event_type, to_value, message, actor_id)
  values (
    p_order_id,
    'note_added',
    v_ord.status::text,
    'Order items updated by staff (new total: ৳' || (v_priced ->> 'grand_total') || ')',
    auth.uid()
  );

  return jsonb_build_object(
    'success',     true,
    'order_id',    p_order_id,
    'grand_total', (v_priced ->> 'grand_total')::numeric,
    'items',       v_priced -> 'items'
  );
end;
$$;

revoke all on function public.set_order_items(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.set_order_items(uuid, jsonb, jsonb) to authenticated;
