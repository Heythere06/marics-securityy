export type StandingLevel = 'critical' | 'elevated' | 'moderate' | 'guarded' | 'resilient';
export type DimensionTone = 'strength' | 'weakness';

export function awarenessStanding(score: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped < 40) {
    return {
      level: 'critical' as StandingLevel,
      label: 'Critical exposure',
      vulnerability: 'Very high',
      weight: 'Immediate practice needed',
      summary: 'Attack pressure would likely succeed often. Finish focused training before handling sensitive requests.',
    };
  }
  if (clamped < 60) {
    return {
      level: 'elevated' as StandingLevel,
      label: 'Elevated risk',
      vulnerability: 'High',
      weight: 'Priority practice areas',
      summary: 'Some habits hold, but several pressure tactics still get through. Treat unexpected requests with extra caution.',
    };
  }
  if (clamped < 75) {
    return {
      level: 'moderate' as StandingLevel,
      label: 'Developing habits',
      vulnerability: 'Moderate',
      weight: 'Build consistency',
      summary: 'You catch many signals, but consistency under urgency or authority still needs work.',
    };
  }
  if (clamped < 90) {
    return {
      level: 'guarded' as StandingLevel,
      label: 'Guarded',
      vulnerability: 'Low',
      weight: 'Maintain and sharpen',
      summary: 'Your baseline is solid. Keep practicing weaker areas so good habits stay automatic.',
    };
  }
  return {
    level: 'resilient' as StandingLevel,
    label: 'Resilient',
    vulnerability: 'Very low',
    weight: 'Protect the edge',
    summary: 'You consistently choose safer responses. Use training to stay sharp as tactics change.',
  };
}

export function dimensionStanding(score: 'strong' | 'weak' | string) {
  if (score === 'strong') {
    return {
      tone: 'strength' as DimensionTone,
      label: 'Strength',
      vulnerability: 'Low',
      detail: 'You handled this pressure pattern safely in the opening quiz.',
    };
  }
  return {
    tone: 'weakness' as DimensionTone,
    label: 'Weakness',
    vulnerability: 'Elevated',
    detail: 'This pattern needs practice before it becomes a reliable habit.',
  };
}

export function vulnerabilityFromWeakCount(weakCount: number, total: number) {
  if (total <= 0) return { label: 'Unknown', level: 'moderate' as StandingLevel };
  const ratio = weakCount / total;
  if (ratio >= 0.8) return { label: 'Critical topic exposure', level: 'critical' as StandingLevel };
  if (ratio >= 0.5) return { label: 'High topic exposure', level: 'elevated' as StandingLevel };
  if (ratio >= 0.3) return { label: 'Moderate topic exposure', level: 'moderate' as StandingLevel };
  if (ratio > 0) return { label: 'Limited topic exposure', level: 'guarded' as StandingLevel };
  return { label: 'Low topic exposure', level: 'resilient' as StandingLevel };
}
