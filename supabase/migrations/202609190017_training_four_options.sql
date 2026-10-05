-- Training interaction hardening: four choices and replay-safe progress support.
-- Existing attempts remain audit history; progress is recalculated by the API per scenario.

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
  if jsonb_array_length(target_options) <> 4
    or (select count(*) from jsonb_to_recordset(target_options) as option(option_key text) where option.option_key in ('A', 'B', 'C', 'D')) <> 4
    or (select count(distinct option_key) from jsonb_to_recordset(target_options) as option(option_key text)) <> 4 then
    raise exception 'SCENARIO_OPTIONS_INVALID';
  end if;
  if (select count(*) from jsonb_to_recordset(target_options) as option(is_correct boolean) where option.is_correct) <> 1 then
    raise exception 'SCENARIO_CORRECT_OPTION_INVALID';
  end if;

  insert into public.scenarios (module_id, slug, content, risk_dimensions)
  values (target_module, lower(trim(target_slug)), target_content, target_risk_dimensions)
  returning * into created;

  insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback)
  select created.id, option_key, content, is_correct, feedback
  from jsonb_to_recordset(target_options) as option(option_key text, content jsonb, is_correct boolean, feedback jsonb);

  return jsonb_build_object('id', created.id, 'moduleId', created.module_id, 'slug', created.slug);
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
  if jsonb_array_length(target_options) <> 4
    or (select count(*) from jsonb_to_recordset(target_options) as option(option_key text) where option.option_key in ('A', 'B', 'C', 'D')) <> 4
    or (select count(distinct option_key) from jsonb_to_recordset(target_options) as option(option_key text)) <> 4 then
    raise exception 'SCENARIO_OPTIONS_INVALID';
  end if;
  if (select count(*) from jsonb_to_recordset(target_options) as option(is_correct boolean) where option.is_correct) <> 1 then
    raise exception 'SCENARIO_CORRECT_OPTION_INVALID';
  end if;
  update public.scenarios set slug = lower(trim(target_slug)), content = target_content, risk_dimensions = target_risk_dimensions where id = target_scenario returning * into updated;
  if updated.id is null then raise exception 'SCENARIO_NOT_FOUND'; end if;
  delete from public.scenario_options where scenario_id = updated.id;
  insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback)
  select updated.id, option_key, content, is_correct, feedback
  from jsonb_to_recordset(target_options) as option(option_key text, content jsonb, is_correct boolean, feedback jsonb);
  return jsonb_build_object('id', updated.id, 'moduleId', updated.module_id, 'slug', updated.slug);
end;
$$;

-- Publishing now requires the four-choice shape for every scenario in the module.
create or replace function public.set_admin_module_published(target_module uuid, target_published boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  if target_published and (
    (select count(*) from public.scenarios where module_id = target_module) < 6
    or exists (
      select 1 from public.scenarios s
      where s.module_id = target_module
      and (
        (select count(*) from public.scenario_options o where o.scenario_id = s.id) <> 4
        or (select count(*) from public.scenario_options o where o.scenario_id = s.id and o.is_correct) <> 1
      )
    )
  ) then raise exception 'MODULE_PUBLISH_INCOMPLETE'; end if;
  update public.training_modules set is_published = target_published, updated_at = now() where id = target_module returning * into result;
  if result.id is null then raise exception 'MODULE_NOT_FOUND'; end if;
  return jsonb_build_object('id', result.id, 'slug', result.slug, 'published', result.is_published);
end;
$$;
