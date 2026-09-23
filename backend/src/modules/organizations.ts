import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../lib/supabase.js';

export const organizationSchema = z.object({ name: z.string().trim().min(2).max(180) });
export const organizationSettingsSchema = z.object({ name: z.string().trim().min(2).max(180).optional(), defaultEmployeeLanguage: z.enum(['en', 'af', 'pt']).optional() });
export const invitationSchema = z.object({ email: z.string().trim().email().max(320) });
export const acceptInvitationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) });

export async function createOrganization(client: SupabaseClient, input: z.infer<typeof organizationSchema>) {
  const { data: organization, error } = await client.rpc('create_organization_for_user', { target_name: input.name });
  if (error) throw error;
  return organization as { id: string; name: string };
}

export async function updateOrganization(client: SupabaseClient, organizationId: string, input: z.infer<typeof organizationSettingsSchema>) {
  await requireOrganizationAdmin(client, organizationId);
  const updates: Record<string, string> = {};
  if (input.name) updates.name = input.name.trim();
  if (input.defaultEmployeeLanguage) updates.default_employee_language = input.defaultEmployeeLanguage;
  if (Object.keys(updates).length === 0) return { id: organizationId, name: '', defaultEmployeeLanguage: 'en' };

  const { data, error } = await client.from('organizations').update(updates).eq('id', organizationId).select('id, name, default_employee_language').single();
  if (error) throw error;
  return { id: data.id, name: data.name, defaultEmployeeLanguage: data.default_employee_language ?? 'en' };
}

export async function requireOrganizationAdmin(client: SupabaseClient, organizationId: string) {
  const { data, error } = await client.from('organization_memberships').select('is_admin').eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  if (!data?.is_admin) throw new Error('FORBIDDEN');
}

export async function createInvitation(client: SupabaseClient, organizationId: string, email: string) {
  await requireOrganizationAdmin(client, organizationId);
  const { data, error } = await client.rpc('create_organization_invitation', { target_org: organizationId, target_email: email });
  if (error) throw error;
  const invitation = data as { id: string; email: string; token: string; expiresAt: string };
  const [{ data: organization, error: organizationError }, { data: authUser, error: authError }] = await Promise.all([
    client.from('organizations').select('name').eq('id', organizationId).single(),
    client.auth.getUser(),
  ]);
  if (organizationError) throw organizationError;
  if (authError || !authUser.user) throw authError ?? new Error('INVITER_NOT_FOUND');
  const { data: inviter, error: inviterError } = await client.from('profiles').select('full_name').eq('id', authUser.user.id).single();
  if (inviterError) throw inviterError;
  await sendOrganizationInvitationEmail(invitation.email, invitation.token);
  return invitation;
}

async function sendOrganizationInvitationEmail(email: string, token: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) throw new Error('INVITATION_EMAIL_NOT_CONFIGURED');
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const invitationUrl = `${frontendUrl}/?invite=${encodeURIComponent(token)}`;
  const { error } = await createServiceClient().auth.admin.inviteUserByEmail(email, { redirectTo: invitationUrl });
  if (error) {
    const deliveryError = new Error('INVITATION_EMAIL_FAILED');
    deliveryError.cause = { provider: 'supabase_auth', message: error.message, name: error.name, status: error.status };
    throw deliveryError;
  }
}

export async function getInvitationByToken(client: SupabaseClient, rawToken: string) {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const { data, error } = await client.from('organization_invitations').select('id, email, expires_at, accepted_at, organization_id, organizations(id, name)').eq('token_hash', tokenHash).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('INVITATION_INVALID');
  const organization = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  return {
    id: data.id,
    organizationId: data.organization_id,
    organizationName: organization?.name ?? 'Organization',
    email: data.email,
    expiresAt: data.expires_at,
    acceptedAt: data.accepted_at,
    isExpired: new Date(data.expires_at).getTime() <= Date.now(),
    isUsed: Boolean(data.accepted_at),
  };
}

export async function acceptInvitation(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc('accept_organization_invitation', { raw_token: token });
  if (error) throw error;
  return data as { organizationId: string };
}

export async function removeOrganizationMember(client: SupabaseClient, organizationId: string, userId: string) {
  await requireOrganizationAdmin(client, organizationId);
  const { error } = await client.from('organization_memberships').delete().eq('organization_id', organizationId).eq('user_id', userId);
  if (error) throw error;
  return { organizationId, userId, removed: true };
}

export async function getOrganizationDashboard(client: SupabaseClient, organizationId: string) {
  await requireOrganizationAdmin(client, organizationId);
  const { data, error } = await client.rpc('get_organization_dashboard', { target_org: organizationId });
  if (error) throw error;
  return data;
}

export async function getOrganizationReport(client: SupabaseClient, organizationId: string) {
  await requireOrganizationAdmin(client, organizationId);
  const { data, error } = await client.rpc('get_organization_report', { target_org: organizationId });
  if (error) throw error;
  return data;
}

export async function getOrganizationReportCsv(client: SupabaseClient, organizationId: string) {
  await requireOrganizationAdmin(client, organizationId);
  const { data, error } = await client.rpc('get_organization_report_csv', { target_org: organizationId });
  if (error) throw error;
  return data as string;
}

export async function listOrganizations(client: SupabaseClient) {
  const { data, error } = await client.from('organization_memberships').select('organization_id, is_admin, organizations(id, name)').order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((membership) => {
    const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    return { id: membership.organization_id, isAdmin: membership.is_admin, name: organization?.name ?? 'Organization' };
  });
}