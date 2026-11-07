-- =============================================================================
-- Migration: Allow service_role and staff members for admin reporting & helper functions
-- =============================================================================

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    private.current_staff_role() is not null
    or current_user in ('postgres', 'service_role')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    coalesce(private.current_staff_role() = 'owner', false)
    or current_user in ('postgres', 'service_role')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    coalesce(private.current_staff_role() in ('owner', 'admin'), false)
    or current_user in ('postgres', 'service_role')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

create or replace function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    coalesce(private.current_staff_role() in ('owner', 'admin', 'manager'), false)
    or current_user in ('postgres', 'service_role')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

create or replace function private.can_manage_content() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    coalesce(private.current_staff_role() in ('owner', 'admin', 'manager', 'editor'), false)
    or current_user in ('postgres', 'service_role')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

grant execute on function public.admin_kpis(timestamptz, timestamptz) to service_role;
grant execute on function public.admin_sales_series(timestamptz, timestamptz, text) to service_role;
grant execute on function public.admin_top_products(timestamptz, timestamptz, integer) to service_role;
grant execute on function public.admin_sales_breakdown(timestamptz, timestamptz, text) to service_role;
grant execute on function public.assign_invoice_number(uuid) to service_role;
grant execute on function public.set_order_items(uuid, jsonb, jsonb) to service_role;
