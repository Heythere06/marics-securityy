import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const assessmentSubmissionSchema = z.object({
  answers: z.array(z.object({
    questionKey: z.string().min(1).max(80),
    selectedOption: z.number().int().min(0).max(2),
    riskDimension: z.string().min(1).max(80),
  })).length(10),
});

const correctOptions: Record<string, number> = {
  urgency: 1,
  authority: 2,
  curiosity: 0,
  fear: 1,
  trust: 2,
  scarcity: 1,
  social_pressure: 2,
  financial_manipulation: 0,
  credential_theft: 1,
  impersonation: 2,
};

export async function submitAssessment(client: SupabaseClient, user: User, input: z.infer<typeof assessmentSubmissionSchema>) {
  const scoredAnswers = input.answers.map((answer) => ({
    ...answer,
    isCorrect: correctOptions[answer.questionKey] === answer.selectedOption,
  }));
  const correctCount = scoredAnswers.filter((answer) => answer.isCorrect).length;
  const focus = scoredAnswers.find((answer) => !answer.isCorrect)?.riskDimension ?? 'Continued practice';
  const strongest = scoredAnswers.find((answer) => answer.isCorrect)?.riskDimension ?? 'Verification habits';
  const awarenessScore = Math.round((correctCount / scoredAnswers.length) * 100);

  const { data: assessment, error: assessmentError } = await client
    .from('assessments')
    .insert({ user_id: user.id, completed_at: new Date().toISOString() })
    .select('id')
    .single();
  if (assessmentError) throw assessmentError;

  const { error: answersError } = await client.from('assessment_answers').insert(scoredAnswers.map((answer) => ({
    assessment_id: assessment.id,
    question_key: answer.questionKey,
    selected_option: answer.selectedOption,
    risk_dimension: answer.riskDimension,
    is_correct: answer.isCorrect,
  })));
  if (answersError) throw answersError;

  const { data: profile, error: profileError } = await client.from('risk_profiles').upsert({
    user_id: user.id,
    strongest_dimension: strongest,
    focus_dimension: focus,
    awareness_score: awarenessScore,
    updated_at: new Date().toISOString(),
  }).select('strongest_dimension, focus_dimension, awareness_score, updated_at').single();
  if (profileError) throw profileError;
  return profile;
}