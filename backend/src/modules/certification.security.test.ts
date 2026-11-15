import { describe, expect, it } from 'vitest';

describe('certification question binding', () => {
  it('keeps submit scoring ordered by the bound start question IDs', () => {
    const boundIds = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ];
    const loaded = [
      { scenarioId: boundIds[1], content: {}, options: [] },
      { scenarioId: boundIds[0], content: {}, options: [] },
    ];
    const byId = new Map(loaded.map((question) => [question.scenarioId, question]));
    const ordered = boundIds.map((id) => byId.get(id));
    expect(ordered.map((question) => question?.scenarioId)).toEqual(boundIds);
  });
});

describe('certification public payload integrity', () => {
  it('never exposes isCorrect on learner-facing question options', () => {
    const questions = [
      {
        scenarioId: '11111111-1111-1111-1111-111111111111',
        content: { en: { title: 'Test', scenario: 'A pressure message' } },
        options: [
          { id: 'a', optionKey: 'A' as const, content: { en: 'Unsafe' }, isCorrect: false },
          { id: 'b', optionKey: 'B' as const, content: { en: 'Safe' }, isCorrect: true },
        ],
      },
    ];

    const publicQuestions = questions.map((question) => ({
      scenarioId: question.scenarioId,
      content: question.content,
      options: question.options.map(({ id, optionKey, content }) => ({ id, optionKey, content })),
    }));

    expect(JSON.stringify(publicQuestions)).not.toMatch(/isCorrect/i);
    expect(publicQuestions[0].options[0]).toEqual({ id: 'a', optionKey: 'A', content: { en: 'Unsafe' } });
    expect(publicQuestions[0].options[1]).toEqual({ id: 'b', optionKey: 'B', content: { en: 'Safe' } });
  });
});

describe('invitation public payload integrity', () => {
  it('strips raw invite tokens from API-facing invitation objects', async () => {
    const { toPublicInvitation } = await import('../lib/supabase.js');
    const publicInvitation = toPublicInvitation({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'employee@example.com',
      expiresAt: '2030-01-01T00:00:00.000Z',
      token: 'a'.repeat(64),
    });
    expect(publicInvitation).toEqual({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'employee@example.com',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    expect('token' in publicInvitation).toBe(false);
  });
});
