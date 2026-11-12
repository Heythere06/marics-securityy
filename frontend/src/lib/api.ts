async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(10_000) });
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('marics:unauthorized'));
  return response;
}

export type OnboardingScenario = {
  slug: string;
  content: Record<string, { title?: string; scenario?: string }>;
  riskDimensions: string[];
  options: Array<{ optionKey: 'A' | 'B' | 'C'; content: Record<string, string> }>;
};

export type RiskProfile = {
  strongest_dimension: string;
  focus_dimension: string;
  awareness_score: number;
  category_scores: Record<string, 'strong' | 'weak'>;
  updated_at?: string;
};

export async function getOnboardingAssessment(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/assessment/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Assessment could not be loaded');
  return (await response.json()).scenarios as OnboardingScenario[];
}

export async function getRiskProfile(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me/risk-profile`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Risk profile could not be loaded');
  return (await response.json()).profile as RiskProfile | null;
}

export async function submitAssessment(accessToken: string, answers: Array<{ scenarioSlug: string; optionKey: 'A' | 'B' | 'C' }>) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/assessments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Assessment could not be saved');
  return (await response.json()).profile as RiskProfile;
}

export async function getProfile(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Profile could not be loaded');
  return (await response.json()).profile as { full_name: string; preferred_language: string; role: 'individual' | 'employee' | 'organization_admin' | 'marics_admin'; account_type: string } | null;
}

export async function saveTrainingAnswer(accessToken: string, scenarioSlug: string, optionKey: 'A' | 'B' | 'C' | 'D') {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/scenarios/${scenarioSlug}/answer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionKey }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Training answer could not be saved');
  return (await response.json()) as { isCorrect: boolean; feedback: Record<string, string>; explanation: Record<string, string>; correctOptionKey: 'A' | 'B' | 'C' | 'D'; progress: { scenarios_attempted: number; scenarios_correct: number } };
}

export async function getTrainingSummary(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me/training-progress`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Training progress could not be loaded');
  return (await response.json()) as { attempted: number; correct: number; lastAttemptAt: string | null; modules: Array<{ id: string; slug: string; title: Record<string, string>; scenarioCount: number; scenariosAttempted: number; scenariosCorrect: number; completed: boolean }>; recommendation: { slug: string; title: Record<string, string>; reason: 'focus-area' | 'next-unfinished' } | null };
}

export async function getOrganizations(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organizations could not be loaded');
  return (await response.json()).organizations as Array<{ id: string; name: string; isAdmin: boolean }>;
}

export async function createOrganization(accessToken: string, name: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organization could not be created');
  return (await response.json()).organization as { id: string; name: string };
}

export async function getOrganizationDashboard(accessToken: string, organizationId: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/dashboard`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organization dashboard could not be loaded');
  return (await response.json()).dashboard as { organization: { id: string; name: string }; employeeCount: number; trainedEmployees: number; attempted: number; correct: number; employees: Array<{ id: string; name: string; email?: string | null; joinedAt: string; attempted: number; correct: number; lastActivityAt: string; modulesCompleted: number; modulesTotal: number; riskSummary: string }>; teamRisk?: { employeeCount: number; assessedEmployees: number; categoryBreakdown: Array<{ category: string; weakCount: number; weakPercent: number }>; highestRiskArea: string; highestRiskPercent: number } };
}

export async function createInvitation(accessToken: string, organizationId: string, email: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/invitations`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const payload = await response.json().catch(() => ({})) as {
    invitation?: { email: string; token: string; expiresAt: string };
    message?: string;
    emailDelivered?: boolean;
  };
  if (payload.invitation?.token) {
    return {
      ...payload.invitation,
      emailDelivered: response.ok ? true : Boolean(payload.emailDelivered),
      deliveryMessage: response.ok ? null : (payload.message ?? 'Invitation created, but email delivery failed.'),
    };
  }
  if (!response.ok) throw new Error(payload.message ?? 'Invitation could not be created');
  throw new Error('Invitation could not be created');
}

export async function previewInvitation(token: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/invitations/preview?token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Invitation could not be previewed');
  return (await response.json()).invitation as { organizationName: string; email: string; expiresAt: string; isExpired: boolean; isUsed: boolean };
}

export async function validateInvitation(accessToken: string, token: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/invitations/validate?token=${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Invitation could not be validated');
  return (await response.json()).invitation as { organizationId: string; organizationName: string; email: string; expiresAt: string; acceptedAt: string | null; isExpired: boolean; isUsed: boolean };
}

export async function updateOrganization(accessToken: string, organizationId: string, input: { name?: string; defaultEmployeeLanguage?: 'en' | 'af' | 'pt' }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Organization settings could not be saved');
  return (await response.json()).organization as { id: string; name: string; defaultEmployeeLanguage: 'en' | 'af' | 'pt' };
}

export async function removeOrganizationMember(accessToken: string, organizationId: string, userId: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/members/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Employee could not be removed');
  return (await response.json()).member as { organizationId: string; userId: string; removed: boolean };
}

export async function createOrganizationReport(accessToken: string, organizationId: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/reports`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Report could not be generated');
  return (await response.json()).report;
}

export async function createOrganizationCsvReport(accessToken: string, organizationId: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/${organizationId}/reports`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'csv' }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'CSV report could not be generated');
  return response.text();
}

export async function acceptOrganizationInvitation(accessToken: string, token: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/organizations/invitations/accept`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Invitation could not be accepted');
  return (await response.json()) as { organizationId: string };
}

export async function updateLanguage(accessToken: string, preferredLanguage: 'en' | 'af' | 'pt') {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ preferredLanguage }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Language preference could not be saved');
}

export async function updateProfileSettings(accessToken: string, input: { fullName: string; preferredLanguage: 'en' | 'af' | 'pt' }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/users/me`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { profile?: { full_name: string; preferred_language: 'en' | 'af' | 'pt' }; message?: string };
  if (!response.ok || !payload.profile) throw new Error(payload.message ?? 'Account settings could not be saved');
  return payload.profile;
}

export type UserCertificate = { id: string; verification_id: string; module_id: string | null; issued_at: string; module: { slug: string; title: Record<string, string> } | null };

export async function getUserCertificates(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/certificates`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({})) as { certificates?: UserCertificate[]; message?: string };
  if (!response.ok || !payload.certificates) throw new Error(payload.message ?? 'Certificates could not be loaded');
  return payload.certificates;
}

export type CertificationQuestion = { scenarioId: string; content: Record<string, { title?: string; scenario?: string }>; options: Array<{ optionKey: 'A' | 'B' | 'C' | 'D'; content: Record<string, string> }> };
export type CertificationAssessment = { assessmentId: string; expiresAt: string; timeLimitMinutes: number; passPercent: number; questions: CertificationQuestion[] };

export async function startCertificationAssessment(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/certification-assessment/start`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({})) as CertificationAssessment & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Certification assessment could not be started');
  return payload;
}

export async function submitCertificationAssessment(accessToken: string, assessmentId: string, answers: Array<{ scenarioId: string; optionKey: 'A' | 'B' | 'C' | 'D' }>) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/certification-assessment/submit`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assessmentId, answers }) });
  const payload = await response.json().catch(() => ({})) as { score?: number; passed?: boolean; message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Certification assessment could not be submitted');
  return payload as { score: number; passed: boolean; passPercent: number };
}

export type VerifiedCertificate = { verificationId: string; issuedAt: string; recipient: string; module: { slug: string; title: Record<string, string> } | null };

export async function verifyCertificate(verificationId: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/certificates/verify/${encodeURIComponent(verificationId)}`, { signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({})) as { certificate?: VerifiedCertificate; message?: string };
  if (!response.ok || !payload.certificate) throw new Error(payload.message ?? 'Certificate could not be verified');
  return payload.certificate;
}

export type AdminOverview = { counts: { users: number; organizations: number; modules: number; publishedModules: number; generatedContent: number; certificates: number }; languages: string[]; users: Array<{ id: string; name: string; role: string; language: string; createdAt: string }>; organizations: Array<{ id: string; name: string; createdAt: string }>; modules: Array<{ id: string; slug: string; title: Record<string, string>; published: boolean }>; aiContent: Array<{ id: string; moduleSlug: string; language: string; provider: string; model: string; createdAt: string }> };

export async function getAdminOverview(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/overview`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({})) as { message?: string; details?: string; overview?: AdminOverview };
  if (!response.ok) {
    const reason = payload.details ? ` ${payload.details}` : '';
    throw new Error(`${payload.message ?? 'Admin dashboard could not be loaded'}${reason} [HTTP ${response.status}]`);
  }
  if (!payload.overview) throw new Error('Admin dashboard returned no data.');
  return payload.overview;
}

export async function createAdminModule(accessToken: string, input: { slug: string; title: string; description: string }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/modules`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Module could not be created');
  return (await response.json()).module;
}

export async function createAdminScenario(accessToken: string, input: { moduleId: string; scenarioId?: string; slug: string; content: Record<string, { title: string; scenario: string }>; riskDimensions: string[]; options: Array<{ optionKey: 'A' | 'B' | 'C' | 'D'; content: Record<string, string>; isCorrect: boolean; feedback: Record<string, { choice: string; explanation: string }> }> }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/scenarios`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Scenario could not be created');
  return (await response.json()).scenario;
}

export type GeneratedScenario = { title: string; scenario: string; options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>; correctOption: 'A' | 'B' | 'C' | 'D'; explanation: string; manipulationTechnique: string; attackerObjective: string; correctResponse: string };

export async function generateScenario(accessToken: string, input: { moduleSlug: string; language: 'en' | 'af' | 'pt'; context: string }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/ai/generate-scenario`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { scenario?: GeneratedScenario; message?: string };
  if (!response.ok || !payload.scenario) throw new Error(payload.message ?? 'AI scenario could not be generated');
  return payload.scenario;
}

export async function getScenarioWhy(accessToken: string, input: { language: 'en' | 'af' | 'pt'; question: { moduleTitle: string; scenarioTitle: string; scenarioPrompt: string; options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>; selectedOptionKey: 'A' | 'B' | 'C' | 'D'; correctOptionKey: 'A' | 'B' | 'C' | 'D'; selectedAnswer: string; correctAnswer: string; isCorrect: boolean; riskDimensions: string[]; existingExplanation: string; userQuestion: string } }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/ai/scenario-why`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(25_000) });
  const payload = await response.json().catch(() => ({})) as { explanation?: string; message?: string };
  if (!response.ok || !payload.explanation) throw new Error(payload.message ?? 'A focused explanation could not be generated');
  return payload.explanation;
}

export type AdminScenario = { id: string; moduleId: string; slug: string; content: Record<string, { title: string; scenario: string }>; riskDimensions: string[]; options: Array<{ id: string; optionKey: 'A' | 'B' | 'C' | 'D'; content: Record<string, string>; isCorrect: boolean; feedback: Record<string, { choice: string; explanation: string }> }> };

export async function getAdminScenarios(accessToken: string, moduleId: string) {
  return (await adminJson<{ scenarios: AdminScenario[] }>(accessToken, `/api/admin/modules/${moduleId}/scenarios`)).scenarios;
}

export async function setAdminModulePublished(accessToken: string, moduleId: string, published: boolean) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/modules/${moduleId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ published }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Module could not be updated');
  return (await response.json()).module;
}

export async function setAdminLanguages(accessToken: string, languages: string[]) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/settings`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'supported_languages', value: languages }) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Platform setting could not be updated');
}

export type AdminUser = { id: string; name: string; role: string; language: string; suspended: boolean; createdAt: string; organizations: Array<{ id: string; name: string; isAdmin: boolean }> };
export type AdminOrganization = { id: string; name: string; suspended: boolean; employeeCount: number; createdAt: string };

async function adminJson<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) }, signal: init?.signal ?? AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? 'Admin request could not be completed');
  return payload as T;
}

export async function searchAdminUsers(accessToken: string, query = '') {
  return (await adminJson<{ users: AdminUser[] }>(accessToken, `/api/admin/users?q=${encodeURIComponent(query)}`)).users;
}

export async function updateAdminUserRole(accessToken: string, userId: string, role: string) {
  return (await adminJson<{ user: AdminUser }>(accessToken, `/api/admin/users/${userId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })).user;
}

export async function updateAdminUserSuspension(accessToken: string, userId: string, suspended: boolean) {
  return (await adminJson<{ user: AdminUser }>(accessToken, `/api/admin/users/${userId}/suspended`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended }) })).user;
}

export async function searchAdminOrganizations(accessToken: string, query = '') {
  return (await adminJson<{ organizations: AdminOrganization[] }>(accessToken, `/api/admin/organizations?q=${encodeURIComponent(query)}`)).organizations;
}

export async function getAdminTrainingCatalog(accessToken: string) {
  return (await adminJson<{ catalog: { languages: string[]; modules: AdminTrainingModule[] } }>(accessToken, '/api/admin/training/catalog')).catalog;
}

export type TrainingLanguage = 'en' | 'af' | 'pt';
export type ModuleLearningMaterialBlock = { whyItMatters: string; warningSigns: string; bestPractice: string };
export type ModuleLearningMaterial = Partial<Record<TrainingLanguage, ModuleLearningMaterialBlock>>;
export type AdminTrainingModule = { id: string; slug: string; title: Record<string, string>; description: Record<string, string>; learningMaterial: ModuleLearningMaterial; published: boolean; archived: boolean; scenarioCount: number; languageCompleteness: Record<string, boolean> };

export async function updateAdminTrainingModule(accessToken: string, moduleId: string, input: { title: Record<string, string>; description: Record<string, string>; published: boolean; learningMaterial: ModuleLearningMaterial }) {
  const result = await adminJson<{ module: { learning_material?: ModuleLearningMaterial } }>(accessToken, `/api/admin/training/modules/${moduleId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return result.module.learning_material ?? input.learningMaterial;
}

export async function getAdminAnalytics(accessToken: string) {
  return (await adminJson<{ analytics: { categoryWeakness: Array<{ category: string; weakCount: number; assessedUsers: number; weakPercent: number }>; completion: { usersWithProfiles: number; usersWithTraining: number } } }>(accessToken, '/api/admin/analytics')).analytics;
}

export async function getAdminAuditLog(accessToken: string) {
  return (await adminJson<{ entries: Array<{ id: string; action: string; targetType: string; targetId: string | null; createdAt: string }> }>(accessToken, '/api/admin/audit-log')).entries;
}

export type TrainingModule = { id: string; slug: string; title: Record<string, string>; description: Record<string, string>; learningMaterial: ModuleLearningMaterial; scenarioCount: number; scenarioSlugs: string[]; scenarioTitles?: Array<{ slug: string; title: string }> };
export type TrainingScenario = { id: string; slug: string; source?: 'manual' | 'ai'; content: Record<string, { channel?: string; sender?: string; message?: string; title?: string; scenario?: string; interaction?: string; email?: unknown; sms?: unknown; chat?: unknown; call?: unknown; job?: unknown; payment?: unknown }>; riskDimensions: string[]; module: { slug: string; title: Record<string, string> }; options: Array<{ option_key: 'A' | 'B' | 'C' | 'D'; content: Record<string, string> }> };
export type AiPracticeScenarioSummary = { slug: string; title: string };

export async function submitDemoRequest(input: { name: string; email: string; organizationName?: string; phone?: string; message: string; language?: 'en' | 'af' | 'pt' }) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/demo-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Demo request could not be sent');
}

export async function requestVerificationEmail(email: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message ?? 'Verification email could not be sent');
  return payload.message ?? 'If that email still needs verification, a confirmation message is on its way. Check inbox and spam.';
}

export async function getAdminDemoRequests(accessToken: string) {
  return (await adminJson<{ requests: Array<{ id: string; name: string; email: string; organizationName: string | null; phone: string | null; message: string; language: string; status: string; createdAt: string }> }>(accessToken, '/api/admin/demo-requests')).requests;
}

export async function getAdminUserDetail(accessToken: string, userId: string) {
  return (await adminJson<{ user: Record<string, unknown> }>(accessToken, `/api/admin/users/${userId}`)).user;
}

export async function getTrainingModules(accessToken: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/training/modules`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Training modules could not be loaded');
  return (await response.json()).modules as TrainingModule[];
}

export async function getTrainingScenario(accessToken: string, scenarioSlug: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/training/scenarios/${scenarioSlug}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'Training scenario could not be loaded');
  return { ...(await response.json()).scenario, source: 'manual' as const } as TrainingScenario;
}

export async function listAiPracticeScenarios(accessToken: string, moduleSlug: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/training/modules/${moduleSlug}/ai-practice`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'AI practice scenarios could not be loaded');
  return (await response.json()).scenarios as AiPracticeScenarioSummary[];
}

export async function generateAiPracticeScenario(accessToken: string, moduleSlug: string, language: 'en' | 'af' | 'pt', difficulty: 'foundation' | 'intermediate' | 'advanced' = 'intermediate') {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/training/modules/${moduleSlug}/ai-practice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, difficulty }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json().catch(() => ({})) as { scenario?: TrainingScenario; message?: string };
  if (!response.ok || !payload.scenario) throw new Error(payload.message ?? 'AI practice scenario could not be generated');
  return { ...payload.scenario, source: 'ai' as const };
}

export async function getAiPracticeScenario(accessToken: string, scenarioSlug: string) {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/training/ai-practice/${scenarioSlug}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error((await response.json()).message ?? 'AI practice scenario could not be loaded');
  return { ...(await response.json()).scenario, source: 'ai' as const } as TrainingScenario;
}

export async function saveAiPracticeAnswer(accessToken: string, scenarioSlug: string, optionKey: 'A' | 'B' | 'C' | 'D') {
  const response = await apiFetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/training/ai-practice/${scenarioSlug}/answer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionKey }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error((await response.json()).message ?? 'AI practice answer could not be saved');
  return (await response.json()) as { isCorrect: boolean; feedback: Record<string, string>; explanation: Record<string, string>; correctOptionKey: 'A' | 'B' | 'C' | 'D'; progress: { scenarios_attempted: number; scenarios_correct: number; ai_scenarios_attempted: number; ai_scenarios_correct: number } };
}