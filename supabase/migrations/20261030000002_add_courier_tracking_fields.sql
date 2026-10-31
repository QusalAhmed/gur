-- Add Steadfast courier tracking and consignment columns to orders table
alter table public.orders
  add column if not exists courier_consignment_id text,
  add column if not exists courier_tracking_code text,
  add column if not exists courier_tracking_url text;

-- Create unique indexes for fast lookup and to prevent duplicate consignments across orders
create unique index if not exists idx_orders_courier_consignment on public.orders (courier_consignment_id) where courier_consignment_id is not null;
create index if not exists idx_orders_courier_tracking on public.orders (courier_tracking_code) where courier_tracking_code is not null;

