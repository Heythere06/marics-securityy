import { describe, expect, it } from 'vitest';
import { getTrainingSummary, splitOptionFeedback } from './training.js';

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

describe('training progress isolation', () => {
  it('scopes attempts, progress, and risk profile reads to the authenticated user', async () => {
    const calls: string[] = [];
    const userId = 'user-a';
    const client = {
      from(table: string) {
        if (table === 'training_attempts') return createQuery([{ is_correct: true, created_at: '2026-09-21T10:00:00Z' }], calls);
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
});
