create table public.generated_content (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  module_slug text not null check (char_length(module_slug) between 1 and 80),
  language text not null default 'en' check (language in ('en', 'af', 'pt')),
  prompt_key text not null check (char_length(prompt_key) between 1 and 160),
  content jsonb not null,
  provider text not null default 'claude',
  model text not null,
  created_at timestamptz not null default now(),
  unique (requested_by, module_slug, language, prompt_key)
);

create index generated_content_lookup_idx on public.generated_content(requested_by, module_slug, language, prompt_key);
alter table public.generated_content enable row level security;
create policy generated_content_self on public.generated_content for select using (requested_by = auth.uid());
create policy generated_content_insert_self on public.generated_content for insert with check (requested_by = auth.uid());