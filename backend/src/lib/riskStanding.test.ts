import { describe, expect, it } from 'vitest';
import { awarenessStanding, dimensionStanding, vulnerabilityFromWeakCount } from './riskStanding.js';

describe('risk standing levels', () => {
  it('maps awareness bands to meaningful vulnerability labels', () => {
    expect(awarenessStanding(20).level).toBe('critical');
    expect(awarenessStanding(50).vulnerability).toBe('High');
    expect(awarenessStanding(70).label).toBe('Developing habits');
    expect(awarenessStanding(80).level).toBe('guarded');
    expect(awarenessStanding(95).level).toBe('resilient');
  });

  it('labels dimensions as strengths or weaknesses with vulnerability weight', () => {
    expect(dimensionStanding('strong').label).toBe('Strength');
    expect(dimensionStanding('strong').vulnerability).toBe('Low');
    expect(dimensionStanding('weak').label).toBe('Weakness');
    expect(dimensionStanding('weak').vulnerability).toBe('Elevated');
  });

  it('summarizes topic exposure from weakness counts', () => {
    expect(vulnerabilityFromWeakCount(9, 10).level).toBe('critical');
    expect(vulnerabilityFromWeakCount(5, 10).level).toBe('elevated');
    expect(vulnerabilityFromWeakCount(0, 10).level).toBe('resilient');
  });
});
