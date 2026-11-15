import { useEffect, useRef, useState, type FormEvent } from 'react';
import { chatWithCoach } from './lib/api';
import type { Language } from './i18n';

type ChatRole = 'user' | 'assistant';
type ChatMessage = { role: ChatRole; content: string };

const starters = [
  'How do I check a suspicious WhatsApp from my manager?',
  'What should I do if an invoice asks me to change bank details?',
  'Explain phishing in plain language.',
];

function storageKey(userId: string) {
  return `marics_ai_chat_${userId}`;
}

function loadMessages(userId: string): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) as ChatMessage[] : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string').slice(-20);
  } catch {
    return [];
  }
}

export function AssistantChat({ accessToken, userId, language, displayName }: { accessToken: string; userId: string; language: Language; displayName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(userId));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadMessages(userId));
  }, [userId]);

  useEffect(() => {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-20)));
  }, [messages, userId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.slice(-12);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const reply = await chatWithCoach(accessToken, { language, message, history });
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The MARICS coach could not reply.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  const firstName = displayName.split(/\s+/)[0] || 'there';

  return (
    <section className="content assistant-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">MARICS / AI coach</p>
          <h1>Chat with your coach.</h1>
          <p className="lede">Ask about suspicious messages, safer habits, or a situation you just saw. This space is conversation only — practice quizzes stay in Training.</p>
        </div>
        {messages.length > 0 && <button className="text-button" type="button" onClick={() => { setMessages([]); setError(null); window.sessionStorage.removeItem(storageKey(userId)); }}>Clear chat</button>}
      </header>
      <article className="chat-shell">
        <div className="chat-thread" ref={threadRef} role="log" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && (
            <div className="chat-bubble assistant">
              Hi {firstName}. I am the MARICS awareness coach. Tell me what landed in your inbox, chat, or call, and I will help you decide what is safer to do.
            </div>
          )}
          {messages.map((entry, index) => (
            <div key={`${entry.role}-${index}`} className={`chat-bubble ${entry.role}`}>
              <span className="chat-role">{entry.role === 'user' ? 'You' : 'Coach'}</span>
              {entry.content}
            </div>
          ))}
          {busy && <div className="chat-bubble assistant pending">Coach is typing...</div>}
        </div>
        {error && <p className="chat-error" role="alert">{error}</p>}
        {messages.length === 0 && (
          <div className="chat-starters">
            {starters.map((prompt) => (
              <button key={prompt} type="button" className="chat-starter" disabled={busy} onClick={() => void send(prompt)}>{prompt}</button>
            ))}
          </div>
        )}
        <form className="chat-composer" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="coach-message">Message the AI coach</label>
          <textarea
            id="coach-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={800}
            rows={2}
            placeholder="Ask anything about a suspicious email, WhatsApp, call, or invoice..."
            disabled={busy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <button className="primary" type="submit" disabled={busy || !draft.trim()}>{busy ? 'Sending...' : 'Send'} <b>→</b></button>
        </form>
      </article>
    </section>
  );
}
