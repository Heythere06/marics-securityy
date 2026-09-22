create or replace function public.organization_team_risk(target_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  employee_total integer;
  assessed_total integer;
  breakdown jsonb;
  top_category text;
  top_percent numeric;
begin
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  select count(*) into employee_total from public.organization_memberships where organization_id = target_org and is_admin = false;
  select count(distinct om.user_id) into assessed_total
  from public.organization_memberships om
  join public.risk_profiles rp on rp.user_id = om.user_id
  where om.organization_id = target_org and om.is_admin = false;

  select coalesce(jsonb_agg(jsonb_build_object(
    'category', category,
    'weakCount', weak_count,
    'weakPercent', case when assessed_total = 0 then 0 else round((weak_count::numeric / assessed_total) * 100, 1) end
  ) order by weak_count desc), '[]'::jsonb)
  into breakdown
  from (
    select key as category, count(*) as weak_count
    from public.organization_memberships om
    join public.risk_profiles rp on rp.user_id = om.user_id
    cross join lateral jsonb_each_text(rp.category_scores) scores(key, value)
    where om.organization_id = target_org and om.is_admin = false and scores.value = 'weak'
    group by key
  ) stats;

  select category, case when assessed_total = 0 then 0 else round((weak_count::numeric / assessed_total) * 100, 1) end
  into top_category, top_percent
  from (
    select key as category, count(*) as weak_count
    from public.organization_memberships om
    join public.risk_profiles rp on rp.user_id = om.user_id
    cross join lateral jsonb_each_text(rp.category_scores) scores(key, value)
    where om.organization_id = target_org and om.is_admin = false and scores.value = 'weak'
    group by key
    order by count(*) desc
    limit 1
  ) top;

  return jsonb_build_object(
    'employeeCount', employee_total,
    'assessedEmployees', assessed_total,
    'categoryBreakdown', breakdown,
    'highestRiskArea', coalesce(top_category, 'Not enough data'),
    'highestRiskPercent', coalesce(top_percent, 0)
  );
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
    'employees', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'attempted', coalesce(stats.attempted, 0), 'correct', coalesce(stats.correct, 0)) order by p.full_name) from public.organization_memberships om join public.profiles p on p.id = om.user_id left join (select user_id, count(*) attempted, count(*) filter (where is_correct) correct from public.training_attempts group by user_id) stats on stats.user_id = p.id where om.organization_id = target_org and om.is_admin = false), '[]'::jsonb),
    'teamRisk', public.organization_team_risk(target_org)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_organization_report_csv(target_org uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  dashboard jsonb;
  risk jsonb;
  lines text[] := array['section,metric,value'];
  item jsonb;
begin
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  dashboard := public.get_organization_dashboard(target_org);
  risk := dashboard -> 'teamRisk';
  lines := lines || format('organization,name,%s', replace(coalesce(dashboard #>> '{organization,name}', ''), ',', ' '));
  lines := lines || format('organization,employees,%s', dashboard ->> 'employeeCount');
  lines := lines || format('training,scenarios_attempted,%s', dashboard ->> 'attempted');
  lines := lines || format('training,team_accuracy_percent,%s', case when (dashboard ->> 'attempted')::int = 0 then 0 else round(((dashboard ->> 'correct')::numeric / (dashboard ->> 'attempted')::numeric) * 100, 1) end);
  lines := lines || format('risk,assessed_employees,%s', risk ->> 'assessedEmployees');
  lines := lines || format('risk,highest_risk_area,%s', replace(coalesce(risk ->> 'highestRiskArea', ''), ',', ' '));
  lines := lines || format('risk,highest_risk_percent,%s', risk ->> 'highestRiskPercent');
  for item in select * from jsonb_array_elements(coalesce(risk -> 'categoryBreakdown', '[]'::jsonb))
  loop
    lines := lines || format('risk_category,%s,%s', replace(item ->> 'category', ',', ' '), item ->> 'weakPercent');
  end loop;
  return array_to_string(lines, E'\n');
end;
$$;
