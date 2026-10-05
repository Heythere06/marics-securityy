do $$
declare
  target_module uuid;
begin
  select id into target_module
  from public.training_modules
  where coalesce(title->>'en', '') ilike '%sql%'
    and coalesce(is_assessment, false) = false
  order by created_at
  limit 1;

  if target_module is null then
    raise exception 'SQL_INJECTION_MODULE_NOT_FOUND';
  end if;

  insert into public.scenarios (module_id, slug, content, risk_dimensions)
  select target_module, seed.slug, seed.content, seed.risk_dimensions
  from (values
    ('sql-injection-search-results', jsonb_build_object('en', jsonb_build_object('title', 'Unexpected search results', 'scenario', 'You search for an ordinary item in a work portal. The results include records that should belong to other teams, followed by a database error. What should you do?')), array['Data exposure']::text[]),
    ('sql-injection-database-error', jsonb_build_object('en', jsonb_build_object('title', 'A database error appears', 'scenario', 'A normal form submission returns a technical database error instead of the usual confirmation. The form still lets you retry. What is the safest response?')), array['Data exposure', 'Safe reporting']::text[]),
    ('sql-injection-diagnostic-request', jsonb_build_object('en', jsonb_build_object('title', 'A request to run diagnostics', 'scenario', 'A coworker sends an unfamiliar tool and asks you to paste database text into a search field to diagnose a problem. What should you do?')), array['Verification', 'Credential theft']::text[]),
    ('sql-injection-unexpected-export', jsonb_build_object('en', jsonb_build_object('title', 'An export includes extra records', 'scenario', 'A report you are authorized to download unexpectedly contains customer records outside your team. What should you do next?')), array['Data exposure', 'Privacy']::text[]),
    ('sql-injection-broad-access', jsonb_build_object('en', jsonb_build_object('title', 'A tool requests broad data access', 'scenario', 'A new work tool asks for access to every customer record, even though your task only needs a small subset. What should you do before approving it?')), array['Least privilege', 'Verification']::text[])
  ) as seed(slug, content, risk_dimensions)
  where not exists (select 1 from public.scenarios existing where existing.slug = seed.slug);

  insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback)
  select existing.id, seed.option_key,
    jsonb_build_object('en', seed.option_text),
    seed.is_correct,
    jsonb_build_object('en', jsonb_build_object('choice', seed.choice_feedback, 'explanation', seed.explanation))
  from (values
    ('sql-injection-login', 'D', 'Forward the link to the whole team and ask them to decide.', false, 'Sharing an unverified link can expose more people.', 'Use the approved reporting channel and verify the request directly with support.'),
    ('sql-injection-search-results', 'A', 'Open several records to see how much information is exposed.', false, 'Looking through records increases exposure and is not authorized.', 'Stop viewing the records and report the unexpected results without copying or sharing them.'),
    ('sql-injection-search-results', 'B', 'Stop using the search and report the result through the approved security channel.', true, 'You limited exposure and used the right reporting path.', 'Unexpected records may indicate an access-control or input-handling problem; do not investigate further.'),
    ('sql-injection-search-results', 'C', 'Send a screenshot of the records to your personal email for later.', false, 'Moving sensitive records to personal email creates another exposure.', 'Report the issue through an approved channel and include only the minimum necessary details.'),
    ('sql-injection-search-results', 'D', 'Try different search terms until the database error goes away.', false, 'Repeated testing can reveal or change data and is not your role.', 'Stop interacting with the form and let the security or support team investigate.'),
    ('sql-injection-database-error', 'A', 'Retry the form with extra punctuation to see if the error changes.', false, 'Testing variations can probe the system and increase risk.', 'Do not probe further; report the error and the ordinary steps that led to it.'),
    ('sql-injection-database-error', 'B', 'Copy the full error into a public team channel.', false, 'Technical errors can contain internal details that should not be widely shared.', 'Use the approved support or security channel and avoid posting sensitive details broadly.'),
    ('sql-injection-database-error', 'C', 'Stop retrying and report the error through the approved support channel.', true, 'You avoided probing and routed the issue to people who can investigate safely.', 'Unexpected database errors can reveal a software problem; record the time and normal action, then stop.'),
    ('sql-injection-database-error', 'D', 'Use a coworker account to check whether the same error appears.', false, 'Using another account expands the impact and does not make the test authorized.', 'Report what happened from your own account and let the responsible team reproduce it safely.'),
    ('sql-injection-diagnostic-request', 'A', 'Paste the requested text into the form because the coworker sounds confident.', false, 'A familiar or confident request does not establish that the tool is approved.', 'Verify the tool and request through a known work channel before entering data.'),
    ('sql-injection-diagnostic-request', 'B', 'Ask the coworker to send the request from a personal account.', false, 'A different sender address does not confirm that the tool is safe.', 'Use the official support process to verify whether the diagnostic is approved.'),
    ('sql-injection-diagnostic-request', 'C', 'Try the diagnostic with a few harmless-looking variations.', false, 'Even test input can interact with a live system in unexpected ways.', 'Do not test unfamiliar tools against work systems; verify approval and report suspicious requests.'),
    ('sql-injection-diagnostic-request', 'D', 'Do not enter anything; verify the request with support through a known channel.', true, 'Independent verification prevents an unapproved request from becoming a data incident.', 'Only use reviewed tools and approved procedures for diagnostics.'),
    ('sql-injection-unexpected-export', 'A', 'Stop using the export and report the extra records through the approved privacy or security channel.', true, 'You stopped further access and reported a possible data exposure.', 'Do not copy, forward, or delete the records; follow the response team’s instructions.'),
    ('sql-injection-unexpected-export', 'B', 'Forward the file to your manager so they can inspect every record.', false, 'Forwarding the file spreads sensitive data beyond the intended audience.', 'Report the issue without distributing the export and provide only the details responders need.'),
    ('sql-injection-unexpected-export', 'C', 'Delete the file and say nothing because it was probably a mistake.', false, 'Silent deletion can remove evidence and prevent the exposure from being addressed.', 'Stop access and report promptly; let the response team advise on preserving or removing the file.'),
    ('sql-injection-unexpected-export', 'D', 'Keep using the file but avoid opening the unfamiliar rows.', false, 'Keeping an unexpectedly broad export still retains data you are not authorized to use.', 'Stop using the export and report the scope mismatch.'),
    ('sql-injection-broad-access', 'A', 'Approve it now and ask for narrower access later.', false, 'Broad access creates immediate exposure and may be difficult to reverse.', 'Wait for review and request only the minimum access needed for the task.'),
    ('sql-injection-broad-access', 'B', 'Use a coworker’s approval because they already use the tool.', false, 'Another person’s use does not confirm that your requested access is appropriate.', 'Follow the approval process for your role and the specific data involved.'),
    ('sql-injection-broad-access', 'C', 'Approve it if the tool has a familiar company logo.', false, 'Branding alone does not verify an integration or its permissions.', 'Verify the tool owner and request scope through approved channels.'),
    ('sql-injection-broad-access', 'D', 'Pause approval and ask the data owner to review a least-privilege scope.', true, 'Reviewing necessity and scope reduces the impact of misuse or compromise.', 'Grant only the access required for the task after the responsible owner approves it.')
  ) as seed(scenario_slug, option_key, option_text, is_correct, choice_feedback, explanation)
  join public.scenarios existing
    on existing.module_id = target_module and existing.slug = seed.scenario_slug
  on conflict (scenario_id, option_key) do nothing;

  if exists (
    select 1
    from public.scenarios scenario
    where scenario.module_id = target_module
      and (
        (select count(*) from public.scenario_options option where option.scenario_id = scenario.id) <> 4
        or (select count(*) from public.scenario_options option where option.scenario_id = scenario.id and option.is_correct) <> 1
      )
  ) then
    raise exception 'SQL_INJECTION_SCENARIO_OPTIONS_INVALID';
  end if;
end;
$$;
