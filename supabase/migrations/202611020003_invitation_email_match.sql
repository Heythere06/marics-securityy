-- Invitation tokens may only be accepted by the invited email address.

create or replace function public.accept_organization_invitation(raw_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
