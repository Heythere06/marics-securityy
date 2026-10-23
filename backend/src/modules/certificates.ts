import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../lib/supabase.js';

export function hasAttemptedEveryScenario(scenarioIds: string[], attemptedScenarioIds: string[]) {
  const attempted = new Set(attemptedScenarioIds);
  return scenarioIds.length > 0 && scenarioIds.every((scenarioId) => attempted.has(scenarioId));
}

export async function awardModuleCertificate(userClient: SupabaseClient, userId: string, moduleId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = createServiceClient();
  const { data: module, error: moduleError } = await service.from('training_modules').select('id, scenarios(id)').eq('id', moduleId).eq('is_published', true).eq('is_assessment', false).maybeSingle();
  if (moduleError) throw moduleError;
  const scenarioIds = Array.isArray(module?.scenarios) ? module.scenarios.map((scenario) => scenario.id) : [];
  if (!scenarioIds.length) return null;

  const { data: attempts, error: attemptsError } = await userClient.from('training_attempts').select('scenario_id').eq('user_id', userId).in('scenario_id', scenarioIds);
  if (attemptsError) throw attemptsError;
  if (!hasAttemptedEveryScenario(scenarioIds, attempts.map((attempt) => attempt.scenario_id))) return null;

  const { data: existing, error: existingError } = await service.from('certificates').select('id, verification_id, user_id, module_id, issued_at').eq('user_id', userId).eq('module_id', moduleId).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: certificate, error: insertError } = await service.from('certificates').insert({ user_id: userId, module_id: moduleId }).select('id, verification_id, user_id, module_id, issued_at').single();
  if (insertError?.code === '23505') {
    const { data: racedCertificate, error: lookupError } = await service.from('certificates').select('id, verification_id, user_id, module_id, issued_at').eq('user_id', userId).eq('module_id', moduleId).single();
    if (lookupError) throw lookupError;
    return racedCertificate;
  }
  if (insertError) throw insertError;
  return certificate;
}

export async function ensureUserCertificates(client: SupabaseClient, userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const service = createServiceClient();
  const { data: modules, error } = await service.from('training_modules').select('id').eq('is_published', true).eq('is_assessment', false);
  if (error) throw error;
  for (const module of modules) await awardModuleCertificate(client, userId, module.id);
}

export async function listUserCertificates(client: SupabaseClient, userId: string) {
  const { data: certificates, error } = await client.from('certificates').select('id, verification_id, module_id, issued_at').eq('user_id', userId).order('issued_at', { ascending: false });
  if (error) throw error;
  const moduleIds = [...new Set(certificates.map((certificate) => certificate.module_id).filter((id): id is string => Boolean(id)))];
  const { data: modules, error: modulesError } = moduleIds.length
    ? await client.from('training_modules').select('id, slug, title').in('id', moduleIds)
    : { data: [], error: null };
  if (modulesError) throw modulesError;
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  return certificates.map((certificate) => ({ ...certificate, module: certificate.module_id ? moduleById.get(certificate.module_id) ?? null : null }));
}

export async function verifyCertificate(verificationId: string) {
  const service = createServiceClient();
  const { data: certificate, error } = await service.from('certificates').select('verification_id, user_id, module_id, issued_at').eq('verification_id', verificationId).maybeSingle();
  if (error) throw error;
  if (!certificate) return null;

  const [{ data: profile, error: profileError }, { data: module, error: moduleError }] = await Promise.all([
    service.from('profiles').select('full_name').eq('id', certificate.user_id).single(),
    certificate.module_id
      ? service.from('training_modules').select('slug, title').eq('id', certificate.module_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (profileError) throw profileError;
  if (moduleError) throw moduleError;
  return { verificationId: certificate.verification_id, issuedAt: certificate.issued_at, recipient: profile.full_name, module: module ? { slug: module.slug, title: module.title } : null };
}