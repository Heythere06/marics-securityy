alter table public.risk_profiles
  add column if not exists category_scores jsonb not null default '{}'::jsonb;

alter table public.training_modules
  add column if not exists is_assessment boolean not null default false;

insert into public.training_modules (id, slug, title, description, is_published, is_assessment)
values (
  '00000000-0000-0000-0000-000000000102',
  'baseline-assessment',
  '{"en":"Baseline risk assessment"}',
  '{"en":"Ten scenario-style questions that map your manipulation-pattern strengths and focus areas."}',
  true,
  true
)
on conflict (slug) do update set is_assessment = true, is_published = excluded.is_published;

insert into public.scenarios (id, module_id, slug, content, risk_dimensions) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', 'urgency', '{"en":{"title":"Urgency","scenario":"Your bank texts: Suspicious activity detected. Confirm within 10 minutes. What do you do?"}}', '{"Urgency"}'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', 'authority', '{"en":{"title":"Authority","scenario":"A senior colleague requests an urgent payment change by email. What is safest?"}}', '{"Authority"}'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000102', 'curiosity', '{"en":{"title":"Curiosity","scenario":"A courier message includes a small fee and a shortened link. What is safest?"}}', '{"Curiosity"}'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000102', 'fear', '{"en":{"title":"Fear","scenario":"A caller says your identity will be reported unless you confirm your details immediately. What do you do?"}}', '{"Fear"}'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000102', 'trust', '{"en":{"title":"Trust","scenario":"A familiar contact sends a new bank account number from an unusual address. What is safest?"}}', '{"Trust"}'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000102', 'scarcity', '{"en":{"title":"Scarcity","scenario":"A software offer says only one license remains and payment must happen now. What do you do?"}}', '{"Scarcity"}'),
  ('00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000102', 'social_pressure', '{"en":{"title":"Social pressure","scenario":"A group chat mocks you for not opening a shared document. What is safest?"}}', '{"Social pressure"}'),
  ('00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000102', 'financial_manipulation', '{"en":{"title":"Financial manipulation","scenario":"A marketplace seller asks for payment outside the platform to save a fee. What do you do?"}}', '{"Financial manipulation"}'),
  ('00000000-0000-0000-0000-000000000309', '00000000-0000-0000-0000-000000000102', 'credential_theft', '{"en":{"title":"Credential theft","scenario":"A login page asks you to enter your password again after arriving from an unexpected message. What is safest?"}}', '{"Credential theft"}'),
  ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000102', 'impersonation', '{"en":{"title":"Impersonation","scenario":"A message appears to come from your manager asking for confidential staff data. What do you do?"}}', '{"Impersonation"}')
on conflict (id) do update set content = excluded.content, risk_dimensions = excluded.risk_dimensions;

insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback) values
  ('00000000-0000-0000-0000-000000000301', 'A', '{"en":"Open the link before the account is locked."}', false, '{"en":{"choice":"Urgency is being used to bypass your normal checks.","explanation":"Open your banking app directly or call the number on your card instead of following SMS links."}}'),
  ('00000000-0000-0000-0000-000000000301', 'B', '{"en":"Open your banking app directly or call the number on your card."}', true, '{"en":{"choice":"You resisted time pressure and used a trusted channel.","explanation":"Attackers fake urgency so you skip verification. Your bank’s official app or card number is the safe path."}}'),
  ('00000000-0000-0000-0000-000000000301', 'C', '{"en":"Reply STOP and wait for another message."}', false, '{"en":{"choice":"Engaging can confirm your number is active.","explanation":"Use official banking channels rather than replying to unexpected texts."}}'),
  ('00000000-0000-0000-0000-000000000302', 'A', '{"en":"Pay it now because the request is from a senior person."}', false, '{"en":{"choice":"Authority alone is not proof of a legitimate request.","explanation":"Verify payment changes through a known phone number or in-person channel."}}'),
  ('00000000-0000-0000-0000-000000000302', 'B', '{"en":"Reply to the email asking for confirmation."}', false, '{"en":{"choice":"Replying keeps you inside the attacker-controlled thread.","explanation":"Use a separate trusted channel to confirm payment changes."}}'),
  ('00000000-0000-0000-0000-000000000302', 'C', '{"en":"Verify using a known phone number or another trusted channel."}', true, '{"en":{"choice":"You separated the request from verification.","explanation":"Authority impersonation fails when you confirm through channels you already trust."}}'),
  ('00000000-0000-0000-0000-000000000303', 'A', '{"en":"Use the courier''s official website or app to check the delivery."}', true, '{"en":{"choice":"Curiosity is safer when you control the destination.","explanation":"Short links hide the real site. Navigate to the courier yourself instead of clicking."}}'),
  ('00000000-0000-0000-0000-000000000303', 'B', '{"en":"Click the link but do not enter your card details."}', false, '{"en":{"choice":"Opening unknown links still exposes your device and identity.","explanation":"Use the official courier site rather than a message link."}}'),
  ('00000000-0000-0000-0000-000000000303', 'C', '{"en":"Forward it to a friend to see whether it looks real."}', false, '{"en":{"choice":"Spreading suspicious links increases risk for others.","explanation":"Verify deliveries through official channels and report suspicious messages."}}'),
  ('00000000-0000-0000-0000-000000000304', 'A', '{"en":"Share enough details to prove who you are."}', false, '{"en":{"choice":"Fear pushes people to over-share before thinking.","explanation":"End the call and contact the organization through an official number."}}'),
  ('00000000-0000-0000-0000-000000000304', 'B', '{"en":"End the call and contact the organization through an official number."}', true, '{"en":{"choice":"You broke the fear cycle and verified independently.","explanation":"Legitimate organizations do not demand immediate identity proof on inbound calls."}}'),
  ('00000000-0000-0000-0000-000000000304', 'C', '{"en":"Ask the caller to call back later."}', false, '{"en":{"choice":"Delaying without verification keeps you engaged with the scammer.","explanation":"Use an official contact path you find yourself, not one the caller provides."}}'),
  ('00000000-0000-0000-0000-000000000305', 'A', '{"en":"Use the new details because you recognize the name."}', false, '{"en":{"choice":"Familiar names are easy to spoof in email and messaging.","explanation":"Verify payment detail changes through a separate trusted channel."}}'),
  ('00000000-0000-0000-0000-000000000305', 'B', '{"en":"Ask them to resend the email."}', false, '{"en":{"choice":"A resent email still comes from the same untrusted thread.","explanation":"Confirm account changes out-of-band using a channel you already trust."}}'),
  ('00000000-0000-0000-0000-000000000305', 'C', '{"en":"Verify the change through a separate trusted channel."}', true, '{"en":{"choice":"Trust is healthy when paired with verification.","explanation":"Account detail changes should always be confirmed outside the message that requested them."}}'),
  ('00000000-0000-0000-0000-000000000306', 'A', '{"en":"Pay quickly before the offer disappears."}', false, '{"en":{"choice":"Scarcity is designed to stop you comparing options.","explanation":"Check vendors through official websites and your procurement process."}}'),
  ('00000000-0000-0000-0000-000000000306', 'B', '{"en":"Check the vendor through its official website and procurement process."}', true, '{"en":{"choice":"You treated scarcity as a signal to slow down.","explanation":"Real procurement rarely depends on a single minutes-long window from an unknown message."}}'),
  ('00000000-0000-0000-0000-000000000306', 'C', '{"en":"Share the offer with coworkers and let them decide."}', false, '{"en":{"choice":"Sharing unverified offers spreads pressure to the team.","explanation":"Validate software purchases through official vendor channels."}}'),
  ('00000000-0000-0000-0000-000000000307', 'A', '{"en":"Open it so you do not hold up the group."}', false, '{"en":{"choice":"Social pressure exploits your need to belong.","explanation":"Verify who created the document and inspect the link before opening."}}'),
  ('00000000-0000-0000-0000-000000000307', 'B', '{"en":"Ask who created it and verify the link before opening."}', false, '{"en":{"choice":"Asking inside the same chat may not reach a trustworthy source.","explanation":"Confirm the document through a separate channel before opening."}}'),
  ('00000000-0000-0000-0000-000000000307', 'C', '{"en":"Verify the link through a separate channel before opening."}', true, '{"en":{"choice":"You resisted group pressure and verified first.","explanation":"Shared document scams rely on embarrassment and speed; verification protects the whole group."}}'),
  ('00000000-0000-0000-0000-000000000308', 'A', '{"en":"Keep payment and communication on the platform."}', true, '{"en":{"choice":"Platform protections exist because off-platform payment is high risk.","explanation":"Off-platform payment removes fraud protections and audit trails."}}'),
  ('00000000-0000-0000-0000-000000000308', 'B', '{"en":"Pay half now and the rest on delivery."}', false, '{"en":{"choice":"Partial off-platform payment still bypasses protections.","explanation":"Stay on the marketplace for payment and messaging."}}'),
  ('00000000-0000-0000-0000-000000000308', 'C', '{"en":"Send your banking details so they can invoice you."}', false, '{"en":{"choice":"Sharing banking details expands your exposure to fraud.","explanation":"Keep transactions inside the platform’s protected flow."}}'),
  ('00000000-0000-0000-0000-000000000309', 'A', '{"en":"Enter it if the logo looks correct."}', false, '{"en":{"choice":"Branding is trivial to copy on fake login pages.","explanation":"Navigate to the service directly and sign in there."}}'),
  ('00000000-0000-0000-0000-000000000309', 'B', '{"en":"Navigate to the service directly and sign in there."}', true, '{"en":{"choice":"You refused to authenticate on an untrusted page.","explanation":"Credential theft succeeds when passwords are entered on attacker-controlled sites."}}'),
  ('00000000-0000-0000-0000-000000000309', 'C', '{"en":"Use the same password only once."}', false, '{"en":{"choice":"Reusing passwords on a fake page still exposes the credential.","explanation":"Always reach the real service yourself before signing in."}}'),
  ('00000000-0000-0000-0000-000000000310', 'A', '{"en":"Send it because the request is internal."}', false, '{"en":{"choice":"Internal-looking messages can still be impersonation.","explanation":"Verify sensitive data requests through a trusted channel and follow policy."}}'),
  ('00000000-0000-0000-0000-000000000310', 'B', '{"en":"Reply and ask why they need it."}', false, '{"en":{"choice":"Replying keeps the conversation inside the attacker thread.","explanation":"Confirm manager requests through a separate trusted channel."}}'),
  ('00000000-0000-0000-0000-000000000310', 'C', '{"en":"Verify the request through a trusted channel and follow data-sharing policy."}', true, '{"en":{"choice":"You treated internal urgency like any other unverified request.","explanation":"Impersonation of managers targets helpers; verification and policy protect staff data."}}')
on conflict (scenario_id, option_key) do update set content = excluded.content, is_correct = excluded.is_correct, feedback = excluded.feedback;

create or replace function public.get_onboarding_assessment()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug', s.slug,
      'content', s.content,
      'riskDimensions', s.risk_dimensions,
      'options', (
        select coalesce(jsonb_agg(jsonb_build_object('optionKey', o.option_key, 'content', o.content) order by o.option_key), '[]'::jsonb)
        from public.scenario_options o where o.scenario_id = s.id
      )
    ) order by s.slug)
    from public.scenarios s
    join public.training_modules m on m.id = s.module_id
    where m.slug = 'baseline-assessment'
  ), '[]'::jsonb);
end;
$$;
