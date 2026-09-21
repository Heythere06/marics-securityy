import { StrictMode, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { acceptOrganizationInvitation, createAdminModule, createInvitation, createOrganization, createOrganizationReport, getAdminOverview, getOrganizationDashboard, getOrganizations, getProfile, getTrainingSummary, saveTrainingAnswer, setAdminLanguages, setAdminModulePublished, submitAssessment as saveAssessment, updateLanguage, type AdminOverview } from './lib/api';
import { supabase } from './lib/supabase';
import { getTranslations, type Language } from './i18n';
import './styles.css';

type View = 'overview' | 'assessment' | 'training' | 'organization' | 'certificates' | 'progress' | 'users' | 'modules' | 'ai-content' | 'reports' | 'settings';
type AppRole = 'individual' | 'employee' | 'organization_admin' | 'marics_admin';
type TrainingAnswer = 'verify' | 'act' | 'ignore';

const modules = [
  { title: 'Email phishing', label: '01', meta: '5 scenarios', tone: 'rust' },
  { title: 'Impersonation & trust', label: '02', meta: '4 scenarios', tone: 'blue' },
  { title: 'Banking scams', label: '03', meta: '6 scenarios', tone: 'green' },
];
const assessmentKeys = ['urgency', 'authority', 'curiosity', 'fear', 'trust', 'scarcity', 'social_pressure', 'financial_manipulation', 'credential_theft', 'impersonation'];

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppRole>('individual');
  const [authReady, setAuthReady] = useState(supabase === null);
  const [view, setView] = useState<View>('overview');
  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [trainingAnswer, setTrainingAnswer] = useState<TrainingAnswer | null>(null);
  const [riskProfile, setRiskProfile] = useState<{ focus_dimension: string; awareness_score: number } | null>(null);
  const [trainingSummary, setTrainingSummary] = useState<{ attempted: number; correct: number; lastAttemptAt: string | null }>({ attempted: 0, correct: 0, lastAttemptAt: null });
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; isAdmin: boolean }>>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const t = getTranslations(language);
  const assessmentQuestions = (t.assessment.questions.length === 10 ? t.assessment.questions : getTranslations('en').assessment.questions);
  const completed = assessmentAnswers.length === assessmentQuestions.length;

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
    getProfile(session.access_token).then((profile) => {
      if (profile?.full_name) setDisplayName(profile.full_name);
      if (profile?.role) setRole(profile.role);
    }).catch(() => undefined);
    getTrainingSummary(session.access_token).then(setTrainingSummary).catch(() => undefined);
    getOrganizations(session.access_token).then(setOrganizations).catch(() => undefined);
  }, [session]);

  const submitAssessment = async () => {
    if (selected === null) return;
    setAssessmentAnswers([...assessmentAnswers, selected]);
    setSelected(null);
    if (assessmentIndex < assessmentQuestions.length - 1) {
      setAssessmentIndex(assessmentIndex + 1);
      return;
    }
    if (!session) return;
    try {
      const profile = await saveAssessment(session.access_token, assessmentQuestions.map((question, index) => ({ questionKey: assessmentKeys[index], selectedOption: index === assessmentIndex ? selected : assessmentAnswers[index], riskDimension: question.dimension })));
      setRiskProfile(profile);
      setView('overview');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your assessment.');
    }
  };

  const handleTrainingAnswer = async (answer: TrainingAnswer) => {
    setTrainingAnswer(answer);
    if (!session) return;
    try {
      const result = await saveTrainingAnswer(session.access_token, 'whatsapp-gift-cards', answer === 'verify' ? 'B' : answer === 'act' ? 'A' : 'C');
      setTrainingSummary((current) => ({ attempted: current.attempted + 1, correct: current.correct + (result.isCorrect ? 1 : 0), lastAttemptAt: new Date().toISOString() }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your training answer.');
    }
  };

  if (!authReady) return <div className="loading-screen">Loading your secure workspace...</div>;
  if (!session) return <PublicSite language={language} setLanguage={setLanguage} />;

  return <main className="workspace">
    <Sidebar role={role} displayName={displayName} language={language} onLanguageChange={(nextLanguage) => { setLanguage(nextLanguage); if (session) updateLanguage(session.access_token, nextLanguage).catch(() => setSaveError('We could not save your language preference.')); }} view={view} setView={setView} hasOrganizations={organizations.length > 0} onSignOut={() => supabase?.auth.signOut()} />
    {view === 'overview' && role === 'marics_admin' && <PlatformAdminDashboard displayName={displayName} session={session} />}
    {view === 'overview' && role === 'employee' && <EmployeeDashboard displayName={displayName} organizations={organizations} trainingSummary={trainingSummary} onAssessment={() => setView('assessment')} onTraining={() => setView('training')} />}
    {view === 'overview' && role === 'organization_admin' && <OrganizationView session={session} organizations={organizations} setOrganizations={setOrganizations} />}
    {view === 'overview' && role === 'individual' && <Overview displayName={displayName} completed={completed} riskProfile={riskProfile} trainingSummary={trainingSummary} onAssessment={() => setView('assessment')} onTraining={() => setView('training')} />}
    {view === 'assessment' && (role === 'individual' || role === 'employee') && <section className="content assessment-view"><Header eyebrow={t.assessment.eyebrow} title={t.assessment.title} detail={t.assessment.body} /><div className="assessment-progress"><span>{t.common.question} {assessmentIndex + 1} {t.common.of} {assessmentQuestions.length}</span><div><i style={{ width: `${((assessmentIndex + 1) / assessmentQuestions.length) * 100}%` }} /></div></div><article className="question-card"><p className="question-dimension">{assessmentQuestions[assessmentIndex].dimension} {t.assessment.manipulation}</p><h2>{assessmentQuestions[assessmentIndex].prompt}</h2><div className="option-list">{assessmentQuestions[assessmentIndex].options.map((option, index) => <button key={option} className={selected === index ? 'option selected' : 'option'} onClick={() => setSelected(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><button className="primary action-button" disabled={selected === null} onClick={submitAssessment}>{assessmentIndex === assessmentQuestions.length - 1 ? t.assessment.finish : t.assessment.continue} <b>→</b></button></article></section>}
    {view === 'training' && (role === 'individual' || role === 'employee') && <TrainingView answer={trainingAnswer} onAnswer={handleTrainingAnswer} />}
    {view === 'organization' && role === 'organization_admin' && <OrganizationView session={session} organizations={organizations} setOrganizations={setOrganizations} />}
    {view !== 'overview' && view !== 'assessment' && view !== 'training' && view !== 'organization' && <RoleSection role={role} view={view} />}
    {saveError && <div className="toast error" role="alert">{saveError}</div>}
  </main>;
}

function PublicSite({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const [showAuth, setShowAuth] = useState(false);
  const t = getTranslations(language);
  if (showAuth) return <AuthScreen configured={supabase !== null} language={language} setLanguage={(value) => setLanguage(value as Language)} />;
  return <main className="public-site"><nav className="public-nav"><img className="public-logo" src="/assets/marics-logo.png.png" alt="MARICS Security" /><div className="public-links"><a href="#why">{t.nav.howItWorks}</a><a href="#features">{t.nav.features}</a><a href="#organizations">{t.nav.organizations}</a><a href="#pricing">{t.nav.pricing}</a></div><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">EN</option><option value="af">AF</option><option value="pt">PT</option></select><button onClick={() => setShowAuth(true)}>{t.nav.login}</button></nav><section className="public-hero"><div className="hero-copy"><p className="eyebrow">{t.landing.eyebrow}</p><h1>{t.landing.title}</h1><p className="public-lede">{t.landing.body}</p><div className="public-actions"><button className="primary" onClick={() => setShowAuth(true)}>{t.landing.primary} <b>→</b></button><a href="#why">{t.landing.secondary} <span>↓</span></a></div></div><div className="hero-visual"><img src="/assets/marics-dashboard.jpg.jpeg" alt="MARICS security operations dashboard" /><span className="pulse-tag">LIVE HUMAN RISK SIGNALS</span></div></section><section id="why" className="why-section"><div className="why-overlay"><p className="eyebrow">01 / WHY MARICS</p><h2>{t.landing.intro}</h2><p>{t.landing.introBody}</p><div className="why-stat"><strong>01</strong><span>Practice the pressure before it becomes a breach.</span></div></div></section><section id="features" className="public-intro"><div><p className="eyebrow">02 / THE MARICS METHOD</p><h2>{t.landing.how}</h2></div><div className="intro-visual"><img src="/assets/marics-mobile.jpg.png" alt="A mobile security training scenario" /><p>{t.landing.introBody}</p></div></section><section id="organizations" className="people-section"><div className="people-visual"><img src="/assets/marics-team.jpg.png" alt="A team collaborating around cybersecurity" /></div><div><p className="eyebrow">03 / FOR ORGANIZATIONS</p><h2>Make resilience a team habit.</h2><p>{t.landing.security}</p><a href="#pricing">Explore organization intelligence →</a></div></section><section className="public-steps">{t.landing.features.map((feature, index) => <article key={feature}><span>0{index + 1}</span><h3>{feature}</h3><p>{t.landing.introBody}</p></article>)}</section><section className="security-section"><img src="/assets/marics-security-team.jpg.jpeg" alt="Cybersecurity team protecting an organization" /><div><p className="eyebrow">04 / BUILT FOR TRUST</p><h2>Security awareness that feels close to the real world.</h2><p>{t.landing.security}</p></div></section><section id="pricing" className="public-cta"><p className="eyebrow">MARICS / SECURITY</p><h2>{t.landing.cta}</h2><button className="primary" onClick={() => setShowAuth(true)}>{t.landing.primary} <b>→</b></button></section><footer><span>{t.landing.footer}</span><span>{t.nav.about} · {t.nav.demo} · {t.nav.signup}</span></footer></main>;
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    if (mode === 'sign-in') {
      const result = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (result.error) setMessage('We could not complete that request. Check your details and try again.');
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
    if (result.error) setMessage('We could not complete that request. Check your details and try again.');
    else if (!result.data.session) setMessage('Check your email to verify your account, then sign in.');
  };

  return <main className="auth-shell"><section className="auth-panel"><div className="brand auth-brand">MARICS<span>/ SECURITY</span></div><p className="eyebrow">Human risk intelligence platform</p><h1>{mode === 'sign-in' ? 'Welcome back.' : mode === 'reset' ? 'Reset your password.' : 'Build safer habits.'}</h1><p className="lede">Your private workspace for practicing the decisions attackers try to rush.</p>{!configured ? <div className="auth-message">Supabase is not configured for the frontend yet. Add the Vite Supabase variables to your local environment and restart the dev server.</div> : <form onSubmit={submit}>{mode === 'sign-up' && <><label>Name<input value={fullName} onChange={event => setFullName(event.target.value)} required /></label><label>Country or region<input value={countryCode} onChange={event => setCountryCode(event.target.value.toUpperCase())} maxLength={2} placeholder="ZA" required /></label><label>Preferred language<select value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Português</option></select></label><label>Account type<select value={accountType} onChange={event => setAccountType(event.target.value)}><option value="individual">Individual</option><option value="organization">Organization administrator</option></select></label></>}<label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>{mode !== 'reset' && <label>Password<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Working...' : mode === 'sign-in' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Create account'} <b>→</b></button>{message && <p className="auth-message" role="status">{message}</p>}</form>}<div className="auth-links"><button className="auth-switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>{mode === 'sign-in' ? 'Need an account? Sign up' : 'Back to sign in'}</button>{mode === 'sign-in' && <button className="auth-switch" onClick={() => setMode('reset')}>Forgot password?</button>}</div></section></main>;
}

function EmployeeDashboard({ displayName, organizations, trainingSummary, onAssessment, onTraining }: { displayName: string; organizations: Array<{ id: string; name: string; isAdmin: boolean }>; trainingSummary: { attempted: number; correct: number; lastAttemptAt: string | null }; onAssessment: () => void; onTraining: () => void }) {
  return <section className="content"><Header eyebrow="Employee workspace" title={`Good morning, ${displayName.split(/\s+/)[0] || 'there'}.`} detail="Your personal learning path, connected to your organization without exposing unnecessary personal information." /><div className="role-banner"><div><p className="card-kicker">ORGANIZATION MEMBERSHIP</p><h2>{organizations.map((organization) => organization.name).join(' · ') || 'Invitation pending'}</h2><p>Your employer can see aggregate team progress. Your individual answers remain yours.</p></div><span className="role-pill">EMPLOYEE</span></div><div className="org-metrics employee-metrics"><article><span>YOUR ATTEMPTS</span><strong>{trainingSummary.attempted}</strong></article><article><span>YOUR CORRECT</span><strong>{trainingSummary.correct}</strong></article><article><span>ACCURACY</span><strong>{trainingSummary.attempted ? Math.round((trainingSummary.correct / trainingSummary.attempted) * 100) : 0}%</strong></article><article><span>MODULES</span><strong>0 / 12</strong></article></div><div className="role-columns"><article className="focus-card"><p className="card-kicker">RECOMMENDED NEXT</p><h2>Practice your next scenario</h2><p>Build confidence with realistic decisions and immediate explanations.</p><button className="text-button" onClick={onTraining}>Continue training <b>→</b></button></article><article className="focus-card"><p className="card-kicker">ONBOARDING</p><h2>Keep your profile current</h2><p>Complete the baseline assessment to receive recommendations matched to your risk profile.</p><button className="text-button" onClick={onAssessment}>Start assessment <b>→</b></button></article></div></section>;
}

function PlatformAdminDashboard({ displayName, session }: { displayName: string; session: Session }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [moduleSlug, setModuleSlug] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { getAdminOverview(session.access_token).then(setOverview).catch((error) => setMessage(error instanceof Error ? error.message : 'Admin dashboard could not be loaded.')); }, [session.access_token]);
  const createModule = async (event: FormEvent) => { event.preventDefault(); try { await createAdminModule(session.access_token, { slug: moduleSlug, title: moduleTitle, description: moduleDescription }); setModuleSlug(''); setModuleTitle(''); setModuleDescription(''); setOverview(await getAdminOverview(session.access_token)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Module could not be created.'); } };
  const toggleModule = async (id: string, published: boolean) => { try { await setAdminModulePublished(session.access_token, id, published); setOverview(await getAdminOverview(session.access_token)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Module could not be updated.'); } };
  const updateLanguages = async (event: ChangeEvent<HTMLSelectElement>) => { const values = Array.from(event.target.selectedOptions).map((option) => option.value); try { await setAdminLanguages(session.access_token, values); setOverview((current) => current ? { ...current, languages: values } : current); } catch (error) { setMessage(error instanceof Error ? error.message : 'Languages could not be updated.'); } };
  const counts = overview?.counts ?? { users: 0, organizations: 0, modules: 0, publishedModules: 0, generatedContent: 0, certificates: 0 };
  return <section className="content"><Header eyebrow="MARICS administration" title={`Welcome, ${displayName.split(/\s+/)[0] || 'admin'}.`} detail="Manage platform users, tenants, training content, AI output, languages, certificates, and reports from one protected control plane." />{message && <div className="auth-message" role="alert">{message}</div>}<div className="admin-grid"><article className="admin-card"><span>USERS</span><strong>{counts.users}</strong><p>Profiles in the platform.</p></article><article className="admin-card"><span>ORGANIZATIONS</span><strong>{counts.organizations}</strong><p>Tenant workspaces.</p></article><article className="admin-card"><span>MODULES</span><strong>{counts.publishedModules} / {counts.modules}</strong><p>Published training modules.</p></article><article className="admin-card"><span>AI CONTENT</span><strong>{counts.generatedContent}</strong><p>Validated generated scenarios.</p></article><article className="admin-card"><span>CERTIFICATES</span><strong>{counts.certificates}</strong><p>Issued certificates.</p></article></div>{overview ? <><div className="admin-columns"><article className="admin-panel"><p className="card-kicker">RECENT USERS</p><div className="admin-list">{overview.users.length ? overview.users.map((user) => <div className="admin-row" key={user.id}><strong>{user.name}</strong><span>{user.role} · {user.language}</span></div>) : <p className="admin-empty-text">No users found.</p>}</div></article><article className="admin-panel"><p className="card-kicker">ORGANIZATIONS</p><div className="admin-list">{overview.organizations.length ? overview.organizations.map((organization) => <div className="admin-row" key={organization.id}><strong>{organization.name}</strong><span>Tenant workspace</span></div>) : <p className="admin-empty-text">No organizations found.</p>}</div></article></div><div className="admin-columns"><article className="admin-panel"><p className="card-kicker">MODULE MANAGEMENT</p><form className="admin-form" onSubmit={createModule}><input value={moduleSlug} onChange={(event) => setModuleSlug(event.target.value)} placeholder="module-slug" required /><input value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} placeholder="Module title" required /><input value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} placeholder="Description" required /><button className="primary">Add module <b>→</b></button></form><div className="admin-list">{overview.modules.map((module) => <div className="admin-row" key={module.id}><strong>{module.title.en ?? module.slug}</strong><button className="text-button" onClick={() => toggleModule(module.id, !module.published)}>{module.published ? 'Unpublish' : 'Publish'}</button></div>)}</div></article><article className="admin-panel"><p className="card-kicker">PLATFORM SETTINGS</p><label className="org-label">Supported languages<select multiple value={overview.languages} onChange={updateLanguages}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Português</option></select></label><p className="admin-empty-text">AI content: {overview.aiContent.length} recent records. Certificates and reports remain available through their audited services.</p></article></div></> : <article className="admin-empty"><p className="card-kicker">ADMIN CONTROL PLANE</p><h2>Loading platform data...</h2></article>}</section>;
}

function Sidebar({ role, displayName, language, onLanguageChange, view, setView, hasOrganizations, onSignOut }: { role: AppRole; displayName: string; language: Language; onLanguageChange: (language: Language) => void; view: View; setView: (view: View) => void; hasOrganizations: boolean; onSignOut: () => void }) {
  const navigation = role === 'marics_admin'
    ? [['overview', '▦', 'Dashboard'], ['users', '♙', 'Users'], ['organization', '⌂', 'Organizations'], ['modules', '▣', 'Training modules'], ['ai-content', '✦', 'AI content'], ['certificates', '◇', 'Certificates'], ['reports', '▤', 'Reports'], ['settings', '⚙', 'System settings']]
    : role === 'organization_admin'
      ? [['overview', '▦', 'Dashboard'], ['organization', '⌂', 'Organization'], ['reports', '▤', 'Reports'], ['certificates', '◇', 'Certificates'], ['settings', '⚙', 'Settings']]
      : role === 'employee'
        ? [['overview', '▦', 'Dashboard'], ['assessment', '◎', 'My risk profile'], ['training', '▣', 'My training'], ['progress', '◌', 'Progress'], ['certificates', '◇', 'Certificates'], ['organization', '⌂', 'Organization']]
        : [['overview', '▦', 'Dashboard'], ['assessment', '◎', 'My risk profile'], ['training', '▣', 'Training'], ['progress', '◌', 'Progress'], ['certificates', '◇', 'Certificates'], ['settings', '⚙', 'Settings']];
  return <aside className="sidebar"><div className="brand">MARICS<span>/ SECURITY</span></div><div className="profile-chip"><div className="avatar">{initials(displayName)}</div><div><strong>{displayName}</strong><small>{roleLabel(role)}</small></div></div><nav className="side-nav" aria-label="Main navigation">{navigation.map(([target, icon, label]) => <button key={target} className={view === target ? 'active' : ''} onClick={() => setView(target as View)}><span>{icon}</span> {label}</button>)}</nav><div className="side-bottom"><label className="sidebar-language">Language<select aria-label="Language settings" value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Português</option></select></label><button onClick={onSignOut}><span>↪</span> Sign out</button><button><span>?</span> Help centre</button></div></aside>;
}

function roleLabel(role: AppRole) {
  return role === 'marics_admin' ? 'MARICS administrator' : role === 'organization_admin' ? 'Organization administrator' : role === 'employee' ? 'Employee' : 'Individual account';
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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
}

function OrganizationView({ session, organizations, setOrganizations }: { session: Session; organizations: Array<{ id: string; name: string; isAdmin: boolean }>; setOrganizations: (organizations: Array<{ id: string; name: string; isAdmin: boolean }>) => void }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? '');
  const [dashboard, setDashboard] = useState<{ organization: { id: string; name: string }; employeeCount: number; trainedEmployees: number; attempted: number; correct: number; employees: Array<{ id: string; name: string; attempted: number; correct: number }> } | null>(null);
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
    try { const result = await createInvitation(session.access_token, selectedOrganizationId, inviteEmail); setInviteToken(result.token); setInviteEmail(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invitation could not be created.'); }
  };
  const report = async () => {
    if (!selectedOrganizationId) return;
    try { const result = await createOrganizationReport(session.access_token, selectedOrganizationId); const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'marics-organization-report.json'; link.click(); URL.revokeObjectURL(url); } catch (error) { setMessage(error instanceof Error ? error.message : 'Report could not be generated.'); }
  };
  const accept = async (event: FormEvent) => {
    event.preventDefault(); setMessage(null);
    try { const result = await acceptOrganizationInvitation(session.access_token, joinToken); const refreshed = await getOrganizations(session.access_token); setOrganizations(refreshed); setSelectedOrganizationId(result.organizationId); setJoinToken(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Invitation could not be accepted.'); }
  };

  return <section className="content"><Header eyebrow="Organizations / human risk" title={dashboard?.organization.name ?? 'Your organization'} detail="Understand team progress through aggregate signals, without exposing unnecessary personal information." />{organizations.length === 0 ? <div className="org-entry-grid"><article className="question-card org-create"><p className="question-dimension">Organization setup</p><h2>Create your first organization workspace.</h2><form onSubmit={create}><label className="org-label">Organization name<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required minLength={2} maxLength={180} /></label><button className="primary action-button">Create organization <b>→</b></button></form></article><article className="question-card org-create"><p className="question-dimension">Employee access</p><h2>Join with an invitation.</h2><form onSubmit={accept}><label className="org-label">Invitation token<input value={joinToken} onChange={(event) => setJoinToken(event.target.value)} required pattern="[a-fA-F0-9]{64}" /></label><button className="primary action-button">Accept invitation <b>→</b></button></form></article></div> : <><div className="org-toolbar"><label>Workspace<select value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><button className="text-button" onClick={report}>Download report <b>↓</b></button></div>{dashboard && <><div className="org-metrics"><article><span>EMPLOYEES</span><strong>{dashboard.employeeCount}</strong></article><article><span>TRAINED</span><strong>{dashboard.trainedEmployees}</strong></article><article><span>SCENARIOS ATTEMPTED</span><strong>{dashboard.attempted}</strong></article><article><span>TEAM ACCURACY</span><strong>{dashboard.attempted ? Math.round((dashboard.correct / dashboard.attempted) * 100) : 0}%</strong></article></div><div className="org-columns"><article className="employee-panel"><div className="section-heading"><div><p className="card-kicker">EMPLOYEE PROGRESS</p><h2>Team activity</h2></div></div>{dashboard.employees.length ? <div className="employee-list">{dashboard.employees.map((employee) => <div className="employee-row" key={employee.id}><strong>{employee.name}</strong><span>{employee.attempted} attempts · {employee.correct} correct</span></div>)}</div> : <div className="empty-state"><span>✦</span><p>No employees yet.<br /><small>Invite your first team member below.</small></p></div>}</article><article className="invite-panel"><p className="card-kicker">INVITE EMPLOYEE</p><h2>Bring your team in.</h2><form onSubmit={invite}><label className="org-label">Work email<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label><button className="primary action-button">Create invitation <b>→</b></button></form>{inviteToken && <p className="invite-result">Invitation created. Share this one-time token securely:<br /><code>{inviteToken}</code></p>}</article></div></>}</>}</section>;
}

function Header({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{detail}</p></div><button className="notification" aria-label="Notifications">○<i /></button></header>;
}

function Overview({ displayName, completed, riskProfile, trainingSummary, onAssessment, onTraining }: { displayName: string; completed: boolean; riskProfile: { focus_dimension: string; awareness_score: number } | null; trainingSummary: { attempted: number; correct: number; lastAttemptAt: string | null }; onAssessment: () => void; onTraining: () => void }) {
  const firstName = displayName.split(/\s+/)[0] || 'there';
  return <section className="content"><Header eyebrow="Saturday, 19 September 2026" title={`Good morning, ${firstName}.`} detail="Your personal security workspace. Small decisions, practiced often, create durable habits." /><div className="overview-grid"><article className="awareness-card"><div><p className="card-kicker">OVERALL AWARENESS</p><div className="score-line"><strong>{completed ? 'Building' : 'Not assessed'}</strong><span>{completed ? 'Profile ready' : 'Start with 3 scenarios'}</span></div></div><div className="ring"><span>{riskProfile?.awareness_score ?? '—'}</span><small>{completed ? '/100' : ''}</small></div></article><article className="next-card"><p className="card-kicker">YOUR NEXT STEP</p><h2>{completed ? `Practice ${riskProfile?.focus_dimension ?? 'your focus area'}` : 'Complete your baseline'}</h2><p>{completed ? 'One focused session is waiting in your training path.' : 'A short assessment reveals where realistic pressure could affect your decisions.'}</p><button onClick={completed ? onTraining : onAssessment}>{completed ? 'Open training' : 'Start assessment'} <b>→</b></button></article></div><div className="section-heading"><div><p className="card-kicker">YOUR WORKSPACE</p><h2>Build your resilience</h2></div><button className="text-button" onClick={onTraining}>View all training <b>→</b></button></div><div className="module-grid">{modules.map(module => <article className={`module-card ${module.tone}`} key={module.title}><span>{module.label}</span><h3>{module.title}</h3><p>{module.meta}</p><button onClick={onTraining}>Explore <b>→</b></button></article>)}</div><div className="lower-grid"><article className="focus-card"><p className="card-kicker">RISK PROFILE</p><h2>{completed ? `${riskProfile?.focus_dimension ?? 'Your focus area'} needs your attention` : 'Your focus areas appear here'}</h2><p>{completed ? 'Your assessment points to this manipulation pattern as a useful place to practice next.' : 'Complete your assessment to see the manipulation patterns that deserve more practice, with context behind every recommendation.'}</p><button className="text-button" onClick={onAssessment}>{completed ? 'Retake assessment' : 'Take assessment'} <b>→</b></button></article><article className="activity-card"><p className="card-kicker">RECENT ACTIVITY</p><div className="empty-state">{trainingSummary.attempted ? <p>{trainingSummary.attempted} scenario attempt{trainingSummary.attempted === 1 ? '' : 's'} saved.<br /><small>{trainingSummary.correct} correct response{trainingSummary.correct === 1 ? '' : 's'} so far.</small></p> : <><span>✦</span><p>No activity yet.<br /><small>Your training history will appear here.</small></p></>}</div></article></div></section>;
}

function TrainingView({ answer, onAnswer }: { answer: TrainingAnswer | null; onAnswer: (answer: TrainingAnswer) => void }) {
  return <section className="content"><Header eyebrow="Training / scenario 01" title="Verify before you act." detail="A realistic request. A moment to slow down. Choose the response you would make." /><article className="scenario-card"><div className="scenario-meta"><span>WHATSAPP</span><span>AUTHORITY + URGENCY</span></div><div className="message"><div className="message-top"><div className="avatar manager">AM</div><div><strong>Alex Morgan</strong><small>Today, 10:42</small></div><span>•••</span></div><p>Hey, I’m in a meeting and need you to buy six gift cards for a client. Send me the codes when you have them. I’ll reimburse you this afternoon.</p></div><h2>What should you do?</h2><div className="training-options"><button className={answer === 'act' ? 'selected' : ''} onClick={() => onAnswer('act')}><b>A</b>Buy the gift cards immediately so the client is not delayed.</button><button className={answer === 'verify' ? 'selected correct' : ''} onClick={() => onAnswer('verify')}><b>B</b>Verify the request using a trusted channel before acting.</button><button className={answer === 'ignore' ? 'selected' : ''} onClick={() => onAnswer('ignore')}><b>C</b>Ignore the message and do not report it.</button></div>{answer && <div className={`feedback ${answer === 'verify' ? 'good' : 'bad'}`}><strong>{answer === 'verify' ? 'Correct response' : 'Risky response'}</strong><p>{answer === 'verify' ? 'This request combines authority and urgency to make normal verification feel inconvenient. Confirm Alex’s request through a known phone number or in person.' : 'The pressure to act quickly is the warning sign. Never send money or codes based on an unexpected message, even when it appears to come from someone senior.'}</p><span>Manipulation technique: Authority + urgency</span></div>}</article></section>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);