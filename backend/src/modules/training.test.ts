import { describe, expect, it } from 'vitest';
import { getScenario, getTrainingSummary, listPublishedModules, recordTrainingAnswer, splitOptionFeedback, trainingAnswerSchema } from './training.js';
import { hasAttemptedEveryScenario } from './certificates.js';
import { adminModuleUpdateSchema } from './admin.js';
import { scenarioWhySchema } from './ai.js';

function createQuery<T>(data: T, calls: string[]) {
  const query = {
    select(selection: string) {
      calls.push(`select:${selection}`);
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return query;
    },
    order() {
      return query;
    },
    maybeSingle() {
      return Promise.resolve({ data, error: null });
    },
    then(resolve: (result: { data: T; error: null }) => unknown) {
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
  return query;
}

describe('training answer explanations', () => {
  it('accepts all four answer keys and rejects unsupported keys', () => {
    expect(trainingAnswerSchema.parse({ optionKey: 'D' }).optionKey).toBe('D');
    expect(() => trainingAnswerSchema.parse({ optionKey: 'E' })).toThrow();
  });

  it('returns choice feedback and a threat-focused explanation from structured option feedback', () => {
    const parsed = splitOptionFeedback({
      en: {
        choice: 'The pressure to act quickly is a warning sign.',
        explanation: 'Verify through a trusted channel before sending money or codes.',
      },
    });

    expect(parsed.choice.en).toContain('pressure');
    expect(parsed.explanation.en).toContain('trusted channel');
  });

  it('supports legacy plain-string feedback', () => {
    const parsed = splitOptionFeedback({ en: 'Verify through a known phone number or in person.' });
    expect(parsed.choice.en).toBe(parsed.explanation.en);
  });
});

describe('localized module learning material', () => {
  const block = { whyItMatters: 'Attackers exploit trust to prompt unsafe action.', warningSigns: 'Look for unusual pressure or requests.', bestPractice: 'Pause and verify independently.' };

  it('accepts a single-language edit so authors can complete translations one at a time', () => {
    const result = adminModuleUpdateSchema.parse({ title: { en: 'Module' }, description: { en: 'Description' }, published: false, learningMaterial: { af: block } });
    expect(result.learningMaterial.af).toEqual(block);
  });

  it('rejects incomplete or unsupported learning-material translations', () => {
    expect(() => adminModuleUpdateSchema.parse({ title: {}, description: {}, published: false, learningMaterial: { en: { ...block, bestPractice: '' } } })).toThrow();
    expect(() => adminModuleUpdateSchema.parse({ title: {}, description: {}, published: false, learningMaterial: { fr: block } })).toThrow();
  });

  it('includes module learning material in the published learner catalog', async () => {
    const savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const learningMaterial = { en: block };
      const client = { from: () => createQuery([{ id: 'module-a', slug: 'module-a', title: { en: 'Module A' }, description: { en: 'Description' }, learning_material: learningMaterial, scenarios: [{ id: 'scenario-a', slug: 'scenario-a' }] }], []) };
      const [module] = await listPublishedModules(client as never);
      expect(module.learningMaterial).toEqual(learningMaterial);
      expect(module.scenarioSlugs).toEqual(['scenario-a']);
    } finally {
      if (savedServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey;
    }
  });
});

describe('learner training scenario access', () => {
  it('returns published learner scenarios without exposing assessment module fields', async () => {
    const savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const calls: string[] = [];
    const moduleTitle = { en: 'Phishing' };
    const scenario = {
      id: 'scenario-a',
      slug: 'phishing-a',
      content: { en: { title: 'A message', scenario: 'Review this message.' } },
      risk_dimensions: ['Urgency'],
      training_modules: { slug: 'phishing', title: moduleTitle, is_published: true, is_assessment: false },
      scenario_options: [],
    };
    try {
      const result = await getScenario({ from: () => createQuery(scenario, calls) } as never, 'phishing-a');

      expect(result.module).toEqual({ slug: 'phishing', title: moduleTitle });
      expect(calls).toContain('eq:training_modules.is_published:true');
      expect(calls).toContain('eq:training_modules.is_assessment:false');
    } finally {
      if (savedServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey;
    }
  });

  it('excludes assessment modules from scenario lookup and answer submission', async () => {
    const savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const lookupCalls: string[] = [];
    const lookupClient = { from: () => createQuery(null, lookupCalls) };
    try {
      await expect(getScenario(lookupClient as never, 'urgency')).rejects.toThrow('SCENARIO_UNAVAILABLE');
      expect(lookupCalls).toContain('eq:training_modules.is_published:true');
      expect(lookupCalls).toContain('eq:training_modules.is_assessment:false');

      const answerCalls: string[] = [];
      const answerClient = { from: () => createQuery(null, answerCalls) };
      await expect(recordTrainingAnswer(answerClient as never, {} as never, 'urgency', { optionKey: 'A' })).rejects.toThrow('SCENARIO_UNAVAILABLE');
      expect(answerCalls).toContain('eq:training_modules.is_published:true');
      expect(answerCalls).toContain('eq:training_modules.is_assessment:false');
    } finally {
      if (savedServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey;
    }
  });
});

describe('question-specific why context', () => {
  const question = {
    moduleTitle: 'Phishing',
    scenarioTitle: 'Unexpected document share',
    scenarioPrompt: 'A message asks you to sign in through an unfamiliar link.',
    options: [
      { key: 'A', text: 'Open the official service directly.' },
      { key: 'B', text: 'Use the unfamiliar link to sign in.' },
      { key: 'C', text: 'Reply to the message for confirmation.' },
      { key: 'D', text: 'Forward the link to a colleague.' },
    ],
    selectedOptionKey: 'A',
    correctOptionKey: 'A',
    selectedAnswer: 'Open the official service directly.',
    correctAnswer: 'Open the official service directly.',
    isCorrect: true,
    riskDimensions: ['Links', 'Credentials'],
    existingExplanation: 'A familiar name can be spoofed.',
    userQuestion: 'Why is it important to check the link?',
  };

  it('accepts bounded scenario answer context', () => {
    expect(scenarioWhySchema.safeParse({ language: 'en', question }).success).toBe(true);
  });

  it('rejects arbitrary prompts and chat history', () => {
    expect(scenarioWhySchema.safeParse({ language: 'en', question, prompt: 'Tell me anything' }).success).toBe(false);
    expect(scenarioWhySchema.safeParse({ language: 'en', question, messages: [{ role: 'user', content: 'Hi' }] }).success).toBe(false);
  });
});

describe('training progress isolation', () => {
  it('scopes attempts, progress, and risk profile reads to the authenticated user', async () => {
    const calls: string[] = [];
    const userId = 'user-a';
    const client = {
      from(table: string) {
        if (table === 'training_attempts') return createQuery([{ scenario_id: 'scenario-a', is_correct: true, created_at: '2026-09-21T10:00:00Z' }], calls);
        if (table === 'training_modules') return createQuery([{ id: 'module-a', slug: 'module-a', title: { en: 'Module A' }, scenarios: [{ id: 'scenario-a', risk_dimensions: ['Urgency'] }] }], calls);
        if (table === 'training_progress') return createQuery([{ module_id: 'module-a', scenarios_attempted: 1, scenarios_correct: 1, completed_at: null }], calls);
        return createQuery({ focus_dimension: 'Urgency' }, calls);
      },
    };

    const summary = await getTrainingSummary(client as never, userId);

    expect(summary.attempted).toBe(1);
    expect(summary.modules[0].scenariosAttempted).toBe(1);
    expect(calls).toContain('eq:user_id:user-a');
    expect(calls.filter((call) => call === 'eq:user_id:user-a')).toHaveLength(3);
  });

  it('does not complete a module until every distinct scenario has been attempted', async () => {
    const scenarios = Array.from({ length: 6 }, (_, index) => ({
      id: `scenario-${index + 1}`,
      risk_dimensions: ['Urgency'],
    }));
    const client = {
      from(table: string) {
        if (table === 'training_attempts') return createQuery([{ scenario_id: 'scenario-1', is_correct: true, created_at: '2026-09-21T10:00:00Z' }], []);
        if (table === 'training_modules') return createQuery([{ id: 'module-a', slug: 'module-a', title: { en: 'Module A' }, scenarios }], []);
        if (table === 'training_progress') return createQuery([{ module_id: 'module-a', scenarios_attempted: 1, scenarios_correct: 1, completed_at: null }], []);
        return createQuery(null, []);
      },
    };

    const summary = await getTrainingSummary(client as never, 'user-a');

    expect(summary.modules[0]).toMatchObject({
      scenarioCount: 6,
      scenariosAttempted: 1,
      completed: false,
    });
  });
});

describe('certificate completion', () => {
  it('requires at least one attempt at every distinct module scenario', () => {
    expect(hasAttemptedEveryScenario(['a', 'b'], ['a', 'a'])).toBe(false);
    expect(hasAttemptedEveryScenario(['a', 'b'], ['a', 'b', 'a'])).toBe(true);
    expect(hasAttemptedEveryScenario([], [])).toBe(false);
  });
});
