import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServiceClient } from '../lib/supabase.js';
import { generatePracticeScenarioDraft } from './ai.js';
import { hasAttemptedEveryScenario } from './certificates.js';

export const aiPracticeGenerateSchema = z.object({
  moduleSlug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  language: z.enum(['en', 'af', 'pt']).default('en'),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced']).default('intermediate'),
});

export const aiPracticeAnswerSchema = z.object({
  optionKey: z.enum(['A', 'B', 'C', 'D']),
});

type PracticeOption = {
  option_key: 'A' | 'B' | 'C' | 'D';
  content: Record<string, string>;
  is_correct: boolean;
  feedback: Record<string, { choice: string; explanation: string }>;
};

function contentClient(client: SupabaseClient) {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceClient() : client;
}

async function assertManualModuleComplete(client: SupabaseClient, userId: string, moduleId: string) {
  const { data: scenarios, error: scenariosError } = await contentClient(client).from('scenarios').select('id').eq('module_id', moduleId);
  if (scenariosError) throw scenariosError;
  const scenarioIds = (scenarios ?? []).map((scenario) => scenario.id);
  if (!scenarioIds.length) throw new Error('MODULE_HAS_NO_MANUAL_SCENARIOS');
  const { data: attempts, error: attemptsError } = await client.from('training_attempts').select('scenario_id').eq('user_id', userId).in('scenario_id', scenarioIds);
  if (attemptsError) throw attemptsError;
  if (!hasAttemptedEveryScenario(scenarioIds, (attempts ?? []).map((attempt) => attempt.scenario_id))) {
    throw new Error('MANUAL_SCENARIOS_INCOMPLETE');
  }
}

async function loadModuleContext(client: SupabaseClient, moduleSlug: string) {
  const { data, error } = await contentClient(client)
    .from('training_modules')
    .select('id, slug, title, description, learning_material, is_published, is_assessment')
    .eq('slug', moduleSlug)
    .eq('is_published', true)
    .eq('is_assessment', false)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('MODULE_UNAVAILABLE');
  return data;
}

function localized(values: Record<string, string> | undefined, language: string) {
  if (!values) return '';
  return values[language] ?? values.en ?? Object.values(values)[0] ?? '';
}

function threatCategoryFromSlug(slug: string) {
  if (slug.includes('email') || slug.includes('phishing')) return 'email phishing and deceptive links';
  if (slug.includes('sms') || slug.includes('smishing')) return 'SMS and smishing';
  if (slug.includes('whatsapp') || slug.includes('social')) return 'messaging and social media impersonation';
  if (slug.includes('voice') || slug.includes('vishing') || slug.includes('call')) return 'voice phishing and call-centre fraud';
  if (slug.includes('job') || slug.includes('recruit')) return 'fake job offers and recruitment fraud';
  if (slug.includes('money') || slug.includes('payment') || slug.includes('eft') || slug.includes('invoice')) return 'payment and mobile-money fraud';
  if (slug.includes('password') || slug.includes('mfa')) return 'passwords and multi-factor abuse';
  return 'human cybersecurity risk';
}

async function applyPracticeToRiskProfile(client: SupabaseClient, userId: string, riskDimensions: string[], isCorrect: boolean) {
  if (!riskDimensions.length) return;
  const { data: profile, error } = await client.from('risk_profiles').select('strongest_dimension, focus_dimension, awareness_score, category_scores').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!profile) return;

  const categoryScores = { ...(profile.category_scores ?? {}) } as Record<string, 'strong' | 'weak'>;
  for (const dimension of riskDimensions) {
    categoryScores[dimension] = isCorrect ? 'strong' : 'weak';
  }
  const entries = Object.entries(categoryScores);
  const weak = entries.filter(([, score]) => score === 'weak').map(([dimension]) => dimension);
  const strong = entries.filter(([, score]) => score === 'strong').map(([dimension]) => dimension);
  const awarenessScore = entries.length ? Math.round((strong.length / entries.length) * 100) : profile.awareness_score;
  const { error: updateError } = await client.from('risk_profiles').update({
    category_scores: categoryScores,
    focus_dimension: weak[0] ?? profile.focus_dimension,
    strongest_dimension: strong[0] ?? profile.strongest_dimension,
    awareness_score: awarenessScore,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  if (updateError) throw updateError;
}

export async function generateAiPracticeScenario(client: SupabaseClient, user: User, input: z.infer<typeof aiPracticeGenerateSchema>) {
  const module = await loadModuleContext(client, input.moduleSlug);
  await assertManualModuleComplete(client, user.id, module.id);

  const title = localized(module.title as Record<string, string>, input.language);
  const description = localized(module.description as Record<string, string>, input.language);
  const material = (module.learning_material as Record<string, { whyItMatters?: string; warningSigns?: string; bestPractice?: string }> | null)?.[input.language]
    ?? (module.learning_material as Record<string, { whyItMatters?: string; warningSigns?: string; bestPractice?: string }> | null)?.en;

  const draft = await generatePracticeScenarioDraft({
    moduleSlug: module.slug,
    moduleTitle: title,
    moduleDescription: description,
    language: input.language,
    difficulty: input.difficulty,
    threatCategory: threatCategoryFromSlug(module.slug),
    learningObjectives: material ? [material.whyItMatters, material.warningSigns, material.bestPractice].filter(Boolean).join(' ') : description,
  });

  const slug = `ai-practice-${module.slug}-${randomUUID().slice(0, 8)}`;
  const content = {
    [input.language]: {
      title: draft.title,
      scenario: draft.scenario,
      channel: draft.channel ?? 'Training scenario',
      sender: draft.sender ?? 'MARICS scenario',
      message: draft.scenario,
    },
  };
  const options: PracticeOption[] = draft.options.map((option) => ({
    option_key: option.key,
    content: { [input.language]: option.text },
    is_correct: option.key === draft.correctOption,
    feedback: {
      [input.language]: {
        choice: option.key === draft.correctOption ? draft.correctResponse : 'That response leaves more risk on the table.',
        explanation: draft.explanation,
      },
    },
  }));
  const riskDimensions = [draft.manipulationTechnique].filter(Boolean);

  const { data: inserted, error: insertError } = await client.from('ai_practice_scenarios').insert({
    user_id: user.id,
    module_id: module.id,
    slug,
    language: input.language,
    content,
    risk_dimensions: riskDimensions,
    options,
    provider: 'claude',
    model: process.env.AI_MODEL ?? 'claude-3-5-haiku-latest',
  }).select('id, slug, content, risk_dimensions, options, language').single();
  if (insertError) throw insertError;

  return {
    id: inserted.id,
    slug: inserted.slug,
    source: 'ai' as const,
    content: inserted.content,
    riskDimensions: inserted.risk_dimensions ?? riskDimensions,
    module: { slug: module.slug, title: module.title },
    options: (inserted.options as PracticeOption[]).map(({ option_key, content: optionContent }) => ({ option_key, content: optionContent })),
  };
}

export async function getAiPracticeScenario(client: SupabaseClient, userId: string, scenarioSlug: string) {
  const { data, error } = await client
    .from('ai_practice_scenarios')
    .select('id, slug, content, risk_dimensions, options, language, module_id, training_modules!inner(slug, title)')
    .eq('slug', scenarioSlug)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('SCENARIO_UNAVAILABLE');
  const module = Array.isArray(data.training_modules) ? data.training_modules[0] : data.training_modules;
  return {
    id: data.id,
    slug: data.slug,
    source: 'ai' as const,
    content: data.content,
    riskDimensions: data.risk_dimensions ?? [],
    module: { slug: module.slug, title: module.title },
    options: (data.options as PracticeOption[]).map(({ option_key, content }) => ({ option_key, content })),
  };
}

export async function listAiPracticeScenarios(client: SupabaseClient, userId: string, moduleSlug: string) {
  const module = await loadModuleContext(client, moduleSlug);
  const { data, error } = await client
    .from('ai_practice_scenarios')
    .select('slug, content, created_at')
    .eq('user_id', userId)
    .eq('module_id', module.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const content = row.content as Record<string, { title?: string }>;
    const title = content.en?.title ?? content.af?.title ?? content.pt?.title ?? row.slug;
    return { slug: row.slug, title };
  });
}

export async function recordAiPracticeAnswer(client: SupabaseClient, user: User, scenarioSlug: string, input: z.infer<typeof aiPracticeAnswerSchema>) {
  const { data: scenario, error: scenarioError } = await client
    .from('ai_practice_scenarios')
    .select('id, module_id, risk_dimensions, options')
    .eq('slug', scenarioSlug)
    .eq('user_id', user.id)
    .maybeSingle();
  if (scenarioError) throw scenarioError;
  if (!scenario) throw new Error('SCENARIO_UNAVAILABLE');

  const options = scenario.options as PracticeOption[];
  const selected = options.find((option) => option.option_key === input.optionKey);
  const correct = options.find((option) => option.is_correct);
  if (!selected || !correct) throw new Error('SCENARIO_OPTIONS_INVALID');

  const { data: previousAttempts, error: previousError } = await client
    .from('ai_practice_attempts')
    .select('is_correct')
    .eq('user_id', user.id)
    .eq('ai_scenario_id', scenario.id);
  if (previousError) throw previousError;
  const wasAttempted = (previousAttempts ?? []).length > 0;
  const wasCorrect = (previousAttempts ?? []).some((attempt) => attempt.is_correct);

  const { error: attemptError } = await client.from('ai_practice_attempts').insert({
    user_id: user.id,
    ai_scenario_id: scenario.id,
    selected_option_key: input.optionKey,
    is_correct: selected.is_correct,
  });
  if (attemptError) throw attemptError;

  const { data: currentProgress, error: progressError } = await client
    .from('training_progress')
    .select('scenarios_attempted, scenarios_correct, completed_at, ai_scenarios_attempted, ai_scenarios_correct')
    .eq('user_id', user.id)
    .eq('module_id', scenario.module_id)
    .maybeSingle();
  if (progressError) throw progressError;

  const { data: progress, error: upsertError } = await client.from('training_progress').upsert({
    user_id: user.id,
    module_id: scenario.module_id,
    scenarios_attempted: currentProgress?.scenarios_attempted ?? 0,
    scenarios_correct: currentProgress?.scenarios_correct ?? 0,
    completed_at: currentProgress?.completed_at ?? null,
    ai_scenarios_attempted: (currentProgress?.ai_scenarios_attempted ?? 0) + (wasAttempted ? 0 : 1),
    ai_scenarios_correct: (currentProgress?.ai_scenarios_correct ?? 0) + (!wasCorrect && selected.is_correct ? 1 : 0),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,module_id' }).select('scenarios_attempted, scenarios_correct, ai_scenarios_attempted, ai_scenarios_correct, completed_at, updated_at').single();
  if (upsertError) throw upsertError;

  await applyPracticeToRiskProfile(client, user.id, scenario.risk_dimensions ?? [], selected.is_correct);

  const languageKeys = Object.keys(selected.feedback ?? {});
  const language = languageKeys.includes('en') ? 'en' : languageKeys[0] ?? 'en';
  return {
    isCorrect: selected.is_correct,
    feedback: Object.fromEntries(Object.entries(selected.feedback).map(([key, value]) => [key, value.choice])),
    explanation: Object.fromEntries(Object.entries(correct.feedback).map(([key, value]) => [key, value.explanation])),
    correctOptionKey: correct.option_key,
    progress,
    source: 'ai' as const,
    language,
  };
}

export async function getAiPracticeSummary(client: SupabaseClient, userId: string) {
  const [{ data: attempts, error: attemptsError }, { data: progress, error: progressError }] = await Promise.all([
    client.from('ai_practice_attempts').select('is_correct, created_at, ai_scenario_id').eq('user_id', userId).order('created_at', { ascending: false }),
    client.from('training_progress').select('module_id, ai_scenarios_attempted, ai_scenarios_correct'),
  ]);
  if (attemptsError) throw attemptsError;
  if (progressError) throw progressError;
  return {
    attempted: (attempts ?? []).length,
    correct: (attempts ?? []).filter((attempt) => attempt.is_correct).length,
    lastAttemptAt: attempts?.[0]?.created_at ?? null,
    byModule: Object.fromEntries((progress ?? []).map((row) => [row.module_id, { attempted: row.ai_scenarios_attempted ?? 0, correct: row.ai_scenarios_correct ?? 0 }])),
  };
}
