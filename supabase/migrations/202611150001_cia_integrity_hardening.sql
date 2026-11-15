-- CIA integrity hardening for a cybersecurity education platform.
-- Confidentiality: answer keys are not client-readable via PostgREST.
-- Integrity: learners cannot forge progress, risk profiles, or certification results.
-- Availability: the trusted API (service role) continues to score and write securely.

-- ---------------------------------------------------------------------------
-- 1) Block privilege escalation on profiles unless an elevated RPC opts in.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('marics.allow_profile_privilege_change', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      raise exception 'PROFILE_ROLE_IMMUTABLE';
    end if;
    if new.suspended_at is distinct from old.suspended_at then
      raise exception 'PROFILE_SUSPENSION_IMMUTABLE';
    end if;
    if new.account_type is distinct from old.account_type then
      raise exception 'PROFILE_ACCOUNT_TYPE_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privilege_guard on public.profiles;
create trigger profiles_privilege_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_privilege_guard();

-- Re-assert admin RPCs with privilege bypass. Return type must stay public.profiles
-- (same as 202609190012). Drop first in case a partial apply left jsonb returns.
drop function if exists public.admin_set_user_role(uuid, public.app_role);
drop function if exists public.admin_set_user_suspended(uuid, boolean);

create or replace function public.admin_set_user_role(target_user uuid, target_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare updated public.profiles;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  perform set_config('marics.allow_profile_privilege_change', 'on', true);
  update public.profiles set role = target_role, updated_at = now() where id = target_user returning * into updated;
  if updated.id is null then raise exception 'USER_NOT_FOUND'; end if;
  perform public.admin_record_audit('user.role.update', 'user', target_user::text, jsonb_build_object('role', target_role));
  return updated;
end;
$$;

create or replace function public.admin_set_user_suspended(target_user uuid, target_suspended boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare updated public.profiles;
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  perform set_config('marics.allow_profile_privilege_change', 'on', true);
  update public.profiles
    set suspended_at = case when target_suspended then now() else null end,
        updated_at = now()
  where id = target_user
  returning * into updated;
  if updated.id is null then raise exception 'USER_NOT_FOUND'; end if;
  perform public.admin_record_audit(
    case when target_suspended then 'user.suspend' else 'user.reactivate' end,
    'user',
    target_user::text,
    '{}'::jsonb
  );
  return updated;
end;
$$;

-- Organization creation promotes the caller to organization_admin.
create or replace function public.create_organization_for_user(target_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare new_org public.organizations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.organizations (name, created_by) values (trim(target_name), auth.uid()) returning * into new_org;
  insert into public.organization_memberships (organization_id, user_id, is_admin) values (new_org.id, auth.uid(), true);
  perform set_config('marics.allow_profile_privilege_change', 'on', true);
  update public.profiles set role = 'organization_admin', account_type = 'organization', updated_at = now() where id = auth.uid();
  return new_org;
end;
$$;

-- Invitation acceptance promotes individual -> employee (email-matched).
create or replace function public.accept_organization_invitation(raw_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  invitation public.organization_invitations;
  signed_in_email text;
begin
  select * into invitation from public.organization_invitations
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex') and accepted_at is null and expires_at > now()
  for update;
  if invitation.id is null then raise exception 'INVITATION_INVALID'; end if;

  select coalesce(profiles.email, users.email) into signed_in_email
  from auth.users as users
  left join public.profiles as profiles on profiles.id = users.id
  where users.id = auth.uid();

  if signed_in_email is null or lower(signed_in_email) <> lower(invitation.email) then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  insert into public.organization_memberships (organization_id, user_id, is_admin)
  values (invitation.organization_id, auth.uid(), false)
  on conflict (organization_id, user_id) do nothing;
  update public.organization_invitations set accepted_at = now() where id = invitation.id;
  perform set_config('marics.allow_profile_privilege_change', 'on', true);
  update public.profiles set role = 'employee', account_type = 'individual', updated_at = now() where id = auth.uid() and role = 'individual';
  return jsonb_build_object('organizationId', invitation.organization_id);
end;
$$;

create or replace function public.admin_set_organization_admin(target_org uuid, target_user uuid, target_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_marics_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.organization_memberships (organization_id, user_id, is_admin)
  values (target_org, target_user, target_is_admin)
  on conflict (organization_id, user_id) do update set is_admin = excluded.is_admin;
  if target_is_admin then
    perform set_config('marics.allow_profile_privilege_change', 'on', true);
    update public.profiles set role = 'organization_admin', updated_at = now() where id = target_user;
  end if;
  perform public.admin_record_audit('organization.admin.update', 'organization', target_org::text, jsonb_build_object('userId', target_user, 'isAdmin', target_is_admin));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Scoring tables: read own rows only. Writes go through the API service role.
-- ---------------------------------------------------------------------------
drop policy if exists attempts_self on public.training_attempts;
drop policy if exists training_attempts_self_read on public.training_attempts;
create policy training_attempts_self_read on public.training_attempts
  for select using (user_id = auth.uid());

drop policy if exists training_progress_self on public.training_progress;
drop policy if exists training_progress_self_read on public.training_progress;
create policy training_progress_self_read on public.training_progress
  for select using (user_id = auth.uid());

drop policy if exists risk_profiles_self on public.risk_profiles;
drop policy if exists risk_profiles_self_read on public.risk_profiles;
create policy risk_profiles_self_read on public.risk_profiles
  for select using (user_id = auth.uid());

drop policy if exists assessments_self on public.assessments;
drop policy if exists assessments_self_read on public.assessments;
create policy assessments_self_read on public.assessments
  for select using (user_id = auth.uid());

drop policy if exists assessment_answers_self on public.assessment_answers;
drop policy if exists assessment_answers_self_read on public.assessment_answers;
create policy assessment_answers_self_read on public.assessment_answers
  for select using (exists (
    select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()
  ));

-- Ensure cert tables exist (202610230001 may not be applied on older remotes).
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
drop policy if exists certification_assessments_self_read on public.certification_assessments;
drop policy if exists certification_assessments_self_start on public.certification_assessments;
create policy certification_assessments_self_read on public.certification_assessments
  for select using (user_id = auth.uid());
create policy certification_assessments_self_start on public.certification_assessments
  for insert with check (
    user_id = auth.uid()
    and completed_at is null
    and score is null
    and passed is null
  );

drop policy if exists certification_answers_self on public.certification_answers;
drop policy if exists certification_answers_self_read on public.certification_answers;
create policy certification_answers_self_read on public.certification_answers
  for select using (exists (
    select 1 from public.certification_assessments a
    where a.id = assessment_id and a.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 3) Confidentiality: hide answer keys on catalog options from direct clients.
-- ---------------------------------------------------------------------------
revoke select (is_correct, feedback) on public.scenario_options from anon, authenticated;
grant select (id, scenario_id, option_key, content) on public.scenario_options to anon, authenticated;
grant all (is_correct, feedback) on public.scenario_options to service_role;

-- ---------------------------------------------------------------------------
-- 4) AI practice: move correctness out of learner-readable option JSON.
-- ---------------------------------------------------------------------------
-- Ensure AI practice tables exist (202611040001 may not be applied on older remotes).
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

create table if not exists public.ai_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ai_scenario_id uuid not null references public.ai_practice_scenarios(id) on delete cascade,
  selected_option_key text not null check (selected_option_key in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

alter table public.ai_practice_scenarios enable row level security;
alter table public.ai_practice_attempts enable row level security;

alter table public.ai_practice_scenarios
  add column if not exists correct_option_key text,
  add column if not exists option_feedback jsonb;

update public.ai_practice_scenarios
set
  correct_option_key = coalesce(
    correct_option_key,
    (
      select elem->>'option_key'
      from jsonb_array_elements(options) as elem
      where coalesce((elem->>'is_correct')::boolean, false) = true
      limit 1
    )
  ),
  option_feedback = coalesce(option_feedback, options),
  options = (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'option_key', elem->>'option_key',
          'content', elem->'content'
        )
        order by elem->>'option_key'
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(options) as elem
  )
where options is not null
  and options::text like '%is_correct%';

revoke select (correct_option_key, option_feedback) on public.ai_practice_scenarios from anon, authenticated;
grant all (correct_option_key, option_feedback) on public.ai_practice_scenarios to service_role;

drop policy if exists ai_practice_scenarios_self on public.ai_practice_scenarios;
drop policy if exists ai_practice_scenarios_self_read on public.ai_practice_scenarios;
drop policy if exists ai_practice_scenarios_self_insert on public.ai_practice_scenarios;
create policy ai_practice_scenarios_self_read on public.ai_practice_scenarios
  for select using (user_id = auth.uid());

drop policy if exists ai_practice_attempts_self on public.ai_practice_attempts;
drop policy if exists ai_practice_attempts_self_read on public.ai_practice_attempts;
create policy ai_practice_attempts_self_read on public.ai_practice_attempts
  for select using (user_id = auth.uid());

-- Service-role / trusted promotion helper used by API invite fallbacks.
create or replace function public.promote_user_to_employee(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> target_user and not public.is_marics_admin() then
    raise exception 'FORBIDDEN';
  end if;
  perform set_config('marics.allow_profile_privilege_change', 'on', true);
  update public.profiles
    set role = 'employee', account_type = 'individual', updated_at = now()
  where id = target_user and role in ('individual', 'employee');
end;
$$;

revoke all on function public.promote_user_to_employee(uuid) from public, anon, authenticated;
grant execute on function public.promote_user_to_employee(uuid) to service_role;
