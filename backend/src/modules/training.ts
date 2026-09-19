import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const trainingAnswerSchema = z.object({ optionKey: z.enum(['A', 'B', 'C']) });

export async function recordTrainingAnswer(client: SupabaseClient, user: User, scenarioSlug: string, input: z.infer<typeof trainingAnswerSchema>) {
  const { data: scenario, error: scenarioError } = await client.from('scenarios').select('id, module_id').eq('slug', scenarioSlug).single();
  if (scenarioError) throw scenarioError;
  const { data: option, error: optionError } = await client.from('scenario_options').select('id, is_correct').eq('scenario_id', scenario.id).eq('option_key', input.optionKey).single();
  if (optionError) throw optionError;
  const { error: attemptError } = await client.from('training_attempts').insert({ user_id: user.id, scenario_id: scenario.id, selected_option_id: option.id, is_correct: option.is_correct });
  if (attemptError) throw attemptError;
  const { data: currentProgress, error: currentProgressError } = await client.from('training_progress').select('scenarios_attempted, scenarios_correct').eq('user_id', user.id).eq('module_id', scenario.module_id).maybeSingle();
  if (currentProgressError) throw currentProgressError;
  const { data: progress, error: progressError } = await client.from('training_progress').upsert({ user_id: user.id, module_id: scenario.module_id, scenarios_attempted: (currentProgress?.scenarios_attempted ?? 0) + 1, scenarios_correct: (currentProgress?.scenarios_correct ?? 0) + (option.is_correct ? 1 : 0), updated_at: new Date().toISOString() }, { onConflict: 'user_id,module_id' }).select('scenarios_attempted, scenarios_correct, updated_at').single();
  if (progressError) throw progressError;
  return { isCorrect: option.is_correct, progress };
}

export async function getTrainingSummary(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('training_attempts').select('is_correct, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return { attempted: data.length, correct: data.filter((attempt) => attempt.is_correct).length, lastAttemptAt: data[0]?.created_at ?? null };
}