import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { requireScoringClient } from '../lib/supabase.js';

export const QUESTION_COUNT = 30;
export const PASS_PERCENT = 80;
export const TIME_LIMIT_MINUTES = 20;

export const CERTIFICATION_GATE = {
  questionCount: QUESTION_COUNT,
  passPercent: PASS_PERCENT,
  timeLimitMinutes: TIME_LIMIT_MINUTES,
} as const;

export const certificationSubmissionSchema = z.object({
  assessmentId: z.string().uuid(),
  answers: z.array(z.object({ scenarioId: z.string().uuid(), optionKey: z.enum(['A', 'B', 'C', 'D']) })).length(QUESTION_COUNT).refine((answers) => new Set(answers.map((answer) => answer.scenarioId)).size === QUESTION_COUNT, 'Each certification question must be answered once.'),
});

type CertificationQuestion = {
  scenarioId: string;
  content: Record<string, { title?: string; scenario?: string }>;
  options: Array<{ id: string; optionKey: 'A' | 'B' | 'C' | 'D'; content: Record<string, string>; isCorrect: boolean }>;
};

async function hasCompletedTraining(client: SupabaseClient, userId: string) {
  const scoring = requireScoringClient(client);
  const [{ data: modules, error: modulesError }, { data: progress, error: progressError }] = await Promise.all([
    scoring.from('training_modules').select('id').eq('is_published', true).eq('is_assessment', false),
    client.from('training_progress').select('module_id, completed_at').eq('user_id', userId),
  ]);
  if (modulesError) throw modulesError;
  if (progressError) throw progressError;
  const completed = new Set((progress ?? []).filter((item) => item.completed_at).map((item) => item.module_id));
  return (modules ?? []).length > 0 && (modules ?? []).every((module) => completed.has(module.id));
}

function mapScenarioRows(data: Array<{
  id: string;
  content: Record<string, { title?: string; scenario?: string }>;
  scenario_options: Array<{ id: string; option_key: 'A' | 'B' | 'C' | 'D'; content: Record<string, string>; is_correct: boolean }>;
}>): CertificationQuestion[] {
  return data.map((scenario) => ({
    scenarioId: scenario.id,
    content: scenario.content,
    options: scenario.scenario_options.map((option) => ({
      id: option.id,
      optionKey: option.option_key,
      content: option.content,
      isCorrect: option.is_correct,
    })),
  }));
}

async function loadQuestions(client: SupabaseClient): Promise<CertificationQuestion[]> {
  const scoring = requireScoringClient(client);
  const { data, error } = await scoring
    .from('scenarios')
    .select('id, content, training_modules!inner(is_published, is_assessment), scenario_options(id, option_key, content, is_correct)')
    .eq('training_modules.is_published', true)
    .eq('training_modules.is_assessment', false)
    .order('created_at', { ascending: true })
    .limit(QUESTION_COUNT);
  if (error) throw error;
  if (!data || data.length < QUESTION_COUNT) throw new Error('CERTIFICATION_QUESTION_POOL_TOO_SMALL');
  return mapScenarioRows(data);
}

async function loadQuestionsByIds(client: SupabaseClient, questionIds: string[]): Promise<CertificationQuestion[]> {
  const scoring = requireScoringClient(client);
  if (questionIds.length !== QUESTION_COUNT) throw new Error('CERTIFICATION_QUESTION_INVALID');
  const { data, error } = await scoring
    .from('scenarios')
    .select('id, content, scenario_options(id, option_key, content, is_correct)')
    .in('id', questionIds);
  if (error) throw error;
  if (!data || data.length !== QUESTION_COUNT) throw new Error('CERTIFICATION_QUESTION_INVALID');
  const byId = new Map(mapScenarioRows(data).map((question) => [question.scenarioId, question]));
  return questionIds.map((id) => {
    const question = byId.get(id);
    if (!question) throw new Error('CERTIFICATION_QUESTION_INVALID');
    return question;
  });
}

function toPublicQuestions(questions: CertificationQuestion[]) {
  return questions.map((question) => ({
    scenarioId: question.scenarioId,
    content: question.content,
    options: question.options.map(({ id, optionKey, content }) => ({ id, optionKey, content })),
  }));
}

export async function startCertificationAssessment(client: SupabaseClient, user: User) {
  if (!(await hasCompletedTraining(client, user.id))) throw new Error('TRAINING_REQUIRED');
  const scoring = requireScoringClient(client);
  const nowIso = new Date().toISOString();

  const { data: active, error: activeError } = await client
    .from('certification_assessments')
    .select('id, expires_at, question_ids')
    .eq('user_id', user.id)
    .is('completed_at', null)
    .gt('expires_at', nowIso)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;

  if (active?.question_ids && Array.isArray(active.question_ids) && active.question_ids.length === QUESTION_COUNT) {
    const questions = await loadQuestionsByIds(client, active.question_ids as string[]);
    return {
      assessmentId: active.id,
      expiresAt: active.expires_at,
      timeLimitMinutes: TIME_LIMIT_MINUTES,
      passPercent: PASS_PERCENT,
      questions: toPublicQuestions(questions),
    };
  }

  // Expire any other open attempts so only one active assessment exists.
  const { error: expireError } = await scoring
    .from('certification_assessments')
    .update({ expires_at: nowIso })
    .eq('user_id', user.id)
    .is('completed_at', null)
    .gt('expires_at', nowIso);
  if (expireError) throw expireError;

  const questions = await loadQuestions(client);
  const questionIds = questions.map((question) => question.scenarioId);
  const expiresAt = new Date(Date.now() + TIME_LIMIT_MINUTES * 60_000).toISOString();
  const { data: assessment, error } = await scoring
    .from('certification_assessments')
    .insert({ user_id: user.id, expires_at: expiresAt, question_ids: questionIds })
    .select('id, expires_at')
    .single();
  if (error) throw error;
  return {
    assessmentId: assessment.id,
    expiresAt: assessment.expires_at,
    timeLimitMinutes: TIME_LIMIT_MINUTES,
    passPercent: PASS_PERCENT,
    questions: toPublicQuestions(questions),
  };
}

export async function submitCertificationAssessment(client: SupabaseClient, user: User, input: z.infer<typeof certificationSubmissionSchema>) {
  const scoring = requireScoringClient(client);
  const { data: assessment, error: assessmentError } = await client
    .from('certification_assessments')
    .select('id, expires_at, completed_at, question_ids')
    .eq('id', input.assessmentId)
    .eq('user_id', user.id)
    .single();
  if (assessmentError) throw assessmentError;
  if (assessment.completed_at) throw new Error('CERTIFICATION_ALREADY_SUBMITTED');
  if (Date.now() > Date.parse(assessment.expires_at)) throw new Error('CERTIFICATION_EXPIRED');

  const boundIds = Array.isArray(assessment.question_ids) ? (assessment.question_ids as string[]) : [];
  const questions = boundIds.length === QUESTION_COUNT
    ? await loadQuestionsByIds(client, boundIds)
    : await loadQuestions(client);
  const questionById = new Map(questions.map((question) => [question.scenarioId, question]));
  if (input.answers.some((answer) => !questionById.has(answer.scenarioId))) throw new Error('CERTIFICATION_QUESTION_INVALID');
  if (boundIds.length === QUESTION_COUNT) {
    const answerIds = input.answers.map((answer) => answer.scenarioId);
    const sameSet = boundIds.length === answerIds.length && boundIds.every((id) => answerIds.includes(id));
    if (!sameSet) throw new Error('CERTIFICATION_QUESTION_INVALID');
  }
  const scored = input.answers.map((answer) => {
    const question = questionById.get(answer.scenarioId);
    if (!question) throw new Error('CERTIFICATION_QUESTION_INVALID');
    const selected = question.options.find((option) => option.optionKey === answer.optionKey);
    if (!selected) throw new Error('CERTIFICATION_OPTION_INVALID');
    return { scenarioId: answer.scenarioId, optionKey: answer.optionKey, isCorrect: selected.isCorrect, selectedOptionId: selected.id };
  });
  const correct = scored.filter((answer) => answer.isCorrect).length;
  const score = Math.round((correct / QUESTION_COUNT) * 100);
  const passed = score >= PASS_PERCENT;
  const { error: answersError } = await scoring.from('certification_answers').insert(scored.map((answer) => ({
    assessment_id: input.assessmentId,
    scenario_id: answer.scenarioId,
    selected_option_id: answer.selectedOptionId,
    is_correct: answer.isCorrect,
  })));
  if (answersError) throw answersError;
  const { error: updateError } = await scoring.from('certification_assessments').update({ completed_at: new Date().toISOString(), score, passed }).eq('id', input.assessmentId).eq('user_id', user.id);
  if (updateError) throw updateError;
  return { score, passed, passPercent: PASS_PERCENT };
}

export async function hasPassedCertification(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('certification_assessments').select('id').eq('user_id', userId).eq('passed', true).not('completed_at', 'is', null).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
