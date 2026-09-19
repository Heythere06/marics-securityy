import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const scenarioGenerationSchema = z.object({
  moduleSlug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  language: z.enum(['en', 'af', 'pt']).default('en'),
  context: z.string().trim().min(1).max(500).optional(),
});

const generatedScenarioSchema = z.object({
  title: z.string().min(1).max(160),
  scenario: z.string().min(1).max(1500),
  options: z.array(z.object({ key: z.enum(['A', 'B', 'C']), text: z.string().min(1).max(400) })).length(3),
  correctOption: z.enum(['A', 'B', 'C']),
  explanation: z.string().min(1).max(1200),
  manipulationTechnique: z.string().min(1).max(200),
  attackerObjective: z.string().min(1).max(400),
  correctResponse: z.string().min(1).max(500),
});

type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;

function getClaude() {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) throw new Error('AI_NOT_CONFIGURED');
  return new Anthropic({ apiKey });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? text;
  return JSON.parse(candidate.trim());
}

function buildPrompt(moduleSlug: string, language: string, context?: string) {
  return `Generate one realistic cybersecurity awareness scenario for the module "${moduleSlug}" in language "${language}".${context ? ` Context: ${context}` : ''}

Return ONLY valid JSON with exactly these fields: title, scenario, options, correctOption, explanation, manipulationTechnique, attackerObjective, correctResponse.
options must be exactly three objects with keys A, B, and C. Make one option clearly safest, but do not make the answer obvious from wording. Keep it appropriate for awareness training, locally realistic, and never request real credentials or personal data.`;
}

export async function generateScenario(client: SupabaseClient, user: User, input: z.infer<typeof scenarioGenerationSchema>): Promise<GeneratedScenario> {
  const promptKey = `${input.moduleSlug}:${input.language}:${input.context ?? ''}`;
  const { data: cached, error: cacheError } = await client.from('generated_content').select('content').eq('requested_by', user.id).eq('module_slug', input.moduleSlug).eq('language', input.language).eq('prompt_key', promptKey).maybeSingle();
  if (cacheError) throw cacheError;
  if (cached) return generatedScenarioSchema.parse(cached.content);

  const model = process.env.AI_MODEL ?? 'claude-3-5-haiku-latest';
  const maxTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 1200);
  const message = await getClaude().messages.create({ model, max_tokens: maxTokens, temperature: 0.7, system: 'You create safe, realistic cybersecurity awareness content. Never provide operational instructions for wrongdoing.', messages: [{ role: 'user', content: buildPrompt(input.moduleSlug, input.language, input.context) }] });
  const text = message.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('AI_INVALID_OUTPUT');
  const content = generatedScenarioSchema.parse(extractJson(text));

  const { error: insertError } = await client.from('generated_content').insert({ requested_by: user.id, module_slug: input.moduleSlug, language: input.language, prompt_key: promptKey, content, provider: 'claude', model });
  if (insertError && insertError.code !== '23505') throw insertError;
  return content;
}