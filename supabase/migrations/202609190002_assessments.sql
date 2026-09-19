create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_key text not null,
  selected_option integer not null check (selected_option between 0 and 2),
  risk_dimension text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (assessment_id, question_key)
);

create table public.risk_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  strongest_dimension text,
  focus_dimension text,
  awareness_score integer not null default 0 check (awareness_score between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.training_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  scenarios_attempted integer not null default 0 check (scenarios_attempted >= 0),
  scenarios_correct integer not null default 0 check (scenarios_correct between 0 and scenarios_attempted),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create index assessments_user_idx on public.assessments(user_id, created_at desc);
create index assessment_answers_assessment_idx on public.assessment_answers(assessment_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.assessments enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.training_progress enable row level security;

create policy assessments_self on public.assessments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assessment_answers_self on public.assessment_answers for all using (exists (select 1 from public.assessments where id = assessment_id and user_id = auth.uid())) with check (exists (select 1 from public.assessments where id = assessment_id and user_id = auth.uid()));
create policy risk_profiles_self on public.risk_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy training_progress_self on public.training_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());