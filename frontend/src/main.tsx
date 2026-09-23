import { StrictMode, useEffect, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { acceptOrganizationInvitation, createAdminModule, createAdminScenario, createInvitation, createOrganization, createOrganizationCsvReport, createOrganizationReport, getAdminAnalytics, getAdminAuditLog, getAdminOverview, getAdminTrainingCatalog, getOnboardingAssessment, getOrganizationDashboard, getOrganizations, getProfile, getRiskProfile, getTrainingModules, getTrainingScenario, getTrainingSummary, removeOrganizationMember, saveTrainingAnswer, searchAdminOrganizations, searchAdminUsers, setAdminLanguages, setAdminModulePublished, submitAssessment as saveAssessment, updateAdminUserRole, updateAdminUserSuspension, updateLanguage, updateOrganization, validateInvitation, type AdminOverview, type OnboardingScenario, type RiskProfile, type TrainingModule, type TrainingScenario } from './lib/api';
import { supabase } from './lib/supabase';
import { getTranslations, type Language } from './i18n';
import { AdminScenarioEditor } from './AdminScenarioEditor';
import './styles.css';

type View = 'overview' | 'assessment' | 'training' | 'organization' | 'certificates' | 'progress' | 'users' | 'modules' | 'ai-content' | 'reports' | 'settings';
type AppRole = 'individual' | 'employee' | 'organization_admin' | 'marics_admin';
type TrainingAnswer = 'verify' | 'act' | 'ignore';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppRole>('individual');
  const [authReady, setAuthReady] = useState(supabase === null);
  const [view, setView] = useState<View>('overview');
  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [onboardingScenarios, setOnboardingScenarios] = useState<OnboardingScenario[]>([]);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Array<{ scenarioSlug: string; optionKey: 'A' | 'B' | 'C' }>>([]);
  const [selectedOptionKey, setSelectedOptionKey] = useState<'A' | 'B' | 'C' | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [trainingAnswer, setTrainingAnswer] = useState<TrainingAnswer | null>(null);
  const [trainingResult, setTrainingResult] = useState<{ isCorrect: boolean; feedback: string; explanation: string; correctOptionKey: 'A' | 'B' | 'C' } | null>(null);
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [trainingScenario, setTrainingScenario] = useState<TrainingScenario | null>(null);
  const [selectedScenarioSlug, setSelectedScenarioSlug] = useState<string | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [trainingSummary, setTrainingSummary] = useState<TrainingSummary>({ attempted: 0, correct: 0, lastAttemptAt: null, modules: [], recommendation: null });
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; isAdmin: boolean }>>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const t = getTranslations(language);
  const needsOnboarding = (role === 'individual' || role === 'employee') && !riskProfile;
  const onboardingComplete = Boolean(riskProfile);
  const currentAssessmentScenario = onboardingScenarios[assessmentIndex] ?? null;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const fallback = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'there';
    const savedLanguage = session.user.user_metadata?.preferred_language as Language | undefined;
    if (savedLanguage === 'en' || savedLanguage === 'af' || savedLanguage === 'pt') setLanguage(savedLanguage);
    setDisplayName(fallback);
    const onboardingTimeout = window.setTimeout(() => {
      setAssessmentLoading(false);
      setAssessmentError('Your workspace took too long to respond. Check the API connection and retry.');
    }, 15_000);
    const loadProfileAndOnboarding = async () => {
      try {
        const invitationToken = window.localStorage.getItem('marics_invitation_token');
        if (invitationToken) {
          await acceptOrganizationInvitation(session.access_token, invitationToken);
          window.localStorage.removeItem('marics_invitation_token');
        }
        const profile = await getProfile(session.access_token);
        if (profile?.full_name) setDisplayName(profile.full_name);
        const nextRole = profile?.role ?? 'individual';
        if (profile?.role) setRole(profile.role);
        const savedRiskProfile = await getRiskProfile(session.access_token);
        if (savedRiskProfile) {
          setRiskProfile(savedRiskProfile);
          return;
        }
        if (nextRole === 'individual' || nextRole === 'employee') {
          setView('assessment');
          setAssessmentLoading(true);
          setAssessmentError(null);
          const scenarios = await getOnboardingAssessment(session.access_token);
          if (scenarios.length !== 10) throw new Error(`The onboarding assessment returned ${scenarios.length} scenarios; 10 are required. Apply migration 202609190011_onboarding_assessment.sql.`);
          setOnboardingScenarios(scenarios);
        }
      } catch (error) {
        setAssessmentError(error instanceof Error ? error.message : 'Your onboarding assessment could not be loaded.');
      } finally {
        window.clearTimeout(onboardingTimeout);
        setAssessmentLoading(false);
      }
    };
    void loadProfileAndOnboarding();
    getTrainingSummary(session.access_token).then(setTrainingSummary).catch(() => undefined);
    getOrganizations(session.access_token).then(setOrganizations).catch(() => undefined);
    getTrainingModules(session.access_token).then((availableModules) => {
      setTrainingModules(availableModules);
      const firstScenarioSlug = availableModules[0]?.scenarioSlugs[0] ?? null;
      if (firstScenarioSlug) void selectTrainingScenario(firstScenarioSlug);
    }).catch((error) => setTrainingError(error instanceof Error ? error.message : 'Training modules could not be loaded.'));
  }, [session]);

  const selectTrainingScenario = async (scenarioSlug: string) => {
    if (!session || !scenarioSlug) return;
    setSelectedScenarioSlug(scenarioSlug);
    setTrainingAnswer(null);
    setTrainingResult(null);
    setTrainingError(null);
    setTrainingLoading(true);
    try {
      setTrainingScenario(await getTrainingScenario(session.access_token, scenarioSlug));
    } catch (error) {
      setTrainingError(error instanceof Error ? error.message : 'Training scenario could not be loaded.');
    } finally {
      setTrainingLoading(false);
    }
  };

  const submitAssessment = async () => {
    if (!selectedOptionKey || !currentAssessmentScenario) return;
    const nextAnswers = [...assessmentAnswers, { scenarioSlug: currentAssessmentScenario.slug, optionKey: selectedOptionKey }];
    setAssessmentAnswers(nextAnswers);
    setSelectedOptionKey(null);
    if (assessmentIndex < onboardingScenarios.length - 1) {
      setAssessmentIndex(assessmentIndex + 1);
      return;
    }
    if (!session) return;
    try {
      const profile = await saveAssessment(session.access_token, nextAnswers);
      setRiskProfile(profile);
      setView('overview');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your assessment.');
    }
  };

  const navigate = (nextView: View) => {
    if (needsOnboarding && nextView !== 'assessment') return;
    setView(nextView);
  };

  const handleTrainingAnswer = async (answer: TrainingAnswer) => {
    setTrainingAnswer(answer);
    setTrainingResult(null);
    if (!session) return;
    try {
      if (!trainingScenario) return;
      const result = await saveTrainingAnswer(session.access_token, trainingScenario.slug, answer === 'verify' ? 'B' : answer === 'act' ? 'A' : 'C');
      const pick = (values: Record<string, string>) => values[language] ?? values.en ?? Object.values(values)[0] ?? '';
      setTrainingResult({ isCorrect: result.isCorrect, feedback: pick(result.feedback), explanation: pick(result.explanation), correctOptionKey: result.correctOptionKey });
      setTrainingSummary((current) => ({ ...current, attempted: current.attempted + 1, correct: current.correct + (result.isCorrect ? 1 : 0), lastAttemptAt: new Date().toISOString(), modules: current.modules.map((module) => module.slug === trainingScenario.module.slug ? { ...module, scenariosAttempted: module.scenariosAttempted + 1, scenariosCorrect: module.scenariosCorrect + (result.isCorrect ? 1 : 0), completed: module.completed || module.scenariosAttempted + 1 >= module.scenarioCount } : module) }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your training answer.');
    }
  };

  if (!authReady) return <div className="loading-screen">Loading your secure workspace...</div>;
  if (!session) return <PublicSite language={language} setLanguage={setLanguage} />;

  return <main className="workspace">
    <Sidebar role={role} displayName={displayName} language={language} onLanguageChange={(nextLanguage) => { setLanguage(nextLanguage); if (session) updateLanguage(session.access_token, nextLanguage).catch(() => setSaveError('We could not save your language preference.')); }} view={view} setView={navigate} onboardingLocked={needsOnboarding} hasOrganizations={organizations.length > 0} onSignOut={() => supabase?.auth.signOut()} />
    {view === 'overview' && role === 'marics_admin' && <PlatformAdminDashboard displayName={displayName} session={session} />}
    {view === 'overview' && role === 'employee' && <EmployeeDashboard displayName={displayName} organizations={organizations} riskProfile={riskProfile} trainingSummary={trainingSummary} onAssessment={() => navigate('assessment')} onTraining={() => navigate('training')} />}
    {view === 'overview' && role === 'organization_admin' && <OrganizationDashboard session={session} organizations={organizations} />}
    {view === 'overview' && role === 'individual' && <Overview displayName={displayName} onboardingComplete={onboardingComplete} riskProfile={riskProfile} trainingSummary={trainingSummary} trainingModules={trainingModules} onAssessment={() => navigate('assessment')} onTraining={() => navigate('training')} />}
    {role === 'marics_admin' && view !== 'overview' && <AdminSecondaryView view={view} session={session} />}
    {view === 'assessment' && (role === 'individual' || role === 'employee') && <AssessmentView language={language} t={t} loading={assessmentLoading} error={assessmentError} scenario={currentAssessmentScenario} index={assessmentIndex} total={onboardingScenarios.length} selectedOptionKey={selectedOptionKey} onSelect={setSelectedOptionKey} onSubmit={submitAssessment} onRetry={() => { setAssessmentError(null); setAssessmentLoading(true); getOnboardingAssessment(session.access_token).then((scenarios) => { setOnboardingScenarios(scenarios); setAssessmentLoading(false); }).catch((error) => { setAssessmentError(error instanceof Error ? error.message : 'Your onboarding assessment could not be loaded.'); setAssessmentLoading(false); }); }} />}
    {view === 'training' && (role === 'individual' || role === 'employee') && !needsOnboarding && <TrainingView language={language} modules={trainingModules} selectedScenarioSlug={selectedScenarioSlug} onScenarioSelect={selectTrainingScenario} scenario={trainingScenario} loading={trainingLoading} error={trainingError} result={trainingResult} answer={trainingAnswer} onAnswer={handleTrainingAnswer} />}
    {view === 'organization' && role === 'organization_admin' && <OrganizationWorkspace session={session} organizations={organizations} setOrganizations={setOrganizations} />}
    {view === 'reports' && role === 'organization_admin' && <OrganizationReports session={session} organizations={organizations} />}
    {view === 'settings' && role === 'organization_admin' && <OrganizationSettings session={session} organizations={organizations} setOrganizations={setOrganizations} />}
    {view !== 'overview' && view !== 'assessment' && view !== 'training' && view !== 'organization' && view !== 'reports' && view !== 'settings' && role !== 'marics_admin' && <RoleSection role={role} view={view} />}
    {saveError && <div className="toast error" role="alert">{saveError}</div>}
  </main>;
}

function PublicSite({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const [showAuth, setShowAuth] = useState(() => Boolean(new URLSearchParams(window.location.search).get('invite')));
  const t = getTranslations(language);
  if (showAuth) return <AuthScreen configured={supabase !== null} language={language} setLanguage={(value) => setLanguage(value as Language)} />;
  return <main className="public-site"><nav className="public-nav"><span className="public-logo-wrap"><img className="public-logo" src="/assets/marics-logo.png.png" alt="MARICS Security" onLoad={(event) => event.currentTarget.parentElement?.classList.add("loaded")} onError={(event) => event.currentTarget.parentElement?.classList.add("error")} /><span className="public-logo-fallback">MARICS<span>/ SECURITY</span></span></span><div className="public-links"><a href="#why">{t.nav.howItWorks}</a><a href="#features">{t.nav.features}</a><a href="#organizations">{t.nav.organizations}</a><a href="#pricing">{t.nav.pricing}</a></div><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="af">AF</option><option value="pt">PT</option></select><button onClick={() => setShowAuth(true)}>{t.nav.login}</button></nav><section className="public-hero"><div className="hero-copy"><p className="eyebrow">{t.landing.eyebrow}</p><h1>{t.landing.title}</h1><p className="public-lede">{t.landing.body}</p><div className="public-actions"><button className="primary" onClick={() => setShowAuth(true)}>{t.landing.primary} <b>&#8594;</b></button><a href="#why">{t.landing.secondary} <span>&#8595;</span></a></div></div><div className="hero-visual"><img src="/assets/marics-dashboard.jpg.jpeg" alt="MARICS security operations dashboard" /><span className="pulse-tag">LIVE HUMAN RISK SIGNALS</span></div></section><section id="why" className="why-section"><div className="why-overlay"><p className="eyebrow">01 / WHY MARICS</p><h2>{t.landing.intro}</h2><p>{t.landing.introBody}</p><div className="why-stat"><strong>01</strong><span>Practice the pressure before it becomes a breach.</span></div></div></section><section id="features" className="public-intro"><div><p className="eyebrow">02 / THE MARICS METHOD</p><h2>{t.landing.how}</h2></div><div className="intro-visual"><img src="/assets/marics-mobile.jpg.png" alt="A mobile security training scenario" /><p>{t.landing.introBody}</p></div></section><section id="organizations" className="people-section"><div className="people-visual"><img src="/assets/marics-team.jpg.png" alt="A team collaborating around cybersecurity" /></div><div><p className="eyebrow">03 / FOR ORGANIZATIONS</p><h2>Make resilience a team habit.</h2><p>{t.landing.security}</p><a href="#pricing">Explore organization intelligence &#8594;</a></div></section><section className="public-steps">{t.landing.features.map((feature, index) => <article key={feature}><span>0{index + 1}</span><h3>{feature}</h3><p>{t.landing.featureBodies[index]}</p></article>)}</section><section className="security-section"><img src="/assets/marics-security-team.jpg.jpeg" alt="Cybersecurity team protecting an organization" /><div><p className="eyebrow">04 / BUILT FOR TRUST</p><h2>Security awareness that feels close to the real world.</h2><p>{t.landing.security}</p></div></section><section id="pricing" className="public-cta"><p className="eyebrow">MARICS / SECURITY</p><h2>{t.landing.cta}</h2><button className="primary" onClick={() => setShowAuth(true)}>{t.landing.primary} <b>&#8594;</b></button></section><footer><span>{t.landing.footer}</span><span>{t.nav.about} &#183; {t.nav.demo} &#183; {t.nav.signup}</span></footer></main>;
}

function AuthScreen({ configured, language, setLanguage }: { configured: boolean; language: Language; setLanguage: (language: string) => void }) {
  const t = getTranslations(language);
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'reset'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const invitationToken = new URLSearchParams(window.location.search).get('invite');
    if (invitationToken && /^[a-f0-9]{64}$/i.test(invitationToken)) window.localStorage.setItem('marics_invitation_token', invitationToken);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    if (mode === 'sign-in') {
      const result = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (result.error) setMessage(formatAuthError(result.error));
      return;
    }
    if (mode === 'reset') {
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
      setBusy(false);
      if (result.error) setMessage('We could not send a reset link. Check your email and try again.');
      else setMessage('If that email is registered, a password reset link is on its way.');
      return;
    }
    const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, country_code: countryCode, preferred_language: language, account_type: accountType } } });
    setBusy(false);
    setLanguage(language as Language);
    if (result.error) setMessage(formatAuthError(result.error));
    else if (!result.data.session) setMessage('Check your email to verify your account, then sign in.');
  };

  return <main className="auth-shell"><section className="auth-panel"><div className="brand auth-brand">MARICS<span>/ SECURITY</span></div><p className="eyebrow">Human risk intelligence platform</p><h1>{mode === 'sign-in' ? 'Welcome back.' : mode === 'reset' ? 'Reset your password.' : 'Build safer habits.'}</h1><p className="lede">Your private workspace for practicing the decisions attackers try to rush.</p>{!configured ? <div className="auth-message">Supabase is not configured for the frontend yet. Add the Vite Supabase variables to your local environment and restart the dev server.</div> : <form onSubmit={submit}>{mode === 'sign-up' && <><label>Name<input value={fullName} onChange={event => setFullName(event.target.value)} required /></label><label>Country or region<input value={countryCode} onChange={event => setCountryCode(event.target.value.toUpperCase())} maxLength={2} placeholder="ZA" required /></label><label>Preferred language<select value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Portuguese</option></select></label><label>Account type<select value={accountType} onChange={event => setAccountType(event.target.value)}><option value="individual">Individual</option><option value="organization">Organization administrator</option></select></label></>}<label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>{mode !== 'reset' && <label>Password<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Working...' : mode === 'sign-in' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Create account'} <b>&#8594;</b></button>{message && <p className="auth-message" role="status">{message}</p>}</form>}<div className="auth-links"><button className="auth-switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>{mode === 'sign-in' ? 'Need an account? Sign up' : 'Back to sign in'}</button>{mode === 'sign-in' && <button className="auth-switch" onClick={() => setMode('reset')}>Forgot password?</button>}</div></section></main>;
}

function formatAuthError(error: { message: string; code?: string; status?: number }) {
  const message = error.message.toLowerCase();
  if (message.includes('already registered') || message.includes('already been registered') || error.code === 'user_already_exists') return 'An account with this email already exists. Sign in or reset your password.';
  if (message.includes('password should be at least') || message.includes('password must')) return 'Choose a stronger password with at least 8 characters.';
  if (message.includes('invalid email')) return 'Enter a valid email address.';
  if (message.includes('database error saving new user') || message.includes('user profile') || message.includes('profiles')) return 'Your account could not be saved to the database. Confirm that the Supabase profile migrations are applied, especially 202609190007_auth_profiles.sql.';
  if (error.status === 429 || message.includes('rate limit')) return 'Too many attempts. Wait a moment and try again.';
  return error.message || 'We could not complete that request. Check your details and try again.';
}

function EmployeeDashboard({ displayName, organizations, riskProfile, trainingSummary, onAssessment, onTraining }: { displayName: string; organizations: Array<{ id: string; name: string; isAdmin: boolean }>; riskProfile: RiskProfile | null; trainingSummary: { attempted: number; correct: number; lastAttemptAt: string | null }; onAssessment: () => void; onTraining: () => void }) {
  return <section className="content"><Header eyebrow="Employee workspace" title={`Good morning, ${displayName.split(/\s+/)[0] || 'there'}.`} detail="Your personal learning path, connected to your organization without exposing unnecessary personal information." /><div className="role-banner"><div><p className="card-kicker">ORGANIZATION MEMBERSHIP</p><h2>{organizations.map((organization) => organization.name).join(' &#183; ') || 'Invitation pending'}</h2><p>Your employer can see aggregate team progress. Your individual answers remain yours.</p></div><span className="role-pill">EMPLOYEE</span></div>{riskProfile && <div className="org-metrics employee-metrics"><article><span>STRONGEST AREA</span><strong>{riskProfile.strongest_dimension}</strong></article><article><span>FOCUS AREA</span><strong>{riskProfile.focus_dimension}</strong></article><article><span>AWARENESS</span><strong>{riskProfile.awareness_score}/100</strong></article><article><span>YOUR ATTEMPTS</span><strong>{trainingSummary.attempted}</strong></article></div>}<div className="role-columns"><article className="focus-card"><p className="card-kicker">RECOMMENDED NEXT</p><h2>{riskProfile ? 'Practice your next scenario' : 'Complete your baseline assessment'}</h2><p>{riskProfile ? 'Build confidence with realistic decisions and immediate explanations.' : 'Your organization dashboard stays aggregate-only until you finish onboarding.'}</p><button className="text-button" onClick={riskProfile ? onTraining : onAssessment}>{riskProfile ? 'Continue training' : 'Start assessment'} <b>&#8594;</b></button></article><article className="focus-card"><p className="card-kicker">RISK PROFILE</p><h2>{riskProfile ? `${riskProfile.focus_dimension} needs practice` : 'Profile pending'}</h2><p>{riskProfile ? `Your strongest habit today: ${riskProfile.strongest_dimension}.` : 'Ten short scenarios map where pressure affects your decisions.'}</p><button className="text-button" onClick={onAssessment}>{riskProfile ? 'Retake assessment' : 'Begin onboarding'} <b>&#8594;</b></button></article></div></section>;
}

function PlatformAdminDashboard({ displayName, session }: { displayName: string; session: Session }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleSlug, setModuleSlug] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const loadOverview = async () => {
    setLoading(true);
    setMessage(null);
    try {
      setOverview(await getAdminOverview(session.access_token));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Admin dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadOverview(); }, [session.access_token]);
  const createModule = async (event: FormEvent) => { event.preventDefault(); try { await createAdminModule(session.access_token, { slug: moduleSlug, title: moduleTitle, description: moduleDescription }); setModuleSlug(''); setModuleTitle(''); setModuleDescription(''); setOverview(await getAdminOverview(session.access_token)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Module could not be created.'); } };
  const toggleModule = async (id: string, published: boolean) => { try { await setAdminModulePublished(session.access_token, id, published); setOverview(await getAdminOverview(session.access_token)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Module could not be updated.'); } };
  const updateLanguages = async (event: ChangeEvent<HTMLSelectElement>) => { const values = Array.from(event.target.selectedOptions).map((option) => option.value); try { await setAdminLanguages(session.access_token, values); setOverview((current) => current ? { ...current, languages: values } : current); } catch (error) { setMessage(error instanceof Error ? error.message : 'Languages could not be updated.'); } };
  const counts = overview?.counts;
  return <section className="content"><Header eyebrow="MARICS administration" title={`Welcome, ${displayName.split(/\s+/)[0] || 'admin'}.`} detail="Manage platform users, tenants, training content, languages, and reports from one protected control plane." />{message && <div className="auth-message" role="alert">{message}</div>}<div className="admin-grid"><article className="admin-card"><span>USERS</span><strong>{counts?.users ?? '—'}</strong><p>Profiles in the platform.</p></article><article className="admin-card"><span>ORGANIZATIONS</span><strong>{counts?.organizations ?? '—'}</strong><p>Tenant workspaces.</p></article><article className="admin-card"><span>MODULES</span><strong>{counts ? `${counts.publishedModules} / ${counts.modules}` : '—'}</strong><p>Published training modules.</p></article></div>{overview ? <><div className="admin-columns"><article className="admin-panel"><p className="card-kicker">RECENT USERS</p><div className="admin-list">{overview.users.length ? overview.users.map((user) => <div className="admin-row" key={user.id}><strong>{user.name}</strong><span>{user.role} &#183; {user.language}</span></div>) : <p className="admin-empty-text">No users found.</p>}</div></article><article className="admin-panel"><p className="card-kicker">ORGANIZATIONS</p><div className="admin-list">{overview.organizations.length ? overview.organizations.map((organization) => <div className="admin-row" key={organization.id}><strong>{organization.name}</strong><span>Tenant workspace</span></div>) : <p className="admin-empty-text">No organizations found.</p>}</div></article></div><div className="admin-columns"><article className="admin-panel"><p className="card-kicker">MODULE MANAGEMENT</p><form className="admin-form" onSubmit={createModule}><input value={moduleSlug} onChange={(event) => setModuleSlug(event.target.value)} placeholder="module-slug" required /><input value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} placeholder="Module title" required /><input value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} placeholder="Description" required /><button className="primary">Add module <b>&#8594;</b></button></form><div className="admin-list">{overview.modules.map((module) => <div className="admin-row" key={module.id}><strong>{module.title.en ?? module.slug}</strong><button className="text-button" onClick={() => toggleModule(module.id, !module.published)}>{module.published ? 'Unpublish' : 'Publish'}</button></div>)}</div></article><article className="admin-panel"><p className="card-kicker">PLATFORM SETTINGS</p><label className="org-label">Supported languages<select multiple value={overview.languages} onChange={updateLanguages}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Portuguese</option></select></label><p className="admin-empty-text">AI content: {overview.aiContent.length} recent records. Certificates and reports remain available through their audited services.</p></article></div></> : <article className="admin-empty"><p className="card-kicker">ADMIN CONTROL PLANE</p><h2>Loading platform data...</h2></article>}</section>;
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    organization: 'M3 21h18M5 21V5l7-3 7 3v16M9 21v-5h6v5M8 8h1M15 8h1M8 11h1M15 11h1',
    modules: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
    ai: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z',
    certificates: 'M6 3h12v18l-6-3-6 3V3zM9 8h6M9 12h6',
    reports: 'M5 20V10M12 20V4M19 20v-7',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.4 1.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L9 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H7v-2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8.4 9 10 7.6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V6h2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.6 9l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2h-.2a1.7 1.7 0 0 0-1.4 1z',
    assessment: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2',
    training: 'M4 5h16v14H4zM8 9h8M8 13h5',
    progress: 'M4 19V5M4 19h16M8 16v-3M12 16V9M16 16v-6',
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.dashboard} /></svg>;
}
function Sidebar({ role, displayName, language, onLanguageChange, view, setView, onboardingLocked, hasOrganizations, onSignOut }: { role: AppRole; displayName: string; language: Language; onLanguageChange: (language: Language) => void; view: View; setView: (view: View) => void; onboardingLocked: boolean; hasOrganizations: boolean; onSignOut: () => void }) {
  const navigation = role === 'marics_admin'
    ? [['overview', 'dashboard', 'Dashboard'], ['users', 'users', 'Users'], ['organization', 'organization', 'Organizations'], ['modules', 'modules', 'Training modules'], ['reports', 'reports', 'Reports'], ['settings', 'settings', 'System settings']]
    : role === 'organization_admin'
      ? [['overview', 'dashboard', 'Dashboard'], ['organization', 'organization', 'Organization'], ['reports', 'reports', 'Reports'], ['settings', 'settings', 'Settings']]
      : role === 'employee'
        ? [['overview', 'dashboard', 'Dashboard'], ['assessment', 'assessment', 'My risk profile'], ['training', 'training', 'My training'], ['progress', 'progress', 'Progress'], ['organization', 'organization', 'Organization']]
        : [['overview', 'dashboard', 'Dashboard'], ['assessment', 'assessment', 'My risk profile'], ['training', 'training', 'Training'], ['progress', 'progress', 'Progress'], ['settings', 'settings', 'Settings']];
  return <aside className="sidebar"><div className="brand">MARICS<span>/ SECURITY</span></div><div className="profile-chip"><div className="avatar">{initials(displayName)}</div><div><strong>{displayName}</strong><small>{roleLabel(role)}</small></div></div>{onboardingLocked && <p className="sidebar-note">Finish your baseline assessment to unlock the rest of your workspace.</p>}<nav className="side-nav" aria-label="Main navigation">{navigation.map(([target, icon, label]) => <button key={target} className={view === target ? 'active' : ''} data-view={target} disabled={onboardingLocked && target !== 'assessment'} onClick={() => setView(target as View)}><NavIcon name={icon} /> {label}</button>)}</nav><div className="side-bottom"><label className="sidebar-language">Language<select aria-label="Language settings" value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Portuguese</option></select></label><button onClick={onSignOut}><span>&#8617;</span> Sign out</button><button><span>?</span> Help centre</button></div></aside>;
}

function AssessmentView({ language, t, loading, error, scenario, index, total, selectedOptionKey, onSelect, onSubmit, onRetry }: { language: Language; t: ReturnType<typeof getTranslations>; loading: boolean; error: string | null; scenario: OnboardingScenario | null; index: number; total: number; selectedOptionKey: 'A' | 'B' | 'C' | null; onSelect: (optionKey: 'A' | 'B' | 'C') => void; onSubmit: () => void; onRetry: () => void }) {
  if (error) return <section className="content assessment-view"><Header eyebrow={t.assessment.eyebrow} title="Your assessment could not load." detail={error} /><button className="primary action-button" onClick={onRetry}>Retry assessment <b>&#8594;</b></button></section>;
  if (loading || !scenario) return <section className="content assessment-view"><Header eyebrow={t.assessment.eyebrow} title="Loading your assessment..." detail="Preparing scenario-style onboarding questions from the training catalog." /></section>;
  const content = scenario.content[language] ?? scenario.content.en ?? Object.values(scenario.content)[0];
  const localized = (values: Record<string, string>) => values[language] ?? values.en ?? Object.values(values)[0] ?? '';
  return <section className="content assessment-view"><Header eyebrow={t.assessment.eyebrow} title={t.assessment.title} detail={t.assessment.body} /><div className="assessment-progress"><span>{t.common.question} {index + 1} {t.common.of} {total}</span><div><i style={{ width: `${((index + 1) / total) * 100}%` }} /></div></div><article className="question-card"><p className="question-dimension">{scenario.riskDimensions[0] ?? content?.title} {t.assessment.manipulation}</p><h2>{content?.scenario ?? content?.title}</h2><div className="option-list">{scenario.options.map((option) => <button key={option.optionKey} className={selectedOptionKey === option.optionKey ? 'option selected' : 'option'} onClick={() => onSelect(option.optionKey)}><span>{option.optionKey}</span>{localized(option.content)}</button>)}</div><button className="primary action-button" disabled={selectedOptionKey === null} onClick={onSubmit}>{index === total - 1 ? t.assessment.finish : t.assessment.continue} <b>&#8594;</b></button></article></section>;
}

function roleLabel(role: AppRole) {
  return role === 'marics_admin' ? 'MARICS administrator' : role === 'organization_admin' ? 'Organization administrator' : role === 'employee' ? 'Employee' : 'Individual account';
}

function AdminSecondaryView({ view, session }: { view: View; session: Session }) {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<unknown[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [scenarioModuleId, setScenarioModuleId] = useState('');
  const [scenarioSlug, setScenarioSlug] = useState('');
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [scenarioText, setScenarioText] = useState('');
  const [riskDimension, setRiskDimension] = useState('');
  const [optionText, setOptionText] = useState(['', '', '']);
  const [correctOption, setCorrectOption] = useState('0');
  const [feedback, setFeedback] = useState('');
  const load = async () => {
    setMessage(null);
    try {
      if (view === 'users') setRecords(await searchAdminUsers(session.access_token, query));
      else if (view === 'organization') setRecords(await searchAdminOrganizations(session.access_token, query));
      else if (view === 'modules') setRecords((await getAdminTrainingCatalog(session.access_token)).modules);
      else if (view === 'reports') setRecords((await getAdminAnalytics(session.access_token)).categoryWeakness);
      else if (view === 'settings') setRecords(await getAdminAuditLog(session.access_token));
      else setRecords([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Admin data could not be loaded.'); }
  };
  useEffect(() => { void load(); }, [view, session.access_token]);
  const updateRole = async (userId: string, role: string) => { try { await updateAdminUserRole(session.access_token, userId, role); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Role could not be updated.'); } };
  const toggleSuspension = async (user: { id: string; suspended: boolean }) => { try { await updateAdminUserSuspension(session.access_token, user.id, !user.suspended); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Account state could not be updated.'); } };
  if (String(view) === 'modules') return <section className="content"><Header eyebrow="MARICS administration / Training catalog" title="Training catalog" detail="Create, localize, edit, and publish the scenarios learners will practice." />{message && <div className="auth-message" role="alert">{message}</div>}<AdminScenarioEditor accessToken={session.access_token} modules={records as Array<{ id: string; slug: string; scenarioCount: number; published: boolean; archived: boolean }>} onMessage={setMessage} /></section>;
    const createScenario = async (event: FormEvent) => {
      event.preventDefault();
      try {
        await createAdminScenario(session.access_token, { moduleId: scenarioModuleId, slug: scenarioSlug, content: { en: { title: scenarioTitle, scenario: scenarioText } }, riskDimensions: [riskDimension], options: optionText.map((content, index) => ({ optionKey: String.fromCharCode(65 + index) as 'A' | 'B' | 'C', content: { en: content }, isCorrect: String(index) === correctOption, feedback: { en: { choice: feedback, explanation: feedback } } })) });
        setScenarioSlug(''); setScenarioTitle(''); setScenarioText(''); setRiskDimension(''); setOptionText(['', '', '']); setFeedback('');
        setMessage('Scenario created. Add more scenarios, then publish the module.');
        await load();
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Scenario could not be created.'); }
    };
  const labels: Record<string, string> = { users: 'Users', organization: 'Organizations', modules: 'Training catalog', reports: 'Platform analytics', settings: 'Audit log', 'ai-content': 'AI content', certificates: 'Certificates' };
  return <section className="content"><Header eyebrow={`MARICS administration / ${labels[view] ?? view}`} title={labels[view] ?? view} detail="Every record is loaded through the authenticated, audited admin API." />{message && <div className="auth-message" role="alert">{message}</div>}{(view === 'users' || view === 'organization') && <form className="org-toolbar" onSubmit={(event) => { event.preventDefault(); void load(); }}><label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${view === 'users' ? 'users' : 'organizations'}`} /></label><button className="text-button">Search <b>&#8594;</b></button></form>}{view === 'users' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; name: string; role: string; suspended: boolean }>).map((user) => <div className="admin-row" key={user.id}><strong>{user.name}</strong><span>{user.role} {user.suspended ? '· suspended' : ''}</span><select value={user.role} onChange={(event) => void updateRole(user.id, event.target.value)}><option value="individual">Individual</option><option value="employee">Employee</option><option value="organization_admin">Org admin</option><option value="marics_admin">MARICS admin</option></select><button className="text-button" onClick={() => void toggleSuspension(user)}>{user.suspended ? 'Reactivate' : 'Suspend'}</button></div>)}</div></article>}{view === 'organization' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; name: string; employeeCount: number; suspended: boolean }>).map((organization) => <div className="admin-row" key={organization.id}><strong>{organization.name}</strong><span>{organization.employeeCount} employees {organization.suspended ? '· suspended' : ''}</span></div>)}</div></article>}{view === 'modules' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; slug: string; scenarioCount: number; published: boolean; archived: boolean }>).map((module) => <div className="admin-row" key={module.id}><strong>{module.slug}</strong><span>{module.scenarioCount} scenarios · {module.published ? 'published' : 'draft'}{module.archived ? ' · archived' : ''}</span></div>)}</div></article>}{view === 'reports' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ category: string; weakPercent: number; weakCount: number }>).map((item) => <div className="admin-row" key={item.category}><strong>{item.category}</strong><span>{item.weakPercent}% weak ({item.weakCount})</span></div>)}</div></article>}{view === 'settings' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; action: string; targetType: string; createdAt: string }>).map((entry) => <div className="admin-row" key={entry.id}><strong>{entry.action}</strong><span>{entry.targetType} · {new Date(entry.createdAt).toLocaleString()}</span></div>)}</div></article>}{(view === 'ai-content' || view === 'certificates') && <article className="role-empty"><p className="card-kicker">PHASED CONTROL</p><h2>{view === 'ai-content' ? 'AI content moderation' : 'Certificate management'}</h2><p>This area remains intentionally staged until the corresponding product phase exists.</p></article>}</section>;
  const moduleRecords = records as Array<{ id: string; slug: string; scenarioCount: number; published: boolean; archived: boolean }>;
  return <section className="content"><Header eyebrow={`MARICS administration / ${labels[view] ?? view}`} title={labels[view] ?? view} detail="Every record is loaded through the authenticated, audited admin API." />{message && <div className="auth-message" role="alert">{message}</div>}{(view === 'users' || view === 'organization') && <form className="org-toolbar" onSubmit={(event) => { event.preventDefault(); void load(); }}><label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${view === 'users' ? 'users' : 'organizations'}`} /></label><button className="text-button">Search <b>&#8594;</b></button></form>}{view === 'users' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; name: string; role: string; suspended: boolean }>).map((user) => <div className="admin-row" key={user.id}><strong>{user.name}</strong><span>{user.role} {user.suspended ? '· suspended' : ''}</span><select value={user.role} onChange={(event) => void updateRole(user.id, event.target.value)}><option value="individual">Individual</option><option value="employee">Employee</option><option value="organization_admin">Org admin</option><option value="marics_admin">MARICS admin</option></select><button className="text-button" onClick={() => void toggleSuspension(user)}>{user.suspended ? 'Reactivate' : 'Suspend'}</button></div>)}</div></article>}{view === 'organization' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; name: string; employeeCount: number; suspended: boolean }>).map((organization) => <div className="admin-row" key={organization.id}><strong>{organization.name}</strong><span>{organization.employeeCount} employees {organization.suspended ? '· suspended' : ''}</span></div>)}</div></article>}{view === 'modules' && <><article className="admin-panel"><p className="card-kicker">CREATE SCENARIO</p><form className="admin-form" onSubmit={createScenario}><select value={scenarioModuleId} onChange={(event) => setScenarioModuleId(event.target.value)} required><option value="">Choose a module</option>{moduleRecords.map((module) => <option key={module.id} value={module.id}>{module.slug}</option>)}</select><input value={scenarioSlug} onChange={(event) => setScenarioSlug(event.target.value)} placeholder="scenario-slug" required /><input value={scenarioTitle} onChange={(event) => setScenarioTitle(event.target.value)} placeholder="Scenario title" required /><input value={riskDimension} onChange={(event) => setRiskDimension(event.target.value)} placeholder="Risk dimension" required /><textarea value={scenarioText} onChange={(event) => setScenarioText(event.target.value)} placeholder="What situation should the learner decide?" required /><label>Option A<input value={optionText[0]} onChange={(event) => setOptionText([event.target.value, optionText[1], optionText[2]])} required /></label><label>Option B<input value={optionText[1]} onChange={(event) => setOptionText([optionText[0], event.target.value, optionText[2]])} required /></label><label>Option C<input value={optionText[2]} onChange={(event) => setOptionText([optionText[0], optionText[1], event.target.value])} required /></label><select value={correctOption} onChange={(event) => setCorrectOption(event.target.value)}><option value="0">Option A is correct</option><option value="1">Option B is correct</option><option value="2">Option C is correct</option></select><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Feedback shown after the answer" required /><button className="primary">Create scenario <b>&#8594;</b></button></form></article><article className="admin-panel"><div className="admin-list">{moduleRecords.map((module) => <div className="admin-row" key={module.id}><strong>{module.slug}</strong><span>{module.scenarioCount} scenarios {module.archived ? '· archived' : ''}</span><button className="text-button" onClick={() => void setAdminModulePublished(session.access_token, module.id, !module.published).then(load).catch((error) => setMessage(error instanceof Error ? error.message : 'Module could not be updated.'))}>{module.published ? 'Unpublish' : 'Publish'}</button></div>)}</div></article></>}{view === 'reports' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ category: string; weakCount: number; assessedUsers: number; weakPercent: number }>).map((item) => <div className="admin-row" key={item.category}><strong>{item.category}</strong><span>{item.weakPercent}% focus area ({item.weakCount}/{item.assessedUsers})</span></div>)}</div></article>}{view === 'settings' && <article className="admin-panel"><div className="admin-list">{(records as Array<{ id: string; action: string; targetType: string; createdAt: string }>).map((entry) => <div className="admin-row" key={entry.id}><strong>{entry.action}</strong><span>{entry.targetType} · {new Date(entry.createdAt).toLocaleString()}</span></div>)}</div></article>}</section>;
}

function RoleSection({ role, view }: { role: AppRole; view: View }) {
  const labels: Record<View, string> = { overview: 'Dashboard', assessment: 'Risk profile', training: 'Training', organization: 'Organization', certificates: 'Certificates', progress: 'Progress', users: 'Users', modules: 'Training modules', 'ai-content': 'AI content', reports: 'Reports', settings: 'Settings' };
  const descriptions = role === 'marics_admin'
    ? 'Platform-level management stays separate from personal training. This area will expose audited controls and database-backed records.'
    : role === 'organization_admin'
      ? 'Organization management stays focused on aggregate participation, people, training configuration, and reports.'
      : 'This personal area will show your own progress and records only.';
  return <section className="content"><Header eyebrow={`${roleLabel(role)} / ${labels[view]}`} title={labels[view]} detail={descriptions} /><article className="role-empty"><p className="card-kicker">ROLE-SCOPED WORKSPACE</p><h2>No records to display yet.</h2><p>This view is intentionally separated from unrelated dashboard responsibilities. It will load only data permitted for your role when its backend service is available.</p></article></section>;
}

function CertificatesPlaceholder({ role }: { role: AppRole }) {
  return <section className="content"><Header eyebrow={`${roleLabel(role)} / Certificates`} title="Certificates" detail="Certificates are not implemented in the product yet." /><article className="role-empty"><p className="card-kicker">NOT YET AVAILABLE</p><h2>Certificate issuance and verification are still future work.</h2><p>This product does not currently generate certificates or expose a verification flow. The platform has a certificates table and admin count in the database, but there is no certificate feature surface in the app yet.</p></article></section>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
}

function OrganizationWorkspace({ session, organizations, setOrganizations }: { session: Session; organizations: Array<{ id: string; name: string; isAdmin: boolean }>; setOrganizations: Dispatch<SetStateAction<Array<{ id: string; name: string; isAdmin: boolean }>>> }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? '');
  const [dashboard, setDashboard] = useState<{ organization: { id: string; name: string }; employeeCount: number; trainedEmployees: number; attempted: number; correct: number; employees: Array<{ id: string; name: string; attempted: number; correct: number }>; teamRisk?: { employeeCount: number; assessedEmployees: number; categoryBreakdown: Array<{ category: string; weakCount: number; weakPercent: number }>; highestRiskArea: string; highestRiskPercent: number } } | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    getOrganizationDashboard(session.access_token, selectedOrganizationId).then(setDashboard).catch((error) => setMessage(error instanceof Error ? error.message : 'Organization dashboard could not be loaded.'));
  }, [selectedOrganizationId, session.access_token]);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setMessage(null);
    try {
      const organization = await createOrganization(session.access_token, organizationName);
      const next = [...organizations, { ...organization, isAdmin: true }]; setOrganizations(next); setOrganizationName(''); setSelectedOrganizationId(organization.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Organization could not be created.'); }
  };
  const invite = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedOrganizationId) return; setMessage(null);
    try { const result = await createInvitation(session.access_token, selectedOrganizationId, inviteEmail); setInviteToken(`${window.location.origin}/?invite=${result.token}`); setInviteEmail(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invitation could not be created.'); }
  };
  const report = async () => {
    if (!selectedOrganizationId) return;
    try {
      const [result, csv] = await Promise.all([createOrganizationReport(session.access_token, selectedOrganizationId), createOrganizationCsvReport(session.access_token, selectedOrganizationId)]);
      const jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
      const jsonLink = document.createElement('a'); jsonLink.href = jsonUrl; jsonLink.download = 'marics-organization-report.json'; jsonLink.click(); URL.revokeObjectURL(jsonUrl);
      const csvUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const csvLink = document.createElement('a'); csvLink.href = csvUrl; csvLink.download = 'marics-organization-report.csv'; csvLink.click(); URL.revokeObjectURL(csvUrl);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Report could not be generated.'); }
  };
  const csvReport = async () => {
    if (!selectedOrganizationId) return;
    try { const csv = await createOrganizationCsvReport(session.access_token, selectedOrganizationId); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'marics-organization-report.csv'; link.click(); URL.revokeObjectURL(url); } catch (error) { setMessage(error instanceof Error ? error.message : 'CSV report could not be generated.'); }
  };
  const accept = async (event: FormEvent) => {
    event.preventDefault(); setMessage(null);
    try { const result = await acceptOrganizationInvitation(session.access_token, joinToken); const refreshed = await getOrganizations(session.access_token); setOrganizations(refreshed); setSelectedOrganizationId(result.organizationId); setJoinToken(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invitation could not be accepted.'); }
  };

  return <section className="content"><Header eyebrow="Organizations / human risk" title={dashboard?.organization.name ?? 'Your organization'} detail="Understand team progress through aggregate signals, without exposing unnecessary personal information." />{organizations.length === 0 ? <div className="org-entry-grid"><article className="question-card org-create"><p className="question-dimension">Organization setup</p><h2>Create your first organization workspace.</h2><form onSubmit={create}><label className="org-label">Organization name<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required minLength={2} maxLength={180} /></label><button className="primary action-button">Create organization <b>&#8594;</b></button></form></article><article className="question-card org-create"><p className="question-dimension">Employee access</p><h2>Join with an invitation.</h2><form onSubmit={accept}><label className="org-label">Invitation token<input value={joinToken} onChange={(event) => setJoinToken(event.target.value)} required pattern="[a-fA-F0-9]{64}" /></label><button className="primary action-button">Accept invitation <b>&#8594;</b></button></form></article></div> : <><div className="org-toolbar"><label>Workspace<select value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><button className="text-button" onClick={report}>Download report <b>&#8595;</b></button></div>{dashboard && <><div className="org-metrics"><article><span>EMPLOYEES</span><strong>{dashboard.employeeCount}</strong></article><article><span>TRAINED</span><strong>{dashboard.trainedEmployees}</strong></article><article><span>SCENARIOS ATTEMPTED</span><strong>{dashboard.attempted}</strong></article><article><span>TEAM ACCURACY</span><strong>{dashboard.attempted ? Math.round((dashboard.correct / dashboard.attempted) * 100) : 0}%</strong></article></div><div className="org-columns"><article className="employee-panel"><div className="section-heading"><div><p className="card-kicker">EMPLOYEE PROGRESS</p><h2>Team activity</h2></div></div>{dashboard.employees.length ? <div className="employee-list">{dashboard.employees.map((employee) => <div className="employee-row" key={employee.id}><strong>{employee.name}</strong><span>{employee.attempted} attempts &#183; {employee.correct} correct</span></div>)}</div> : <div className="empty-state"><span aria-hidden="true">!</span><p>No employees yet.<br /><small>Invite your first team member below.</small></p></div>}</article><article className="invite-panel"><p className="card-kicker">INVITE EMPLOYEE</p><h2>Bring your team in.</h2><form onSubmit={invite}><label className="org-label">Work email<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label><button className="primary action-button">Create invitation <b>&#8594;</b></button></form>{inviteToken && <p className="invite-result">Invitation created. Share this one-time token securely:<br /><code>{inviteToken}</code></p>}</article></div></>}</>}</section>;
}

function OrganizationDashboard({ session, organizations }: { session: Session; organizations: Array<{ id: string; name: string; isAdmin: boolean }> }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof getOrganizationDashboard>> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) return;
    void getOrganizationDashboard(session.access_token, organizationId).then(setDashboard).catch((error) => setMessage(error instanceof Error ? error.message : 'Dashboard could not be loaded.'));
  }, [organizationId, session.access_token]);
  return <section className="content"><Header eyebrow="Organizations / dashboard" title={dashboard?.organization.name ?? 'Organization dashboard'} detail="Track aggregate workforce readiness and team progress." />{message && <div className="auth-message" role="alert">{message}</div>}{organizations.length ? <><div className="org-toolbar"><label>Workspace<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label></div>{dashboard ? <div className="org-metrics"><article><span>EMPLOYEES</span><strong>{dashboard.employeeCount}</strong></article><article><span>TRAINED</span><strong>{dashboard.trainedEmployees}</strong></article><article><span>SCENARIOS ATTEMPTED</span><strong>{dashboard.attempted}</strong></article><article><span>TEAM ACCURACY</span><strong>{dashboard.attempted ? Math.round((dashboard.correct / dashboard.attempted) * 100) : 0}%</strong></article></div> : <div className="auth-message">Loading dashboard data...</div>}</> : <article className="role-empty"><h2>Create an organization workspace first.</h2><p>The dashboard becomes available after the first workspace is created.</p></article>}</section>;
}

function OrganizationReports({ session, organizations }: { session: Session; organizations: Array<{ id: string; name: string; isAdmin: boolean }> }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [report, setReport] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!organizationId) return;
    void createOrganizationReport(session.access_token, organizationId).then(setReport).catch((error) => setMessage(error instanceof Error ? error.message : 'Report could not be loaded.'));
  }, [organizationId, session.access_token]);
  const download = async () => { if (!organizationId) return; try { const csv = await createOrganizationCsvReport(session.access_token, organizationId); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'marics-organization-report.csv'; link.click(); URL.revokeObjectURL(url); } catch (error) { setMessage(error instanceof Error ? error.message : 'CSV report could not be generated.'); } };
  return <section className="content"><Header eyebrow="Reports / organization" title="Team risk report" detail="Review aggregate organization reporting and export the current CSV." />{message && <div className="auth-message" role="alert">{message}</div>}{organizations.length ? <><div className="org-toolbar"><label>Workspace<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><button className="text-button" onClick={() => void download()}>Download CSV <b>&#8595;</b></button></div><article className="role-empty"><p className="card-kicker">AGGREGATE REPORT</p><h2>{report ? 'Report ready' : 'Loading report'}</h2><p>{report ? 'The report is generated from organization-level participation data.' : 'Preparing the current organization report.'}</p></article></> : <article className="role-empty"><h2>Create an organization workspace first.</h2></article>}</section>;
}

function OrganizationSettings({ session, organizations, setOrganizations }: { session: Session; organizations: Array<{ id: string; name: string; isAdmin: boolean }>; setOrganizations: Dispatch<SetStateAction<Array<{ id: string; name: string; isAdmin: boolean }>>> }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [name, setName] = useState(organizations[0]?.name ?? '');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { const organization = organizations.find((entry) => entry.id === organizationId); if (organization) setName(organization.name); }, [organizationId, organizations]);
  const save = async (event: FormEvent) => { event.preventDefault(); if (!organizationId) return; try { const updated = await updateOrganization(session.access_token, organizationId, { name }); setOrganizations((current) => current.map((entry) => entry.id === updated.id ? { ...entry, name: updated.name } : entry)); setMessage('Organization settings saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Organization settings could not be saved.'); } };
  return <section className="content"><Header eyebrow="Settings / organization" title="Organization settings" detail="Update the workspace name used for employee onboarding and reporting." />{message && <div className="auth-message" role="status">{message}</div>}{organizations.length ? <form className="question-card org-create" onSubmit={save}><label className="org-label">Workspace<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="org-label">Organization name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={180} /></label><button className="primary action-button">Save settings <b>&#8594;</b></button></form> : <article className="role-empty"><h2>Create an organization workspace first.</h2></article>}</section>;
}

function Header({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{detail}</p></div><button className="notification" aria-label="Notifications">&#9675;<i /></button></header>;
}

type TrainingSummary = { attempted: number; correct: number; lastAttemptAt: string | null; modules: Array<{ id: string; slug: string; title: Record<string, string>; scenarioCount: number; scenariosAttempted: number; scenariosCorrect: number; completed: boolean }>; recommendation: { slug: string; title: Record<string, string>; reason: 'focus-area' | 'next-unfinished' } | null };

function Overview({ displayName, onboardingComplete, riskProfile, trainingSummary, trainingModules, onAssessment, onTraining }: { displayName: string; onboardingComplete: boolean; riskProfile: RiskProfile | null; trainingSummary: TrainingSummary; trainingModules: TrainingModule[]; onAssessment: () => void; onTraining: () => void }) {
  const firstName = displayName.split(/\s+/)[0] || 'there';
  const progressBySlug = new Map(trainingSummary.modules.map((module) => [module.slug, module]));
  const modules = trainingModules.map((module, index) => {
    const progress = progressBySlug.get(module.slug);
    return { title: module.title.en ?? module.slug, label: String(index + 1).padStart(2, '0'), meta: `${progress?.scenariosAttempted ?? 0} / ${module.scenarioCount} scenarios`, tone: ['rust', 'blue', 'green'][index % 3] };
  });
  return <section className="content"><Header eyebrow="Saturday, 19 September 2026" title={`Good morning, ${firstName}.`} detail="Your personal security workspace. Small decisions, practiced often, create durable habits." /><div className="overview-grid"><article className="awareness-card"><div><p className="card-kicker">OVERALL AWARENESS</p><div className="score-line"><strong>{onboardingComplete ? 'Profile ready' : 'Not assessed'}</strong><span>{onboardingComplete && riskProfile ? `Strongest: ${riskProfile.strongest_dimension}` : 'Complete onboarding first'}</span></div></div><div className="ring"><span>{riskProfile?.awareness_score ?? '&#8212;'}</span><small>{onboardingComplete ? '/100' : ''}</small></div></article><article className="next-card"><p className="card-kicker">YOUR NEXT STEP</p><h2>{onboardingComplete ? `Practice ${trainingSummary.recommendation?.title.en ?? riskProfile?.focus_dimension ?? 'your focus area'}` : 'Complete your baseline'}</h2><p>{onboardingComplete ? trainingSummary.recommendation?.reason === 'focus-area' ? 'Recommended from your saved risk profile.' : 'Continue with your next unfinished module.' : 'Ten scenario-style questions map your strongest habits and focus areas.'}</p><button onClick={onboardingComplete ? onTraining : onAssessment}>{onboardingComplete ? 'Open training' : 'Start assessment'} <b>&#8594;</b></button></article></div>{onboardingComplete && riskProfile && <div className="org-metrics employee-metrics"><article><span>STRONGEST AREA</span><strong>{riskProfile.strongest_dimension}</strong></article><article><span>FOCUS AREA</span><strong>{riskProfile.focus_dimension}</strong></article><article><span>WEAK SIGNALS</span><strong>{Object.values(riskProfile.category_scores ?? {}).filter((score) => score === 'weak').length}</strong></article><article><span>STRONG SIGNALS</span><strong>{Object.values(riskProfile.category_scores ?? {}).filter((score) => score === 'strong').length}</strong></article></div>}<div className="section-heading"><div><p className="card-kicker">YOUR WORKSPACE</p><h2>Build your resilience</h2></div><button className="text-button" onClick={onTraining}>View all training <b>&#8594;</b></button></div><div className="module-grid">{modules.map(module => <article className={`module-card ${module.tone}`} key={module.title}><span>{module.label}</span><h3>{module.title}</h3><p>{module.meta}</p><button onClick={onTraining}>Explore <b>&#8594;</b></button></article>)}</div><div className="lower-grid"><article className="focus-card"><p className="card-kicker">RISK PROFILE</p><h2>{onboardingComplete ? `Focus area: ${riskProfile?.focus_dimension ?? 'Continued practice'}` : 'Your focus areas appear here'}</h2><p>{onboardingComplete ? `Strongest area: ${riskProfile?.strongest_dimension ?? 'Verification habits'}. Use training to turn focus areas into durable habits.` : 'Complete your assessment to see the manipulation patterns that deserve more practice.'}</p><button className="text-button" onClick={onAssessment}>{onboardingComplete ? 'Retake assessment' : 'Take assessment'} <b>&#8594;</b></button></article><article className="activity-card"><p className="card-kicker">RECENT ACTIVITY</p><div className="empty-state">{trainingSummary.attempted ? <p>{trainingSummary.attempted} scenario attempt{trainingSummary.attempted === 1 ? '' : 's'} saved.<br /><small>{trainingSummary.correct} correct response{trainingSummary.correct === 1 ? '' : 's'} so far.</small></p> : <><span>ai</span><p>No activity yet.<br /><small>Your training history will appear here.</small></p></>}</div></article></div></section>;
}

function TrainingView({ language, modules, selectedScenarioSlug, onScenarioSelect, scenario, loading, error, result, answer, onAnswer }: { language: Language; modules: TrainingModule[]; selectedScenarioSlug: string | null; onScenarioSelect: (scenarioSlug: string) => void; scenario: TrainingScenario | null; loading: boolean; error: string | null; result: { isCorrect: boolean; feedback: string; explanation: string; correctOptionKey: 'A' | 'B' | 'C' } | null; answer: TrainingAnswer | null; onAnswer: (answer: TrainingAnswer) => void }) {
  if (loading) return <section className="content"><Header eyebrow="Training" title="Loading your next scenario." detail="Preparing a database-backed training situation." /></section>;
  if (error) return <section className="content"><Header eyebrow="Training" title="Training is unavailable." detail={error} /></section>;
  if (!scenario) return <section className="content"><Header eyebrow="Training" title={modules.length ? 'Published modules have no scenarios yet.' : 'No training is published yet.'} detail={modules.length ? 'Your administrator has published a module, but scenario content still needs to be added.' : 'Your administrator will make scenarios available here.'} /></section>;
  const content = scenario.content[language] ?? scenario.content.en ?? Object.values(scenario.content)[0];
  const localized = (values: Record<string, string>) => values[language] ?? values.en ?? Object.values(values)[0] ?? '';
  const optionText = (key: 'A' | 'B' | 'C') => localized(scenario.options.find((option) => option.option_key === key)?.content ?? {});
  return <section className="content"><Header eyebrow={`Training / ${scenario.module.title[language] ?? scenario.module.title.en ?? scenario.module.slug}`} title={content?.title ?? 'Verify before you act.'} detail={content?.scenario ?? 'A realistic request. Choose the response you would make.'} /><article className="scenario-card"><label className="scenario-picker">Choose a scenario<select value={selectedScenarioSlug ?? ''} onChange={(event) => onScenarioSelect(event.target.value)}>{modules.flatMap((module) => module.scenarioSlugs.map((slug) => <option key={slug} value={slug}>{module.title[language] ?? module.title.en ?? module.slug} / {slug}</option>))}</select></label><div className="scenario-meta">{scenario.riskDimensions.map((dimension) => <span key={dimension}>{dimension}</span>)}</div><div className="message"><div className="message-top"><div className="avatar manager">{content?.sender?.slice(0, 2).toUpperCase() ?? 'MR'}</div><div><strong>{content?.sender ?? 'MARICS scenario'}</strong><small>{content?.channel ?? 'Training scenario'}</small></div></div><p>{content?.message ?? content?.scenario}</p></div><h2>What should you do?</h2><div className="training-options">{(['A', 'B', 'C'] as const).map((key) => <button key={key} className={answer === (key === 'B' ? 'verify' : key === 'A' ? 'act' : 'ignore') ? 'selected' : ''} onClick={() => onAnswer(key === 'B' ? 'verify' : key === 'A' ? 'act' : 'ignore')}><b>{key}</b>{optionText(key)}</button>)}</div>{result && <div className={`feedback ${result.isCorrect ? 'good' : 'bad'}`}><strong>{result.isCorrect ? 'Correct — and here is why it matters' : 'Not quite — learn the safer response'}</strong><p>{result.feedback}</p><p className="feedback-explanation"><em>Why this is the risk:</em> {result.explanation}</p>{!result.isCorrect && <p className="feedback-correct">The strongest response is option {result.correctOptionKey}.</p>}<span>Manipulation signals: {scenario.riskDimensions.join(' + ')}</span></div>}</article></section>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);












