import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServiceClient } from '../lib/supabase.js';

export const trainingAnswerSchema = z.object({ optionKey: z.enum(['A', 'B', 'C']) });

type LocalizedText = Record<string, string>;
type FeedbackLeaf = string | { choice?: string; explanation?: string };

function publicContentClient(client: SupabaseClient) {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceClient() : client;
}

export function splitOptionFeedback(feedback: Record<string, FeedbackLeaf>): { choice: LocalizedText; explanation: LocalizedText } {
  const choice: LocalizedText = {};
  const explanation: LocalizedText = {};
  for (const [language, value] of Object.entries(feedback)) {
    if (typeof value === 'string') {
      choice[language] = value;
      explanation[language] = value;
      continue;
    }
    if (value.choice) choice[language] = value.choice;
    if (value.explanation) explanation[language] = value.explanation;
    else if (value.choice) explanation[language] = value.choice;
  }
  return { choice, explanation };
}

export async function listPublishedModules(client: SupabaseClient) {
  const { data, error } = await publicContentClient(client)
    .from('training_modules')
    .select('id, slug, title, description, is_published, scenarios(id, slug)')
    .eq('is_published', true)
    .eq('is_assessment', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((module) => ({
    id: module.id,
    slug: module.slug,
    title: module.title,
    description: module.description,
    scenarioCount: Array.isArray(module.scenarios) ? module.scenarios.length : 0,
    scenarioSlugs: Array.isArray(module.scenarios) ? module.scenarios.map((scenario) => scenario.slug).filter((slug): slug is string => Boolean(slug)) : [],
  }));
}

export async function getScenario(client: SupabaseClient, scenarioSlug: string) {
  const { data, error } = await publicContentClient(client)
    .from('scenarios')
    .select('id, slug, content, risk_dimensions, training_modules!inner(slug, title), scenario_options(option_key, content)')
    .eq('slug', scenarioSlug)
    .eq('training_modules.is_published', true)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    slug: data.slug,
    content: data.content,
    riskDimensions: data.risk_dimensions,
    module: Array.isArray(data.training_modules) ? data.training_modules[0] : data.training_modules,
    options: data.scenario_options,
  };
}

export async function recordTrainingAnswer(client: SupabaseClient, user: User, scenarioSlug: string, input: z.infer<typeof trainingAnswerSchema>) {
  const { data: scenario, error: scenarioError } = await publicContentClient(client).from('scenarios').select('id, module_id').eq('slug', scenarioSlug).single();
  if (scenarioError) throw scenarioError;
  const { data: options, error: optionsError } = await publicContentClient(client).from('scenario_options').select('id, option_key, is_correct, feedback').eq('scenario_id', scenario.id);
  if (optionsError) throw optionsError;
  const selected = options.find((option) => option.option_key === input.optionKey);
  const correct = options.find((option) => option.is_correct);
  if (!selected || !correct) throw new Error('SCENARIO_OPTIONS_INVALID');
  const selectedFeedback = splitOptionFeedback(selected.feedback as Record<string, FeedbackLeaf>);
  const correctFeedback = splitOptionFeedback(correct.feedback as Record<string, FeedbackLeaf>);
  const { error: attemptError } = await client.from('training_attempts').insert({ user_id: user.id, scenario_id: scenario.id, selected_option_id: selected.id, is_correct: selected.is_correct });
  if (attemptError) throw attemptError;
  const { data: currentProgress, error: currentProgressError } = await client.from('training_progress').select('scenarios_attempted, scenarios_correct').eq('user_id', user.id).eq('module_id', scenario.module_id).maybeSingle();
  if (currentProgressError) throw currentProgressError;
  const { data: progress, error: progressError } = await client.from('training_progress').upsert({ user_id: user.id, module_id: scenario.module_id, scenarios_attempted: (currentProgress?.scenarios_attempted ?? 0) + 1, scenarios_correct: (currentProgress?.scenarios_correct ?? 0) + (selected.is_correct ? 1 : 0), updated_at: new Date().toISOString() }, { onConflict: 'user_id,module_id' }).select('scenarios_attempted, scenarios_correct, updated_at').single();
  if (progressError) throw progressError;
  return {
    isCorrect: selected.is_correct,
    feedback: selectedFeedback.choice,
    explanation: correctFeedback.explanation,
    correctOptionKey: correct.option_key as 'A' | 'B' | 'C',
    progress,
  };
}

export async function getTrainingSummary(client: SupabaseClient, userId: string) {
  const [{ data: attempts, error: attemptsError }, { data: modules, error: modulesError }, { data: progress, error: progressError }, { data: riskProfile, error: riskProfileError }] = await Promise.all([
    client.from('training_attempts').select('is_correct, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    publicContentClient(client).from('training_modules').select('id, slug, title, scenarios(id, risk_dimensions)').eq('is_published', true).eq('is_assessment', false).order('created_at', { ascending: true }),
    client.from('training_progress').select('module_id, scenarios_attempted, scenarios_correct, completed_at').eq('user_id', userId),
    client.from('risk_profiles').select('focus_dimension').eq('user_id', userId).maybeSingle(),
  ]);
  if (attemptsError) throw attemptsError;
  if (modulesError) throw modulesError;
  if (progressError) throw progressError;
  if (riskProfileError) throw riskProfileError;
  const progressByModule = new Map(progress.map((item) => [item.module_id, item]));
  const moduleProgress = modules.map((module) => {
    const saved = progressByModule.get(module.id);
    const scenarioCount = Array.isArray(module.scenarios) ? module.scenarios.length : 0;
    return { id: module.id, slug: module.slug, title: module.title, scenarioCount, scenariosAttempted: saved?.scenarios_attempted ?? 0, scenariosCorrect: saved?.scenarios_correct ?? 0, completed: Boolean(saved?.completed_at) || (scenarioCount > 0 && (saved?.scenarios_attempted ?? 0) >= scenarioCount), riskDimensions: Array.isArray(module.scenarios) ? module.scenarios.flatMap((scenario) => scenario.risk_dimensions ?? []) : [] };
  });
  const focus = riskProfile?.focus_dimension?.toLowerCase();
  const recommended = moduleProgress.find((module) => !module.completed && focus && module.riskDimensions.some((dimension) => dimension.toLowerCase() === focus)) ?? moduleProgress.find((module) => !module.completed) ?? null;
  return {
    attempted: attempts.length,
    correct: attempts.filter((attempt) => attempt.is_correct).length,
    lastAttemptAt: attempts[0]?.created_at ?? null,
    modules: moduleProgress.map(({ riskDimensions: _riskDimensions, ...module }) => module),
    recommendation: recommended ? { slug: recommended.slug, title: recommended.title, reason: focus && recommended.riskDimensions.some((dimension) => dimension.toLowerCase() === focus) ? 'focus-area' : 'next-unfinished' } : null,
  };
}