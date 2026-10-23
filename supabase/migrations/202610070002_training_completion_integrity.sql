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
      'modulesCompleted', (
        select count(*)
        from public.training_modules m
        where m.is_published = true
          and coalesce(m.is_assessment, false) = false
          and exists (select 1 from public.scenarios s where s.module_id = m.id)
          and not exists (
            select 1
            from public.scenarios s
            where s.module_id = m.id
              and not exists (
                select 1
                from public.training_attempts ta
                where ta.user_id = p.id and ta.scenario_id = s.id
              )
          )
      ),
      'modulesTotal', (
        select count(*)
        from public.training_modules m
        where m.is_published = true
          and coalesce(m.is_assessment, false) = false
          and exists (select 1 from public.scenarios s where s.module_id = m.id)
      ),
      'riskSummary', case when rp.user_id is null then 'Not assessed' else coalesce(rp.focus_dimension, 'Profile available') end
    ) order by p.full_name)
    from public.organization_memberships om
    join public.profiles p on p.id = om.user_id
    left join public.risk_profiles rp on rp.user_id = p.id
    left join (select user_id, count(*) attempted, count(*) filter (where is_correct) correct, max(created_at) last_attempt_at from public.training_attempts group by user_id) stats on stats.user_id = p.id
    left join (select user_id, max(updated_at) last_progress_at from public.training_progress group by user_id) progress on progress.user_id = p.id
    where om.organization_id = target_org and om.is_admin = false), '[]'::jsonb),
    'teamRisk', public.organization_team_risk(target_org)
  ) into result;
  return result;
end;
$$;
