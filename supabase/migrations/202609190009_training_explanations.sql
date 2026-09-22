-- Enrich scenario option feedback with choice-specific notes and threat-focused explanations.
-- feedback jsonb shape per language: { "choice": "...", "explanation": "..." }
-- Legacy plain strings remain supported in application code.

update public.scenario_options set feedback = '{"en":{"choice":"Acting immediately rewards the attacker: gift-card requests are a classic impersonation pattern because they are hard to trace and bypass normal approval.","explanation":"The safest response is to verify identity through a channel you already trust—call a known number or speak in person—before sending money or codes. Real colleagues accept verification; attackers push urgency to stop you from checking."}}'::jsonb
where scenario_id = '00000000-0000-0000-0000-000000000201' and option_key = 'A';

update public.scenario_options set feedback = '{"en":{"choice":"You treated the message as unverified until confirmed—exactly what stops impersonation.","explanation":"Verify through a known phone number or in person before buying gift cards or sharing codes. Attackers exploit authority and urgency on WhatsApp because it feels informal; verification breaks the scam even when the display name looks familiar."}}'::jsonb
where scenario_id = '00000000-0000-0000-0000-000000000201' and option_key = 'B';

update public.scenario_options set feedback = '{"en":{"choice":"Ignoring without reporting leaves the organization blind to an active impersonation attempt.","explanation":"When a request looks suspicious, verify through a trusted channel and report it to your security contact. Verification protects you; reporting helps protect colleagues from the same tactic."}}'::jsonb
where scenario_id = '00000000-0000-0000-0000-000000000201' and option_key = 'C';
