-- Signup must not grant administrator access. Organization admin promotion
-- happens only through create_organization_for_user or audited MARICS-admin action.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  normalized_account_type text;
begin
  normalized_account_type := coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'individual');
  if normalized_account_type not in ('individual', 'organization') then
    normalized_account_type := 'individual';
  end if;

  insert into public.profiles (id, full_name, country_code, preferred_language, role, account_type, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(upper(new.raw_user_meta_data ->> 'country_code'), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_language', ''), 'en'),
    'individual'::public.app_role,
    normalized_account_type,
    new.email
  );
  return new;
end;
$$;

update public.profiles as profiles
set role = 'individual', updated_at = now()
where profiles.role = 'organization_admin'
  and not exists (
    select 1
    from public.organization_memberships memberships
    where memberships.user_id = profiles.id
      and memberships.is_admin = true
  );

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  email text not null check (char_length(email) between 5 and 180),
  organization_name text check (organization_name is null or char_length(organization_name) between 2 and 180),
  phone text check (phone is null or char_length(phone) between 5 and 40),
  message text not null check (char_length(message) between 10 and 2000),
  language text not null default 'en' check (language in ('en', 'af', 'pt')),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.demo_requests enable row level security;
drop policy if exists demo_requests_admin_read on public.demo_requests;
create policy demo_requests_admin_read on public.demo_requests
  for select
  using (public.is_marics_admin());

grant select on table public.demo_requests to authenticated;
