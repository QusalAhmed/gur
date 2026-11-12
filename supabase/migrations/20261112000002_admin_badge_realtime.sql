-- =============================================================================
-- Migration: Enable Supabase Realtime for admin badge count tables
-- Timestamp: 20261112000002_admin_badge_realtime.sql
-- Purpose: Allow staff browser Realtime subscriptions to receive live changes
--          for reviews, quote requests, and contact messages alongside existing
--          notifications and orders publications, eliminating periodic polling.
-- =============================================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array['product_reviews', 'quote_requests', 'contact_messages']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
