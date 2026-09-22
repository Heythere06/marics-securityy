import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServiceClient } from '../lib/supabase.js';

export const ASSESSMENT_SCENARIO_ORDER = [
  'urgency',
  'authority',
  'curiosity',
  'fear',
  'trust',
  'scarcity',
  'social_pressure',
  'financial_manipulation',
  'credential_theft',
  'impersonation',
] as const;

export const assessmentSubmissionSchema = z.object({
  answers: z.array(z.object({
    scenarioSlug: z.enum(ASSESSMENT_SCENARIO_ORDER),
    optionKey: z.enum(['A', 'B', 'C']),
  })).length(10),
});

type ScoredAnswer = { dimension: string; isCorrect: boolean; scenarioSlug: string };

export function buildRiskProfileFromAnswers(answers: ScoredAnswer[]) {
  const categoryScores: Record<string, 'strong' | 'weak'> = {};
  for (const answer of answers) {
    categoryScores[answer.dimension] = answer.isCorrect ? 'strong' : 'weak';
  }
  const weakDimensions = answers.filter((answer) => !answer.isCorrect).map((answer) => answer.dimension);
  const strongDimensions = answers.filter((answer) => answer.isCorrect).map((answer) => answer.dimension);
  const focusDimension = weakDimensions[0] ?? 'Continued practice';
  const strongestDimension = strongDimensions[0] ?? 'Verification habits';
  const awarenessScore = Math.round((strongDimensions.length / answers.length) * 100);
  return {
    category_scores: categoryScores,
    focus_dimension: focusDimension,
    strongest_dimension: strongestDimension,
    awareness_score: awarenessScore,
  };
}

export async function getOnboardingAssessment(client: SupabaseClient) {
  const { data, error } = await client.rpc('get_onboarding_assessment');
  if (error) throw error;
  const scenarios = (data ?? []) as Array<{
    slug: string;
    content: Record<string, { title?: string; scenario?: string }>;
    riskDimensions: string[];
    options: Array<{ optionKey: 'A' | 'B' | 'C'; content: Record<string, string> }>;
  }>;
  const order = new Map(ASSESSMENT_SCENARIO_ORDER.map((slug, index) => [slug, index]));
  return scenarios.sort((left, right) => (order.get(left.slug as typeof ASSESSMENT_SCENARIO_ORDER[number]) ?? 0) - (order.get(right.slug as typeof ASSESSMENT_SCENARIO_ORDER[number]) ?? 0));
}

export async function submitAssessment(client: SupabaseClient, user: User, input: z.infer<typeof assessmentSubmissionSchema>) {
  const contentClient = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceClient() : client;
  const { data: scenarios, error: scenarioError } = await contentClient
    .from('scenarios')
    .select('id, slug, risk_dimensions, scenario_options(option_key, is_correct)')
    .in('slug', [...ASSESSMENT_SCENARIO_ORDER]);
  if (scenarioError) throw scenarioError;
  const scenarioBySlug = new Map(scenarios.map((scenario) => [scenario.slug, scenario]));
  const scoredAnswers: ScoredAnswer[] = input.answers.map((answer) => {
    const scenario = scenarioBySlug.get(answer.scenarioSlug);
    if (!scenario) throw new Error('ASSESSMENT_SCENARIO_INVALID');
    const options = Array.isArray(scenario.scenario_options) ? scenario.scenario_options : [];
    const selected = options.find((option) => option.option_key === answer.optionKey);
    if (!selected) throw new Error('ASSESSMENT_OPTION_INVALID');
    const dimension = Array.isArray(scenario.risk_dimensions) ? scenario.risk_dimensions[0] : answer.scenarioSlug;
    return { dimension, isCorrect: selected.is_correct, scenarioSlug: answer.scenarioSlug };
  });

  const profileFields = buildRiskProfileFromAnswers(scoredAnswers);

  const { data: assessment, error: assessmentError } = await client
    .from('assessments')
    .insert({ user_id: user.id, completed_at: new Date().toISOString() })
    .select('id')
    .single();
  if (assessmentError) throw assessmentError;

  const { error: answersError } = await client.from('assessment_answers').insert(scoredAnswers.map((answer, index) => ({
    assessment_id: assessment.id,
    question_key: input.answers[index].scenarioSlug,
    selected_option: input.answers[index].optionKey === 'A' ? 0 : input.answers[index].optionKey === 'B' ? 1 : 2,
    risk_dimension: answer.dimension,
    is_correct: answer.isCorrect,
  })));
  if (answersError) throw answersError;

  const { data: profile, error: profileError } = await client.from('risk_profiles').upsert({
    user_id: user.id,
    strongest_dimension: profileFields.strongest_dimension,
    focus_dimension: profileFields.focus_dimension,
    awareness_score: profileFields.awareness_score,
    category_scores: profileFields.category_scores,
    updated_at: new Date().toISOString(),
  }).select('strongest_dimension, focus_dimension, awareness_score, category_scores, updated_at').single();
  if (profileError) throw profileError;
  return profile;
}
