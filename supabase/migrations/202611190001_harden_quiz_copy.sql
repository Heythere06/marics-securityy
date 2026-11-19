-- Remove spoiler titles like "A fake ..." and harden distractor answers so
-- wrong options sound like reasonable security habits, not cartoon mistakes.

-- 1) Strip "A fake" / "A fraudulent" prefixes from English scenario titles.
do $$
declare
  r record;
  old_title text;
  rest text;
  new_title text;
begin
  for r in
    select id, content
    from public.scenarios
    where coalesce(content->'en'->>'title', '') ~* '^(A fake|A fraudulent)\s+'
  loop
    old_title := r.content->'en'->>'title';
    rest := regexp_replace(old_title, '^(A fake|A fraudulent)\s+', '', 'i');
    new_title := upper(left(rest, 1)) || substr(rest, 2);
    update public.scenarios
    set content = jsonb_set(r.content, '{en,title}', to_jsonb(new_title), true)
    where id = r.id;
  end loop;
end $$;

-- Specific clearer titles (still no spoiler wording).
update public.scenarios
set content = jsonb_set(content, '{en,title}', to_jsonb(v.title), true)
from (values
  ('email-lookalike-login', 'Microsoft 365 shared-file sign-in'),
  ('sms-bank-suspension', 'Bank account suspension text'),
  ('sms-mobile-network', 'Mobile network SIM registration text'),
  ('whatsapp-family-emergency', 'Family emergency on WhatsApp'),
  ('whatsapp-giveaway-investment', 'Giveaway and investment pitch'),
  ('job-cloned-recruiter', 'Recruiter offer and careers page'),
  ('job-equipment-payment', 'Remote job equipment payment'),
  ('job-malicious-interview-link', 'Interview link and case-study file'),
  ('mobile-cash-send-reversal', 'Cash-send reversal request'),
  ('mobile-overpayment-eft', 'EFT overpayment refund request'),
  ('namibia-mtc-fake-reward', 'MTC customer reward message'),
  ('namibia-bank-windhoek-fake-suspension', 'Bank Windhoek suspension notice'),
  ('namibia-fnb-fake-security-alert', 'FNB security alert'),
  ('namibia-telecom-fake-disconnection', 'Telecom Namibia disconnection notice'),
  ('namibia-nampost-fake-parcel', 'NamPost parcel notification'),
  ('namibia-namra-fake-refund', 'NamRA tax refund message'),
  ('namibia-standard-bank-fake-transaction', 'Standard Bank transaction alert'),
  ('namibia-namwater-fake-bill', 'NamWater final notice'),
  ('namibia-government-fake-payout', 'Government benefits payout notice'),
  ('namibia-pick-n-pay-fake-competition', 'Pick n Pay competition message'),
  ('namibia-woermann-brock-fake-loyalty', 'Woermann Brock loyalty rewards'),
  ('namibia-mtc-fake-sim-warning', 'MTC SIM registration warning')
) as v(slug, title)
where scenarios.slug = v.slug;

-- 2) Harden opening-quiz distractors (plausible near-misses).
insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback) values
  ('00000000-0000-0000-0000-000000000301', 'A', '{"en":"Call the number shown in the SMS, confirm it is the bank, then open the link they send."}', false, '{"en":{"choice":"Contact details inside the message can belong to the attacker.","explanation":"Use the number on your card or in the official banking app — never numbers or links that arrived with the alert."}}'),
  ('00000000-0000-0000-0000-000000000301', 'B', '{"en":"Open your banking app directly or call the number printed on your card."}', true, '{"en":{"choice":"You resisted time pressure and used a trusted channel.","explanation":"Attackers fake urgency so you skip verification. Your bank’s official app or card number is the safe path."}}'),
  ('00000000-0000-0000-0000-000000000301', 'C', '{"en":"Open the banking website from Google, then paste the SMS link into the address bar after it loads."}', false, '{"en":{"choice":"Pasting the SMS destination still lands on the attacker’s page.","explanation":"Start and stay inside a channel you already trust. Do not reuse links from unexpected messages."}}'),

  ('00000000-0000-0000-0000-000000000302', 'A', '{"en":"Process the change in the finance system first, then reply to the email with the reference number."}', false, '{"en":{"choice":"Replying still keeps you inside an untrusted thread.","explanation":"Unusual payment changes need out-of-band confirmation before any system update or reply."}}'),
  ('00000000-0000-0000-0000-000000000302', 'B', '{"en":"Ask the sender for a scanned ID and a signed instruction on company letterhead."}', false, '{"en":{"choice":"Documents can be forged and still leave you in the attacker’s channel.","explanation":"Call or meet using a number or route you already had on file."}}'),
  ('00000000-0000-0000-0000-000000000302', 'C', '{"en":"Verify using a known phone number or another trusted channel before changing anything."}', true, '{"en":{"choice":"You separated the request from verification.","explanation":"Authority impersonation fails when you confirm through channels you already trust."}}'),

  ('00000000-0000-0000-0000-000000000303', 'A', '{"en":"Use the courier’s official website or app to check the delivery."}', true, '{"en":{"choice":"Curiosity is safer when you control the destination.","explanation":"Short links hide the real site. Navigate to the courier yourself instead of clicking."}}'),
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
on conflict (scenario_id, option_key) do update
  set content = excluded.content,
      is_correct = excluded.is_correct,
      feedback = excluded.feedback;

-- 3) Harden common training-module distractors (by scenario slug).
with patches(slug, option_key, content, is_correct, feedback) as (
  values
  ('email-spear-phishing-ceo', 'A', '{"en":"Buy two cards first as a test, keep the codes, and wait for a calendar invite from the CEO before sending them."}'::text, false::boolean, '{"en":{"choice":"Partial compliance still moves gift-card value toward the attacker.","explanation":"Unusual payment requests need independent verification before any purchase."}}'::text),
  ('email-spear-phishing-ceo', 'C', '{"en":"Forward the email to finance and ask them to process it if the CEO domain looks close enough."}'::text, false::boolean, '{"en":{"choice":"Lookalike domains are the trap.","explanation":"Confirm unusual requests on a known internal channel, then report the message."}}'::text),
  ('email-spear-phishing-ceo', 'D', '{"en":"Reply with a read receipt and ask for a purchase-order number before buying."}'::text, false::boolean, '{"en":{"choice":"Replying confirms the mailbox is active.","explanation":"Leave the thread and verify through a channel you already trust."}}'::text),

  ('email-ai-perfect-grammar', 'A', '{"en":"Open the link in a sandboxed browser profile reserved for security checks."}'::text, false::boolean, '{"en":{"choice":"A sandbox still sends you to an attacker page and can harvest a session.","explanation":"Use the official banking app or a saved bookmark instead of the email destination."}}'::text),
  ('email-ai-perfect-grammar', 'B', '{"en":"Hover the link, confirm it mentions Bank Windhoek, then continue."}'::text, false::boolean, '{"en":{"choice":"Display text and brand words can hide a different host.","explanation":"Compare the real host with the official domain, or better: open the bank yourself."}}'::text),
  ('email-ai-perfect-grammar', 'D', '{"en":"Call the phone number printed in the email while keeping the page open."}'::text, false::boolean, '{"en":{"choice":"Numbers inside the message can route to the attacker.","explanation":"Use the number on your card or in the official app."}}'::text),

  ('email-lookalike-login', 'B', '{"en":"Sign in with a temporary password, then change it in the real Microsoft portal afterward."}'::text, false::boolean, '{"en":{"choice":"Any password entered on the lookalike page is captured.","explanation":"Open the real document library from a known work bookmark and report the email."}}'::text),
  ('email-lookalike-login', 'C', '{"en":"Paste the link into Microsoft Safe Links / a URL scanner, then open it if the scan is clean."}'::text, false::boolean, '{"en":{"choice":"Scanners miss fresh phishing hosts, and opening still risks credential entry.","explanation":"Do not use the emailed destination. Start from the official library."}}'::text),
  ('email-lookalike-login', 'D', '{"en":"Ask the colleague named in the email to resend the share from their mailbox."}'::text, false::boolean, '{"en":{"choice":"The colleague may never have sent it; the attacker controls the thread.","explanation":"Check for a real share in the official library, then report the message."}}'::text),

  ('email-qr-quishing', 'A', '{"en":"Scan it on a work phone with screen sharing off, then stop at the login screen."}'::text, false::boolean, '{"en":{"choice":"Reaching the login page is already too far.","explanation":"Unexpected QR codes should be treated like unexpected links — open the known finance system instead."}}'::text),
  ('email-qr-quishing', 'C', '{"en":"Photograph the QR code and upload it to an online QR decoder before deciding."}'::text, false::boolean, '{"en":{"choice":"Decoding still leaves you trusting an unexpected destination.","explanation":"Use the official finance bookmark and report the message."}}'::text),
  ('email-qr-quishing', 'D', '{"en":"Scan it only after VPN and MDM show green on the device."}'::text, false::boolean, '{"en":{"choice":"Corporate posture does not validate the payment destination.","explanation":"Start from the known finance system rather than the QR."}}'::text),

  ('email-fake-invoice-attachment', 'B', '{"en":"Open the file in Protected View without enabling macros, then decide."}'::text, false::boolean, '{"en":{"choice":"Macro lures often push you to leave Protected View.","explanation":"Verify the invoice with the supplier contact on file before opening anything unusual."}}'::text),
  ('email-fake-invoice-attachment', 'C', '{"en":"Upload the attachment to a malware sandbox; pay if the sandbox reports clean."}'::text, false::boolean, '{"en":{"choice":"A clean file can still be a social-engineering invoice.","explanation":"Confirm the debt through the known supplier process, not the attachment alone."}}'::text),
  ('email-fake-invoice-attachment', 'D', '{"en":"Pay a holding amount from a corporate card with alerts enabled."}'::text, false::boolean, '{"en":{"choice":"Payment does not verify the invoice.","explanation":"Verify with the supplier first, then use the official reporting path for the email."}}'::text),

  ('sms-bank-suspension', 'A', '{"en":"Open the link over mobile data instead of office Wi-Fi so credential theft is limited."}'::text, false::boolean, '{"en":{"choice":"Network choice does not make a phishing page safe.","explanation":"Ignore the link and check the account in the official banking app."}}'::text),
  ('sms-bank-suspension', 'C', '{"en":"Screenshot the SMS and send it to the bank WhatsApp support number from Google."}'::text, false::boolean, '{"en":{"choice":"Search results for bank WhatsApp are often fake too.","explanation":"Use the number on your card or the official app support path."}}'::text),
  ('sms-bank-suspension', 'D', '{"en":"Reply with only your customer number so they can locate the profile without a full ID."}'::text, false::boolean, '{"en":{"choice":"Any KYC reply still feeds the attacker.","explanation":"Do not converse with an unverified alert."}}'::text),

  ('sms-otp-theft', 'A', '{"en":"Read the code only after the caller reads your full name and last transaction."}'::text, false::boolean, '{"en":{"choice":"Attackers often already have partial account data.","explanation":"Banks never ask you to read an SMS OTP to a caller. Hang up and dial the card number."}}'::text),
  ('sms-otp-theft', 'C', '{"en":"Ask the caller for a case ID, then enter the OTP yourself in the banking app while they wait."}'::text, false::boolean, '{"en":{"choice":"Staying on the attacker call keeps you in their script.","explanation":"End the call first, then use only official channels."}}'::text),
  ('sms-otp-theft', 'D', '{"en":"Share the OTP in the bank in-app chat instead of over the phone."}'::text, false::boolean, '{"en":{"choice":"If you did not start a payment, no OTP should be used anywhere.","explanation":"Hang up, ignore the code, and contact the bank independently."}}'::text),

  ('whatsapp-family-emergency', 'A', '{"en":"Send a smaller amount first and ask for a hospital invoice before the rest."}'::text, false::boolean, '{"en":{"choice":"Any payment into an unverified emergency is the win for the scammer.","explanation":"Call the family member on a number you already have before sending money."}}'::text),
  ('whatsapp-family-emergency', 'C', '{"en":"Ask for a live video in the same chat, then send money if they appear on camera."}'::text, false::boolean, '{"en":{"choice":"Deepfakes and stolen video can pass a quick check.","explanation":"Place a call to a known number outside this chat."}}'::text),
  ('whatsapp-family-emergency', 'D', '{"en":"Ask other relatives in the same chat whether they already paid, then match their amount."}'::text, false::boolean, '{"en":{"choice":"The attacker may already be in several family chats.","explanation":"Leave the compromised thread and call people on numbers you already trust."}}'::text),

  ('job-cloned-recruiter', 'A', '{"en":"Pay the portal fee from a virtual card after checking that the company name matches Namdeb."}'::text, false::boolean, '{"en":{"choice":"Brand names on lookalike domains are the scam.","explanation":"Confirm the vacancy on the official careers site before sharing data or paying fees."}}'::text),
  ('job-cloned-recruiter', 'C', '{"en":"Continue if the LinkedIn profile has more than 50 connections and they offer a video call."}'::text, false::boolean, '{"en":{"choice":"New profiles can be padded quickly and still video-call.","explanation":"Match the recruiter domain and vacancy to the employer official site."}}'::text),
  ('job-cloned-recruiter', 'D', '{"en":"Submit a CV with personal references removed, but skip the fee for now."}'::text, false::boolean, '{"en":{"choice":"A CV still exposes personal data to an unverified recruiter.","explanation":"Confirm the role officially first."}}'::text),

  ('mobile-cash-send-reversal', 'A', '{"en":"Reverse half now and ask them to visit a branch for the rest."}'::text, false::boolean, '{"en":{"choice":"Mistaken deposits are handled by the provider, not by you sending money onward.","explanation":"Do not reverse funds on chat instructions. Contact Mixx/MTC through official channels."}}'::text),
  ('mobile-cash-send-reversal', 'C', '{"en":"Keep the money for 24 hours, then reverse it if nobody with ID collects it."}'::text, false::boolean, '{"en":{"choice":"Holding still follows the scammer frame.","explanation":"Report the transfer in the official app and wait for provider guidance."}}'::text),
  ('mobile-cash-send-reversal', 'D', '{"en":"Ask for their ID photo in WhatsApp, then reverse if the name matches the SMS."}'::text, false::boolean, '{"en":{"choice":"ID photos are easy to steal or edit.","explanation":"Use the official mobile-money dispute process only."}}'::text)
)
update public.scenario_options as so
set
  content = patches.content::jsonb,
  is_correct = patches.is_correct,
  feedback = patches.feedback::jsonb
from patches
join public.scenarios as s on s.slug = patches.slug
where so.scenario_id = s.id
  and so.option_key = patches.option_key;
