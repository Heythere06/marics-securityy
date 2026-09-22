-- Admin scenario authoring. This migration is additive and safe to rerun.
alter table public.scenarios add column if not exists slug text;
create unique index if not exists scenarios_slug_idx on public.scenarios(slug) where slug is not null;

alter table public.training_modules enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_options enable row level security;
drop policy if exists published_modules_read on public.training_modules;
drop policy if exists published_scenarios_read on public.scenarios;
drop policy if exists published_options_read on public.scenario_options;
create policy published_modules_read on public.training_modules for select using (is_published = true and coalesce(is_assessment, false) = false);
create policy published_scenarios_read on public.scenarios for select using (exists (select 1 from public.training_modules m where m.id = module_id and m.is_published = true and coalesce(m.is_assessment, false) = false));
create policy published_options_read on public.scenario_options for select using (exists (select 1 from public.scenarios s join public.training_modules m on m.id = s.module_id where s.id = scenario_id and m.is_published = true and coalesce(m.is_assessment, false) = false));

create or replace function public.admin_create_scenario(
  target_module uuid,
  target_slug text,
  target_content jsonb,
  target_risk_dimensions text[],
  target_options jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  created public.scenarios;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.training_modules where id = target_module and is_assessment = false) then
    raise exception 'MODULE_NOT_FOUND';
  end if;
  if jsonb_array_length(target_options) <> 3 then raise exception 'SCENARIO_OPTIONS_INVALID'; end if;

  insert into public.scenarios (module_id, slug, content, risk_dimensions)
  values (target_module, lower(trim(target_slug)), target_content, target_risk_dimensions)
  returning * into created;

  insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback)
  select created.id, option_key, content, is_correct, feedback
  from jsonb_to_recordset(target_options) as option(option_key text, content jsonb, is_correct boolean, feedback jsonb);

  return jsonb_build_object('id', created.id, 'moduleId', created.module_id, 'slug', created.slug);
end;
$$;

create or replace function public.admin_list_scenarios(target_module uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', s.id, 'moduleId', s.module_id, 'slug', s.slug, 'content', s.content, 'riskDimensions', s.risk_dimensions,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'optionKey', o.option_key, 'content', o.content, 'isCorrect', o.is_correct, 'feedback', o.feedback) order by o.option_key), '[]'::jsonb) from public.scenario_options o where o.scenario_id = s.id)
  ) order by s.created_at) from public.scenarios s where s.module_id = target_module), '[]'::jsonb);
end;
$$;

create or replace function public.admin_update_scenario(
  target_scenario uuid,
  target_slug text,
  target_content jsonb,
  target_risk_dimensions text[],
  target_options jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare updated public.scenarios;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  if jsonb_array_length(target_options) <> 3 then raise exception 'SCENARIO_OPTIONS_INVALID'; end if;
  update public.scenarios set slug = lower(trim(target_slug)), content = target_content, risk_dimensions = target_risk_dimensions where id = target_scenario returning * into updated;
  if updated.id is null then raise exception 'SCENARIO_NOT_FOUND'; end if;
  delete from public.scenario_options where scenario_id = updated.id;
  insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback)
  select updated.id, option_key, content, is_correct, feedback
  from jsonb_to_recordset(target_options) as option(option_key text, content jsonb, is_correct boolean, feedback jsonb);
  return jsonb_build_object('id', updated.id, 'moduleId', updated.module_id, 'slug', updated.slug);
end;
$$;