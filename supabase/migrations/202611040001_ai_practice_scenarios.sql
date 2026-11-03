-- Learner-scoped AI practice scenarios unlock after manual module completion.
-- Manual catalog rows in scenarios / scenario_options are never modified by this feature.

create table if not exists public.ai_practice_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  slug text not null unique check (slug ~ '^ai-practice-[a-z0-9-]+$'),
  language text not null default 'en' check (language in ('en', 'af', 'pt')),
  content jsonb not null,
  risk_dimensions text[] not null default '{}',
  options jsonb not null,
  provider text not null default 'claude',
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_practice_scenarios_user_module_idx
  on public.ai_practice_scenarios(user_id, module_id, created_at desc);

create table if not exists public.ai_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ai_scenario_id uuid not null references public.ai_practice_scenarios(id) on delete cascade,
  selected_option_key text not null check (selected_option_key in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_practice_attempts_user_idx
  on public.ai_practice_attempts(user_id, created_at desc);

create index if not exists ai_practice_attempts_scenario_idx
  on public.ai_practice_attempts(ai_scenario_id, user_id);

alter table public.ai_practice_scenarios enable row level security;
alter table public.ai_practice_attempts enable row level security;

drop policy if exists ai_practice_scenarios_self on public.ai_practice_scenarios;
create policy ai_practice_scenarios_self on public.ai_practice_scenarios
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_practice_attempts_self on public.ai_practice_attempts;
create policy ai_practice_attempts_self on public.ai_practice_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.training_progress add column if not exists ai_scenarios_attempted integer not null default 0;
alter table public.training_progress add column if not exists ai_scenarios_correct integer not null default 0;
