import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAuditLog } from './audit.js';
import { createServiceClient } from '../lib/supabase.js';

export const adminModuleSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(500),
});
export const adminScenarioSchema = z.object({
  moduleId: z.string().uuid(),
  scenarioId: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  content: z.record(z.enum(['en', 'af', 'pt']), z.object({ title: z.string().trim().min(2).max(160), scenario: z.string().trim().min(10).max(2000) })).refine((value) => Boolean(value.en)),
  riskDimensions: z.array(z.string().trim().min(2).max(80)).min(1).max(5),
  options: z.array(z.object({
    content: z.record(z.enum(['en', 'af', 'pt']), z.string().trim().min(1).max(500)),
    isCorrect: z.boolean(),
    feedback: z.record(z.enum(['en', 'af', 'pt']), z.object({ choice: z.string().trim().min(1).max(1000), explanation: z.string().trim().min(1).max(2000) })),
  })).length(3).refine((options) => options.filter((option) => option.isCorrect).length === 1),
});
export const adminPublishSchema = z.object({ published: z.boolean() });
export const adminSettingSchema = z.object({
  key: z.enum(['supported_languages', 'ai_usage_cap', 'rate_limit_config', 'feature_flags']),
  value: z.union([
    z.array(z.enum(['en', 'af', 'pt'])).min(1).max(3),
    z.object({ monthlyRequests: z.number().int().positive(), monthlyBudgetUsd: z.number().positive() }),
    z.object({ max: z.number().int().positive(), timeWindowMinutes: z.number().int().positive() }),
    z.object({ aiGeneration: z.boolean(), certificates: z.boolean() }),
  ]),
});
export const adminUserRoleSchema = z.object({ role: z.enum(['individual', 'employee', 'organization_admin', 'marics_admin']) });
export const adminSuspendSchema = z.object({ suspended: z.boolean() });
export const adminOrganizationSchema = z.object({ name: z.string().trim().min(2).max(180) });
export const adminOrgAdminSchema = z.object({ userId: z.string().uuid(), isAdmin: z.boolean() });
export const adminModuleUpdateSchema = z.object({
  title: z.record(z.string(), z.string()),
  description: z.record(z.string(), z.string()),
  published: z.boolean(),
});
export const adminArchiveSchema = z.object({ archived: z.boolean() });

export async function requireMaricsAdmin(client: SupabaseClient) {
  const { data, error } = await client.rpc('is_marics_admin');
  if (error) throw error;
  if (data !== true) throw new Error('ADMIN_FORBIDDEN');
}

export async function getAdminOverview(client: SupabaseClient) {
  const { data, error } = await client.rpc('get_admin_overview');
  if (error) throw error;
  return data;
}

export async function createAdminModule(client: SupabaseClient, input: z.infer<typeof adminModuleSchema>) {
  const { data, error } = await client.rpc('create_admin_module', { target_slug: input.slug, target_title: { en: input.title }, target_description: { en: input.description } });
  if (error) throw error;
  await recordAuditLog(client, { action: 'training.module.create', targetType: 'training_module', targetId: (data as { id: string }).id, metadata: { slug: input.slug } });
  return data;
}

export async function createAdminScenario(client: SupabaseClient, input: z.infer<typeof adminScenarioSchema>) {
  if (input.scenarioId) {
    const service = createServiceClient();
    const { data: updated, error: updateError } = await service.from('scenarios').update({ slug: input.slug, content: input.content, risk_dimensions: input.riskDimensions }).eq('id', input.scenarioId).select('id, module_id, slug').single();
    if (updateError) throw updateError;
    const { error: deleteError } = await service.from('scenario_options').delete().eq('scenario_id', input.scenarioId);
    if (deleteError) throw deleteError;
    const { error: insertError } = await service.from('scenario_options').insert(input.options.map((option, index) => ({ scenario_id: input.scenarioId, option_key: String.fromCharCode(65 + index), content: option.content, is_correct: option.isCorrect, feedback: option.feedback })));
    if (insertError) throw insertError;
    await recordAuditLog(client, { action: 'training.scenario.update', targetType: 'scenario', targetId: updated.id, metadata: { slug: input.slug, moduleId: updated.module_id } });
    return updated;
  }
  const rpc = 'admin_create_scenario';
  const { data, error } = await client.rpc(rpc, {
    ...(input.scenarioId ? { target_scenario: input.scenarioId } : { target_module: input.moduleId }),
    target_slug: input.slug,
    target_content: input.content,
    target_risk_dimensions: input.riskDimensions,
    target_options: input.options.map((option, index) => ({ option_key: String.fromCharCode(65 + index), content: option.content, is_correct: option.isCorrect, feedback: option.feedback })),
  });
  if (error) throw error;
  await recordAuditLog(client, { action: 'training.scenario.create', targetType: 'scenario', targetId: (data as { id: string }).id, metadata: { slug: input.slug, moduleId: input.moduleId } });
  return data;
}

export async function listAdminScenarios(client: SupabaseClient, moduleId: string) {
  const { data, error } = await createServiceClient().from('scenarios').select('id, module_id, slug, content, risk_dimensions, scenario_options(id, option_key, content, is_correct, feedback)').eq('module_id', moduleId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((scenario) => ({ id: scenario.id, moduleId: scenario.module_id, slug: scenario.slug, content: scenario.content, riskDimensions: scenario.risk_dimensions, options: Array.isArray(scenario.scenario_options) ? scenario.scenario_options.map((option) => ({ id: option.id, optionKey: option.option_key, content: option.content, isCorrect: option.is_correct, feedback: option.feedback })) : [] }));
}

export async function setAdminModulePublished(client: SupabaseClient, moduleId: string, published: boolean) {
  const { data, error } = await client.rpc('set_admin_module_published', { target_module: moduleId, target_published: published });
  if (error) throw error;
  await recordAuditLog(client, { action: published ? 'training.module.publish' : 'training.module.unpublish', targetType: 'training_module', targetId: moduleId });
  return data;
}

export async function setAdminSetting(client: SupabaseClient, input: z.infer<typeof adminSettingSchema>) {
  const { data, error } = await client.rpc('set_admin_setting', { target_key: input.key, target_value: input.value });
  if (error) throw error;
  await recordAuditLog(client, { action: 'platform.setting.update', targetType: 'platform_setting', targetId: input.key, metadata: { value: input.value } });
  return data;
}

export async function searchAdminUsers(client: SupabaseClient, query: string) {
  const { data, error } = await client.rpc('admin_search_users', { search_query: query });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.rpc('admin_get_user', { target_user: userId });
  if (error) throw error;
  return data;
}

export async function setAdminUserRole(client: SupabaseClient, userId: string, role: z.infer<typeof adminUserRoleSchema>['role']) {
  const { data, error } = await client.rpc('admin_set_user_role', { target_user: userId, target_role: role });
  if (error) throw error;
  return data;
}

export async function setAdminUserSuspended(client: SupabaseClient, userId: string, suspended: boolean) {
  const { data, error } = await client.rpc('admin_set_user_suspended', { target_user: userId, target_suspended: suspended });
  if (error) throw error;
  return data;
}

export async function searchAdminOrganizations(client: SupabaseClient, query: string) {
  const { data, error } = await client.rpc('admin_search_organizations', { search_query: query });
  if (error) throw error;
  return data ?? [];
}

export async function getAdminOrganization(client: SupabaseClient, organizationId: string) {
  const { data, error } = await client.rpc('admin_get_organization', { target_org: organizationId });
  if (error) throw error;
  return data;
}

export async function createAdminOrganization(client: SupabaseClient, name: string) {
  const { data, error } = await client.rpc('admin_create_organization', { target_name: name });
  if (error) throw error;
  return data;
}

export async function setAdminOrganizationSuspended(client: SupabaseClient, organizationId: string, suspended: boolean) {
  const { data, error } = await client.rpc('admin_set_organization_suspended', { target_org: organizationId, target_suspended: suspended });
  if (error) throw error;
  return data;
}

export async function setAdminOrganizationAdmin(client: SupabaseClient, organizationId: string, userId: string, isAdmin: boolean) {
  const { error } = await client.rpc('admin_set_organization_admin', { target_org: organizationId, target_user: userId, target_is_admin: isAdmin });
  if (error) throw error;
}

export async function getAdminTrainingCatalog(client: SupabaseClient) {
  const { data, error } = await client.rpc('admin_get_training_catalog');
  if (error) throw error;
  return data;
}

export async function updateAdminTrainingModule(client: SupabaseClient, moduleId: string, input: z.infer<typeof adminModuleUpdateSchema>) {
  const { data, error } = await client.rpc('admin_upsert_training_module', {
    target_module: moduleId,
    target_title: input.title,
    target_description: input.description,
    target_published: input.published,
  });
  if (error) throw error;
  return data;
}

export async function archiveAdminTrainingModule(client: SupabaseClient, moduleId: string, archived: boolean) {
  const { data, error } = await client.rpc('admin_archive_training_module', { target_module: moduleId, target_archived: archived });
  if (error) throw error;
  return data;
}

export async function getAdminPlatformAnalytics(client: SupabaseClient) {
  const { data, error } = await client.rpc('admin_get_platform_analytics');
  if (error) throw error;
  return data;
}

export async function listAdminAuditLog(client: SupabaseClient, limit = 50) {
  const { data, error } = await client.rpc('admin_list_audit_log', { limit_count: limit });
  if (error) throw error;
  return data ?? [];
}

export async function resendUserVerification(client: SupabaseClient, userId: string) {
  await requireMaricsAdmin(client);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL;
  if (!serviceKey || !url) throw new Error('ADMIN_VERIFICATION_UNAVAILABLE');
  const { createClient } = await import('@supabase/supabase-js');
  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile, error: profileError } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error('USER_NOT_FOUND');
  const { data: authUser, error: authError } = await service.auth.admin.getUserById(userId);
  if (authError) throw authError;
  if (!authUser.user.email) throw new Error('USER_EMAIL_MISSING');
  const { error: inviteError } = await service.auth.admin.inviteUserByEmail(authUser.user.email);
  if (inviteError) throw inviteError;
  await recordAuditLog(client, { action: 'user.verification.resend', targetType: 'user', targetId: userId });
}
