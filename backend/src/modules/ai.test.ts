import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMessage } = vi.hoisted(() => ({ createMessage: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMessage };
  },
}));

import { chatSchema, chatWithCoach, explainScenarioWhy, generatePracticeScenarioDraft, scenarioWhySchema } from './ai.js';

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

  it('accepts a short coach conversation and refuses empty chat', () => {
    expect(chatSchema.safeParse({ language: 'en', message: 'Is this WhatsApp from my manager safe?' }).success).toBe(true);
    expect(chatSchema.safeParse({ language: 'en', message: '   ' }).success).toBe(false);
    expect(chatSchema.safeParse({ language: 'en', message: 'Hello', history: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'How can I help?' }] }).success).toBe(true);
  });

  it('sends coach chat with bounded history and defensive instructions', async () => {
    createMessage.mockResolvedValue({ content: [{ type: 'text', text: 'Do not send money or vouchers from a WhatsApp message. Call your manager on a number you already have.' }] });
    const reply = await chatWithCoach({
      language: 'en',
      message: 'Someone claiming to be my manager asked for airtime vouchers.',
      history: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'What arrived?' }],
    });
    expect(reply).toContain('WhatsApp');
    const [request] = createMessage.mock.calls[0] as [{ system: string; messages: Array<{ role: string }> }];
    expect(request.system).toContain('untrusted');
    expect(request.system).toContain('exploit');
    expect(request.messages[request.messages.length - 1].role).toBe('user');
  });

  it('builds practice scenarios from the learner prompt', async () => {
    createMessage.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: 'After-hours voucher request',
          scenario: 'A WhatsApp contact claiming to be your manager asks you to buy airtime vouchers tonight.',
          options: [
            { key: 'A', text: 'Buy the vouchers immediately.' },
            { key: 'B', text: 'Call your manager on a known number before doing anything.' },
            { key: 'C', text: 'Reply with your PIN so they can collect the vouchers.' },
            { key: 'D', text: 'Forward the message to a random colleague.' },
          ],
          correctOption: 'B',
          explanation: 'Managers do not ask staff to buy vouchers over WhatsApp after hours.',
          manipulationTechnique: 'Authority',
          attackerObjective: 'Steal money through a fake manager request.',
          correctResponse: 'Verify through a known phone number.',
          channel: 'WhatsApp',
          sender: 'Manager (unknown number)',
        }),
      }],
    });

    const draft = await generatePracticeScenarioDraft({
      moduleSlug: 'social-engineering',
      moduleTitle: 'Social engineering',
      moduleDescription: 'Pressure and impersonation',
      language: 'en',
      difficulty: 'intermediate',
      threatCategory: 'messaging and social media impersonation',
      learningObjectives: 'Verify unexpected payment requests.',
      prompt: 'A WhatsApp message from someone pretending to be my manager, asking me to buy airtime vouchers after hours.',
    });

    expect(draft.title).toContain('voucher');
    const [request] = createMessage.mock.calls[0] as [{ messages: Array<{ content: string }> }];
    expect(request.messages[0].content).toContain('Learner prompt');
    expect(request.messages[0].content).toContain('buy airtime vouchers after hours');
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
