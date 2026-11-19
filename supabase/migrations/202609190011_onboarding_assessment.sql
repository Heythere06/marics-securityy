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
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', 'urgency', '{"en":{"title":"Urgency","scenario":"Your bank texts: “Suspicious activity detected. Confirm within 10 minutes or your account will be locked.” The message includes a link. What do you do?"}}', '{"Urgency"}'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', 'authority', '{"en":{"title":"Authority","scenario":"An email that looks like it is from a senior colleague asks you to change a supplier’s bank account “before payroll runs today.” What is safest?"}}', '{"Authority"}'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000102', 'curiosity', '{"en":{"title":"Curiosity","scenario":"A courier SMS says a parcel is waiting and asks you to pay a small fee through a shortened link. What is safest?"}}', '{"Curiosity"}'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000102', 'fear', '{"en":{"title":"Fear","scenario":"A caller says your identity will be reported for fraud unless you confirm your ID number and card details right now. What do you do?"}}', '{"Fear"}'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000102', 'trust', '{"en":{"title":"Trust","scenario":"Someone you recognise by name emails a new bank account number from an address you have never seen, and asks you to pay the next invoice there. What is safest?"}}', '{"Trust"}'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000102', 'scarcity', '{"en":{"title":"Scarcity","scenario":"A message says only one software licence remains and payment must be completed in the next 15 minutes through their link. What do you do?"}}', '{"Scarcity"}'),
  ('00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000102', 'social_pressure', '{"en":{"title":"Social pressure","scenario":"In a group chat, coworkers joke that you are holding everyone up because you have not opened a shared document link. What is safest?"}}', '{"Social pressure"}'),
  ('00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000102', 'financial_manipulation', '{"en":{"title":"Financial manipulation","scenario":"A marketplace seller asks you to leave the app and pay by Mixx or WhatsApp to “save the platform fee.” What do you do?"}}', '{"Financial manipulation"}'),
  ('00000000-0000-0000-0000-000000000309', '00000000-0000-0000-0000-000000000102', 'credential_theft', '{"en":{"title":"Credential theft","scenario":"After you open an unexpected message, a login page asks you to enter your work password again to continue. What is safest?"}}', '{"Credential theft"}'),
  ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000102', 'impersonation', '{"en":{"title":"Impersonation","scenario":"A message that appears to be from your manager asks you to send a confidential staff list “urgently for an audit.” What do you do?"}}', '{"Impersonation"}')
on conflict (id) do update set content = excluded.content, risk_dimensions = excluded.risk_dimensions;

insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback) values
  -- Urgency / bank SMS
  ('00000000-0000-0000-0000-000000000301', 'A',
    '{"en":"Tap the SMS link immediately so the account is not locked in 10 minutes."}',
    false,
    '{"en":{"choice":"The countdown is meant to stop you thinking.","explanation":"Banks do not restore accounts through surprise SMS links. Use the official app or the number on your card."}}'),
  ('00000000-0000-0000-0000-000000000301', 'B',
    '{"en":"Ignore the SMS link. Open your bank’s official app, or call the phone number printed on your bank card."}',
    true,
    '{"en":{"choice":"You used a bank channel you already trust.","explanation":"Official apps and card numbers bypass lookalike pages hidden in urgent texts."}}'),
  ('00000000-0000-0000-0000-000000000301', 'C',
    '{"en":"Reply YES to the text and wait for a one-time PIN so you can unlock the account."}',
    false,
    '{"en":{"choice":"Replying confirms your number is active.","explanation":"Do not chat with an unverified alert. Open the bank yourself."}}'),

  -- Authority / senior payment change
  ('00000000-0000-0000-0000-000000000302', 'A',
    '{"en":"Update the supplier bank details right away because a senior colleague asked."}',
    false,
    '{"en":{"choice":"Seniority in an email is easy to fake.","explanation":"Unusual payment changes need confirmation outside that email thread."}}'),
  ('00000000-0000-0000-0000-000000000302', 'B',
    '{"en":"Forward the email to Finance and tell them to process it under the senior colleague’s name."}',
    false,
    '{"en":{"choice":"Forwarding a live scam can pull more people into it.","explanation":"Confirm with the real colleague first, then follow the normal payment process."}}'),
  ('00000000-0000-0000-0000-000000000302', 'C',
    '{"en":"Call the senior colleague on the office extension or mobile number you already have saved, and only change details after they confirm."}',
    true,
    '{"en":{"choice":"You checked the person, not just the email.","explanation":"A known phone number breaks authority impersonation before money moves."}}'),

  -- Curiosity / courier short link
  ('00000000-0000-0000-0000-000000000303', 'A',
    '{"en":"Open the shortened link and pay the small fee so the parcel is released today."}',
    false,
    '{"en":{"choice":"The fee and short link are the trap.","explanation":"Unexpected courier fees through SMS links often harvest card details."}}'),
  ('00000000-0000-0000-0000-000000000303', 'B',
    '{"en":"Open the courier’s official website or app and look up the tracking number yourself."}',
    true,
    '{"en":{"choice":"You controlled where the browser went.","explanation":"If the parcel is real, it will appear in the official courier account without that SMS link."}}'),
  ('00000000-0000-0000-0000-000000000303', 'C',
    '{"en":"Reply with your full delivery address and ID number so they can find the parcel."}',
    false,
    '{"en":{"choice":"That hands over personal data to whoever sent the text.","explanation":"Never send KYC details in reply to an unexpected courier SMS."}}'),

  -- Fear / inbound caller
  ('00000000-0000-0000-0000-000000000304', 'A',
    '{"en":"Read your ID number and card digits so they can cancel the fraud report."}',
    false,
    '{"en":{"choice":"Fear is being used to collect your identity.","explanation":"Real investigators do not demand full ID and card data on a cold call."}}'),
  ('00000000-0000-0000-0000-000000000304', 'B',
    '{"en":"Hang up. Look up the organisation’s published number and call that number yourself."}',
    true,
    '{"en":{"choice":"You ended their script and started over on your terms.","explanation":"Independent call-back is the check inbound fear calls cannot survive."}}'),
  ('00000000-0000-0000-0000-000000000304', 'C',
    '{"en":"Stay on the line, refuse the ID, and ask them to WhatsApp a case reference instead."}',
    false,
    '{"en":{"choice":"Staying on their call keeps you inside the scam.","explanation":"Hang up first, then use a published contact channel."}}'),

  -- Trust / new bank details
  ('00000000-0000-0000-0000-000000000305', 'A',
    '{"en":"Save the new account and pay the next invoice there because you recognise the person’s name."}',
    false,
    '{"en":{"choice":"A familiar display name is not proof of the mailbox.","explanation":"Bank-detail changes from unusual addresses need a separate check."}}'),
  ('00000000-0000-0000-0000-000000000305', 'B',
    '{"en":"Phone or visit the contact using a number or address you already used before this email, and confirm the bank change."}',
    true,
    '{"en":{"choice":"You confirmed the change outside the suspicious email.","explanation":"Only update banking details after the real person agrees on a known channel."}}'),
  ('00000000-0000-0000-0000-000000000305', 'C',
    '{"en":"Ask them to attach a stamped bank letter in the same email thread, then update the account."}',
    false,
    '{"en":{"choice":"Attachments in a compromised thread can be forged.","explanation":"Leave that email and confirm by phone or in person."}}'),

  -- Scarcity / last licence
  ('00000000-0000-0000-0000-000000000306', 'A',
    '{"en":"Pay through the message link now so you do not lose the last licence."}',
    false,
    '{"en":{"choice":"“Only one left” is pressure, not proof.","explanation":"Buy software only through the vendor’s official site or your procurement process."}}'),
  ('00000000-0000-0000-0000-000000000306', 'B',
    '{"en":"Open the software company’s official website or your company procurement portal and purchase only from there."}',
    true,
    '{"en":{"choice":"You ignored the countdown and used a real storefront.","explanation":"Legitimate licence sales do not depend on a 15-minute link in a random message."}}'),
  ('00000000-0000-0000-0000-000000000306', 'C',
    '{"en":"Send payment to the personal mobile-money number listed “for faster clearance.”"}',
    false,
    '{"en":{"choice":"Personal wallets are a common theft path.","explanation":"Company software is not paid to a stranger’s Mixx or eWallet number."}}'),

  -- Social pressure / shared doc
  ('00000000-0000-0000-0000-000000000307', 'A',
    '{"en":"Open the shared link immediately so the group stops mocking you."}',
    false,
    '{"en":{"choice":"Embarrassment is the hook.","explanation":"Malicious “shared docs” rely on group pressure to get a click."}}'),
  ('00000000-0000-0000-0000-000000000307', 'B',
    '{"en":"Message or call the coworker who supposedly shared it on a known work number, and open the file only from your company drive or work email."}',
    true,
    '{"en":{"choice":"You checked the source before clicking.","explanation":"Real work files can be opened from places you already trust, not from a pressured chat link."}}'),
  ('00000000-0000-0000-0000-000000000307', 'C',
    '{"en":"Download the file, tell the group you opened it, and scan it at home later."}',
    false,
    '{"en":{"choice":"Downloading still runs the risk.","explanation":"Do not fetch an untrusted file just to save face in the chat."}}'),

  -- Financial manipulation / marketplace
  ('00000000-0000-0000-0000-000000000308', 'A',
    '{"en":"Pay on Mixx or WhatsApp to save the marketplace fee."}',
    false,
    '{"en":{"choice":"Leaving the platform removes buyer protection.","explanation":"Off-platform payment is how marketplace sellers disappear with the money."}}'),
  ('00000000-0000-0000-0000-000000000308', 'B',
    '{"en":"Keep chatting and paying only inside the marketplace checkout."}',
    true,
    '{"en":{"choice":"You kept the sale where disputes can be raised.","explanation":"Platform checkout exists so you are not relying on a private wallet transfer."}}'),
  ('00000000-0000-0000-0000-000000000308', 'C',
    '{"en":"Ask for their bank letter PDF, then EFT the amount from your business account."}',
    false,
    '{"en":{"choice":"A PDF is easy to fake.","explanation":"Stay on the marketplace rather than inventing a private payment path."}}'),

  -- Credential theft / unexpected login page
  ('00000000-0000-0000-0000-000000000309', 'A',
    '{"en":"Enter your password on that page if the logo and padlock look correct."}',
    false,
    '{"en":{"choice":"Logos and HTTPS are easy to copy.","explanation":"Unexpected login pages after a message are classic credential harvesting."}}'),
  ('00000000-0000-0000-0000-000000000309', 'B',
    '{"en":"Close the page. Open the real service from a saved bookmark or by typing the address yourself, then sign in there."}',
    true,
    '{"en":{"choice":"You refused to type secrets on an untrusted page.","explanation":"Always reach the real site yourself after an unexpected prompt."}}'),
  ('00000000-0000-0000-0000-000000000309', 'C',
    '{"en":"Type a wrong password first to test whether the page is real, then use the real one."}',
    false,
    '{"en":{"choice":"Any password attempt can still expose you or confirm the mailbox.","explanation":"Do not interact with the unexpected page at all."}}'),

  -- Impersonation / manager staff data
  ('00000000-0000-0000-0000-000000000310', 'A',
    '{"en":"Send the staff list because the message looks like it came from your manager."}',
    false,
    '{"en":{"choice":"Manager names are frequently spoofed.","explanation":"Confidential staff data needs a real confirmation and a policy-approved channel."}}'),
  ('00000000-0000-0000-0000-000000000310', 'B',
    '{"en":"Call your manager on their known work number, or check with HR, before sharing any staff file."}',
    true,
    '{"en":{"choice":"You treated the request like sensitive data, not a chat favour.","explanation":"Impersonators count on helpers who skip the call-back."}}'),
  ('00000000-0000-0000-0000-000000000310', 'C',
    '{"en":"Email a password-protected spreadsheet and send the password in a second message to the same address."}',
    false,
    '{"en":{"choice":"If the mailbox is fake, both messages still reach the attacker.","explanation":"Confirm the requester on a known number before any staff data leaves."}}')
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
