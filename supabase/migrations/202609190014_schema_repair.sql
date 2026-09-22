-- Repair migration for projects where migration snippets were applied manually
-- or an earlier migration was interrupted. Apply the numbered migrations first;
-- this only makes the affected additive schema/policy changes idempotent.

alter table public.scenarios add column if not exists slug text;
create unique index if not exists scenarios_slug_idx on public.scenarios(slug) where slug is not null;

alter table public.risk_profiles add column if not exists category_scores jsonb not null default '{}'::jsonb;
alter table public.training_modules add column if not exists is_assessment boolean not null default false;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.organizations add column if not exists suspended_at timestamptz;
alter table public.training_modules add column if not exists archived_at timestamptz;

create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.platform_settings (key, value) values
  ('supported_languages', '["en", "af", "pt"]'::jsonb),
  ('ai_usage_cap', '{"monthlyRequests":5000,"monthlyBudgetUsd":250}'::jsonb),
  ('rate_limit_config', '{"max":100,"timeWindowMinutes":1}'::jsonb),
  ('feature_flags', '{"aiGeneration":false,"certificates":false}'::jsonb)
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_admin_read on public.platform_settings;
drop policy if exists platform_settings_admin_write on public.platform_settings;
create policy platform_settings_admin_read on public.platform_settings for select using (public.is_marics_admin());
create policy platform_settings_admin_write on public.platform_settings for all using (public.is_marics_admin()) with check (public.is_marics_admin());

alter table public.organization_memberships enable row level security;
drop policy if exists memberships_self_or_admin on public.organization_memberships;
drop policy if exists memberships_self on public.organization_memberships;
drop policy if exists memberships_org_admin_read on public.organization_memberships;
create policy memberships_self on public.organization_memberships for select using (user_id = auth.uid());
create policy memberships_org_admin_read on public.organization_memberships for select using (public.is_org_admin(organization_id));