-- =============================================================================
-- Migration: Allow service_role to manage orders via private.can_manage_orders()
-- =============================================================================

create or replace function private.can_manage_orders() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    coalesce(private.current_staff_role() in ('owner', 'admin', 'manager', 'support'), false)
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  );
$$;

-- Ensure service_role has execute permissions on helper functions
grant execute on function public.assign_invoice_number(uuid) to service_role;
grant execute on function public.cancel_order(uuid, text) to service_role;
grant execute on function public.set_order_items(uuid, jsonb, jsonb) to service_role;
