import { useEffect, useState, type FormEvent } from 'react';
import { createAdminScenario, getAdminScenarios, type AdminScenario } from './lib/api';

type Language = 'en' | 'af' | 'pt';
type Module = { id: string; slug: string; scenarioCount: number; published: boolean; archived: boolean };
type Draft = { moduleId: string; scenarioId?: string; slug: string; riskDimensions: string; title: string; prompt: string; options: Array<{ text: string; correct: boolean; choice: string; explanation: string }> };

const emptyDraft = (moduleId = ''): Draft => ({ moduleId, slug: '', riskDimensions: '', title: '', prompt: '', options: [{ text: '', correct: false, choice: '', explanation: '' }, { text: '', correct: false, choice: '', explanation: '' }, { text: '', correct: false, choice: '', explanation: '' }] });

export function AdminScenarioEditor({ accessToken, modules, onMessage }: { accessToken: string; modules: Module[]; onMessage: (message: string) => void }) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? '');
  const [scenarios, setScenarios] = useState<AdminScenario[]>([]);
  const [language, setLanguage] = useState<Language>('en');
  const [draft, setDraft] = useState<Draft>(emptyDraft(modules[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);

  const load = async (id = moduleId) => {
    if (!id) return;
    try { setScenarios(await getAdminScenarios(accessToken, id)); } catch (error) { onMessage(error instanceof Error ? error.message : 'Scenarios could not be loaded.'); }
  };
  useEffect(() => { void load(); }, [moduleId, accessToken]);
  const edit = (scenario: AdminScenario) => {
    const content = scenario.content[language] ?? scenario.content.en ?? { title: '', scenario: '' };
    setDraft({ moduleId: scenario.moduleId, scenarioId: scenario.id, slug: scenario.slug, riskDimensions: scenario.riskDimensions.join(', '), title: content.title, prompt: content.scenario, options: scenario.options.map((option) => { const feedback = option.feedback[language] ?? option.feedback.en ?? { choice: '', explanation: '' }; return { text: option.content[language] ?? option.content.en ?? '', correct: option.isCorrect, choice: feedback.choice, explanation: feedback.explanation }; }) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.moduleId || draft.options.filter((option) => option.correct).length !== 1) { onMessage('Choose one correct answer before saving.'); return; }
    setBusy(true);
    try {
      const existing = draft.scenarioId ? scenarios.find((scenario) => scenario.id === draft.scenarioId) : undefined;
      const content = { ...(existing?.content ?? {}), [language]: { title: draft.title, scenario: draft.prompt } };
      const options = draft.options.map((option, index) => ({ optionKey: String.fromCharCode(65 + index) as 'A' | 'B' | 'C', content: { ...(existing?.options[index]?.content ?? {}), [language]: option.text }, isCorrect: option.correct, feedback: { ...(existing?.options[index]?.feedback ?? {}), [language]: { choice: option.choice, explanation: option.explanation } } }));
      await createAdminScenario(accessToken, { moduleId: draft.moduleId, scenarioId: draft.scenarioId, slug: draft.slug, content, riskDimensions: draft.riskDimensions.split(',').map((item) => item.trim()).filter(Boolean), options });
      onMessage(draft.scenarioId ? 'Scenario updated.' : 'Scenario created.');
      setDraft(emptyDraft(draft.moduleId));
      await load(draft.moduleId);
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Scenario could not be saved.'); } finally { setBusy(false); }
  };
  const updateOption = (index: number, field: 'text' | 'correct' | 'choice' | 'explanation', value: string | boolean) => setDraft((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, [field]: value } : field === 'correct' && value ? { ...option, correct: false } : option) }));
  return <div className="admin-columns"><article className="admin-panel"><p className="card-kicker">SCENARIOS</p><label>Module<select value={moduleId} onChange={(event) => { setModuleId(event.target.value); setDraft(emptyDraft(event.target.value)); }}><option value="">Choose a module</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.slug} ({module.scenarioCount})</option>)}</select></label><div className="admin-list">{scenarios.map((scenario) => <div className="admin-row" key={scenario.id}><strong>{scenario.slug}</strong><span>{scenario.riskDimensions.join(', ')}</span><button className="text-button" onClick={() => edit(scenario)}>Edit</button></div>)}{!scenarios.length && <p className="admin-empty-text">This module has no scenario content yet.</p>}</div></article><article className="admin-panel"><p className="card-kicker">{draft.scenarioId ? 'EDIT SCENARIO' : 'CREATE SCENARIO'}</p><form className="admin-form" onSubmit={submit}><label>Language<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Portuguese</option></select></label><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="scenario-slug" required /><input value={draft.riskDimensions} onChange={(event) => setDraft({ ...draft, riskDimensions: event.target.value })} placeholder="Risk dimensions, comma separated" required /><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Scenario title" required /><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="Scenario prompt" required />{draft.options.map((option, index) => <fieldset key={index}><legend>Option {String.fromCharCode(65 + index)}</legend><input value={option.text} onChange={(event) => updateOption(index, 'text', event.target.value)} placeholder="Option text" required /><label><input type="radio" name="correct-option" checked={option.correct} onChange={() => updateOption(index, 'correct', true)} /> Correct answer</label><textarea value={option.choice} onChange={(event) => updateOption(index, 'choice', event.target.value)} placeholder="Choice feedback" required /><textarea value={option.explanation} onChange={(event) => updateOption(index, 'explanation', event.target.value)} placeholder="Explanation" required /></fieldset>)}<button className="primary" disabled={busy || !draft.moduleId}>{busy ? 'Saving...' : draft.scenarioId ? 'Save scenario' : 'Create scenario'} <b>&#8594;</b></button></form></article></div>;
}