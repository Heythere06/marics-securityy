-- Batch 3: org admin can update settings and remove members under RLS.
-- Confidentiality: invite tokens remain email-only (no schema change here).
-- Integrity: last-admin and self-removal are blocked.

-- ---------------------------------------------------------------------------
-- 1) Organization settings column used by PATCH /api/organizations/:id
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists default_employee_language text not null default 'en'
    constraint organizations_default_employee_language_check
    check (default_employee_language in ('en', 'af', 'pt'));

-- ---------------------------------------------------------------------------
-- 2) Org admins may UPDATE their organization (name / language).
-- ---------------------------------------------------------------------------
drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations
  for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- ---------------------------------------------------------------------------
-- 3) Org admins may DELETE non-self memberships (employees).
--    Last-admin / self-remove guards live in remove_organization_member RPC.
-- ---------------------------------------------------------------------------
drop policy if exists memberships_org_admin_delete on public.organization_memberships;
create policy memberships_org_admin_delete on public.organization_memberships
  for delete
  using (
    public.is_org_admin(organization_id)
    and user_id <> auth.uid()
  );

-- Trusted remove path with explicit integrity checks (preferred by API).
create or replace function public.remove_organization_member(target_org uuid, target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_is_admin boolean;
  admin_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_org_admin(target_org) then raise exception 'FORBIDDEN'; end if;
  if target_user = auth.uid() then raise exception 'CANNOT_REMOVE_SELF'; end if;

  select is_admin into target_is_admin
  from public.organization_memberships
  where organization_id = target_org and user_id = target_user;

  if target_is_admin is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if target_is_admin then
    select count(*) into admin_count
    from public.organization_memberships
    where organization_id = target_org and is_admin = true;
    if admin_count <= 1 then raise exception 'LAST_ADMIN'; end if;
  end if;

  delete from public.organization_memberships
  where organization_id = target_org and user_id = target_user;

  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  return jsonb_build_object(
    'organizationId', target_org,
    'userId', target_user,
    'removed', true
  );
end;
$$;

revoke all on function public.remove_organization_member(uuid, uuid) from public, anon;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated, service_role;
