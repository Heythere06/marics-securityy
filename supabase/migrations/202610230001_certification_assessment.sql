create table if not exists public.certification_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  score integer,
  passed boolean
);

create table if not exists public.certification_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.certification_assessments(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id),
  selected_option_id uuid not null references public.scenario_options(id),
  is_correct boolean not null,
  unique (assessment_id, scenario_id)
);

alter table public.certification_assessments enable row level security;
alter table public.certification_answers enable row level security;
drop policy if exists certification_assessments_self on public.certification_assessments;
drop policy if exists certification_answers_self on public.certification_answers;
create policy certification_assessments_self on public.certification_assessments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy certification_answers_self on public.certification_answers for all using (exists (select 1 from public.certification_assessments where id = assessment_id and user_id = auth.uid())) with check (exists (select 1 from public.certification_assessments where id = assessment_id and user_id = auth.uid()));
