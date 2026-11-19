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
  ('00000000-0000-0000-0000-000000000301', 'A', '{"en":"Call the number shown in the SMS, confirm it is the bank, then open the link they send."}', false, '{"en":{"choice":"Contact details inside the message can belong to the attacker.","explanation":"Use the number on your card or in the official banking app — never numbers or links that arrived with the alert."}}'),
  ('00000000-0000-0000-0000-000000000301', 'B', '{"en":"Open your banking app directly or call the number printed on your card."}', true, '{"en":{"choice":"You resisted time pressure and used a trusted channel.","explanation":"Attackers fake urgency so you skip verification. Your bank’s official app or card number is the safe path."}}'),
  ('00000000-0000-0000-0000-000000000301', 'C', '{"en":"Open the banking website from Google, then paste the SMS link into the address bar after it loads."}', false, '{"en":{"choice":"Pasting the SMS destination still lands on the attacker’s page.","explanation":"Start and stay inside a channel you already trust. Do not reuse links from unexpected messages."}}'),
  ('00000000-0000-0000-0000-000000000302', 'A', '{"en":"Process the change in the finance system first, then reply to the email with the reference number."}', false, '{"en":{"choice":"Replying still keeps you inside an untrusted thread.","explanation":"Unusual payment changes need out-of-band confirmation before any system update or reply."}}'),
  ('00000000-0000-0000-0000-000000000302', 'B', '{"en":"Ask the sender for a scanned ID and a signed instruction on company letterhead."}', false, '{"en":{"choice":"Documents can be forged and still leave you in the attacker’s channel.","explanation":"Call or meet using a number or route you already had on file."}}'),
  ('00000000-0000-0000-0000-000000000302', 'C', '{"en":"Verify using a known phone number or another trusted channel before changing anything."}', true, '{"en":{"choice":"You separated the request from verification.","explanation":"Authority impersonation fails when you confirm through channels you already trust."}}'),
  ('00000000-0000-0000-0000-000000000303', 'A', '{"en":"Use the courier''s official website or app to check the delivery."}', true, '{"en":{"choice":"Curiosity is safer when you control the destination.","explanation":"Short links hide the real site. Navigate to the courier yourself instead of clicking."}}'),
  ('00000000-0000-0000-0000-000000000303', 'B', '{"en":"Preview the short link with a link-expander site, then open it if the brand name appears."}', false, '{"en":{"choice":"Expanded brand names can still point to lookalike hosts.","explanation":"Even after expanding, open the courier from a bookmark or app you already trust."}}'),
  ('00000000-0000-0000-0000-000000000303', 'C', '{"en":"Pay the small fee from a virtual card so your main card stays protected."}', false, '{"en":{"choice":"Payment still validates the scam flow and can expose details.","explanation":"Confirm the parcel exists in the official courier account before paying anything."}}'),
  ('00000000-0000-0000-0000-000000000304', 'A', '{"en":"Ask security questions first, then share only the last four digits of your ID."}', false, '{"en":{"choice":"Partial identity data is still useful to fraudsters.","explanation":"End the call and contact the organization through an official number you find yourself."}}'),
  ('00000000-0000-0000-0000-000000000304', 'B', '{"en":"End the call and contact the organization through an official number."}', true, '{"en":{"choice":"You broke the fear cycle and verified independently.","explanation":"Legitimate organizations do not demand immediate identity proof on inbound calls."}}'),
  ('00000000-0000-0000-0000-000000000304', 'C', '{"en":"Stay on the line, refuse personal data, and ask them to email a case number."}', false, '{"en":{"choice":"Continuing the inbound call keeps you in their script.","explanation":"Hang up, then open a case through a published contact channel."}}'),
  ('00000000-0000-0000-0000-000000000305', 'A', '{"en":"Compare the new account digits with the last invoice, then update if they look similar."}', false, '{"en":{"choice":"Lookalike numbers are intentional.","explanation":"Confirm every bank-detail change out-of-band, even when the name feels familiar."}}'),
  ('00000000-0000-0000-0000-000000000305', 'B', '{"en":"Reply asking them to CC a second manager before you update the details."}', false, '{"en":{"choice":"A CC inside the same compromised thread is not verification.","explanation":"Use a separate phone call or known portal to confirm account changes."}}'),
  ('00000000-0000-0000-0000-000000000305', 'C', '{"en":"Verify the change through a separate trusted channel."}', true, '{"en":{"choice":"Trust is healthy when paired with verification.","explanation":"Account detail changes should always be confirmed outside the message that requested them."}}'),
  ('00000000-0000-0000-0000-000000000306', 'A', '{"en":"Reserve the license with a refundable hold so you do not lose the last seat."}', false, '{"en":{"choice":"Pressure purchases skip vendor checks.","explanation":"Confirm software buys through the official vendor site and your procurement process."}}'),
  ('00000000-0000-0000-0000-000000000306', 'B', '{"en":"Check the vendor through its official website and procurement process."}', true, '{"en":{"choice":"You treated scarcity as a signal to slow down.","explanation":"Real procurement rarely depends on a single minutes-long window from an unknown message."}}'),
  ('00000000-0000-0000-0000-000000000306', 'C', '{"en":"Ask IT whether the brand is on the approved list, then pay from the message link if they say yes."}', false, '{"en":{"choice":"Brand approval does not validate the payment destination.","explanation":"Even approved software must be purchased through official vendor or procurement channels."}}'),
  ('00000000-0000-0000-0000-000000000307', 'A', '{"en":"Open it in a private browser window so the group is not delayed."}', false, '{"en":{"choice":"A private window does not make an untrusted link safe.","explanation":"Confirm who created the document and open it from a known work location."}}'),
  ('00000000-0000-0000-0000-000000000307', 'B', '{"en":"Ask in the same chat who created it, then open if a familiar name replies."}', false, '{"en":{"choice":"Names inside a compromised chat can be spoofed.","explanation":"Confirm the document through a separate channel before opening."}}'),
  ('00000000-0000-0000-0000-000000000307', 'C', '{"en":"Verify the link through a separate channel before opening."}', true, '{"en":{"choice":"You resisted group pressure and verified first.","explanation":"Shared document scams rely on embarrassment and speed; verification protects the whole group."}}'),
  ('00000000-0000-0000-0000-000000000308', 'A', '{"en":"Keep payment and communication on the platform."}', true, '{"en":{"choice":"Platform protections exist because off-platform payment is high risk.","explanation":"Off-platform payment removes fraud protections and audit trails."}}'),
  ('00000000-0000-0000-0000-000000000308', 'B', '{"en":"Move to WhatsApp but pay with a platform voucher code so the order stays linked."}', false, '{"en":{"choice":"Leaving the platform still drops buyer protection.","explanation":"Keep both chat and payment inside the marketplace."}}'),
  ('00000000-0000-0000-0000-000000000308', 'C', '{"en":"Ask for a signed invoice PDF first, then pay to the account on that invoice."}', false, '{"en":{"choice":"A polished invoice is easy to forge.","explanation":"Marketplace escrow exists because documents alone are not proof."}}'),
  ('00000000-0000-0000-0000-000000000309', 'A', '{"en":"Check that the padlock is present and the logo matches, then sign in."}', false, '{"en":{"choice":"HTTPS and branding are easy to copy on phishing pages.","explanation":"Navigate to the service yourself from a bookmark or app, then sign in there."}}'),
  ('00000000-0000-0000-0000-000000000309', 'B', '{"en":"Navigate to the service directly and sign in there."}', true, '{"en":{"choice":"You refused to authenticate on an untrusted page.","explanation":"Credential theft succeeds when passwords are entered on attacker-controlled sites."}}'),
  ('00000000-0000-0000-0000-000000000309', 'C', '{"en":"Sign in with a password manager so a lookalike page will not autofill."}', false, '{"en":{"choice":"You can still paste or type credentials into the wrong site.","explanation":"Reach the real service first. Password managers help only after the destination is trusted."}}'),
  ('00000000-0000-0000-0000-000000000310', 'A', '{"en":"Send a redacted sample first, then the full file once they confirm receipt."}', false, '{"en":{"choice":"Any staff data sent into an unverified request is still a breach risk.","explanation":"Confirm the request through a trusted channel and follow data-sharing policy."}}'),
  ('00000000-0000-0000-0000-000000000310', 'B', '{"en":"Reply from your work phone and ask them to switch to the internal ticket system."}', false, '{"en":{"choice":"Replying can still confirm a live mailbox to an impersonator.","explanation":"Start a new conversation on a known manager contact, not the inbound thread."}}'),
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
