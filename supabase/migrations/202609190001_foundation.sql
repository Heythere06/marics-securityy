create extension if not exists pgcrypto;

create type public.app_role as enum ('individual', 'employee', 'organization_admin', 'marics_admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 160),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'af', 'pt')),
  role public.app_role not null default 'individual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 180),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_memberships_user_idx on public.organization_memberships(user_id);

create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title jsonb not null,
  description jsonb not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  content jsonb not null,
  risk_dimensions text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index scenarios_module_idx on public.scenarios(module_id);

create table public.scenario_options (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  option_key text not null,
  content jsonb not null,
  is_correct boolean not null,
  feedback jsonb not null,
  unique (scenario_id, option_key)
);

create table public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id),
  selected_option_id uuid not null references public.scenario_options(id),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);
create index training_attempts_user_idx on public.training_attempts(user_id, created_at desc);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid references public.training_modules(id),
  issued_at timestamptz not null default now()
);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships where organization_id = target_org and user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.training_attempts enable row level security;
alter table public.certificates enable row level security;

create policy profiles_self on public.profiles for select using (id = auth.uid());
create policy organizations_members on public.organizations for select using (public.is_org_member(id));
create policy memberships_self_or_admin on public.organization_memberships for select using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy attempts_self on public.training_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy certificates_self on public.certificates for select using (user_id = auth.uid());