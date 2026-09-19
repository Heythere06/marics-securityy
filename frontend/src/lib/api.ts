export async function submitAssessment(accessToken: string, answers: Array<{ questionKey: string; selectedOption: number; riskDimension: string }>) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/assessments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Assessment could not be saved');
  return (await response.json()).profile as { strongest_dimension: string; focus_dimension: string; awareness_score: number };
}

export async function getProfile(accessToken: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Profile could not be loaded');
  return (await response.json()).profile as { full_name: string; preferred_language: string; role: string } | null;
}

export async function saveTrainingAnswer(accessToken: string, scenarioSlug: string, optionKey: 'A' | 'B' | 'C') {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/scenarios/${scenarioSlug}/answer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionKey }),
  });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Training answer could not be saved');
  return (await response.json()) as { isCorrect: boolean; progress: { scenarios_attempted: number; scenarios_correct: number } };
}

export async function getTrainingSummary(accessToken: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me/training-progress`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Training progress could not be loaded');
  return (await response.json()) as { attempted: number; correct: number; lastAttemptAt: string | null };
}