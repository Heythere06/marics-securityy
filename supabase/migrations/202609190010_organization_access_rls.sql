-- Org admins manage invitations only for organizations where they are admins (already enforced in RPC).
-- Restrict organization membership reads so users see their own row or, for admins, members of orgs they administer.

drop policy if exists memberships_self_or_admin on public.organization_memberships;
drop policy if exists memberships_self on public.organization_memberships;
drop policy if exists memberships_org_admin_read on public.organization_memberships;

create policy memberships_self on public.organization_memberships
  for select using (user_id = auth.uid());

create policy memberships_org_admin_read on public.organization_memberships
  for select using (public.is_org_admin(organization_id));
