import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMessage } = vi.hoisted(() => ({ createMessage: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMessage };
  },
}));

import { explainScenarioWhy, scenarioWhySchema } from './ai.js';

const context = {
  language: 'en' as const,
  question: {
    moduleTitle: 'Phishing and suspicious links',
    scenarioTitle: 'Unexpected document share',
    scenarioPrompt: 'A message asks you to open a shortened link to review an invoice.',
    options: [
      { key: 'A' as const, text: 'Open the link immediately.' },
      { key: 'B' as const, text: 'Reply to the message for confirmation.' },
      { key: 'C' as const, text: 'Verify with the sender through a known channel.' },
      { key: 'D' as const, text: 'Forward the link to a colleague.' },
    ],
    selectedOptionKey: 'A' as const,
    correctOptionKey: 'C' as const,
    selectedAnswer: 'Open the link immediately.',
    correctAnswer: 'Verify with the sender through a known channel.',
    isCorrect: false,
    riskDimensions: ['Urgency', 'Verification'],
    existingExplanation: 'Urgency and unfamiliar links can lead to credential theft.',
    userQuestion: 'What could happen if I opened it?',
  },
};

describe('scenario follow-up questions', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_API_KEY', 'test-key');
    createMessage.mockReset();
  });

  it('requires the complete scenario, all answer options, and one scoped question', () => {
    expect(scenarioWhySchema.safeParse(context).success).toBe(true);
    const { userQuestion: _userQuestion, options: _options, ...incomplete } = context.question;
    expect(scenarioWhySchema.safeParse({ language: 'en', question: incomplete }).success).toBe(false);
    expect(scenarioWhySchema.safeParse({ ...context, prompt: 'general chat' }).success).toBe(false);
  });

  it('sends grounded context and off-topic redirection instructions to the provider', async () => {
    createMessage.mockResolvedValue({ content: [{ type: 'text', text: 'The shortened link may hide a fake sign-in page. Verify with the sender using a known contact method before entering credentials.' }] });

    const answer = await explainScenarioWhy(context);

    expect(answer).toContain('shortened link');
    const [request] = createMessage.mock.calls[0] as [{ system: string; messages: Array<{ content: string }> }];
    expect(request.system).toContain('unrelated');
    expect(request.system).toContain('redirect');
    expect(JSON.parse(request.messages[0].content)).toEqual(context.question);
  });
});
