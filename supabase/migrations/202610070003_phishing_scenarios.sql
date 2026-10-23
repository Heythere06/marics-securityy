-- Add realistic, fictional Namibian phishing awareness scenarios.
-- These messages are intentionally fake and must not be treated as actual company notifications.

DO $$
declare
  module_id uuid;
  v_scenario_id uuid;
  scenario_record record;
begin
  select id into module_id
  from public.training_modules
  where slug = 'phishing-and-suspicious-links';

  if module_id is null then
    raise exception 'Phishing training module was not found.';
  end if;

  for scenario_record in
    select *
    from jsonb_to_recordset('[
      {
        "slug": "namibia-mtc-fake-reward",
        "title": "A fake MTC reward message",
        "scenario": "MTC: Congratulations! Your number has been selected to receive N$2,500 in our customer appreciation promotion. Claim your reward before midnight by verifying your details here: https://example.com/claim",
        "risk_dimensions": ["Urgency", "Unexpected reward", "Untrusted link"]
      },
      {
        "slug": "namibia-bank-windhoek-fake-suspension",
        "title": "A fake Bank Windhoek suspension notice",
        "scenario": "BANK WINDHOEK: Dear customer, your account has been temporarily restricted due to unusual activity. Please verify your account information within 24 hours to avoid permanent suspension. Verify here: https://example.com/verify",
        "risk_dimensions": ["Urgency", "Account restriction", "Untrusted link"]
      },
      {
        "slug": "namibia-fnb-fake-security-alert",
        "title": "A fake FNB security alert",
        "scenario": "FNB: Your online banking profile has been flagged for suspicious activity. To protect your funds, confirm your identity immediately using the secure link below: https://example.com/security",
        "risk_dimensions": ["Urgency", "Impersonation", "Credential theft"]
      },
      {
        "slug": "namibia-telecom-fake-disconnection",
        "title": "A fake Telecom Namibia disconnection notice",
        "scenario": "TELECOM NAMIBIA: Your outstanding account balance requires immediate attention. Failure to settle your balance today may result in service disconnection. View your statement here: https://example.com/billing",
        "risk_dimensions": ["Urgency", "Financial pressure", "Untrusted link"]
      },
      {
        "slug": "namibia-nampost-fake-parcel",
        "title": "A fake NamPost parcel notification",
        "scenario": "NAMPOST: Your parcel is currently on hold due to incomplete delivery information. Please confirm your delivery address and pay the outstanding processing fee to continue delivery: https://example.com/delivery",
        "risk_dimensions": ["Urgency", "Unexpected payment", "Untrusted link"]
      },
      {
        "slug": "namibia-namra-fake-refund",
        "title": "A fake NamRA tax refund message",
        "scenario": "NAMRA: Our records indicate that you qualify for a tax refund of N$3,850. Please submit your banking details for processing within 48 hours: https://example.com/refund",
        "risk_dimensions": ["Urgency", "Unexpected refund", "Credential theft"]
      },
      {
        "slug": "namibia-standard-bank-fake-transaction",
        "title": "A fake Standard Bank transaction alert",
        "scenario": "STANDARD BANK: A transaction of N$4,750 has been initiated on your account. If you did not authorize this transaction, cancel it immediately by confirming your account details here: https://example.com/cancel",
        "risk_dimensions": ["Urgency", "Account compromise", "Untrusted link"]
      },
      {
        "slug": "namibia-namwater-fake-bill",
        "title": "A fake NamWater final notice",
        "scenario": "NAMWATER: FINAL NOTICE: Your water account is overdue. Your supply may be disconnected if payment is not received today. Settle your outstanding balance here: https://example.com/payment",
        "risk_dimensions": ["Urgency", "Threat of disconnection", "Unexpected payment"]
      },
      {
        "slug": "namibia-government-fake-payout",
        "title": "A fake government benefits payout",
        "scenario": "GOVERNMENT NOTICE: Your application for financial assistance has been approved. You qualify for a payment of N$1,800. Confirm your identity and payment details to receive your funds: https://example.com/benefit",
        "risk_dimensions": ["Urgency", "Unexpected payout", "Credential theft"]
      },
      {
        "slug": "namibia-pick-n-pay-fake-competition",
        "title": "A fake Pick n Pay competition message",
        "scenario": "PICK N PAY: You have been selected as one of our lucky customers! You qualify for a N$2,000 shopping voucher. Complete our short customer survey to activate your voucher: https://example.com/voucher",
        "risk_dimensions": ["Unexpected reward", "Urgency", "Untrusted link"]
      },
      {
        "slug": "namibia-woermann-brock-fake-loyalty",
        "title": "A fake Woermann Brock loyalty message",
        "scenario": "WOERMANN BROCK: Your loyalty rewards are about to expire. Redeem your accumulated points for shopping vouchers before the end of today: https://example.com/rewards",
        "risk_dimensions": ["Unexpected reward", "Urgency", "Untrusted link"]
      },
      {
        "slug": "namibia-mtc-fake-sim-warning",
        "title": "A fake MTC SIM registration warning",
        "scenario": "MTC NOTICE: Your SIM registration details require urgent updating. Failure to complete verification within 24 hours may result in temporary suspension of your mobile number. Update your details here: https://example.com/registration",
        "risk_dimensions": ["Urgency", "Account restriction", "Untrusted link"]
      }
    ]') as scenario(slug text, title text, scenario text, risk_dimensions jsonb)

  loop

    insert into public.scenarios (
      module_id,
      slug,
      content,
      risk_dimensions
    )
    values (
      module_id,
      scenario_record.slug,
      jsonb_build_object(
        'en',
        jsonb_build_object(
          'title', scenario_record.title,
          'scenario', scenario_record.scenario
        )
      ),
      array(
        select value
        from jsonb_array_elements_text(
          scenario_record.risk_dimensions
        ) with ordinality as element(value, ord)
        order by ord
      )
    )
    on conflict (slug) where slug is not null
    do update
      set content = excluded.content,
          risk_dimensions = excluded.risk_dimensions
    returning id into v_scenario_id;

    insert into public.scenario_options (
      scenario_id,
      option_key,
      content,
      is_correct,
      feedback
    )
    values

      (
        v_scenario_id,
        'A',
        jsonb_build_object(
          'en',
          'Verify the message through a known company channel before opening the link.'
        ),
        true,
        jsonb_build_object(
          'en',
          jsonb_build_object(
            'choice',
            'Verify independently before acting.',
            'explanation',
            'The message uses urgency, an unexpected reward or payment, and a link that does not match a known official channel.'
          )
        )
      ),

      (
        v_scenario_id,
        'B',
        jsonb_build_object(
          'en',
          'Click the link because the company name and message are familiar.'
        ),
        false,
        jsonb_build_object(
          'en',
          jsonb_build_object(
            'choice',
            'A familiar company name does not prove the message is genuine.',
            'explanation',
            'Scammers can spoof sender names and use trusted-looking wording. A message link should never be the first verification channel.'
          )
        )
      ),

      (
        v_scenario_id,
        'C',
        jsonb_build_object(
          'en',
          'Enter the requested bank or identity details immediately.'
        ),
        false,
        jsonb_build_object(
          'en',
          jsonb_build_object(
            'choice',
            'Do not disclose confidential information in response to an unverified message.',
            'explanation',
            'Banking credentials, PINs, OTPs, and account details can be used to compromise an account.'
          )
        )
      ),

      (
        v_scenario_id,
        'D',
        jsonb_build_object(
          'en',
          'Forward the message to friends to confirm it is real.'
        ),
        false,
        jsonb_build_object(
          'en',
          jsonb_build_object(
            'choice',
            'Forwarding can spread the message and expose confidential information.',
            'explanation',
            'Verify through a trusted number, official app, or known website instead of forwarding the message or its link.'
          )
        )
      )

    on conflict (scenario_id, option_key)
    do update
      set content = excluded.content,
          is_correct = excluded.is_correct,
          feedback = excluded.feedback;

  end loop;
end;
$$;