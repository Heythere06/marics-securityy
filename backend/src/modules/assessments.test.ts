import { describe, expect, it } from 'vitest';
import { awarenessStanding } from '../lib/riskStanding.js';
import { buildRiskProfileFromAnswers } from './assessments.js';

describe('assessment risk profile scoring', () => {
  it('marks each category strong or weak and picks focus from the first miss', () => {
    const profile = buildRiskProfileFromAnswers([
      { dimension: 'Urgency', isCorrect: true, scenarioSlug: 'urgency' },
      { dimension: 'Authority', isCorrect: false, scenarioSlug: 'authority' },
      { dimension: 'Curiosity', isCorrect: true, scenarioSlug: 'curiosity' },
    ]);

    expect(profile.category_scores.Urgency).toBe('strong');
    expect(profile.category_scores.Authority).toBe('weak');
    expect(profile.strongest_dimension).toBe('Urgency');
    expect(profile.focus_dimension).toBe('Authority');
    expect(profile.awareness_score).toBe(67);
    expect(profile.standing_level).toBe('moderate');
    expect(profile.vulnerability_level).toBe('Moderate');
    expect(profile.strengths_count).toBe(2);
    expect(profile.weaknesses_count).toBe(1);
  });

  it('maps low awareness into critical exposure', () => {
    const profile = buildRiskProfileFromAnswers([
      { dimension: 'Urgency', isCorrect: false, scenarioSlug: 'urgency' },
      { dimension: 'Authority', isCorrect: false, scenarioSlug: 'authority' },
      { dimension: 'Curiosity', isCorrect: false, scenarioSlug: 'curiosity' },
      { dimension: 'Fear', isCorrect: true, scenarioSlug: 'fear' },
      { dimension: 'Trust', isCorrect: false, scenarioSlug: 'trust' },
      { dimension: 'Scarcity', isCorrect: false, scenarioSlug: 'scarcity' },
      { dimension: 'Social', isCorrect: false, scenarioSlug: 'social_pressure' },
      { dimension: 'Finance', isCorrect: false, scenarioSlug: 'financial_manipulation' },
      { dimension: 'Credential', isCorrect: false, scenarioSlug: 'credential_theft' },
      { dimension: 'Impersonation', isCorrect: false, scenarioSlug: 'impersonation' },
    ]);
    expect(profile.awareness_score).toBe(10);
    expect(profile.standing_level).toBe('critical');
    expect(awarenessStanding(10).vulnerability).toBe('Very high');
  });
});
