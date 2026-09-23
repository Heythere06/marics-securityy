alter table public.profiles add column if not exists email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where users.id = profiles.id
  and profiles.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  normalized_account_type text;
begin
  normalized_account_type := coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'individual');

  insert into public.profiles (id, full_name, country_code, preferred_language, role, account_type, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'country_code', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_language', ''), 'en'),
    case when normalized_account_type = 'organization' then 'organization_admin'::public.app_role else 'individual'::public.app_role end,
    normalized_account_type,
    new.email
  );
  return new;
end;
$$;

create or replace function public.get_organization_dashboard(target_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'organization', (select jsonb_build_object('id', id, 'name', name) from public.organizations where id = target_org),
    'employeeCount', (select count(*) from public.organization_memberships where organization_id = target_org and is_admin = false),
    'trainedEmployees', (select count(distinct ta.user_id) from public.training_attempts ta join public.organization_memberships om on om.user_id = ta.user_id where om.organization_id = target_org and om.is_admin = false),
    'attempted', (select count(*) from public.training_attempts ta join public.organization_memberships om on om.user_id = ta.user_id where om.organization_id = target_org and om.is_admin = false),
    'correct', (select count(*) from public.training_attempts ta join public.organization_memberships om on om.user_id = ta.user_id where om.organization_id = target_org and om.is_admin = false and ta.is_correct),
    'employees', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.full_name,
      'email', p.email,
      'joinedAt', om.created_at,
      'attempted', coalesce(stats.attempted, 0),
      'correct', coalesce(stats.correct, 0),
      'lastActivityAt', greatest(om.created_at, coalesce(stats.last_attempt_at, om.created_at), coalesce(progress.last_progress_at, om.created_at)),
      'modulesCompleted', coalesce(progress.modules_completed, 0),
      'modulesTotal', (select count(*) from public.training_modules where is_published = true),
      'riskSummary', case when rp.user_id is null then 'Not assessed' else coalesce(rp.focus_dimension, 'Profile available') end
    ) order by p.full_name)
    from public.organization_memberships om
    join public.profiles p on p.id = om.user_id
    left join public.risk_profiles rp on rp.user_id = p.id
    left join (select user_id, count(*) attempted, count(*) filter (where is_correct) correct, max(created_at) last_attempt_at from public.training_attempts group by user_id) stats on stats.user_id = p.id
    left join (select user_id, count(*) filter (where completed_at is not null) modules_completed, max(updated_at) last_progress_at from public.training_progress group by user_id) progress on progress.user_id = p.id
    where om.organization_id = target_org and om.is_admin = false), '[]'::jsonb),
    'teamRisk', public.organization_team_risk(target_org)
  ) into result;
  return result;
end;
$$;
