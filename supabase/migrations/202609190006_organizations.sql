create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_invitations_org_idx on public.organization_invitations(organization_id, created_at desc);
create index organization_invitations_email_idx on public.organization_invitations(lower(email));

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_memberships where organization_id = target_org and user_id = auth.uid() and is_admin = true);
$$;

alter table public.organization_invitations enable row level security;
create policy organization_invitations_admin_read on public.organization_invitations for select using (public.is_org_admin(organization_id));
create policy organization_invitations_admin_insert on public.organization_invitations for insert with check (public.is_org_admin(organization_id) and invited_by = auth.uid());

create policy organizations_creator_insert on public.organizations for insert with check (created_by = auth.uid());
create policy memberships_creator_insert on public.organization_memberships for insert with check (user_id = auth.uid() and is_admin = true and exists (select 1 from public.organizations where id = organization_id and created_by = auth.uid()));

create or replace function public.create_organization_invitation(target_org uuid, target_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  raw_token text := encode(gen_random_bytes(32), 'hex');
  invitation public.organization_invitations;
begin
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  insert into public.organization_invitations (organization_id, email, token_hash, invited_by)
  values (target_org, lower(trim(target_email)), encode(digest(raw_token, 'sha256'), 'hex'), auth.uid())
  returning * into invitation;
  return jsonb_build_object('id', invitation.id, 'email', invitation.email, 'token', raw_token, 'expiresAt', invitation.expires_at);
end;
$$;

create or replace function public.accept_organization_invitation(raw_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  invitation public.organization_invitations;
begin
  select * into invitation from public.organization_invitations
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex') and accepted_at is null and expires_at > now()
  for update;
  if invitation.id is null then raise exception 'INVITATION_INVALID'; end if;
  insert into public.organization_memberships (organization_id, user_id, is_admin)
  values (invitation.organization_id, auth.uid(), false)
  on conflict (organization_id, user_id) do nothing;
  update public.organization_invitations set accepted_at = now() where id = invitation.id;
  return jsonb_build_object('organizationId', invitation.organization_id);
end;
$$;

create or replace function public.get_organization_dashboard(target_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'organization', (select jsonb_build_object('id', id, 'name', name) from public.organizations where id = target_org),
    'employeeCount', (select count(*) from public.organization_memberships where organization_id = target_org and is_admin = false),
    'trainedEmployees', (select count(distinct ta.user_id) from public.training_attempts ta join public.organization_memberships om on om.user_id = ta.user_id where om.organization_id = target_org and om.is_admin = false),
    'attempted', (select count(*) from public.training_attempts ta join public.organization_memberships om on om.user_id = ta.user_id where om.organization_id = target_org and om.is_admin = false),
    'correct', (select count(*) from public.training_attempts ta join public.organization_memberships om on om.user_id = ta.user_id where om.organization_id = target_org and om.is_admin = false and ta.is_correct),
    'employees', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'attempted', coalesce(stats.attempted, 0), 'correct', coalesce(stats.correct, 0)) order by p.full_name) from public.organization_memberships om join public.profiles p on p.id = om.user_id left join (select user_id, count(*) attempted, count(*) filter (where is_correct) correct from public.training_attempts group by user_id) stats on stats.user_id = p.id where om.organization_id = target_org and om.is_admin = false), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_organization_report(target_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object('generatedAt', now(), 'dashboard', public.get_organization_dashboard(target_org));
end;
$$;