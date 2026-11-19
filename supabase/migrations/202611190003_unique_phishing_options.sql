-- Replace the shared generic Namibia phishing options with scenario-specific choices.

with patches(slug, option_key, content, is_correct, feedback_choice, feedback_explanation) as (
  values
  -- MTC reward
  ('namibia-mtc-fake-reward', 'A', 'Open the MTC app or dial a published MTC USSD/short code and check whether any reward exists there.', true::boolean, 'You started from MTC, not from the SMS link.', 'Real rewards appear in the official app or at a store — not through a surprise claim link.'),
  ('namibia-mtc-fake-reward', 'B', 'Open the claim link before midnight so you do not lose the N$2,500.', false::boolean, 'The midnight deadline is pressure.', 'Unexpected airtime or cash prizes in SMS are a common lure to a phishing page.'),
  ('namibia-mtc-fake-reward', 'C', 'Reply with your ID number and SIM details so MTC can release the prize.', false::boolean, 'That hands KYC data to whoever sent the text.', 'Operators do not collect identity documents through prize SMS replies.'),
  ('namibia-mtc-fake-reward', 'D', 'Forward the prize SMS to coworkers so they can claim too.', false::boolean, 'Forwarding spreads the lure.', 'Report or delete it instead of amplifying it.'),

  -- Bank Windhoek suspension
  ('namibia-bank-windhoek-fake-suspension', 'A', 'Ignore the link. Open the Bank Windhoek app or call the number on your card to check the account.', true::boolean, 'You verified with the bank, not the SMS.', 'Banks do not lift suspensions through unexpected text links.'),
  ('namibia-bank-windhoek-fake-suspension', 'B', 'Open the verify link within 24 hours so the account is not permanently suspended.', false::boolean, 'The suspension threat is the bait.', 'Lookalike “verify” pages exist to steal banking passwords.'),
  ('namibia-bank-windhoek-fake-suspension', 'C', 'Call the phone number printed inside the SMS and follow their unlock steps.', false::boolean, 'Numbers in the message can belong to the attacker.', 'Use the number on your card or in the official app.'),
  ('namibia-bank-windhoek-fake-suspension', 'D', 'Email your full statement to the address in the SMS so they can clear the flag.', false::boolean, 'That exposes account history.', 'Never send statements to an unverified alert.'),

  -- FNB security alert
  ('namibia-fnb-fake-security-alert', 'A', 'Close the SMS. Sign in only through the FNB app or a bookmark you already trust.', true::boolean, 'You avoided the “secure link.”', 'Security alerts that demand an immediate sign-in through SMS are classic phishing.'),
  ('namibia-fnb-fake-security-alert', 'B', 'Open the secure link and confirm your identity so the flag is cleared.', false::boolean, 'The link is the attack.', 'FNB will not ask you to re-authenticate through an unexpected SMS URL.'),
  ('namibia-fnb-fake-security-alert', 'C', 'Reply with the last OTP you received so they can match your profile.', false::boolean, 'OTPs are the keys to your account.', 'Never share SMS codes with anyone who contacted you first.'),
  ('namibia-fnb-fake-security-alert', 'D', 'Screenshot the alert and post it in a public Facebook group for advice.', false::boolean, 'That can leak account hints and spread the lure.', 'Use official bank support channels instead.'),

  -- Telecom Namibia disconnection
  ('namibia-telecom-fake-disconnection', 'A', 'Check the balance in the official Telecom Namibia app, USSD, or a known store — not the SMS link.', true::boolean, 'You used a published Telecom channel.', 'Disconnection threats with surprise payment links are a common bill-scam pattern.'),
  ('namibia-telecom-fake-disconnection', 'B', 'Pay through the SMS link today so the line is not cut.', false::boolean, 'Urgency pushes you onto their page.', 'Card details entered there can be reused for larger theft.'),
  ('namibia-telecom-fake-disconnection', 'C', 'Send airtime vouchers to the number that texted you as a temporary payment.', false::boolean, 'Voucher payments to strangers are a direct loss.', 'Settle real bills only through official channels.'),
  ('namibia-telecom-fake-disconnection', 'D', 'Ignore the bill entirely even if the official app later shows a real balance due.', false::boolean, 'Real bills still need paying — just not via this SMS.', 'Confirm in the official account, then pay there if needed.'),

  -- NamPost parcel
  ('namibia-nampost-fake-parcel', 'A', 'Open the NamPost site or app and search for the parcel with a tracking number you already have.', true::boolean, 'You controlled the destination.', 'Unexpected “pay to release parcel” texts are a standard customs-fee scam.'),
  ('namibia-nampost-fake-parcel', 'B', 'Pay the processing fee on the SMS link so delivery continues.', false::boolean, 'The small fee harvests card data.', 'If no real tracking exists in NamPost, there is no parcel.'),
  ('namibia-nampost-fake-parcel', 'C', 'Reply with your home address and ID so they can find the held parcel.', false::boolean, 'That shares personal data with the sender.', 'NamPost will not collect KYC through a random SMS.'),
  ('namibia-nampost-fake-parcel', 'D', 'Ask a neighbour to click the link first in case it is unsafe.', false::boolean, 'That moves the risk onto someone else.', 'Use the official NamPost channel yourself.'),

  -- NamRA refund
  ('namibia-namra-fake-refund', 'A', 'Ignore the refund link. If you expect a refund, use NamRA’s official eTAX / published portal only.', true::boolean, 'You refused the unexpected payout lure.', 'Tax authorities do not ask for banking details through surprise SMS links.'),
  ('namibia-namra-fake-refund', 'B', 'Submit your banking details on the link within 48 hours to receive N$3,850.', false::boolean, 'The refund is the bait.', 'Phishing pages copy brand names to steal account credentials.'),
  ('namibia-namra-fake-refund', 'C', 'WhatsApp your tax number and bank proof to the contact that texted you.', false::boolean, 'That is direct credential and identity theft.', 'Use only official NamRA contact channels.'),
  ('namibia-namra-fake-refund', 'D', 'Pay a small “processing fee” first so the larger refund can be released.', false::boolean, 'Advance fees are part of the scam.', 'Real refunds do not require you to pay a stranger to unlock them.'),

  -- Standard Bank transaction alert
  ('namibia-standard-bank-fake-transaction', 'A', 'Do not use the cancel link. Open the Standard Bank app or call the number on your card to review recent transactions.', true::boolean, 'You checked the real account view.', 'Fake “cancel this payment” links steal logins while a real fraud may still need a bank call.'),
  ('namibia-standard-bank-fake-transaction', 'B', 'Open the cancel link immediately so the N$4,750 does not leave.', false::boolean, 'The cancel button is on the attacker’s site.', 'Stopping fraud happens inside the official app or with the bank’s fraud desk.'),
  ('namibia-standard-bank-fake-transaction', 'C', 'Reply STOP to block all future transaction alerts from that number.', false::boolean, 'Replying confirms the number is live.', 'Manage alerts inside the bank app instead.'),
  ('namibia-standard-bank-fake-transaction', 'D', 'Transfer your balance to another bank first, using details the SMS provides.', false::boolean, 'That can move money straight to the attacker.', 'Never follow transfer instructions from an unverified alert.'),

  -- NamWater final notice
  ('namibia-namwater-fake-bill', 'A', 'Log in to NamWater’s official account channels or visit a known pay point — skip the SMS link.', true::boolean, 'You verified the bill independently.', 'Final-notice SMS links are often fake payment pages.'),
  ('namibia-namwater-fake-bill', 'B', 'Settle the overdue balance through the SMS link before supply is cut today.', false::boolean, 'The disconnection clock is pressure.', 'Pay only after the balance appears on an official NamWater channel.'),
  ('namibia-namwater-fake-bill', 'C', 'Send a photo of your water meter and ID to the SMS number for a dispute.', false::boolean, 'That exposes identity documents.', 'Disputes go through published NamWater contacts.'),
  ('namibia-namwater-fake-bill', 'D', 'Ask the sender to collect cash at your gate to keep the water on.', false::boolean, 'In-person cash to a stranger is still theft.', 'Use official payment points only.'),

  -- Government benefits payout
  ('namibia-government-fake-payout', 'A', 'Do not open the link. Confirm any grant only through the official ministry/agency website or office you already know.', true::boolean, 'You treated the payout as unverified.', 'Unexpected government payment texts are a frequent credential-harvesting scam.'),
  ('namibia-government-fake-payout', 'B', 'Confirm your identity on the link so the N$1,800 is paid out.', false::boolean, 'The approval story is the lure.', 'Real grant processes do not start from a cold SMS with a random URL.'),
  ('namibia-government-fake-payout', 'C', 'Pay a registration fee to the mobile number in the text to activate the benefit.', false::boolean, 'Activation fees are the theft.', 'Legitimate grants do not require airtime or wallet payments to strangers.'),
  ('namibia-government-fake-payout', 'D', 'Share the SMS in a family group and ask everyone to claim as well.', false::boolean, 'That multiplies victims.', 'Report or ignore it instead.'),

  -- Pick n Pay competition
  ('namibia-pick-n-pay-fake-competition', 'A', 'Check competitions only via the official Pick n Pay app/website or in-store notices — not this SMS survey link.', true::boolean, 'You stayed on Pick n Pay’s real channels.', 'Unsolicited voucher SMS surveys are a common phishing pattern.'),
  ('namibia-pick-n-pay-fake-competition', 'B', 'Complete the short survey on the link to activate the N$2,000 voucher.', false::boolean, 'The survey collects data or leads to a fake login.', 'If you did not enter a competition, treat the win as fake.'),
  ('namibia-pick-n-pay-fake-competition', 'C', 'Pay a delivery fee for the voucher card through the same link.', false::boolean, 'Fees unlock nothing but card theft.', 'Real vouchers are not released after surprise SMS payments.'),
  ('namibia-pick-n-pay-fake-competition', 'D', 'Reply with your Smart Shopper number and ID to verify the win.', false::boolean, 'That is useful identity data for fraud.', 'Never confirm loyalty accounts through unexpected texts.'),

  -- Woermann Brock loyalty
  ('namibia-woermann-brock-fake-loyalty', 'A', 'Open the official Woermann Brock / loyalty channel you already use and see whether points are actually expiring.', true::boolean, 'You checked the real loyalty account.', '“Points expiring today” texts with links are designed for rushed clicks.'),
  ('namibia-woermann-brock-fake-loyalty', 'B', 'Redeem on the SMS link before end of day so the points are not lost.', false::boolean, 'The expiry clock is the hook.', 'Redeem only inside the official loyalty experience.'),
  ('namibia-woermann-brock-fake-loyalty', 'C', 'Send your loyalty PIN to the SMS so they can redeem on your behalf.', false::boolean, 'A PIN is account control.', 'Support will not ask for loyalty PINs by text.'),
  ('namibia-woermann-brock-fake-loyalty', 'D', 'Transfer the points to a friend’s number listed in the message.', false::boolean, 'That can move value to the attacker.', 'Point transfers belong in the official app, if offered at all.'),

  -- MTC SIM registration warning
  ('namibia-mtc-fake-sim-warning', 'A', 'Update SIM registration only through the official MTC app, USSD, or a known MTC store — never the SMS link.', true::boolean, 'You used MTC’s real registration path.', 'Fake SIM-registration deadlines are used to steal identity details.'),
  ('namibia-mtc-fake-sim-warning', 'B', 'Open the update link within 24 hours so the number is not suspended.', false::boolean, 'The suspension threat forces a click.', 'Registration pages in SMS links are often credential traps.'),
  ('namibia-mtc-fake-sim-warning', 'C', 'WhatsApp a photo of your ID and SIM pack to the number that texted you.', false::boolean, 'That is full identity theft in one step.', 'MTC does not collect IDs through random WhatsApp chats from an alert SMS.'),
  ('namibia-mtc-fake-sim-warning', 'D', 'Buy a new SIM immediately and abandon the old number without checking officially.', false::boolean, 'Panic switching can still leave you exposed and costs money.', 'Confirm status with MTC first, then decide.')
)
update public.scenario_options as so
set
  content = jsonb_build_object('en', patches.content),
  is_correct = patches.is_correct,
  feedback = jsonb_build_object(
    'en',
    jsonb_build_object(
      'choice', patches.feedback_choice,
      'explanation', patches.feedback_explanation
    )
  )
from patches
join public.scenarios as s on s.slug = patches.slug
where so.scenario_id = s.id
  and so.option_key = patches.option_key;
