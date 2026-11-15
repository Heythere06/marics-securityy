import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrganizationInvitationEmail, isEmailConfigured, sendEmail } from '../lib/email.js';
import { createServiceClient, toPublicInvitation } from '../lib/supabase.js';

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
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('FORBIDDEN');
  const { data, error } = await client.from('organization_memberships').select('is_admin').eq('organization_id', organizationId).eq('user_id', auth.user.id).maybeSingle();
  if (error) throw error;
  if (!data?.is_admin) throw new Error('FORBIDDEN');
  const { data: organization, error: organizationError } = await client
    .from('organizations')
    .select('suspended_at')
    .eq('id', organizationId)
    .maybeSingle();
  if (organizationError) throw organizationError;
  if (organization?.suspended_at) throw new Error('ORGANIZATION_SUSPENDED');
}

export async function createInvitation(client: SupabaseClient, organizationId: string, email: string) {
  await requireOrganizationAdmin(client, organizationId);
  const [{ data: organization, error: organizationError }, { data: authUser, error: authError }] = await Promise.all([
    client.from('organizations').select('name').eq('id', organizationId).single(),
    client.auth.getUser(),
  ]);
  if (organizationError) throw organizationError;
  if (authError || !authUser.user) throw authError ?? new Error('INVITER_NOT_FOUND');
  const { data: inviter, error: inviterError } = await client.from('profiles').select('full_name').eq('id', authUser.user.id).single();
  if (inviterError) throw inviterError;

  let invitation: { id: string; email: string; token: string; expiresAt: string };
  const { data, error } = await client.rpc('create_organization_invitation', { target_org: organizationId, target_email: email });
  if (error) {
    // Only fall back when pgcrypto/digest is missing from the RPC search_path.
    if (!isPgcryptoFallbackError(error)) throw error;
    invitation = await createInvitationWithServiceRole(organizationId, email, authUser.user.id);
  } else {
    invitation = data as { id: string; email: string; token: string; expiresAt: string };
  }

  try {
    await sendOrganizationInvitationEmail(
      invitation.email,
      invitation.token,
      organization?.name ?? 'your organization',
      inviter?.full_name ?? 'A MARICS administrator',
    );
  } catch (error) {
    if (error instanceof Error && (error.message === 'INVITATION_EMAIL_FAILED' || error.message === 'INVITATION_EMAIL_NOT_CONFIGURED')) {
      const deliveryError = new Error(error.message);
      // Never attach the raw invite token to HTTP error causes (confidentiality).
      deliveryError.cause = {
        ...(error.cause as object | undefined),
        invitation: toPublicInvitation(invitation),
      };
      throw deliveryError;
    }
    throw error;
  }
  return { ...toPublicInvitation(invitation), emailDelivered: true as const };
}

export async function previewInvitationByToken(rawToken: string) {
  const service = createServiceClient();
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const { data, error } = await service
    .from('organization_invitations')
    .select('expires_at, accepted_at, organizations(id, name)')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('INVITATION_INVALID');
  const organization = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  const isExpired = new Date(data.expires_at).getTime() <= Date.now();
  const isUsed = Boolean(data.accepted_at);
  // Public preview must not expose invitee email / expiry timestamps (PII).
  return {
    organizationName: organization?.name ?? 'Organization',
    isExpired,
    isUsed,
    status: isUsed ? 'used' as const : isExpired ? 'expired' as const : 'valid' as const,
  };
}

async function createInvitationWithServiceRole(organizationId: string, email: string, invitedBy: string) {
  const service = createServiceClient();
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await service.from('organization_invitations').insert({
    organization_id: organizationId,
    email: normalizedEmail,
    token_hash: tokenHash,
    invited_by: invitedBy,
    expires_at: expiresAt,
  }).select('id, email, expires_at').single();
  if (error) throw error;
  return { id: data.id, email: data.email, token, expiresAt: data.expires_at };
}

async function sendOrganizationInvitationEmail(email: string, token: string, organizationName: string, inviterName: string) {
  if (!isEmailConfigured()) throw new Error('INVITATION_EMAIL_NOT_CONFIGURED');
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const invitationUrl = `${frontendUrl}/?invite=${encodeURIComponent(token)}`;
  const message = buildOrganizationInvitationEmail({
    organizationName,
    inviterName: inviterName || 'A MARICS administrator',
    invitationUrl,
  });
  try {
    await sendEmail({ to: email, ...message });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_NOT_CONFIGURED') throw new Error('INVITATION_EMAIL_NOT_CONFIGURED');
    if (error instanceof Error && error.message === 'EMAIL_DELIVERY_FAILED') {
      const deliveryError = new Error('INVITATION_EMAIL_FAILED');
      deliveryError.cause = error.cause;
      throw deliveryError;
    }
    throw error;
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

function isPgcryptoFallbackError(error: { message?: string; details?: string; hint?: string; code?: string }) {
  const detail = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''} ${error.code ?? ''}`;
  return /gen_random_bytes|digest\(|pgcrypto|42883|PGRST202|function .* does not exist/i.test(detail);
}

async function assertOrganizationNotSuspended(organizationId: string) {
  const service = createServiceClient();
  const { data, error } = await service.from('organizations').select('suspended_at').eq('id', organizationId).maybeSingle();
  if (error) throw error;
  if (data?.suspended_at) throw new Error('ORGANIZATION_SUSPENDED');
}

export async function acceptInvitation(client: SupabaseClient, token: string) {
  const service = createServiceClient();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: invitationPeek, error: peekError } = await service
    .from('organization_invitations')
    .select('organization_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (peekError) throw peekError;
  if (invitationPeek?.organization_id) await assertOrganizationNotSuspended(invitationPeek.organization_id);

  const { data, error } = await client.rpc('accept_organization_invitation', { raw_token: token });
  if (!error) return data as { organizationId: string };

  const detail = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toUpperCase();
  if (detail.includes('INVITATION_EMAIL_MISMATCH')) throw new Error('INVITATION_EMAIL_MISMATCH');
  if (detail.includes('INVITATION_INVALID') || detail.includes('AUTH_REQUIRED')) {
    throw new Error(detail.includes('AUTH_REQUIRED') ? 'AUTH_REQUIRED' : 'INVITATION_INVALID');
  }
  // Fallback only when digest()/pgcrypto is not visible on the RPC search_path.
  if (!isPgcryptoFallbackError(error)) throw error;

  const { data: authUser, error: authError } = await client.auth.getUser();
  if (authError || !authUser.user) throw new Error('AUTH_REQUIRED');

  const { data: invitation, error: invitationError } = await service
    .from('organization_invitations')
    .select('id, email, expires_at, accepted_at, organization_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (invitationError) throw invitationError;
  if (!invitation) throw new Error('INVITATION_INVALID');
  if (invitation.accepted_at || new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw new Error('INVITATION_INVALID');
  }

  const signedInEmail = (authUser.user.email ?? '').trim().toLowerCase();
  if (!signedInEmail || signedInEmail !== String(invitation.email).trim().toLowerCase()) {
    throw new Error('INVITATION_EMAIL_MISMATCH');
  }

  // Claim the invitation first so concurrent accepts cannot both succeed.
  const { data: claimed, error: markError } = await service.from('organization_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .is('accepted_at', null)
    .select('id')
    .maybeSingle();
  if (markError) throw markError;
  if (!claimed) throw new Error('INVITATION_INVALID');

  const { error: membershipError } = await service.from('organization_memberships').upsert({
    organization_id: invitation.organization_id,
    user_id: authUser.user.id,
    is_admin: false,
  }, { onConflict: 'organization_id,user_id', ignoreDuplicates: true });
  if (membershipError) throw membershipError;

  const { error: promoteError } = await service.rpc('promote_user_to_employee', { target_user: authUser.user.id });
  if (promoteError) throw promoteError;

  return { organizationId: invitation.organization_id };
}

export async function removeOrganizationMember(client: SupabaseClient, organizationId: string, userId: string) {
  await requireOrganizationAdmin(client, organizationId);
  const { data, error } = await client.rpc('remove_organization_member', {
    target_org: organizationId,
    target_user: userId,
  });
  if (error) {
    const detail = `${error.message} ${error.details ?? ''} ${error.hint ?? ''} ${error.code ?? ''}`;
    const upper = detail.toUpperCase();
    if (upper.includes('CANNOT_REMOVE_SELF')) throw new Error('CANNOT_REMOVE_SELF');
    if (upper.includes('LAST_ADMIN')) throw new Error('LAST_ADMIN');
    if (upper.includes('MEMBER_NOT_FOUND')) throw new Error('MEMBER_NOT_FOUND');
    if (upper.includes('FORBIDDEN') || upper.includes('AUTH_REQUIRED')) throw new Error('FORBIDDEN');
    // Fallback only when the Batch 3 RPC is not applied yet.
    if (!/does not exist|PGRST202|42883/i.test(detail)) throw error;
    const { error: deleteError } = await client
      .from('organization_memberships')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId);
    if (deleteError) throw deleteError;
    return { organizationId, userId, removed: true };
  }
  const result = data as { organizationId?: string; userId?: string; removed?: boolean } | null;
  return {
    organizationId: result?.organizationId ?? organizationId,
    userId: result?.userId ?? userId,
    removed: result?.removed ?? true,
  };
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