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
  return (await response.json()).profile as { full_name: string; preferred_language: string; role: 'individual' | 'employee' | 'organization_admin' | 'marics_admin'; account_type: string } | null;
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

export async function getOrganizations(accessToken: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organizations could not be loaded');
  return (await response.json()).organizations as Array<{ id: string; name: string; isAdmin: boolean }>;
}

export async function createOrganization(accessToken: string, name: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organization could not be created');
  return (await response.json()).organization as { id: string; name: string };
}

export async function getOrganizationDashboard(accessToken: string, organizationId: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/dashboard`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organization dashboard could not be loaded');
  return (await response.json()).dashboard as { organization: { id: string; name: string }; employeeCount: number; trainedEmployees: number; attempted: number; correct: number; employees: Array<{ id: string; name: string; attempted: number; correct: number }> };
}

export async function createInvitation(accessToken: string, organizationId: string, email: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/invitations`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Invitation could not be created');
  return (await response.json()).invitation as { email: string; token: string; expiresAt: string };
}

export async function createOrganizationReport(accessToken: string, organizationId: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/reports`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Report could not be generated');
  return (await response.json()).report;
}

export async function acceptOrganizationInvitation(accessToken: string, token: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/invitations/accept`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Invitation could not be accepted');
  return (await response.json()) as { organizationId: string };
}

export async function updateLanguage(accessToken: string, preferredLanguage: 'en' | 'af' | 'pt') {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ preferredLanguage }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Language preference could not be saved');
}

export type AdminOverview = { counts: { users: number; organizations: number; modules: number; publishedModules: number; generatedContent: number; certificates: number }; languages: string[]; users: Array<{ id: string; name: string; role: string; language: string; createdAt: string }>; organizations: Array<{ id: string; name: string; createdAt: string }>; modules: Array<{ id: string; slug: string; title: Record<string, string>; published: boolean }>; aiContent: Array<{ id: string; moduleSlug: string; language: string; provider: string; model: string; createdAt: string }> };

export async function getAdminOverview(accessToken: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/overview`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Admin dashboard could not be loaded');
  return (await response.json()).overview as AdminOverview;
}

export async function createAdminModule(accessToken: string, input: { slug: string; title: string; description: string }) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/modules`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Module could not be created');
  return (await response.json()).module;
}

export async function setAdminModulePublished(accessToken: string, moduleId: string, published: boolean) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/modules/${moduleId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ published }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Module could not be updated');
  return (await response.json()).module;
}

export async function setAdminLanguages(accessToken: string, languages: string[]) {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/settings`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'supported_languages', value: languages }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Platform setting could not be updated');
}