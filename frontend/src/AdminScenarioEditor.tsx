import { useEffect, useState, type FormEvent } from 'react';
import { createAdminScenario, generateScenario, getAdminScenarios, setAdminModulePublished, updateAdminTrainingModule, type AdminScenario, type ModuleLearningMaterialBlock } from './lib/api';

type Language = 'en' | 'af' | 'pt';
type Module = { id: string; slug: string; title: Record<string, string>; description: Record<string, string>; learningMaterial: Partial<Record<Language, ModuleLearningMaterialBlock>>; scenarioCount: number; published: boolean; archived: boolean };
type Draft = { moduleId: string; scenarioId?: string; slug: string; riskDimensions: string; title: string; prompt: string; options: Array<{ text: string; correct: boolean; choice: string; explanation: string }> };
type LearningDraft = ModuleLearningMaterialBlock;

const emptyLearningDraft = (): LearningDraft => ({ whyItMatters: '', warningSigns: '', bestPractice: '' });

const emptyDraft = (moduleId = ''): Draft => ({ moduleId, slug: '', riskDimensions: '', title: '', prompt: '', options: [{ text: '', correct: false, choice: '', explanation: '' }, { text: '', correct: false, choice: '', explanation: '' }, { text: '', correct: false, choice: '', explanation: '' }, { text: '', correct: false, choice: '', explanation: '' }] });

export function AdminScenarioEditor({ accessToken, modules, onMessage, onModuleUpdated }: { accessToken: string; modules: Module[]; onMessage: (message: string) => void; onModuleUpdated: () => void }) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? '');
  const [scenarios, setScenarios] = useState<AdminScenario[]>([]);
  const [language, setLanguage] = useState<Language>('en');
  const [learningLanguage, setLearningLanguage] = useState<Language>('en');
  const [learningDraft, setLearningDraft] = useState<LearningDraft>(emptyLearningDraft);
  const [savedLearningMaterial, setSavedLearningMaterial] = useState<Record<string, Partial<Record<Language, ModuleLearningMaterialBlock>>>>({});
  const [draft, setDraft] = useState<Draft>(emptyDraft(modules[0]?.id ?? ''));
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async (id = moduleId) => {
    if (!id) return;
    try { setScenarios(await getAdminScenarios(accessToken, id)); } catch (error) { onMessage(error instanceof Error ? error.message : 'Scenarios could not be loaded.'); }
  };
  useEffect(() => { void load(); }, [moduleId, accessToken]);
  useEffect(() => {
    if (!moduleId && modules[0]) setModuleId(modules[0].id);
  }, [moduleId, modules]);
  useEffect(() => {
    const module = modules.find((entry) => entry.id === moduleId);
    setLearningDraft(savedLearningMaterial[moduleId]?.[learningLanguage] ?? module?.learningMaterial?.[learningLanguage] ?? emptyLearningDraft());
  }, [moduleId, learningLanguage, modules, savedLearningMaterial]);
  const edit = (scenario: AdminScenario) => {
    const content = scenario.content[language] ?? scenario.content.en ?? { title: '', scenario: '' };
    setDraft({ moduleId: scenario.moduleId, scenarioId: scenario.id, slug: scenario.slug, riskDimensions: scenario.riskDimensions.join(', '), title: content.title, prompt: content.scenario, options: scenario.options.map((option) => { const feedback = option.feedback[language] ?? option.feedback.en ?? { choice: '', explanation: '' }; return { text: option.content[language] ?? option.content.en ?? '', correct: option.isCorrect, choice: feedback.choice, explanation: feedback.explanation }; }) });
  };
  const generate = async () => {
    const selectedModule = modules.find((module) => module.id === draft.moduleId);
    if (!selectedModule || !generationPrompt.trim()) { onMessage('Choose a module and describe the scenario for Claude.'); return; }
    setGenerating(true);
    try {
      const generated = await generateScenario(accessToken, { moduleSlug: selectedModule.slug, language, context: generationPrompt.trim() });
      const correctOption = generated.options.find((option) => option.key === generated.correctOption);
      if (!correctOption) throw new Error('Claude returned an invalid correct answer.');
      setDraft((current) => ({
        ...current,
        slug: current.slug || generated.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'generated-scenario',
        riskDimensions: current.riskDimensions || generated.manipulationTechnique.slice(0, 80),
        title: generated.title,
        prompt: generated.scenario,
        options: generated.options.map((option) => ({
          text: option.text,
          correct: option.key === generated.correctOption,
          choice: option.key === generated.correctOption ? 'Recommended response' : 'This response may increase risk',
          explanation: option.key === generated.correctOption
            ? `${generated.explanation} ${generated.correctResponse}`
            : `The attacker may be pursuing ${generated.attackerObjective} through ${generated.manipulationTechnique}.`,
        })),
      }));
      onMessage('Claude generated a scenario draft. Review it before saving.');
    } catch (error) { onMessage(error instanceof Error ? error.message : 'AI scenario could not be generated.'); } finally { setGenerating(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.moduleId || draft.options.filter((option) => option.correct).length !== 1) { onMessage('Choose one correct answer before saving.'); return; }
    setBusy(true);
    try {
      const existing = draft.scenarioId ? scenarios.find((scenario) => scenario.id === draft.scenarioId) : undefined;
      const content = { ...(existing?.content ?? {}), [language]: { title: draft.title, scenario: draft.prompt } };
      const options = draft.options.map((option, index) => ({ optionKey: String.fromCharCode(65 + index) as 'A' | 'B' | 'C' | 'D', content: { ...(existing?.options[index]?.content ?? {}), [language]: option.text }, isCorrect: option.correct, feedback: { ...(existing?.options[index]?.feedback ?? {}), [language]: { choice: option.choice, explanation: option.explanation } } }));
      await createAdminScenario(accessToken, { moduleId: draft.moduleId, scenarioId: draft.scenarioId, slug: draft.slug, content, riskDimensions: draft.riskDimensions.split(',').map((item) => item.trim()).filter(Boolean), options });
      onMessage(draft.scenarioId ? 'Scenario updated.' : 'Scenario created.');
      setDraft(emptyDraft(draft.moduleId));
      await load(draft.moduleId);
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Scenario could not be saved.'); } finally { setBusy(false); }
  };
  const saveLearningMaterial = async (event: FormEvent) => {
    event.preventDefault();
    const module = modules.find((entry) => entry.id === moduleId);
    if (!module) return;
    setBusy(true);
    try {
      const updatedMaterial = await updateAdminTrainingModule(accessToken, module.id, {
        title: module.title,
        description: module.description,
        published: module.published,
        learningMaterial: { [learningLanguage]: learningDraft },
      });
      setSavedLearningMaterial((current) => ({ ...current, [module.id]: updatedMaterial }));
      onMessage(`Learning material saved in ${learningLanguage.toUpperCase()}.`);
      await load(module.id);
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Learning material could not be saved.'); } finally { setBusy(false); }
  };
  const toggleModulePublication = async () => {
    const module = modules.find((entry) => entry.id === moduleId);
    if (!module || (module.archived && !module.published)) return;
    setBusy(true);
    try {
      await setAdminModulePublished(accessToken, module.id, !module.published);
      onMessage(module.published ? 'Module unpublished.' : 'Module published.');
      onModuleUpdated();
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Module publication could not be updated.'); } finally { setBusy(false); }
  };
  const updateOption = (index: number, field: 'text' | 'correct' | 'choice' | 'explanation', value: string | boolean) => setDraft((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, [field]: value } : field === 'correct' && value ? { ...option, correct: false } : option) }));
  const selectedModule = modules.find((module) => module.id === moduleId);
  const materialLanguagesComplete = (['en', 'af', 'pt'] as const).filter((entry) => {
    const material = savedLearningMaterial[moduleId]?.[entry] ?? selectedModule?.learningMaterial?.[entry];
    return material && Object.values(material).every((value) => value.trim().length >= 10);
  }).length;
  return <div className="admin-columns">
    <article className="admin-panel">
      <p className="card-kicker">SCENARIOS</p>
      <label>Module<select value={moduleId} onChange={(event) => { setModuleId(event.target.value); setDraft(emptyDraft(event.target.value)); }}><option value="">Choose a module</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.slug} ({module.scenarioCount})</option>)}</select></label>
      <div className="module-publication-control"><span>{selectedModule?.published ? 'Published' : selectedModule?.archived ? 'Archived' : 'Draft'}</span><button type="button" className="text-button" disabled={busy || !selectedModule || (selectedModule.archived && !selectedModule.published)} onClick={() => void toggleModulePublication()}>{selectedModule?.published ? 'Unpublish module' : 'Publish module'}</button></div>
      <section className="module-learning-editor">
        <p className="card-kicker">MODULE LEARNING MATERIAL</p>
        <p className="admin-empty-text">Complete all three language versions before publishing: {materialLanguagesComplete}/3.</p>
        <form className="admin-form" onSubmit={saveLearningMaterial}>
          <label>Learning language<select value={learningLanguage} onChange={(event) => setLearningLanguage(event.target.value as Language)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Português</option></select></label>
          <label>Why this threat works<textarea value={learningDraft.whyItMatters} onChange={(event) => setLearningDraft({ ...learningDraft, whyItMatters: event.target.value })} minLength={10} maxLength={800} required /></label>
          <label>Warning signs<textarea value={learningDraft.warningSigns} onChange={(event) => setLearningDraft({ ...learningDraft, warningSigns: event.target.value })} minLength={10} maxLength={800} required /></label>
          <label>Safer general practice<textarea value={learningDraft.bestPractice} onChange={(event) => setLearningDraft({ ...learningDraft, bestPractice: event.target.value })} minLength={10} maxLength={800} required /></label>
          <button className="text-button" type="submit" disabled={busy || !moduleId}>Save learning material</button>
        </form>
      </section>
      <div className="admin-list">{scenarios.map((scenario) => <div className="admin-row" key={scenario.id}><strong>{scenario.slug}</strong><span>{scenario.riskDimensions.join(', ')}</span><button className="text-button" type="button" onClick={() => edit(scenario)}>Edit</button></div>)}{!scenarios.length && <p className="admin-empty-text">This module has no scenario content yet.</p>}</div>
    </article>
    <article className="admin-panel">
      <p className="card-kicker">{draft.scenarioId ? 'EDIT SCENARIO' : 'CREATE SCENARIO'}</p>
      <form className="admin-form" onSubmit={submit}>
        <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="af">Afrikaans</option><option value="pt">Portuguese</option></select></label>
        <label>Prompt Claude<textarea value={generationPrompt} onChange={(event) => setGenerationPrompt(event.target.value)} maxLength={500} placeholder="Describe the behavior, setting, and learning goal" /></label>
        <button type="button" className="text-button" disabled={generating || busy || !draft.moduleId} onClick={() => void generate()}>{generating ? 'Generating with Claude...' : 'Generate scenario with Claude'}</button>
        <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="scenario-slug" required />
        <input value={draft.riskDimensions} onChange={(event) => setDraft({ ...draft, riskDimensions: event.target.value })} placeholder="Risk dimensions, comma separated" required />
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Scenario title" required />
        <textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="Scenario content" required />
        {draft.options.map((option, index) => <fieldset key={index}><legend>Option {String.fromCharCode(65 + index)}</legend><input value={option.text} onChange={(event) => updateOption(index, 'text', event.target.value)} placeholder="Option text" required /><label><input type="radio" name="correct-option" checked={option.correct} onChange={() => updateOption(index, 'correct', true)} /> Correct answer</label><textarea value={option.choice} onChange={(event) => updateOption(index, 'choice', event.target.value)} placeholder="Choice feedback" required /><textarea value={option.explanation} onChange={(event) => updateOption(index, 'explanation', event.target.value)} placeholder="Explanation" required /></fieldset>)}
        <button className="primary" disabled={busy || generating || !draft.moduleId}>{busy ? 'Saving...' : draft.scenarioId ? 'Save scenario' : 'Create scenario'} <b>&#8594;</b></button>
      </form>
    </article>
  </div>;
}