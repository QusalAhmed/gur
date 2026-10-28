-- =============================================================================
-- MOLASSES STORE · migration 1 of 3 · SCHEMA
-- Target : Supabase (PostgreSQL 15+). Run once on a fresh project, then run
--          migration 2 (security) and 3 (functions & views).
--
-- Conventions
--   money       numeric(14,2), BDT (the currency code is stored on each order)
--   quantities  numeric(12,3)  -> 2.5 t, 0.5 L ... are valid order quantities
--   ids         uuid for entities, bigint identity for append-only ledgers
--   *_bn        Bangla translation sitting next to the English column
--   user links  point at public.profiles (so PostgREST can embed names);
--               profiles.id is the ONLY foreign key into auth.users
--   privacy     customer-readable tables never hold internal data: cost lives
--               in stock_movements, staff comments in staff_notes, raw gateway
--               payloads in payment_logs (all staff-only / service-only)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS & SCHEMAS
-- -----------------------------------------------------------------------------
create schema if not exists extensions;                       -- already exists on Supabase
create extension if not exists pg_trgm with schema extensions; -- fast ILIKE / fuzzy search

create schema if not exists private;                          -- helpers + trigger functions, NOT exposed by the Data API
comment on schema private is 'Internal helpers and trigger functions. Never exposed through the Data API.';

-- -----------------------------------------------------------------------------
-- 1. TYPES
-- -----------------------------------------------------------------------------
create domain public.slug          as text check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(value) <= 120);
-- (phone numbers are plain text + CHECK, not a domain: a domain is validated when the value is coerced,
--  i.e. BEFORE the normalising trigger could turn 01712345678 into +8801712345678)
create domain public.email_address as text check (value ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(value) <= 254);

create type public.app_role             as enum ('owner','admin','manager','editor','support');
create type public.account_type         as enum ('individual','business');
create type public.business_status      as enum ('pending','approved','suspended');
create type public.business_member_role as enum ('owner','buyer','accountant');
create type public.product_status       as enum ('draft','active','archived');
create type public.molasses_source      as enum ('sugarcane','sugar_beet','date_palm','palmyra','sorghum','other');
create type public.product_use          as enum ('edible','animal_feed','industrial','agricultural','cosmetic');
create type public.pack_type            as enum ('bottle','jar','pouch','pail','jerrycan','drum','ibc_tote','bag','block','tanker','bulk','other');
create type public.uom                  as enum ('g','kg','ml','l','t','pcs');
create type public.stock_status         as enum ('in_stock','low_stock','out_of_stock','backorder');
create type public.batch_status         as enum ('quarantine','released','blocked','expired');
create type public.stock_movement_type  as enum ('receipt','sale','return','adjustment','transfer_in','transfer_out','write_off');
create type public.document_kind        as enum ('coa','spec_sheet','msds','certificate','brochure','other');
create type public.discount_type        as enum ('percentage','fixed_amount','free_shipping');
create type public.order_status         as enum ('pending','confirmed','processing','shipped','delivered','cancelled','returned');
create type public.payment_status       as enum ('unpaid','partially_paid','paid','partially_refunded','refunded');
create type public.fulfillment_status   as enum ('unfulfilled','partial','fulfilled');
create type public.payment_method       as enum ('cod','bkash','nagad','rocket','card','bank_transfer','cash','credit_terms');
create type public.payment_kind         as enum ('charge','refund');
create type public.payment_txn_status   as enum ('initiated','pending','succeeded','failed','cancelled');
create type public.shipment_status      as enum ('preparing','in_transit','delivered','failed','returned');
create type public.quote_status         as enum ('new','in_review','quoted','accepted','declined','expired','converted');
create type public.review_status        as enum ('pending','approved','rejected');
create type public.post_status          as enum ('draft','published','archived');
create type public.message_status       as enum ('new','read','replied','spam');
create type public.outbox_channel       as enum ('sms','email','whatsapp','webhook');
create type public.outbox_status        as enum ('pending','sent','failed','cancelled');

-- -----------------------------------------------------------------------------
-- 2. GENERIC HELPERS
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- '01712-345678' | '8801712345678' | '+8801712345678'  ->  '+8801712345678'
create function private.normalize_phone(p_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  s text := regexp_replace(coalesce(p_phone, ''), '[\s\-\.\(\)]', '', 'g');
begin
  if s = ''                  then return null;               end if;
  if s ~ '^01[0-9]{9}$'      then return '+88' || s;         end if;  -- local BD mobile
  if s ~ '^8801[0-9]{9}$'    then return '+' || s;           end if;  -- BD without the plus
  if s ~ '^00[1-9]'          then return '+' || substr(s, 3); end if; -- 00 international prefix
  return s;                                                           -- E.164 already (CHECKs reject the rest)
end $$;

-- BEFORE trigger: normalises the phone column named in TG_ARGV[0]
create function private.normalize_phone_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_col text := tg_argv[0];
  v_val text := to_jsonb(new) ->> tg_argv[0];
begin
  if v_val is not null then
    new := jsonb_populate_record(new, jsonb_build_object(v_col, private.normalize_phone(v_val)));
  end if;
  return new;
end $$;

create function private.forbid_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op using errcode = 'P0001';
end $$;

-- 'MOL-2610-01001' style human-friendly numbers (month in Asia/Dhaka time)
create sequence private.order_number_seq start 1001;
create sequence private.quote_number_seq start 1001;

create function private.next_number(p_prefix text, p_seq regclass)
returns text language sql volatile set search_path = '' as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Dhaka', 'YYMM') || '-' || lpad(nextval(p_seq)::text, 5, '0')
$$;

-- -----------------------------------------------------------------------------
-- 3. GEOGRAPHY, DELIVERY ZONES, SHIPPING
-- -----------------------------------------------------------------------------
create table public.geo_divisions (
  id      smallint generated always as identity primary key,
  name    text not null unique,
  name_bn text
);

create table public.delivery_zones (
  id        smallint generated always as identity primary key,
  name      text not null unique,
  name_bn   text,
  is_active boolean not null default true
);

create table public.geo_districts (
  id          smallint generated always as identity primary key,
  division_id smallint not null references public.geo_divisions (id),
  zone_id     smallint references public.delivery_zones (id) on delete set null,
  name        text not null unique,
  name_bn     text
);
create index on public.geo_districts (division_id);
create index on public.geo_districts (zone_id);

create table public.shipping_methods (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z0-9_]+$'),
  name           text not null,
  name_bn        text,
  description    text,
  description_bn text,
  is_pickup      boolean not null default false,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- fee = base_fee + per_kg_fee * total_kg, for the weight band [min_weight_kg, max_weight_kg)
create table public.shipping_rates (
  id               uuid primary key default gen_random_uuid(),
  method_id        uuid not null references public.shipping_methods (id) on delete cascade,
  zone_id          smallint references public.delivery_zones (id) on delete cascade,   -- NULL = every zone
  min_weight_kg    numeric(10,3) not null default 0 check (min_weight_kg >= 0),
  max_weight_kg    numeric(10,3) check (max_weight_kg is null or max_weight_kg > min_weight_kg),
  base_fee         numeric(12,2) not null default 0 check (base_fee >= 0),
  per_kg_fee       numeric(12,4) not null default 0 check (per_kg_fee >= 0),
  free_over_amount numeric(14,2) check (free_over_amount is null or free_over_amount >= 0),
  eta_days_min     smallint check (eta_days_min >= 0),
  eta_days_max     smallint check (eta_days_max >= eta_days_min),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index shipping_rates_band_key on public.shipping_rates (method_id, zone_id, min_weight_kg) nulls not distinct;

-- -----------------------------------------------------------------------------
-- 4. PEOPLE: profiles, staff, B2B accounts, address book
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text check (char_length(full_name) between 1 and 120),
  phone              text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_path        text,
  account_type       public.account_type not null default 'individual',
  preferred_language text not null default 'en' check (preferred_language in ('en','bn')),
  marketing_opt_in   boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.profiles (phone);

create table public.staff_members (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  role       public.app_role not null default 'support',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create table public.business_accounts (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 2 and 200),
  industry           text check (char_length(industry) <= 80),     -- dairy_farm, feed_mill, distillery, yeast, trader ...
  trade_license_no   text check (char_length(trade_license_no) <= 80),
  bin                text check (char_length(bin) <= 40),           -- VAT Business Identification Number
  tin                text check (char_length(tin) <= 40),           -- taxpayer ID
  contact_name       text check (char_length(contact_name) <= 120),
  contact_phone      text check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email      public.email_address,
  address_line       text check (char_length(address_line) <= 500),
  district_id        smallint references public.geo_districts (id),
  status             public.business_status not null default 'pending',
  credit_limit       numeric(14,2) not null default 0 check (credit_limit >= 0),
  payment_terms_days smallint not null default 0 check (payment_terms_days between 0 and 180),
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  approved_by        uuid references public.profiles (id) on delete set null,
  approved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.business_accounts (status);

create table public.business_members (
  business_id uuid not null references public.business_accounts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.business_member_role not null default 'buyer',
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_members (user_id);

create table public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles (id) on delete cascade,
  business_id    uuid references public.business_accounts (id) on delete cascade,
  label          text check (char_length(label) <= 60),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone          text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  country_code   char(2) not null default 'BD',
  district_id    smallint references public.geo_districts (id),
  upazila        text check (char_length(upazila) <= 120),            -- upazila / thana (free text)
  address_line   text not null check (char_length(address_line) between 3 and 500),
  postal_code    text check (char_length(postal_code) <= 16),
  landmark       text check (char_length(landmark) <= 200),
  latitude       numeric(9,6) check (latitude between -90 and 90),
  longitude      numeric(9,6) check (longitude between -180 and 180),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (user_id is not null or business_id is not null)
);
create index on public.addresses (user_id);
create index on public.addresses (business_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default and user_id is not null;

-- -----------------------------------------------------------------------------
-- 5. CATALOG
-- -----------------------------------------------------------------------------
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references public.categories (id) on delete set null,
  slug            public.slug not null unique,
  name            text not null check (char_length(name) between 1 and 120),
  name_bn         text,
  description     text,
  description_bn  text,
  image_path      text,                                  -- path inside the 'catalog-images' bucket
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index on public.categories (parent_id);

create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  slug                 public.slug not null unique,
  name                 text not null check (char_length(name) between 2 and 200),
  name_bn              text,
  summary              text,
  summary_bn           text,
  description          text,                              -- markdown
  description_bn       text,
  category_id          uuid references public.categories (id) on delete set null,
  status               public.product_status not null default 'draft',
  source               public.molasses_source not null default 'sugarcane',
  grade                text check (char_length(grade) <= 80),   -- 'Blackstrap', 'Food grade', 'Feed grade A' ...
  uses                 public.product_use[] not null default '{}',
  origin               text,                              -- region / mill / farm
  ingredients          text,
  storage_instructions text,
  shelf_life_days      integer check (shelf_life_days > 0),
  nutrition            jsonb not null default '{}' check (jsonb_typeof(nutrition) = 'object'),       -- per 100 g
  specifications       jsonb not null default '{}' check (jsonb_typeof(specifications) = 'object'),  -- typical lab ranges, e.g. {"brix":{"min":78,"max":82}}
  certifications       text[] not null default '{}',      -- 'BSTI', 'Halal', 'Organic', 'ISO 22000' ...
  tags                 text[] not null default '{}',
  tax_rate             numeric(5,2) not null default 0 check (tax_rate between 0 and 100),           -- VAT %, prices are tax-exclusive
  is_featured          boolean not null default false,
  sort_order           integer not null default 0,
  rating_avg           numeric(3,2) not null default 0,   -- maintained by trigger from approved reviews
  rating_count         integer not null default 0,
  seo_title            text,
  seo_description      text,
  search               tsvector generated always as (
                         setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
                         setweight(to_tsvector('simple', coalesce(name_bn, '')), 'A') ||
                         setweight(to_tsvector('simple', coalesce(summary, '') || ' ' || coalesce(summary_bn, '')), 'B') ||
                         setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(description_bn, '')), 'C')
                       ) stored,
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on public.products (category_id);
create index on public.products (sort_order, name) where status = 'active';
create index on public.products using gin (search);
create index on public.products using gin (name extensions.gin_trgm_ops);
create index on public.products using gin (name_bn extensions.gin_trgm_ops);
create index on public.products using gin (uses);
create index on public.products using gin (tags);

-- A variant is one purchasable pack: "500 g jar", "200 L drum", "Bulk tanker (per tonne)".
create table public.product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  sku                 text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9._-]*$'),
  barcode             text,
  name                text not null,
  name_bn             text,
  pack_type           public.pack_type not null default 'jar',
  net_quantity        numeric(12,3) not null check (net_quantity > 0),     -- contents of ONE pack ...
  net_unit            public.uom not null default 'kg',                    -- ... in this unit
  weight_grams        integer not null default 0 check (weight_grams >= 0), -- shipping weight of one pack incl. packaging
  price               numeric(12,2) not null check (price >= 0),           -- price of one pack (BDT, before volume tiers)
  compare_at_price    numeric(12,2),
  min_order_qty       numeric(12,3) not null default 1 check (min_order_qty > 0),
  order_qty_step      numeric(12,3) not null default 1 check (order_qty_step > 0),   -- quantity must be a multiple of this
  max_order_qty       numeric(12,3),
  track_inventory     boolean not null default true,
  allow_backorder     boolean not null default false,
  low_stock_threshold numeric(12,3) not null default 5 check (low_stock_threshold >= 0),
  stock_status        public.stock_status not null default 'out_of_stock', -- maintained by triggers, safe to expose publicly
  is_default          boolean not null default false,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (compare_at_price is null or compare_at_price > price),
  check (max_order_qty is null or max_order_qty >= min_order_qty)
);
create index on public.product_variants (product_id);
create unique index product_variants_one_default on public.product_variants (product_id) where is_default;

-- Volume pricing, e.g. 1+ drums 12,000 / 10+ drums 11,500 / 50+ drums 11,000
create table public.price_tiers (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  min_qty    numeric(12,3) not null check (min_qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (variant_id, min_qty)
);

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  variant_id   uuid references public.product_variants (id) on delete set null,
  storage_path text not null,                              -- path inside the 'catalog-images' bucket
  alt_text     text,
  alt_text_bn  text,
  sort_order   integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on public.product_images (product_id, sort_order);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

-- -----------------------------------------------------------------------------
-- 6. LOT TRACEABILITY: suppliers, batches (with lab results), documents
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  phone        text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  address      text,
  district_id  smallint references public.geo_districts (id),
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.batches (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete restrict,
  lot_code         text not null unique check (lot_code ~ '^[A-Z0-9][A-Z0-9._-]*$'),
  supplier_id      uuid references public.suppliers (id) on delete set null,
  status           public.batch_status not null default 'quarantine',   -- only 'released' lots can be shipped
  produced_on      date,
  received_on      date,
  best_before      date,
  brix             numeric(5,2)  check (brix between 0 and 100),
  total_sugar_pct  numeric(5,2)  check (total_sugar_pct between 0 and 100),
  moisture_pct     numeric(5,2)  check (moisture_pct between 0 and 100),
  ash_pct          numeric(5,2)  check (ash_pct between 0 and 100),
  ph               numeric(4,2)  check (ph between 0 and 14),
  density_kg_per_l numeric(5,3)  check (density_kg_per_l > 0),
  tested_on        date,
  tested_by        text,                                                -- lab name
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (best_before is null or produced_on is null or best_before >= produced_on)
);
create index on public.batches (product_id, status);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references public.products (id) on delete cascade,
  batch_id     uuid references public.batches (id) on delete cascade,
  kind         public.document_kind not null,
  title        text not null,
  title_bn     text,
  storage_path text not null,              -- documents-public bucket when is_public, else documents-private
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  check (product_id is not null or batch_id is not null)
);
create index on public.documents (product_id);
create index on public.documents (batch_id);

-- -----------------------------------------------------------------------------
-- 7. INVENTORY (levels are a cache of the append-only stock_movements ledger)
-- -----------------------------------------------------------------------------
create table public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_-]+$'),
  name        text not null,
  address     text,
  district_id smallint references public.geo_districts (id),
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index warehouses_one_default on public.warehouses ((true)) where is_default;

create table public.inventory_levels (
  variant_id    uuid not null references public.product_variants (id) on delete cascade,
  warehouse_id  uuid not null references public.warehouses (id) on delete restrict,
  on_hand       numeric(14,3) not null default 0 check (on_hand >= 0),
  reserved      numeric(14,3) not null default 0 check (reserved >= 0),
  reorder_point numeric(14,3) not null default 0 check (reorder_point >= 0),
  available     numeric(14,3) generated always as (on_hand - reserved) stored,
  updated_at    timestamptz not null default now(),
  primary key (variant_id, warehouse_id)
);
create index on public.inventory_levels (warehouse_id);

-- -----------------------------------------------------------------------------
-- 8. CART & COUPONS  (guests keep their cart in the browser; only signed-in
--    customers get a server-side cart)
-- -----------------------------------------------------------------------------
create table public.cart_items (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity   numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);
create index on public.cart_items (variant_id);

create table public.coupons (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description              text,
  discount_type            public.discount_type not null,
  value                    numeric(12,2) not null default 0 check (value >= 0),   -- % or BDT; ignored for free_shipping
  max_discount_amount      numeric(12,2) check (max_discount_amount > 0),         -- cap for percentage coupons
  min_order_amount         numeric(14,2) not null default 0 check (min_order_amount >= 0),
  starts_at                timestamptz,
  ends_at                  timestamptz,
  usage_limit_total        integer check (usage_limit_total > 0),
  usage_limit_per_customer integer not null default 1 check (usage_limit_per_customer > 0),
  used_count               integer not null default 0 check (used_count >= 0),
  business_only            boolean not null default false,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check ((discount_type = 'percentage'   and value > 0 and value <= 100)
      or (discount_type = 'fixed_amount' and value > 0)
      or (discount_type = 'free_shipping')),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- -----------------------------------------------------------------------------
-- 9. B2B: REQUEST FOR QUOTE (bulk buyers negotiate; items live in one jsonb so
--    that anonymous visitors can submit with a single INSERT)
-- -----------------------------------------------------------------------------
create table public.quote_requests (
  id                   uuid primary key default gen_random_uuid(),
  reference_no         text not null unique,                  -- RFQ-2610-01001, set by trigger
  user_id              uuid default auth.uid() references public.profiles (id) on delete set null,
  business_id          uuid references public.business_accounts (id) on delete set null,
  company_name         text check (char_length(company_name) <= 200),
  contact_name         text not null check (char_length(contact_name) between 1 and 120),
  phone                text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email                public.email_address,
  items                jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
                       -- [{"product_id":"..","variant_id":"..","quantity":20,"unit":"t","note":".."}]
  delivery_district_id smallint references public.geo_districts (id),
  delivery_address     text check (char_length(delivery_address) <= 500),
  required_by          date,
  message              text check (char_length(message) <= 4000),
  status               public.quote_status not null default 'new',
  assigned_to          uuid references public.profiles (id) on delete set null,
  quoted_total         numeric(14,2) check (quoted_total >= 0),
  quote_valid_until    date,
  quote_reply          text check (char_length(quote_reply) <= 4000),   -- the customer-visible answer
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on public.quote_requests (user_id);
create index on public.quote_requests (business_id);
create index on public.quote_requests (status, created_at desc);

-- -----------------------------------------------------------------------------
-- 10. ORDERS, PAYMENTS, SHIPMENTS, STOCK LEDGER
-- -----------------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique,                       -- MOL-2610-01001, set by trigger
  public_token         uuid not null unique default gen_random_uuid(),  -- unguessable handle for guest order pages
  user_id              uuid references public.profiles (id) on delete set null,   -- NULL = guest checkout
  business_id          uuid references public.business_accounts (id) on delete set null,
  quote_request_id     uuid references public.quote_requests (id) on delete set null,
  channel              text not null default 'web' check (channel in ('web','phone','whatsapp','facebook','walk_in','admin')),
  status               public.order_status not null default 'pending',
  payment_status       public.payment_status not null default 'unpaid',        -- maintained from payments
  fulfillment_status   public.fulfillment_status not null default 'unfulfilled', -- maintained from shipments
  payment_method       public.payment_method not null default 'cod',
  currency             char(3) not null default 'BDT',
  customer_name        text not null check (char_length(customer_name) between 1 and 120),
  customer_phone       text not null check (customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  customer_email       public.email_address,
  shipping_address     jsonb not null check (jsonb_typeof(shipping_address) = 'object'),   -- frozen snapshot
  billing_address      jsonb check (jsonb_typeof(billing_address) = 'object'),
  shipping_method_id   uuid references public.shipping_methods (id) on delete set null,
  shipping_method_name text,
  coupon_code          text,
  subtotal             numeric(14,2) not null check (subtotal >= 0),
  discount_total       numeric(14,2) not null default 0 check (discount_total >= 0),
  shipping_total       numeric(14,2) not null default 0 check (shipping_total >= 0),
  tax_total            numeric(14,2) not null default 0 check (tax_total >= 0),
  grand_total          numeric(14,2) not null check (grand_total >= 0),
  amount_paid          numeric(14,2) not null default 0 check (amount_paid >= 0),
  total_weight_kg      numeric(12,3) not null default 0 check (total_weight_kg >= 0),
  customer_note        text check (char_length(customer_note) <= 2000),
  attribution          jsonb not null default '{}' check (jsonb_typeof(attribution) = 'object'), -- utm_*, fbclid / fbp / fbc, referrer ...
  invoice_number       text unique,
  invoiced_at          timestamptz,
  payment_due_date     date,                                       -- credit-terms orders
  placed_at            timestamptz not null default now(),
  confirmed_at         timestamptz,
  shipped_at           timestamptz,
  delivered_at         timestamptz,
  cancelled_at         timestamptz,
  cancel_reason        text check (char_length(cancel_reason) <= 500),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint orders_totals_consistent check (grand_total = subtotal - discount_total + shipping_total + tax_total),
  check (discount_total <= subtotal)
);
create index on public.orders (user_id, placed_at desc);
create index on public.orders (business_id, placed_at desc);
create index on public.orders (status, placed_at desc);
create index on public.orders (customer_phone);
create index on public.orders (quote_request_id);
create index on public.orders (payment_status) where payment_status <> 'paid';

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  variant_id       uuid references public.product_variants (id) on delete set null,
  product_id       uuid references public.products (id) on delete set null,
  warehouse_id     uuid references public.warehouses (id) on delete set null,   -- where the stock is reserved
  sku              text not null,                    -- everything below is a snapshot taken at order time
  product_name     text not null,
  variant_name     text not null,
  net_quantity     numeric(12,3),
  net_unit         public.uom,
  quantity         numeric(12,3) not null check (quantity > 0),
  unit_price       numeric(12,2) not null check (unit_price >= 0),
  tax_rate         numeric(5,2) not null default 0,
  tax_amount       numeric(14,2) not null default 0 check (tax_amount >= 0),
  weight_grams     integer not null default 0 check (weight_grams >= 0),
  shipped_quantity numeric(12,3) not null default 0 check (shipped_quantity >= 0),   -- maintained from shipment_items
  line_subtotal    numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  line_total       numeric(14,2) generated always as (round(quantity * unit_price, 2) + tax_amount) stored,
  created_at       timestamptz not null default now(),
  check (shipped_quantity <= quantity)
);
create index on public.order_items (order_id);
create index on public.order_items (variant_id);
create index on public.order_items (product_id);

-- customer-visible timeline (internal comments go to staff_notes)
create table public.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders (id) on delete cascade,
  event_type text not null,        -- placed, status_changed, payment_status_changed, shipment_created ...
  from_value text,
  to_value   text,
  message    text,
  actor_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);
create index on public.order_events (actor_id) where actor_id is not null;

create table public.coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons (id) on delete restrict,
  order_id        uuid not null references public.orders (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,
  customer_phone  text check (customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  discount_amount numeric(14,2) not null default 0,
  created_at      timestamptz not null default now(),
  unique (coupon_id, order_id)
);
create index on public.coupon_redemptions (order_id);
create index on public.coupon_redemptions (coupon_id, user_id);
create index on public.coupon_redemptions (coupon_id, customer_phone);
create index on public.coupon_redemptions (user_id) where user_id is not null;

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete restrict,
  kind                public.payment_kind not null default 'charge',
  method              public.payment_method not null,
  provider            text check (char_length(provider) <= 40),        -- bkash, nagad, sslcommerz, manual ...
  status              public.payment_txn_status not null default 'initiated',
  amount              numeric(14,2) not null check (amount > 0),
  currency            char(3) not null default 'BDT',
  provider_payment_id text,                                            -- gateway session / payment id
  provider_txn_id     text,                                            -- gateway transaction id (bKash trxID ...)
  payer_account       text check (char_length(payer_account) <= 40),   -- MASKED only, e.g. 017****5678
  failure_reason      text,
  paid_at             timestamptz,
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.payments (order_id);
create unique index payments_provider_txn_key on public.payments (provider, provider_txn_id) where provider_txn_id is not null;  -- webhook idempotency
create index on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create index on public.payments (created_by) where created_by is not null;

-- raw gateway callbacks: service role only (no policies, no grants for clients)
create table public.payment_logs (
  id         bigint generated always as identity primary key,
  payment_id uuid references public.payments (id) on delete set null,
  provider   text not null,
  event      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.payment_logs (payment_id);
create index on public.payment_logs (created_at desc);

create table public.shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete restrict,
  warehouse_id    uuid references public.warehouses (id) on delete set null,   -- where it physically leaves from
  status          public.shipment_status not null default 'preparing',
  carrier         text check (char_length(carrier) <= 80),                     -- Pathao, Steadfast, RedX, own truck ...
  tracking_number text check (char_length(tracking_number) <= 120),
  tracking_url    text check (char_length(tracking_url) <= 500),
  vehicle_no      text check (char_length(vehicle_no) <= 40),                  -- truck / tanker deliveries
  driver_name     text check (char_length(driver_name) <= 120),
  driver_phone    text check (driver_phone ~ '^\+[1-9][0-9]{7,14}$'),
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.shipments (order_id);
create index on public.shipments (status) where status in ('preparing','in_transit');
create index on public.shipments (created_by) where created_by is not null;

-- one row per (order line, lot) that physically left the warehouse
create table public.shipment_items (
  id            uuid primary key default gen_random_uuid(),
  shipment_id   uuid not null references public.shipments (id) on delete restrict,
  order_item_id uuid not null references public.order_items (id) on delete restrict,
  batch_id      uuid references public.batches (id) on delete restrict,       -- which lot was shipped (recall tracing)
  quantity      numeric(12,3) not null check (quantity > 0),
  created_at    timestamptz not null default now()
);
create index on public.shipment_items (shipment_id);
create index on public.shipment_items (order_item_id);
create index on public.shipment_items (batch_id);

-- append-only ledger = source of truth for stock (inventory_levels is derived)
create table public.stock_movements (
  id             bigint generated always as identity primary key,
  variant_id     uuid not null references public.product_variants (id) on delete restrict,
  warehouse_id   uuid not null references public.warehouses (id) on delete restrict,
  batch_id       uuid references public.batches (id) on delete restrict,
  movement_type  public.stock_movement_type not null,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost      numeric(12,2) check (unit_cost >= 0),                 -- purchase cost lives here, never on a public table
  order_id       uuid references public.orders (id) on delete restrict,
  shipment_id    uuid references public.shipments (id) on delete restrict,
  note           text,
  created_by     uuid default auth.uid(),                              -- plain uuid: ledger rows are never updated
  created_at     timestamptz not null default now(),
  check (
    (movement_type in ('receipt','return','transfer_in')  and quantity_delta > 0) or
    (movement_type in ('sale','write_off','transfer_out') and quantity_delta < 0) or
     movement_type = 'adjustment'
  )
);
create index on public.stock_movements (variant_id, created_at desc);
create index on public.stock_movements (warehouse_id);
create index on public.stock_movements (batch_id)    where batch_id is not null;
create index on public.stock_movements (order_id)    where order_id is not null;
create index on public.stock_movements (shipment_id) where shipment_id is not null;

-- -----------------------------------------------------------------------------
-- 11. ENGAGEMENT & CONTENT
-- -----------------------------------------------------------------------------
create table public.product_reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products (id) on delete cascade,
  user_id              uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reviewer_name        text not null default 'Customer',        -- first name only, set by trigger (profiles are private)
  rating               smallint not null check (rating between 1 and 5),
  title                text check (char_length(title) <= 120),
  body                 text check (char_length(body) <= 4000),
  status               public.review_status not null default 'pending',
  is_verified_purchase boolean not null default false,          -- set by trigger from delivered orders
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (product_id, user_id)
);
create index on public.product_reviews (product_id) where status = 'approved';
create index on public.product_reviews (user_id);
create index on public.product_reviews (status, created_at desc);

create table public.posts (
  id               uuid primary key default gen_random_uuid(),
  slug             public.slug not null unique,
  title            text not null,
  title_bn         text,
  excerpt          text,
  excerpt_bn       text,
  body             text not null default '',                    -- markdown
  body_bn          text,
  cover_image_path text,
  tags             text[] not null default '{}',
  status           public.post_status not null default 'draft',
  published_at     timestamptz,
  author_name      text,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.posts (published_at desc) where status = 'published';
create index on public.posts using gin (tags);

create table public.faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  question_bn text,
  answer      text not null,
  answer_bn   text,
  topic       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  name       text not null check (char_length(name) between 1 and 120),
  phone      text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email      public.email_address,
  subject    text check (char_length(subject) <= 200),
  message    text not null check (char_length(message) between 1 and 4000),
  status     public.message_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index on public.contact_messages (status, created_at desc);
create index on public.contact_messages (user_id) where user_id is not null;

-- -----------------------------------------------------------------------------
-- 12. SYSTEM: staff notes, settings, audit trail, notification outbox
-- -----------------------------------------------------------------------------
create table public.staff_notes (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('order','business','quote_request','customer','contact_message','batch','product')),
  entity_id   uuid not null,
  body        text not null check (char_length(body) between 1 and 4000),
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.staff_notes (entity_type, entity_id, created_at desc);
create index on public.staff_notes (author_id) where author_id is not null;

create table public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  actor_id   uuid,                                  -- plain uuid: the log outlives users
  created_at timestamptz not null default now()
);
create index on public.audit_log (table_name, created_at desc);
create index on public.audit_log (actor_id, created_at desc);

-- transactional outbox: the database queues SMS / email / webhooks, an Edge Function sends them
create table public.notification_outbox (
  id           bigint generated always as identity primary key,
  channel      public.outbox_channel not null,
  recipient    text not null,
  template     text not null,                       -- order_placed, order_shipped, meta_purchase ...
  payload      jsonb not null default '{}',
  status       public.outbox_status not null default 'pending',
  attempts     smallint not null default 0,
  last_error   text,
  scheduled_at timestamptz not null default now(),
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.notification_outbox (scheduled_at) where status = 'pending';

-- =============================================================================
-- 13. ROLE HELPERS  (SECURITY DEFINER so they can read staff_members / business
--     tables without recursing into RLS; used by policies in migration 2)
-- =============================================================================
create function private.current_staff_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select s.role from public.staff_members s where s.user_id = (select auth.uid())
$$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_staff_role() is not null
$$;
create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_staff_role() = 'owner', false)
$$;
create function private.is_admin() returns boolean                 -- owner, admin
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_staff_role() in ('owner','admin'), false)
$$;
create function private.is_manager() returns boolean               -- + manager: pricing, stock, shipping, coupons, B2B approval
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_staff_role() in ('owner','admin','manager'), false)
$$;
create function private.can_manage_content() returns boolean       -- + editor: products (content), categories, posts, FAQs, images
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_staff_role() in ('owner','admin','manager','editor'), false)
$$;
create function private.can_manage_orders() returns boolean        -- + support: orders, payments, shipments, customers, reviews
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_staff_role() in ('owner','admin','manager','support'), false)
$$;

create function private.is_business_member(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_members m
                  where m.business_id = p_business_id and m.user_id = (select auth.uid()))
$$;
create function private.is_approved_business_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_members m
                   join public.business_accounts b on b.id = m.business_id
                  where m.user_id = (select auth.uid()) and b.status = 'approved')
$$;

-- =============================================================================
-- 14. TRIGGERS: identity, normalisation, housekeeping
-- =============================================================================
-- new Supabase Auth user -> profile row (never blocks sign-up: only safe columns are copied)
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := private.normalize_phone(new.phone);
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    case when v_phone ~ '^\+[1-9][0-9]{7,14}$' then v_phone end
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- phone numbers are stored as E.164 whatever format the form sends
create trigger trg_profiles_phone          before insert or update of phone          on public.profiles          for each row execute function private.normalize_phone_trigger('phone');
create trigger trg_addresses_phone         before insert or update of phone          on public.addresses         for each row execute function private.normalize_phone_trigger('phone');
create trigger trg_business_phone          before insert or update of contact_phone  on public.business_accounts for each row execute function private.normalize_phone_trigger('contact_phone');
create trigger trg_suppliers_phone         before insert or update of phone          on public.suppliers         for each row execute function private.normalize_phone_trigger('phone');
create trigger trg_quotes_phone            before insert or update of phone          on public.quote_requests    for each row execute function private.normalize_phone_trigger('phone');
create trigger trg_contact_phone           before insert or update of phone          on public.contact_messages  for each row execute function private.normalize_phone_trigger('phone');
create trigger trg_shipments_driver_phone  before insert or update of driver_phone   on public.shipments         for each row execute function private.normalize_phone_trigger('driver_phone');
create trigger trg_orders_phone            before insert or update of customer_phone on public.orders            for each row execute function private.normalize_phone_trigger('customer_phone');
create trigger trg_redemptions_phone       before insert or update of customer_phone on public.coupon_redemptions for each row execute function private.normalize_phone_trigger('customer_phone');

-- updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','business_accounts','addresses','shipping_methods','shipping_rates','categories','products',
    'product_variants','suppliers','batches','warehouses','inventory_levels','cart_items','coupons','orders',
    'payments','shipments','quote_requests','product_reviews','posts','faqs','contact_messages','site_settings'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- category tree can never loop
create function private.categories_no_cycle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and exists (
       with recursive up as (
         select c.id, c.parent_id from public.categories c where c.id = new.parent_id
         union
         select c.id, c.parent_id from public.categories c join up on c.id = up.parent_id)
       select 1 from up where up.id = new.id) then
    raise exception 'CATEGORY_CYCLE: a category cannot be its own ancestor' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_categories_no_cycle before insert or update of parent_id on public.categories
  for each row execute function private.categories_no_cycle();

create function private.products_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'active' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger trg_products_publish before insert or update of status on public.products
  for each row execute function private.products_before_write();

-- a business applicant becomes the first member (owner) of the account they created
create function private.business_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.business_members (business_id, user_id, role)
    values (new.id, new.created_by, 'owner') on conflict do nothing;
  end if;
  return null;
end $$;
create trigger trg_business_owner after insert on public.business_accounts
  for each row execute function private.business_after_insert();

create function private.quote_requests_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.reference_no := private.next_number('RFQ', 'private.quote_number_seq'::regclass);
  return new;
end $$;
create trigger trg_quotes_number before insert on public.quote_requests
  for each row execute function private.quote_requests_before_insert();

-- =============================================================================
-- 15. TRIGGERS: stock ledger, reservations, storefront stock status
-- =============================================================================
create function private.variant_available(p_variant_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.on_hand - l.reserved), 0)
    from public.inventory_levels l
    join public.warehouses w on w.id = l.warehouse_id and w.is_active
   where l.variant_id = p_variant_id
$$;

create function private.compute_stock_status(p_track boolean, p_backorder boolean, p_threshold numeric, p_available numeric)
returns public.stock_status language sql stable set search_path = '' as $$
  select (case
            when not p_track                      then 'in_stock'
            when p_available <= 0 and p_backorder then 'backorder'
            when p_available <= 0                 then 'out_of_stock'
            when p_available <= p_threshold       then 'low_stock'
            else 'in_stock'
          end)::public.stock_status
$$;

-- stock_status is always derived, never hand-edited
create function private.variants_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.stock_status := private.compute_stock_status(
    new.track_inventory, new.allow_backorder, new.low_stock_threshold,
    case when tg_op = 'INSERT' then 0 else private.variant_available(new.id) end);
  return new;
end $$;
create trigger trg_variants_stock_status before insert or update on public.product_variants
  for each row execute function private.variants_before_write();

create function private.inventory_levels_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.product_variants v
     set stock_status = s.status
    from (select private.compute_stock_status(x.track_inventory, x.allow_backorder, x.low_stock_threshold,
                                              private.variant_available(x.id)) as status
            from public.product_variants x where x.id = new.variant_id) s
   where v.id = new.variant_id and v.stock_status is distinct from s.status;
  return null;
end $$;
create trigger trg_inventory_levels_status after insert or update on public.inventory_levels
  for each row execute function private.inventory_levels_after_write();

-- ledger row -> on_hand.  (UPDATE first: an upsert with a negative delta would trip the CHECK before ON CONFLICT.)
create function private.stock_movements_apply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory_levels
     set on_hand = on_hand + new.quantity_delta
   where variant_id = new.variant_id and warehouse_id = new.warehouse_id;
  if not found then
    insert into public.inventory_levels as l (variant_id, warehouse_id, on_hand)
    values (new.variant_id, new.warehouse_id, new.quantity_delta)
    on conflict (variant_id, warehouse_id) do update set on_hand = l.on_hand + excluded.on_hand;
  end if;
  return null;
exception when check_violation then
  raise exception 'INSUFFICIENT_STOCK: variant % in warehouse % cannot go below zero', new.variant_id, new.warehouse_id
    using errcode = 'P0001';
end $$;
create trigger trg_stock_movements_apply after insert on public.stock_movements
  for each row execute function private.stock_movements_apply();
create trigger trg_stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function private.forbid_mutation();

-- =============================================================================
-- 16. TRIGGERS: orders (numbering, state machine, timeline, cancellation)
-- =============================================================================
create function private.orders_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.order_number is null then
    new.order_number := private.next_number(
      coalesce((select s.value #>> '{}' from public.site_settings s where s.key = 'orders.number_prefix'), 'MOL'),
      'private.order_number_seq'::regclass);
  end if;
  return new;
end $$;
create trigger trg_orders_number before insert on public.orders
  for each row execute function private.orders_before_insert();

-- forward-only flow, cancel only before shipping, returns only after shipping
create function private.orders_before_update()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_flow constant text[] := array['pending','confirmed','processing','shipped','delivered'];
begin
  if new.order_number is distinct from old.order_number
     or new.public_token is distinct from old.public_token
     or new.currency     is distinct from old.currency then
    raise exception 'ORDER_IMMUTABLE: order_number, public_token and currency cannot change' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('cancelled','returned') then
      raise exception 'ORDER_FINAL: order is already %', old.status using errcode = 'P0001';
    elsif new.status = 'cancelled' then
      if old.status in ('shipped','delivered') then
        raise exception 'ORDER_NOT_CANCELLABLE: order is already %', old.status using errcode = 'P0001';
      end if;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    elsif new.status = 'returned' then
      if old.status not in ('shipped','delivered') then
        raise exception 'ORDER_NOT_RETURNABLE: order is still %', old.status using errcode = 'P0001';
      end if;
    elsif array_position(v_flow, new.status::text) <= array_position(v_flow, old.status::text) then
      raise exception 'ORDER_STATUS_BACKWARDS: % -> %', old.status, new.status using errcode = 'P0001';
    end if;
    if new.status = 'confirmed' then new.confirmed_at := coalesce(new.confirmed_at, now()); end if;
    if new.status = 'shipped'   then new.shipped_at   := coalesce(new.shipped_at,   now()); end if;
    if new.status = 'delivered' then new.delivered_at := coalesce(new.delivered_at, now()); end if;
  end if;
  return new;
end $$;
create trigger trg_orders_guard before update on public.orders
  for each row execute function private.orders_before_update();

create function private.orders_after_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, event_type, from_value, to_value, actor_id)
    values (new.id, 'status_changed', old.status::text, new.status::text, auth.uid());
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, event_type, from_value, to_value, actor_id)
    values (new.id, 'payment_status_changed', old.payment_status::text, new.payment_status::text, auth.uid());
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    -- 1) release the reservation for whatever has not shipped yet
    update public.inventory_levels l
       set reserved = greatest(l.reserved - r.qty, 0), updated_at = now()
      from (select oi.variant_id, oi.warehouse_id, sum(oi.quantity - oi.shipped_quantity) as qty
              from public.order_items oi
              join public.product_variants v on v.id = oi.variant_id and v.track_inventory
             where oi.order_id = new.id and oi.warehouse_id is not null
             group by oi.variant_id, oi.warehouse_id) r
     where l.variant_id = r.variant_id and l.warehouse_id = r.warehouse_id and r.qty > 0;
    -- 2) abandon unfinished payment attempts
    update public.payments set status = 'cancelled'
     where order_id = new.id and kind = 'charge' and status in ('initiated','pending');
    -- 3) hand the coupon use back
    with gone as (delete from public.coupon_redemptions where order_id = new.id returning coupon_id)
    update public.coupons c set used_count = greatest(c.used_count - 1, 0) from gone where c.id = gone.coupon_id;
  end if;
  return null;
end $$;
create trigger trg_orders_after_update after update on public.orders
  for each row execute function private.orders_after_update();

-- payments -> orders.amount_paid / payment_status
create function private.payments_sync_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order_id uuid;
  v_charged  numeric(14,2);
  v_refunded numeric(14,2);
  v_total    numeric(14,2);
  v_paid     numeric(14,2);
  v_status   public.payment_status;
begin
  if tg_op = 'DELETE' then v_order_id := old.order_id; else v_order_id := new.order_id; end if;

  select coalesce(sum(p.amount) filter (where p.kind = 'charge' and p.status = 'succeeded'), 0),
         coalesce(sum(p.amount) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0)
    into v_charged, v_refunded
    from public.payments p where p.order_id = v_order_id;

  select o.grand_total into v_total from public.orders o where o.id = v_order_id;
  v_paid := greatest(v_charged - v_refunded, 0);
  v_status := (case
                 when v_charged > 0 and v_refunded >= v_charged then 'refunded'
                 when v_refunded > 0                            then 'partially_refunded'
                 when v_charged > 0 and v_charged >= v_total    then 'paid'
                 when v_charged > 0                             then 'partially_paid'
                 else 'unpaid'
               end)::public.payment_status;

  update public.orders o set amount_paid = v_paid, payment_status = v_status
   where o.id = v_order_id
     and (o.amount_paid is distinct from v_paid or o.payment_status is distinct from v_status);
  return null;
end $$;
create trigger trg_payments_sync after insert or update or delete on public.payments
  for each row execute function private.payments_sync_order();

-- =============================================================================
-- 17. TRIGGERS: shipments (stock deduction, lot checks, fulfilment status)
-- =============================================================================
create function private.shipments_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'in_transit' then new.shipped_at := coalesce(new.shipped_at, now()); end if;
  if new.status = 'delivered'  then
    new.shipped_at   := coalesce(new.shipped_at, now());
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end $$;
create trigger trg_shipments_timestamps before insert or update on public.shipments
  for each row execute function private.shipments_before_write();

create function private.shipments_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, event_type, to_value, message, actor_id)
    values (new.order_id, 'shipment_created', new.status::text,
            concat_ws(' · ', 'Shipment created', new.carrier, new.tracking_number), auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, event_type, from_value, to_value, message, actor_id)
    values (new.order_id, 'shipment_status_changed', old.status::text, new.status::text,
            concat_ws(' · ', 'Shipment ' || new.status::text, new.carrier, new.tracking_number), auth.uid());
    -- every shipment delivered and everything shipped -> the order is delivered
    if new.status = 'delivered'
       and not exists (select 1 from public.shipments s where s.order_id = new.order_id and s.status <> 'delivered')
       and exists (select 1 from public.orders o
                    where o.id = new.order_id and o.fulfillment_status = 'fulfilled' and o.status = 'shipped') then
      update public.orders set status = 'delivered' where id = new.order_id;
    end if;
  end if;
  return null;
end $$;
create trigger trg_shipments_after after insert or update on public.shipments
  for each row execute function private.shipments_after_write();

-- A shipment line is what moves stock: ledger 'sale' entry, reservation released, order progress updated.
create function private.shipment_items_apply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ship   public.shipments;
  v_oi     public.order_items;
  v_ord    public.orders;
  v_batch  public.batches;
  v_track  boolean;
  v_wh     uuid;
  v_fulfil public.fulfillment_status;
begin
  select * into v_ship from public.shipments  where id = new.shipment_id;
  select * into v_oi   from public.order_items where id = new.order_item_id for update;
  select * into v_ord  from public.orders      where id = v_oi.order_id;

  if v_oi.order_id <> v_ship.order_id then
    raise exception 'SHIPMENT_ORDER_MISMATCH: order line belongs to another order' using errcode = 'P0001';
  end if;
  if v_ord.status in ('cancelled','returned','delivered') then
    raise exception 'ORDER_NOT_SHIPPABLE: order is %', v_ord.status using errcode = 'P0001';
  end if;
  if new.quantity > v_oi.quantity - v_oi.shipped_quantity then
    raise exception 'SHIPMENT_EXCEEDS_ORDER: only % of % left to ship', v_oi.quantity - v_oi.shipped_quantity, v_oi.sku
      using errcode = 'P0001';
  end if;

  if new.batch_id is not null then
    select * into v_batch from public.batches where id = new.batch_id;
    if v_batch.status <> 'released' then
      raise exception 'BATCH_NOT_RELEASED: lot % is %', v_batch.lot_code, v_batch.status using errcode = 'P0001';
    end if;
    if v_batch.product_id is distinct from v_oi.product_id then
      raise exception 'BATCH_PRODUCT_MISMATCH: lot % belongs to a different product', v_batch.lot_code using errcode = 'P0001';
    end if;
    if v_batch.best_before is not null and v_batch.best_before < current_date then
      raise exception 'BATCH_EXPIRED: lot % expired on %', v_batch.lot_code, v_batch.best_before using errcode = 'P0001';
    end if;
  end if;

  select v.track_inventory into v_track from public.product_variants v where v.id = v_oi.variant_id;
  v_wh := coalesce(v_ship.warehouse_id, v_oi.warehouse_id);

  if coalesce(v_track, false) then
    if v_wh is null then
      raise exception 'NO_WAREHOUSE: set a warehouse on the shipment' using errcode = 'P0001';
    end if;
    insert into public.stock_movements (variant_id, warehouse_id, batch_id, movement_type, quantity_delta, order_id, shipment_id, note)
    values (v_oi.variant_id, v_wh, new.batch_id, 'sale', -new.quantity, v_oi.order_id, new.shipment_id, 'Shipped');
    update public.inventory_levels
       set reserved = greatest(reserved - new.quantity, 0), updated_at = now()
     where variant_id = v_oi.variant_id and warehouse_id = coalesce(v_oi.warehouse_id, v_wh);
  end if;

  update public.order_items set shipped_quantity = shipped_quantity + new.quantity where id = v_oi.id;

  select (case when sum(i.shipped_quantity) = 0 then 'unfulfilled'
               when bool_and(i.shipped_quantity >= i.quantity) then 'fulfilled'
               else 'partial' end)::public.fulfillment_status
    into v_fulfil
    from public.order_items i where i.order_id = v_oi.order_id;

  update public.orders
     set fulfillment_status = v_fulfil,
         status = case when v_fulfil = 'fulfilled' and status in ('pending','confirmed','processing')
                       then 'shipped'::public.order_status else status end
   where id = v_oi.order_id;
  return null;
end $$;
create trigger trg_shipment_items_apply after insert on public.shipment_items
  for each row execute function private.shipment_items_apply();
create trigger trg_shipment_items_immutable before update or delete on public.shipment_items
  for each row execute function private.forbid_mutation();

-- =============================================================================
-- 18. TRIGGERS: reviews, audit trail
-- =============================================================================
create function private.reviews_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_untrusted boolean := auth.uid() is not null and not private.can_manage_orders();
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''), 'Customer')
      into new.reviewer_name from public.profiles p where p.id = new.user_id;
    new.reviewer_name := coalesce(new.reviewer_name, 'Customer');
    new.is_verified_purchase := exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
       where o.user_id = new.user_id and oi.product_id = new.product_id and o.status = 'delivered');
    if v_untrusted then new.status := 'pending'; end if;
  elsif v_untrusted then          -- customers may only edit their own words; edits go back to moderation
    new.product_id := old.product_id;
    new.user_id := old.user_id;
    new.reviewer_name := old.reviewer_name;
    new.is_verified_purchase := old.is_verified_purchase;
    new.status := 'pending';
  end if;
  return new;
end $$;
create trigger trg_reviews_before before insert or update on public.product_reviews
  for each row execute function private.reviews_before_write();

create function private.reviews_refresh_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_product uuid;
begin
  if tg_op = 'DELETE' then v_product := old.product_id; else v_product := new.product_id; end if;
  update public.products p
     set rating_count = s.cnt, rating_avg = s.avg
    from (select count(*)::integer as cnt, coalesce(round(avg(r.rating)::numeric, 2), 0) as avg
            from public.product_reviews r where r.product_id = v_product and r.status = 'approved') s
   where p.id = v_product;
  return null;
end $$;
create trigger trg_reviews_rating after insert or update or delete on public.product_reviews
  for each row execute function private.reviews_refresh_rating();

create function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old   jsonb;
  v_new   jsonb;
  v_noise constant text[] := array['updated_at','stock_status','rating_avg','rating_count'];
begin
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (v_old - v_noise) = (v_new - v_noise) then return null; end if;

  insert into public.audit_log (table_name, row_id, action, old_data, new_data, actor_id)
  values (tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id', v_new ->> 'key', v_old ->> 'key'),
          tg_op, v_old, v_new, auth.uid());
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'products','product_variants','price_tiers','categories','shipping_methods','shipping_rates','coupons',
    'site_settings','staff_members','business_accounts','warehouses'
  ] loop
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I for each row execute function private.audit_row()', t);
  end loop;
end $$;
create trigger trg_audit_log_immutable before update or delete on public.audit_log
  for each row execute function private.forbid_mutation();

-- =============================================================================
-- 19. REFERENCE DATA  (needed in production too, so it lives in the migration)
-- =============================================================================
insert into public.warehouses (code, name, is_default) values ('MAIN', 'Main warehouse', true);

insert into public.shipping_methods (code, name, name_bn, description, is_pickup, sort_order) values
  ('pickup',  'Pickup from warehouse',   'গুদাম থেকে সংগ্রহ',        'Collect your order from our warehouse.', true,  1),
  ('courier', 'Courier delivery',        'কুরিয়ার ডেলিভারি',          'Delivered by our courier partner.',      false, 2),
  ('truck',   'Truck / tanker delivery', 'ট্রাক / ট্যাংকার ডেলিভারি', 'Bulk delivery by truck or tanker.',      false, 3);

insert into public.site_settings (key, value, description, is_public) values
  ('store.name',                           '"Molasses Store"', 'Public store name',                                         true),
  ('store.currency',                       '"BDT"',            'ISO currency code',                                         true),
  ('store.support_phone',                  '""',               'Shown in the footer and in order SMS (E.164)',              true),
  ('store.whatsapp',                       '""',               'WhatsApp number (E.164)',                                   true),
  ('checkout.cod_enabled',                 'true',             'Allow cash on delivery',                                    true),
  ('checkout.guest_checkout_enabled',      'true',             'Allow orders without an account',                           true),
  ('orders.number_prefix',                 '"MOL"',            'Prefix of generated order numbers',                         false),
  ('orders.unpaid_online_expiry_minutes',  '60',               'Unpaid online-payment orders are cancelled after this long', false);

insert into public.geo_divisions (name, name_bn) values
  ('Barishal','বরিশাল'), ('Chattogram','চট্টগ্রাম'), ('Dhaka','ঢাকা'), ('Khulna','খুলনা'),
  ('Mymensingh','ময়মনসিংহ'), ('Rajshahi','রাজশাহী'), ('Rangpur','রংপুর'), ('Sylhet','সিলেট');

insert into public.geo_districts (division_id, name, name_bn)
select d.id, v.name, v.name_bn
from (values
  ('Dhaka','Dhaka','ঢাকা'), ('Dhaka','Faridpur','ফরিদপুর'), ('Dhaka','Gazipur','গাজীপুর'), ('Dhaka','Gopalganj','গোপালগঞ্জ'),
  ('Dhaka','Kishoreganj','কিশোরগঞ্জ'), ('Dhaka','Madaripur','মাদারীপুর'), ('Dhaka','Manikganj','মানিকগঞ্জ'),
  ('Dhaka','Munshiganj','মুন্সীগঞ্জ'), ('Dhaka','Narayanganj','নারায়ণগঞ্জ'), ('Dhaka','Narsingdi','নরসিংদী'),
  ('Dhaka','Rajbari','রাজবাড়ী'), ('Dhaka','Shariatpur','শরীয়তপুর'), ('Dhaka','Tangail','টাঙ্গাইল'),
  ('Chattogram','Bandarban','বান্দরবান'), ('Chattogram','Brahmanbaria','ব্রাহ্মণবাড়িয়া'), ('Chattogram','Chandpur','চাঁদপুর'),
  ('Chattogram','Chattogram','চট্টগ্রাম'), ('Chattogram','Cox''s Bazar','কক্সবাজার'), ('Chattogram','Cumilla','কুমিল্লা'),
  ('Chattogram','Feni','ফেনী'), ('Chattogram','Khagrachhari','খাগড়াছড়ি'), ('Chattogram','Lakshmipur','লক্ষ্মীপুর'),
  ('Chattogram','Noakhali','নোয়াখালী'), ('Chattogram','Rangamati','রাঙ্গামাটি'),
  ('Rajshahi','Bogura','বগুড়া'), ('Rajshahi','Chapai Nawabganj','চাঁপাইনবাবগঞ্জ'), ('Rajshahi','Joypurhat','জয়পুরহাট'),
  ('Rajshahi','Naogaon','নওগাঁ'), ('Rajshahi','Natore','নাটোর'), ('Rajshahi','Pabna','পাবনা'),
  ('Rajshahi','Rajshahi','রাজশাহী'), ('Rajshahi','Sirajganj','সিরাজগঞ্জ'),
  ('Khulna','Bagerhat','বাগেরহাট'), ('Khulna','Chuadanga','চুয়াডাঙ্গা'), ('Khulna','Jashore','যশোর'),
  ('Khulna','Jhenaidah','ঝিনাইদহ'), ('Khulna','Khulna','খুলনা'), ('Khulna','Kushtia','কুষ্টিয়া'),
  ('Khulna','Magura','মাগুরা'), ('Khulna','Meherpur','মেহেরপুর'), ('Khulna','Narail','নড়াইল'), ('Khulna','Satkhira','সাতক্ষীরা'),
  ('Barishal','Barguna','বরগুনা'), ('Barishal','Barishal','বরিশাল'), ('Barishal','Bhola','ভোলা'),
  ('Barishal','Jhalokathi','ঝালকাঠি'), ('Barishal','Patuakhali','পটুয়াখালী'), ('Barishal','Pirojpur','পিরোজপুর'),
  ('Sylhet','Habiganj','হবিগঞ্জ'), ('Sylhet','Moulvibazar','মৌলভীবাজার'), ('Sylhet','Sunamganj','সুনামগঞ্জ'), ('Sylhet','Sylhet','সিলেট'),
  ('Rangpur','Dinajpur','দিনাজপুর'), ('Rangpur','Gaibandha','গাইবান্ধা'), ('Rangpur','Kurigram','কুড়িগ্রাম'),
  ('Rangpur','Lalmonirhat','লালমনিরহাট'), ('Rangpur','Nilphamari','নীলফামারী'), ('Rangpur','Panchagarh','পঞ্চগড়'),
  ('Rangpur','Rangpur','রংপুর'), ('Rangpur','Thakurgaon','ঠাকুরগাঁও'),
  ('Mymensingh','Jamalpur','জামালপুর'), ('Mymensingh','Mymensingh','ময়মনসিংহ'), ('Mymensingh','Netrokona','নেত্রকোণা'),
  ('Mymensingh','Sherpur','শেরপুর')
) as v(division, name, name_bn)
join public.geo_divisions d on d.name = v.division;

-- starting point: one delivery zone per division (regroup them whenever your courier rates require it)
insert into public.delivery_zones (name, name_bn) select name, name_bn from public.geo_divisions order by id;
update public.geo_districts d set zone_id = z.id
  from public.geo_divisions v join public.delivery_zones z on z.name = v.name
 where d.division_id = v.id;

-- =============================================================================
-- 20. TABLE COMMENTS (visible in Studio and the generated API docs)
-- =============================================================================
comment on table public.orders           is 'A sale, frozen at checkout. Created ONLY through public.place_order(); every price and total is recomputed server-side.';
comment on table public.order_items      is 'Order lines with product/variant/price snapshots, so later catalog edits never rewrite history.';
comment on table public.order_events     is 'Customer-visible order timeline. Internal comments belong in staff_notes.';
comment on table public.payments         is 'Charges and refunds. Unique (provider, provider_txn_id) makes gateway webhooks idempotent.';
comment on table public.payment_logs     is 'Raw gateway callbacks. Service role only.';
comment on table public.inventory_levels is 'Derived cache: on_hand comes from stock_movements, reserved from open orders. Written by triggers / place_order only.';
comment on table public.stock_movements  is 'Append-only stock ledger and the source of truth for quantities and per-lot movement. Staff only.';
comment on table public.batches          is 'Production / purchase lots with lab results. Only status = released can be shipped.';
comment on table public.shipment_items   is 'What physically left the warehouse, per order line and lot. Inserting a row moves the stock.';
comment on table public.product_variants is 'Purchasable pack sizes (jar ... drum ... bulk tonne) with min/step quantities. stock_status is derived.';
comment on table public.price_tiers      is 'Volume pricing per variant: the tier with the highest min_qty <= ordered quantity wins.';
comment on table public.staff_notes      is 'Internal comments on orders, customers, quotes ... Staff only.';
comment on table public.notification_outbox is 'Transactional outbox for SMS / email / webhook events; an Edge Function drains it.';
comment on table public.audit_log        is 'Append-only change history of catalog, pricing, settings and staff changes.';
