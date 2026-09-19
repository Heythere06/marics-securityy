alter table public.scenarios add column if not exists slug text;
create unique index if not exists scenarios_slug_idx on public.scenarios(slug) where slug is not null;

insert into public.training_modules (id, slug, title, description, is_published)
values ('00000000-0000-0000-0000-000000000101', 'impersonation-trust', '{"en":"Impersonation & trust"}', '{"en":"Recognize authority and urgency before acting."}', true)
on conflict (slug) do update set is_published = excluded.is_published;

insert into public.scenarios (id, module_id, slug, content, risk_dimensions)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'whatsapp-gift-cards', '{"en":{"channel":"WhatsApp","sender":"Alex Morgan","message":"Hey, I am in a meeting and need you to buy six gift cards for a client. Send me the codes when you have them. I will reimburse you this afternoon."}}', '{"Authority","Urgency"}')
on conflict (id) do update set content = excluded.content, risk_dimensions = excluded.risk_dimensions;

insert into public.scenario_options (scenario_id, option_key, content, is_correct, feedback)
values
  ('00000000-0000-0000-0000-000000000201', 'A', '{"en":"Buy the gift cards immediately so the client is not delayed."}', false, '{"en":"The pressure to act quickly is a warning sign."}'),
  ('00000000-0000-0000-0000-000000000201', 'B', '{"en":"Verify the request using a trusted channel before acting."}', true, '{"en":"Verify through a known phone number or in person."}'),
  ('00000000-0000-0000-0000-000000000201', 'C', '{"en":"Ignore the message and do not report it."}', false, '{"en":"Ignoring a suspicious request misses an opportunity to report it."}')
on conflict (scenario_id, option_key) do update set content = excluded.content, is_correct = excluded.is_correct, feedback = excluded.feedback;