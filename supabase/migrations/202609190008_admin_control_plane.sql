create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.platform_settings (key, value)
values ('supported_languages', '["en", "af", "pt"]'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_marics_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'marics_admin');
$$;

alter table public.platform_settings enable row level security;
create policy platform_settings_admin_read on public.platform_settings for select using (public.is_marics_admin());
create policy platform_settings_admin_write on public.platform_settings for all using (public.is_marics_admin()) with check (public.is_marics_admin());

create or replace function public.get_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'counts', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'organizations', (select count(*) from public.organizations),
      'modules', (select count(*) from public.training_modules),
      'publishedModules', (select count(*) from public.training_modules where is_published),
      'generatedContent', (select count(*) from public.generated_content),
      'certificates', (select count(*) from public.certificates)
    ),
    'languages', coalesce((select value from public.platform_settings where key = 'supported_languages'), '["en", "af", "pt"]'::jsonb),
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'role', role, 'language', preferred_language, 'createdAt', created_at) order by created_at desc) from (select id, full_name, role, preferred_language, created_at from public.profiles order by created_at desc limit 12) recent), '[]'::jsonb),
    'organizations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'createdAt', created_at) order by created_at desc) from (select id, name, created_at from public.organizations order by created_at desc limit 12) recent), '[]'::jsonb),
    'modules', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'title', title, 'published', is_published) order by created_at desc) from public.training_modules), '[]'::jsonb),
    'aiContent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'moduleSlug', module_slug, 'language', language, 'provider', provider, 'model', model, 'createdAt', created_at) order by created_at desc) from (select id, module_slug, language, provider, model, created_at from public.generated_content order by created_at desc limit 12) recent), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_admin_module(target_slug text, target_title jsonb, target_description jsonb)
returns public.training_modules language plpgsql security definer set search_path = public as $$
declare new_module public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.training_modules (slug, title, description, is_published)
  values (lower(trim(target_slug)), target_title, target_description, false)
  returning * into new_module;
  return new_module;
end;
$$;

create or replace function public.set_admin_module_published(target_module uuid, target_published boolean)
returns public.training_modules language plpgsql security definer set search_path = public as $$
declare updated_module public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  update public.training_modules set is_published = target_published where id = target_module returning * into updated_module;
  if updated_module.id is null then raise exception 'MODULE_NOT_FOUND'; end if;
  return updated_module;
end;
$$;

create or replace function public.set_admin_setting(target_key text, target_value jsonb)
returns public.platform_settings language plpgsql security definer set search_path = public as $$
declare updated_setting public.platform_settings;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.platform_settings (key, value, updated_by) values (target_key, target_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid()
  returning * into updated_setting;
  return updated_setting;
end;
$$;