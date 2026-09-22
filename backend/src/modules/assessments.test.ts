import { describe, expect, it } from 'vitest';
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
  });
});
