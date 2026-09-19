import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const organizationSchema = z.object({ name: z.string().trim().min(2).max(180) });
export const invitationSchema = z.object({ email: z.string().trim().email().max(320) });
export const acceptInvitationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) });

export async function createOrganization(client: SupabaseClient, input: z.infer<typeof organizationSchema>) {
  const { data: organization, error } = await client.rpc('create_organization_for_user', { target_name: input.name });
  if (error) throw error;
  return organization as { id: string; name: string };
}

export async function createInvitation(client: SupabaseClient, organizationId: string, email: string) {
  const { data, error } = await client.rpc('create_organization_invitation', { target_org: organizationId, target_email: email });
  if (error) throw error;
  return data as { id: string; email: string; token: string; expiresAt: string };
}

export async function acceptInvitation(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc('accept_organization_invitation', { raw_token: token });
  if (error) throw error;
  return data as { organizationId: string };
}

export async function getOrganizationDashboard(client: SupabaseClient, organizationId: string) {
  const { data, error } = await client.rpc('get_organization_dashboard', { target_org: organizationId });
  if (error) throw error;
  return data;
}

export async function getOrganizationReport(client: SupabaseClient, organizationId: string) {
  const { data, error } = await client.rpc('get_organization_report', { target_org: organizationId });
  if (error) throw error;
  return data;
}

export async function listOrganizations(client: SupabaseClient) {
  const { data, error } = await client.from('organization_memberships').select('organization_id, is_admin, organizations(id, name)').order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((membership) => {
    const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    return { id: membership.organization_id, isAdmin: membership.is_admin, name: organization?.name ?? 'Organization' };
  });
}