alter table public.training_modules
  add column if not exists learning_material jsonb not null default '{}'::jsonb;

update public.training_modules m
set learning_material = jsonb_build_object(
  'en', jsonb_build_object(
    'whyItMatters', format('Threats such as %s exploit a gap between what a person or system expects and what is actually happening, so routine behavior can allow unsafe action or expose data.', coalesce(m.title->>'en', m.slug)),
    'warningSigns', 'Unexpected requests or inputs, pressure to act quickly or secretly, mismatched sender details, unfamiliar links, and unusual errors, access, or behavior.',
    'bestPractice', 'Pause and verify unusual requests independently. Use approved secure pathways, limit access and information to what is needed, and report suspicious activity or behavior.'
  ),
  'af', jsonb_build_object(
    'whyItMatters', format('Bedreigings soos %s benut die verskil tussen wat ’n persoon of stelsel verwag en wat werklik gebeur, sodat roetinegedrag onveilige optrede of datablootstelling kan veroorsaak.', coalesce(m.title->>'af', m.title->>'en', m.slug)),
    'warningSigns', 'Onverwagte versoeke of invoer, druk om vinnig of in die geheim op te tree, senderbesonderhede wat nie klop nie, onbekende skakels en ongewone foute, toegang of gedrag.',
    'bestPractice', 'Wag en bevestig ongewone versoeke onafhanklik. Gebruik goedgekeurde veilige kanale, beperk toegang en inligting tot wat nodig is, en rapporteer verdagte aktiwiteit of gedrag.'
  ),
  'pt', jsonb_build_object(
    'whyItMatters', format('Ameaças como %s exploram a diferença entre o que uma pessoa ou sistema espera e o que realmente acontece, permitindo ações inseguras ou exposição de dados.', coalesce(m.title->>'pt', m.title->>'en', m.slug)),
    'warningSigns', 'Pedidos ou dados inesperados, pressão para agir depressa ou em segredo, dados do remetente que não coincidem, links desconhecidos e erros, acessos ou comportamentos invulgares.',
    'bestPractice', 'Pare e confirme pedidos invulgares por um canal independente. Use os canais seguros aprovados, limite o acesso e os dados ao necessário e denuncie atividades suspeitas.'
  )
)
where not (
  m.learning_material ? 'en'
  and m.learning_material ? 'af'
  and m.learning_material ? 'pt'
  and coalesce(m.learning_material->'en'->>'whyItMatters', '') <> ''
  and coalesce(m.learning_material->'en'->>'warningSigns', '') <> ''
  and coalesce(m.learning_material->'en'->>'bestPractice', '') <> ''
  and coalesce(m.learning_material->'af'->>'whyItMatters', '') <> ''
  and coalesce(m.learning_material->'af'->>'warningSigns', '') <> ''
  and coalesce(m.learning_material->'af'->>'bestPractice', '') <> ''
  and coalesce(m.learning_material->'pt'->>'whyItMatters', '') <> ''
  and coalesce(m.learning_material->'pt'->>'warningSigns', '') <> ''
  and coalesce(m.learning_material->'pt'->>'bestPractice', '') <> ''
);

update public.training_modules
set learning_material = jsonb_build_object(
  'en', jsonb_build_object(
    'whyItMatters', 'SQL injection can happen when software treats untrusted text as part of a database command. That can expose or change information the user should not control.',
    'warningSigns', 'Unexpected records, unusual login or search results, database errors shown in the app, or requests to enter unusual symbols or extra text into a form.',
    'bestPractice', 'Use only the intended fields and report unusual behavior instead of probing further. Software teams should validate input and use parameterized database queries.'
  ),
  'af', jsonb_build_object(
    'whyItMatters', 'SQL-inspuiting kan gebeur wanneer sagteware onbetroubare teks as deel van ’n databasisopdrag hanteer. Dit kan inligting blootstel of verander wat die gebruiker nie behoort te beheer nie.',
    'warningSigns', 'Onverwagte rekords, vreemde aanmeld- of soekresultate, databasisfoute wat in die toepassing verskyn, of versoeke om ongewone simbole of ekstra teks in ’n vorm in te voer.',
    'bestPractice', 'Gebruik slegs die bedoelde velde en rapporteer ongewone gedrag eerder as om verder te toets. Sagtewarespanne moet invoer valideer en geparameteriseerde databasisnavrae gebruik.'
  ),
  'pt', jsonb_build_object(
    'whyItMatters', 'A injeção de SQL pode ocorrer quando o software trata texto não confiável como parte de um comando à base de dados. Isso pode expor ou alterar informações que o utilizador não deveria controlar.',
    'warningSigns', 'Registos inesperados, resultados estranhos de pesquisa ou início de sessão, erros da base de dados apresentados na aplicação ou pedidos para inserir símbolos ou texto extra num formulário.',
    'bestPractice', 'Use apenas os campos previstos e reporte comportamentos invulgares em vez de continuar a testar. As equipas de software devem validar os dados e usar consultas parametrizadas.'
  )
)
where slug ilike '%sql%' or coalesce(title->>'en', '') ilike '%sql%';

update public.training_modules
set learning_material = jsonb_build_object(
  'en', jsonb_build_object(
    'whyItMatters', 'Impersonation works because a familiar name and a time-sensitive request can make people bypass normal checks.',
    'warningSigns', 'Unexpected requests for money, gift cards, passwords, or codes; urgency or secrecy; and a sender or channel that is difficult to verify.',
    'bestPractice', 'Pause. Contact the person through a number or channel you already trust, confirm the request, and report suspicious messages.'
  ),
  'af', jsonb_build_object(
    'whyItMatters', 'Nabootsing werk omdat ’n bekende naam en ’n dringende versoek mense kan laat nalaat om gewone kontroles te doen.',
    'warningSigns', 'Onverwagte versoeke vir geld, geskenkbewyse, wagwoorde of kodes; dringendheid of geheimhouding; en ’n sender of kanaal wat moeilik is om te bevestig.',
    'bestPractice', 'Wag eers. Kontak die persoon via ’n nommer of kanaal wat jy reeds vertrou, bevestig die versoek en rapporteer verdagte boodskappe.'
  ),
  'pt', jsonb_build_object(
    'whyItMatters', 'A falsificação de identidade funciona porque um nome conhecido e um pedido urgente podem levar as pessoas a ignorar verificações normais.',
    'warningSigns', 'Pedidos inesperados de dinheiro, cartões-presente, palavras-passe ou códigos; urgência ou segredo; e um remetente ou canal difícil de confirmar.',
    'bestPractice', 'Pare. Contacte a pessoa por um número ou canal em que já confia, confirme o pedido e denuncie mensagens suspeitas.'
  )
)
where slug = 'impersonation-trust';

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
        'description', m.description,
        'learningMaterial', m.learning_material,
        'published', m.is_published,
        'archived', m.archived_at is not null,
        'scenarioCount', (select count(*) from public.scenarios s where s.module_id = m.id),
        'languageCompleteness', (
          select coalesce(jsonb_object_agg(lang_code, (m.title ? lang_code and m.description ? lang_code and coalesce(length(trim(m.learning_material->lang_code->>'whyItMatters')), 0) >= 10 and coalesce(length(trim(m.learning_material->lang_code->>'warningSigns')), 0) >= 10 and coalesce(length(trim(m.learning_material->lang_code->>'bestPractice')), 0) >= 10)), '{}'::jsonb)
          from jsonb_array_elements_text(langs) as languages(lang_code)
        )
      ) order by m.created_at)
      from public.training_modules m
      where m.is_assessment = false
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.admin_upsert_training_module(uuid, jsonb, jsonb, boolean);
create or replace function public.admin_upsert_training_module(target_module uuid, target_title jsonb, target_description jsonb, target_published boolean, target_learning_material jsonb)
returns public.training_modules language plpgsql security definer set search_path = public as $$
declare updated public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.training_modules where id = target_module) then raise exception 'MODULE_NOT_FOUND'; end if;
  if target_published is distinct from (select is_published from public.training_modules where id = target_module) then
    raise exception 'MODULE_PUBLICATION_REQUIRES_GUARD';
  end if;
  update public.training_modules
  set title = target_title,
      description = target_description,
      learning_material = coalesce(learning_material, '{}'::jsonb) || target_learning_material
  where id = target_module
  returning * into updated;
  if updated.id is null then raise exception 'MODULE_NOT_FOUND'; end if;
  perform public.admin_record_audit('training.module.update', 'training_module', target_module::text, jsonb_build_object('published', target_published, 'learningLanguages', (select jsonb_agg(languages.language) from jsonb_object_keys(target_learning_material) as languages(language))));
  return updated;
end;
$$;

drop function if exists public.set_admin_module_published(uuid, boolean);
create function public.set_admin_module_published(target_module uuid, target_published boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.training_modules;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.training_modules where id = target_module) then raise exception 'MODULE_NOT_FOUND'; end if;
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
    or exists (
      select 1
      from public.training_modules m
      cross join (values ('en'), ('af'), ('pt')) as locale(code)
      where m.id = target_module
      and (
        coalesce(length(trim(m.learning_material->locale.code->>'whyItMatters')), 0) < 10
        or coalesce(length(trim(m.learning_material->locale.code->>'warningSigns')), 0) < 10
        or coalesce(length(trim(m.learning_material->locale.code->>'bestPractice')), 0) < 10
      )
    )
  ) then raise exception 'MODULE_PUBLISH_INCOMPLETE'; end if;
  update public.training_modules set is_published = target_published, updated_at = now() where id = target_module returning * into result;
  return jsonb_build_object('id', result.id, 'slug', result.slug, 'published', result.is_published);
end;
$$;