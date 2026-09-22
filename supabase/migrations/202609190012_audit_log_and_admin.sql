create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null check (char_length(action) between 2 and 120),
  target_type text not null check (char_length(target_type) between 2 and 80),
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_actor_idx on public.audit_log(actor_id, created_at desc);

alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.organizations add column if not exists suspended_at timestamptz;
alter table public.training_modules add column if not exists archived_at timestamptz;

insert into public.platform_settings (key, value) values
  ('ai_usage_cap', '{"monthlyRequests":5000,"monthlyBudgetUsd":250}'::jsonb),
  ('rate_limit_config', '{"max":100,"timeWindowMinutes":1}'::jsonb),
  ('feature_flags', '{"aiGeneration":false,"certificates":false}'::jsonb)
on conflict (key) do nothing;

alter table public.audit_log enable row level security;
create policy audit_log_admin_read on public.audit_log for select using (public.is_marics_admin());

create or replace function public.admin_record_audit(target_action text, target_type text, target_id text default null, target_metadata jsonb default '{}'::jsonb)
returns public.audit_log language plpgsql security definer set search_path = public as $$
declare entry public.audit_log;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), target_action, target_type, target_id, coalesce(target_metadata, '{}'::jsonb))
  returning * into entry;
  return entry;
end;
$$;

create or replace function public.admin_search_users(search_query text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.full_name,
      'role', p.role,
      'language', p.preferred_language,
      'suspended', p.suspended_at is not null,
      'createdAt', p.created_at,
      'organizations', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'isAdmin', om.is_admin))
        from public.organization_memberships om
        join public.organizations o on o.id = om.organization_id
        where om.user_id = p.id
      ), '[]'::jsonb)
    ) order by p.created_at desc)
    from public.profiles p
    where search_query = '' or p.full_name ilike '%' || search_query || '%' or p.id::text = search_query
    limit 50
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_user(target_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return (
    select jsonb_build_object(
      'profile', jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role, 'language', p.preferred_language, 'suspended', p.suspended_at is not null, 'createdAt', p.created_at),
      'riskProfile', (select to_jsonb(rp.*) from public.risk_profiles rp where rp.user_id = p.id),
      'training', jsonb_build_object(
        'attempted', (select count(*) from public.training_attempts ta where ta.user_id = p.id),
        'correct', (select count(*) from public.training_attempts ta where ta.user_id = p.id and ta.is_correct)
      ),
      'organizations', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'isAdmin', om.is_admin))
        from public.organization_memberships om join public.organizations o on o.id = om.organization_id where om.user_id = p.id
      ), '[]'::jsonb)
    )
    from public.profiles p where p.id = target_user
  );
end;
$$;

create or replace function public.admin_set_user_role(target_user uuid, target_role public.app_role)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare updated public.profiles;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  update public.profiles set role = target_role, updated_at = now() where id = target_user returning * into updated;
  if updated.id is null then raise exception 'USER_NOT_FOUND'; end if;
  perform public.admin_record_audit('user.role.update', 'user', target_user::text, jsonb_build_object('role', target_role));
  return updated;
end;
$$;

create or replace function public.admin_set_user_suspended(target_user uuid, target_suspended boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare updated public.profiles;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  update public.profiles set suspended_at = case when target_suspended then now() else null end, updated_at = now() where id = target_user returning * into updated;
  if updated.id is null then raise exception 'USER_NOT_FOUND'; end if;
  perform public.admin_record_audit(case when target_suspended then 'user.suspend' else 'user.reactivate' end, 'user', target_user::text, '{}'::jsonb);
  return updated;
end;
$$;

create or replace function public.admin_search_organizations(search_query text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'suspended', o.suspended_at is not null,
      'employeeCount', (select count(*) from public.organization_memberships om where om.organization_id = o.id and om.is_admin = false),
      'createdAt', o.created_at
    ) order by o.created_at desc)
    from public.organizations o
    where search_query = '' or o.name ilike '%' || search_query || '%' or o.id::text = search_query
    limit 50
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_organization(target_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'organization', (select jsonb_build_object('id', id, 'name', name, 'suspended', suspended_at is not null) from public.organizations where id = target_org),
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role, 'isAdmin', om.is_admin, 'awarenessScore', rp.awareness_score))
      from public.organization_memberships om
      join public.profiles p on p.id = om.user_id
      left join public.risk_profiles rp on rp.user_id = p.id
      where om.organization_id = target_org
    ), '[]'::jsonb),
    'aggregateRisk', public.admin_organization_risk_aggregate(target_org)
  );
end;
$$;

create or replace function public.admin_organization_risk_aggregate(target_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(category, weak_count), '{}'::jsonb)
  from (
    select key as category, count(*) as weak_count
    from public.organization_memberships om
    join public.risk_profiles rp on rp.user_id = om.user_id
    cross join lateral jsonb_each_text(rp.category_scores) as scores(key, value)
    where om.organization_id = target_org and om.is_admin = false and scores.value = 'weak'
    group by key
  ) stats;
$$;

create or replace function public.admin_create_organization(target_name text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare created public.organizations;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.organizations (name, created_by) values (trim(target_name), auth.uid()) returning * into created;
  perform public.admin_record_audit('organization.create', 'organization', created.id::text, jsonb_build_object('name', created.name));
  return created;
end;
$$;

create or replace function public.admin_set_organization_suspended(target_org uuid, target_suspended boolean)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare updated public.organizations;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  update public.organizations set suspended_at = case when target_suspended then now() else null end where id = target_org returning * into updated;
  if updated.id is null then raise exception 'ORG_NOT_FOUND'; end if;
  perform public.admin_record_audit(case when target_suspended then 'organization.suspend' else 'organization.reactivate' end, 'organization', target_org::text, '{}'::jsonb);
  return updated;
end;
$$;

create or replace function public.admin_set_organization_admin(target_org uuid, target_user uuid, target_is_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.organization_memberships (organization_id, user_id, is_admin)
  values (target_org, target_user, target_is_admin)
  on conflict (organization_id, user_id) do update set is_admin = excluded.is_admin;
  if target_is_admin then
    update public.profiles set role = 'organization_admin', updated_at = now() where id = target_user;
  end if;
  perform public.admin_record_audit('organization.admin.update', 'organization', target_org::text, jsonb_build_object('userId', target_user, 'isAdmin', target_is_admin));
end;
$$;

create or replace function public.admin_get_training_catalog()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare langs jsonb;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  langs := coalesce((select value from public.platform_settings where key = 'supported_languages'), '["en","af","pt"]'::jsonb);
  return jsonb_build_object(
    'languages', langs,
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'slug', m.slug,
        'title', m.title,
        'published', m.is_published,
        'archived', m.archived_at is not null,
        'scenarioCount', (select count(*) from public.scenarios s where s.module_id = m.id),
        'languageCompleteness', (
          select coalesce(jsonb_object_agg(lang_code, (m.title ? lang_code and m.description ? lang_code)), '{}'::jsonb)
          from jsonb_array_elements_text(langs) as lang_code
        )
      ) order by m.created_at)
      from public.training_modules m
      where m.is_assessment = false
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_upsert_training_module(target_module uuid, target_title jsonb, target_description jsonb, target_published boolean)
returns public.training_modules language plpgsql security definer set search_path = public as $$
declare updated public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  update public.training_modules
  set title = target_title, description = target_description, is_published = target_published
  where id = target_module
  returning * into updated;
  if updated.id is null then raise exception 'MODULE_NOT_FOUND'; end if;
  perform public.admin_record_audit('training.module.update', 'training_module', target_module::text, jsonb_build_object('published', target_published));
  return updated;
end;
$$;

create or replace function public.admin_archive_training_module(target_module uuid, target_archived boolean)
returns public.training_modules language plpgsql security definer set search_path = public as $$
declare updated public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  update public.training_modules
  set archived_at = case when target_archived then now() else null end, is_published = case when target_archived then false else is_published end
  where id = target_module returning * into updated;
  if updated.id is null then raise exception 'MODULE_NOT_FOUND'; end if;
  perform public.admin_record_audit(case when target_archived then 'training.module.archive' else 'training.module.restore' end, 'training_module', target_module::text, '{}'::jsonb);
  return updated;
end;
$$;

create or replace function public.admin_get_platform_analytics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'categoryWeakness', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'weakCount', weak_count, 'assessedUsers', assessed_users, 'weakPercent', round((weak_count::numeric / nullif(assessed_users, 0)) * 100, 1)) order by weak_count desc)
      from (
        select key as category,
          count(*) filter (where value = 'weak') as weak_count,
          count(distinct rp.user_id) as assessed_users
        from public.risk_profiles rp
        cross join lateral jsonb_each_text(rp.category_scores) scores(key, value)
        group by key
      ) stats
    ), '[]'::jsonb),
    'completion', jsonb_build_object(
      'usersWithProfiles', (select count(*) from public.risk_profiles),
      'usersWithTraining', (select count(distinct user_id) from public.training_attempts)
    )
  );
end;
$$;

create or replace function public.admin_list_audit_log(limit_count integer default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'actorId', actor_id, 'action', action, 'targetType', target_type, 'targetId', target_id, 'metadata', metadata, 'createdAt', created_at) order by created_at desc)
    from (select * from public.audit_log order by created_at desc limit greatest(limit_count, 1)) recent
  ), '[]'::jsonb);
end;
$$;
