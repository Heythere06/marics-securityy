-- Invitation token helpers live in the extensions schema on Supabase.
-- Functions that set search_path = public cannot see gen_random_bytes/digest otherwise.

create or replace function public.create_organization_invitation(target_org uuid, target_email text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
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
  update public.profiles set role = 'employee', account_type = 'individual', updated_at = now() where id = auth.uid() and role = 'individual';
  return jsonb_build_object('organizationId', invitation.organization_id);
end;
$$;
