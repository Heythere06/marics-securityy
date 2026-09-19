alter table public.profiles add column if not exists account_type text not null default 'individual' check (account_type in ('individual', 'organization'));
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, country_code, preferred_language, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'country_code', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_language', ''), 'en'),
    coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'individual')
  );
  return new;
end;
$$;

create or replace function public.create_organization_for_user(target_name text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare new_org public.organizations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.organizations (name, created_by) values (trim(target_name), auth.uid()) returning * into new_org;
  insert into public.organization_memberships (organization_id, user_id, is_admin) values (new_org.id, auth.uid(), true);
  update public.profiles set role = 'organization_admin', account_type = 'organization', updated_at = now() where id = auth.uid();
  return new_org;
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
  update public.profiles set role = 'employee', account_type = 'individual', updated_at = now() where id = auth.uid() and role = 'individual';
  return jsonb_build_object('organizationId', invitation.organization_id);
end;
$$;