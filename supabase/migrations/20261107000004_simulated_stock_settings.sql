-- =============================================================================
-- Migration: Simulated Stock Settings & Realtime Enablement
-- Seeds simulated demand settings and enables Supabase Realtime for site_settings
-- =============================================================================

-- 1. Seed simulated stock settings into site_settings
insert into public.site_settings (key, value, description, is_public) values
  ('inventory.simulated_demand_enabled',       'true',    'Toggle simulated pre-order demand automation', true),
  ('inventory.simulated_demand_kg',            '0',       'Current simulated demand offset in KG',         true),
  ('inventory.simulated_demand_min_kg',        '1.0',     'Minimum simulated decrement KG per step',      false),
  ('inventory.simulated_demand_max_kg',        '3.0',     'Maximum simulated decrement KG per step',      false),
  ('inventory.simulated_demand_max_cap_kg',    '80.0',    'Maximum simulated demand cap in KG',           false),
  ('inventory.simulated_demand_interval_mins', '10',      'Cadence of simulated demand in minutes',       false),
  ('inventory.simulated_demand_last_reset_date', '""',    'Last date (YYYY-MM-DD) when demand was reset', false)
on conflict (key) do nothing;

-- 2. Ensure daily_production_kg exists and is public
insert into public.site_settings (key, value, description, is_public) values
  ('inventory.daily_production_kg', '50', 'Future molasses production capacity per day in KG', true)
on conflict (key) do update set is_public = true;

-- 3. Set replica identity to FULL for comprehensive realtime change notifications
alter table public.site_settings replica identity full;

-- 4. Enable Supabase Realtime for public.site_settings
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_settings'
  ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end $$;
