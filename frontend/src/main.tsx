import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { getProfile, submitAssessment as saveAssessment } from './lib/api';
import { supabase } from './lib/supabase';
import './styles.css';

type View = 'overview' | 'assessment' | 'training';
type TrainingAnswer = 'verify' | 'act' | 'ignore';

const assessmentQuestions = [
  { prompt: 'Your bank texts: “Suspicious activity detected. Confirm your account within 10 minutes.” What do you do?', dimension: 'Urgency', options: ['Open the link before the account is locked.', 'Open your banking app directly or call the number on your card.', 'Reply STOP and wait for another message.'] },
  { prompt: 'A senior colleague asks for an urgent payment change by email. The tone feels unusual. What is safest?', dimension: 'Authority', options: ['Pay it now because the request is from a senior person.', 'Reply to the email asking for confirmation.', 'Verify using a known phone number or another trusted channel.'] },
  { prompt: 'A courier message includes a small customs fee and a shortened link. What is the safest next step?', dimension: 'Curiosity', options: ['Use the courier’s official website or app to check the delivery.', 'Click the link but do not enter your card details.', 'Forward it to a friend to see whether it looks real.'] },
];

const modules = [
  { title: 'Email phishing', label: '01', meta: '5 scenarios', tone: 'rust' },
  { title: 'Impersonation & trust', label: '02', meta: '4 scenarios', tone: 'blue' },
  { title: 'Banking scams', label: '03', meta: '6 scenarios', tone: 'green' },
];

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [authReady, setAuthReady] = useState(supabase === null);
  const [view, setView] = useState<View>('overview');
  const [assessmentIndex, setAssessmentIndex] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [trainingAnswer, setTrainingAnswer] = useState<TrainingAnswer | null>(null);
  const [riskProfile, setRiskProfile] = useState<{ focus_dimension: string; awareness_score: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
    setDisplayName(fallback);
    getProfile(session.access_token).then((profile) => {
      if (profile?.full_name) setDisplayName(profile.full_name);
    }).catch(() => undefined);
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
      const profile = await saveAssessment(session.access_token, assessmentQuestions.map((question, index) => ({ questionKey: question.dimension.toLowerCase(), selectedOption: index === assessmentIndex ? selected : assessmentAnswers[index], riskDimension: question.dimension })));
      setRiskProfile(profile);
      setView('overview');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your assessment.');
    }
  };

  if (!authReady) return <div className="loading-screen">Loading your secure workspace...</div>;
  if (!session) return <AuthScreen configured={supabase !== null} />;

  return <main className="workspace">
    <Sidebar displayName={displayName} view={view} setView={setView} />
    {view === 'overview' && <Overview displayName={displayName} completed={completed} riskProfile={riskProfile} onAssessment={() => setView('assessment')} onTraining={() => setView('training')} />}
    {view === 'assessment' && <section className="content assessment-view"><Header eyebrow="Onboarding / assessment" title="How do you respond under pressure?" detail="Three short situations help us understand the moments that need your attention. There is no perfect score." /><div className="assessment-progress"><span>Question {assessmentIndex + 1} of {assessmentQuestions.length}</span><div><i style={{ width: `${((assessmentIndex + 1) / assessmentQuestions.length) * 100}%` }} /></div></div><article className="question-card"><p className="question-dimension">{assessmentQuestions[assessmentIndex].dimension} manipulation</p><h2>{assessmentQuestions[assessmentIndex].prompt}</h2><div className="option-list">{assessmentQuestions[assessmentIndex].options.map((option, index) => <button key={option} className={selected === index ? 'option selected' : 'option'} onClick={() => setSelected(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><button className="primary action-button" disabled={selected === null} onClick={submitAssessment}>{assessmentIndex === assessmentQuestions.length - 1 ? 'See my profile' : 'Continue'} <b>→</b></button></article></section>}
    {view === 'training' && <TrainingView answer={trainingAnswer} setAnswer={setTrainingAnswer} />}
    {saveError && <div className="toast error" role="alert">{saveError}</div>}
  </main>;
}

function AuthScreen({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(null);
    const result = mode === 'sign-in' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setBusy(false);
    if (result.error) setMessage('We could not complete that request. Check your details and try again.');
    else if (mode === 'sign-up' && !result.data.session) setMessage('Check your email to verify your account, then sign in.');
  };

  return <main className="auth-shell"><section className="auth-panel"><div className="brand auth-brand">MARICS<span>/ SECURITY</span></div><p className="eyebrow">Human risk intelligence platform</p><h1>{mode === 'sign-in' ? 'Welcome back.' : 'Build safer habits.'}</h1><p className="lede">Your private workspace for practicing the decisions attackers try to rush.</p>{!configured ? <div className="auth-message">Supabase is not configured for the frontend yet. Add the Vite Supabase variables to your local environment and restart the dev server.</div> : <form onSubmit={submit}>{mode === 'sign-up' && <label>Name<input value={fullName} onChange={event => setFullName(event.target.value)} required /></label>}<label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="primary auth-submit" disabled={busy}>{busy ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Create account'} <b>→</b></button>{message && <p className="auth-message" role="status">{message}</p>}</form>}<button className="auth-switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>{mode === 'sign-in' ? 'Need an account? Sign up' : 'Already registered? Sign in'}</button></section></main>;
}

function Sidebar({ displayName, view, setView }: { displayName: string; view: View; setView: (view: View) => void }) {
  return <aside className="sidebar"><div className="brand">MARICS<span>/ SECURITY</span></div><div className="profile-chip"><div className="avatar">{initials(displayName)}</div><div><strong>{displayName}</strong><small>Individual account</small></div></div><nav className="side-nav" aria-label="Main navigation"><button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><span>◈</span> Overview</button><button className={view === 'assessment' ? 'active' : ''} onClick={() => setView('assessment')}><span>◎</span> Assessment</button><button className={view === 'training' ? 'active' : ''} onClick={() => setView('training')}><span>▣</span> Training</button></nav><div className="side-bottom"><button><span>⚙</span> Settings</button><button><span>?</span> Help centre</button></div></aside>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
}

function Header({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{detail}</p></div><button className="notification" aria-label="Notifications">○<i /></button></header>;
}

function Overview({ displayName, completed, riskProfile, onAssessment, onTraining }: { displayName: string; completed: boolean; riskProfile: { focus_dimension: string; awareness_score: number } | null; onAssessment: () => void; onTraining: () => void }) {
  const firstName = displayName.split(/\s+/)[0] || 'there';
  return <section className="content"><Header eyebrow="Saturday, 19 September 2026" title={`Good morning, ${firstName}.`} detail="Your personal security workspace. Small decisions, practiced often, create durable habits." /><div className="overview-grid"><article className="awareness-card"><div><p className="card-kicker">OVERALL AWARENESS</p><div className="score-line"><strong>{completed ? 'Building' : 'Not assessed'}</strong><span>{completed ? 'Profile ready' : 'Start with 3 scenarios'}</span></div></div><div className="ring"><span>{riskProfile?.awareness_score ?? '—'}</span><small>{completed ? '/100' : ''}</small></div></article><article className="next-card"><p className="card-kicker">YOUR NEXT STEP</p><h2>{completed ? `Practice ${riskProfile?.focus_dimension ?? 'your focus area'}` : 'Complete your baseline'}</h2><p>{completed ? 'One focused session is waiting in your training path.' : 'A short assessment reveals where realistic pressure could affect your decisions.'}</p><button onClick={completed ? onTraining : onAssessment}>{completed ? 'Open training' : 'Start assessment'} <b>→</b></button></article></div><div className="section-heading"><div><p className="card-kicker">YOUR WORKSPACE</p><h2>Build your resilience</h2></div><button className="text-button" onClick={onTraining}>View all training <b>→</b></button></div><div className="module-grid">{modules.map(module => <article className={`module-card ${module.tone}`} key={module.title}><span>{module.label}</span><h3>{module.title}</h3><p>{module.meta}</p><button onClick={onTraining}>Explore <b>→</b></button></article>)}</div><div className="lower-grid"><article className="focus-card"><p className="card-kicker">RISK PROFILE</p><h2>{completed ? `${riskProfile?.focus_dimension ?? 'Your focus area'} needs your attention` : 'Your focus areas appear here'}</h2><p>{completed ? 'Your assessment points to this manipulation pattern as a useful place to practice next.' : 'Complete your assessment to see the manipulation patterns that deserve more practice, with context behind every recommendation.'}</p><button className="text-button" onClick={onAssessment}>{completed ? 'Retake assessment' : 'Take assessment'} <b>→</b></button></article><article className="activity-card"><p className="card-kicker">RECENT ACTIVITY</p><div className="empty-state"><span>✦</span><p>No activity yet.<br /><small>Your training history will appear here.</small></p></div></article></div></section>;
}

function TrainingView({ answer, setAnswer }: { answer: TrainingAnswer | null; setAnswer: (answer: TrainingAnswer) => void }) {
  return <section className="content"><Header eyebrow="Training / scenario 01" title="Verify before you act." detail="A realistic request. A moment to slow down. Choose the response you would make." /><article className="scenario-card"><div className="scenario-meta"><span>WHATSAPP</span><span>AUTHORITY + URGENCY</span></div><div className="message"><div className="message-top"><div className="avatar manager">AM</div><div><strong>Alex Morgan</strong><small>Today, 10:42</small></div><span>•••</span></div><p>Hey, I’m in a meeting and need you to buy six gift cards for a client. Send me the codes when you have them. I’ll reimburse you this afternoon.</p></div><h2>What should you do?</h2><div className="training-options"><button className={answer === 'act' ? 'selected' : ''} onClick={() => setAnswer('act')}><b>A</b>Buy the gift cards immediately so the client is not delayed.</button><button className={answer === 'verify' ? 'selected correct' : ''} onClick={() => setAnswer('verify')}><b>B</b>Verify the request using a trusted channel before acting.</button><button className={answer === 'ignore' ? 'selected' : ''} onClick={() => setAnswer('ignore')}><b>C</b>Ignore the message and do not report it.</button></div>{answer && <div className={`feedback ${answer === 'verify' ? 'good' : 'bad'}`}><strong>{answer === 'verify' ? 'Correct response' : 'Risky response'}</strong><p>{answer === 'verify' ? 'This request combines authority and urgency to make normal verification feel inconvenient. Confirm Alex’s request through a known phone number or in person.' : 'The pressure to act quickly is the warning sign. Never send money or codes based on an unexpected message, even when it appears to come from someone senior.'}</p><span>Manipulation technique: Authority + urgency</span></div>}</article></section>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);