import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ai.js', () => ({
  generatePracticeScenarioDraft: vi.fn(async () => ({
    title: 'Unexpected bank OTP request',
    scenario: 'A message claims your bank needs an OTP to stop a transfer.',
    options: [
      { key: 'A', text: 'Send the OTP so the transfer is cancelled.' },
      { key: 'B', text: 'Ignore the message and contact the bank through a known channel.' },
      { key: 'C', text: 'Forward the OTP to a colleague for advice.' },
      { key: 'D', text: 'Call the number in the message immediately.' },
    ],
    correctOption: 'B',
    explanation: 'Banks never ask for OTPs through unexpected messages.',
    manipulationTechnique: 'Urgency',
    attackerObjective: 'Capture a one-time password.',
    correctResponse: 'Use a known official channel instead of the message.',
    channel: 'SMS',
    sender: 'Bank Alert',
  })),
}));

import { generateAiPracticeScenario } from './aiPractice.js';

describe('ai practice generation gate', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  });

  it('refuses generation until every manual scenario is attempted', async () => {
    const client = {
      from(table: string) {
        if (table === 'training_modules') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({
              data: { id: 'm1', slug: 'phishing-email-fundamentals', title: { en: 'Phishing' }, description: { en: 'Inspect' }, learning_material: null, is_published: true, is_assessment: false },
              error: null,
            }),
          };
        }
        if (table === 'scenarios') {
          return {
            select() { return this; },
            eq: async () => ({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
          };
        }
        if (table === 'training_attempts') {
          return {
            select() { return this; },
            eq() { return this; },
            in: async () => ({ data: [{ scenario_id: 's1' }], error: null }),
          };
        }
        throw new Error(table);
      },
    };

    await expect(generateAiPracticeScenario(client as never, { id: 'u1' } as never, {
      moduleSlug: 'phishing-email-fundamentals',
      language: 'en',
      difficulty: 'intermediate',
    })).rejects.toThrow('MANUAL_SCENARIOS_INCOMPLETE');
  });

  it('creates a fresh AI practice scenario after manuals are complete', async () => {
    const client = {
      from(table: string) {
        if (table === 'training_modules') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({
              data: {
                id: 'm1',
                slug: 'phishing-email-fundamentals',
                title: { en: 'Phishing Email Fundamentals' },
                description: { en: 'Inspect email' },
                learning_material: { en: { whyItMatters: 'why', warningSigns: 'signs', bestPractice: 'practice' } },
                is_published: true,
                is_assessment: false,
              },
              error: null,
            }),
          };
        }
        if (table === 'scenarios') {
          return {
            select() { return this; },
            eq: async () => ({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
          };
        }
        if (table === 'training_attempts') {
          return {
            select() { return this; },
            eq() { return this; },
            in: async () => ({ data: [{ scenario_id: 's1' }, { scenario_id: 's2' }], error: null }),
          };
        }
        if (table === 'ai_practice_scenarios') {
          return {
            insert(payload: Record<string, unknown>) {
              return {
                select() {
                  return {
                    single: async () => ({
                      data: {
                        id: 'ai-1',
                        slug: payload.slug,
                        content: payload.content,
                        risk_dimensions: payload.risk_dimensions,
                        options: payload.options,
                        language: payload.language,
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }
        throw new Error(table);
      },
    };

    const scenario = await generateAiPracticeScenario(client as never, { id: 'u1' } as never, {
      moduleSlug: 'phishing-email-fundamentals',
      language: 'en',
      difficulty: 'intermediate',
    });
    expect(scenario.source).toBe('ai');
    expect(scenario.slug.startsWith('ai-practice-phishing-email-fundamentals-')).toBe(true);
    expect(scenario.options).toHaveLength(4);
  });
});
