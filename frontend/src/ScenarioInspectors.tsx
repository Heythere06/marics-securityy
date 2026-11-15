import { useEffect, useMemo, useState } from 'react';
import { getTranslations, type Language } from './i18n';

export type EmailArtifact = {
  fromName: string;
  fromAddress: string;
  to?: string;
  subject: string;
  date?: string;
  body: string;
  link?: { display: string; actual: string; safe?: boolean };
  attachment?: { name: string; type: string; note?: string };
  qr?: { label: string; destination: string };
};

export type SmsMessage = { from: 'them' | 'you' | 'system'; text: string; time?: string; flagged?: boolean };
export type SmsArtifact = { contact: string; number: string; messages: SmsMessage[] };

export type ChatChoice = { label: string; next: string };
export type ChatNode = { from: 'them' | 'you' | 'system'; text: string; choices?: ChatChoice[]; end?: boolean };
export type WhatsAppArtifact = { displayName: string; number: string; verified?: boolean; start: string; nodes: Record<string, ChatNode> };

export type CallArtifact = { caller: string; callerId: string; claimedOrg: string; transcript: Array<{ speaker: string; text: string }> };

export type JobArtifact = {
  advert: { company: string; title: string; salary: string; source: string; body: string };
  recruiter: { name: string; title: string; email: string; profileNote: string };
  offer: { salary: string; startDate: string; request: string; letter: string };
};

export type PaymentArtifact = {
  vendor: string;
  invoiceNumber: string;
  amount: string;
  previousBank: string;
  newBank: string;
  notice: string;
};

export type ScenarioContent = {
  channel?: string;
  sender?: string;
  message?: string;
  title?: string;
  scenario?: string;
  interaction?: 'email' | 'sms' | 'whatsapp' | 'phone' | 'job' | 'payment';
  email?: EmailArtifact;
  sms?: SmsArtifact;
  chat?: WhatsAppArtifact;
  call?: CallArtifact;
  job?: JobArtifact;
  payment?: PaymentArtifact;
};

type InspectCopy = ReturnType<typeof getTranslations>['inspect'];

function inferInteraction(content: ScenarioContent): ScenarioContent['interaction'] {
  if (content.interaction) return content.interaction;
  if (content.email) return 'email';
  if (content.sms) return 'sms';
  if (content.chat) return 'whatsapp';
  if (content.call) return 'phone';
  if (content.job) return 'job';
  if (content.payment) return 'payment';
  const channel = (content.channel ?? '').toLowerCase();
  if (channel.includes('email')) return 'email';
  if (channel.includes('sms') || channel.includes('text')) return 'sms';
  if (channel.includes('whatsapp')) return 'whatsapp';
  if (channel.includes('call') || channel.includes('phone')) return 'phone';
  return undefined;
}

function partsLabel(t: InspectCopy, seen: number, total: number) {
  return t.partsInspected.replace('{seen}', String(seen)).replace('{total}', String(total));
}

export function ScenarioInspector({ content, onInspected, language = 'en' }: { content: ScenarioContent; onInspected?: (complete: boolean) => void; language?: Language }) {
  const t = getTranslations(language).inspect;
  const interaction = inferInteraction(content);
  if (interaction === 'email' && content.email) return <EmailInspector email={content.email} onInspected={onInspected} t={t} />;
  if (interaction === 'sms' && content.sms) return <SmsInspector sms={content.sms} onInspected={onInspected} t={t} />;
  if (interaction === 'whatsapp' && content.chat) return <WhatsAppInspector chat={content.chat} onInspected={onInspected} t={t} />;
  if (interaction === 'phone' && content.call) return <CallInspector call={content.call} onInspected={onInspected} t={t} />;
  if (interaction === 'job' && content.job) return <JobInspector job={content.job} onInspected={onInspected} t={t} />;
  if (interaction === 'payment' && content.payment) return <PaymentInspector payment={content.payment} onInspected={onInspected} t={t} />;

  return (
    <FallbackMessage content={content} onInspected={onInspected} />
  );
}

function FallbackMessage({ content, onInspected }: { content: ScenarioContent; onInspected?: (complete: boolean) => void }) {
  useEffect(() => { onInspected?.(true); }, [onInspected]);
  return (
    <div className="message">
      <div className="message-top">
        <div className="avatar manager">{content.sender?.slice(0, 2).toUpperCase() ?? 'MR'}</div>
        <div>
          <strong>{content.sender ?? 'MARICS scenario'}</strong>
          <small>{content.channel ?? 'Training scenario'}</small>
        </div>
      </div>
      <p>{content.message ?? content.scenario}</p>
    </div>
  );
}

function EmailInspector({ email, onInspected, t }: { email: EmailArtifact; onInspected?: (complete: boolean) => void; t: InspectCopy }) {
  const [tab, setTab] = useState<'message' | 'sender' | 'link' | 'attachment'>('message');
  const tabs = [
    ['message', t.tabMessage],
    ['sender', t.tabSender],
    ['link', email.link ? t.tabLink : null],
    ['attachment', email.attachment || email.qr ? (email.qr ? t.tabQr : t.tabAttachment) : null],
  ].filter((entry): entry is [typeof tab, string] => Boolean(entry[1]));
  const [seen, setSeen] = useState<Set<string>>(() => new Set(['message']));
  useEffect(() => {
    onInspected?.(tabs.every(([id]) => seen.has(id)));
  }, [onInspected, seen, tabs.map(([id]) => id).join('|')]);
  const openTab = (id: typeof tab) => {
    setTab(id);
    setSeen((current) => new Set(current).add(id));
  };

  return (
    <article className="inspect-card email-inspect">
      <div className="email-window-bar"><span /><span /><span /><strong>{t.emailPreview}</strong></div>
      <dl className="email-headers">
        <div><dt>From</dt><dd>{email.fromName} &lt;{email.fromAddress}&gt;</dd></div>
        {email.to && <div><dt>To</dt><dd>{email.to}</dd></div>}
        <div><dt>Subject</dt><dd>{email.subject}</dd></div>
        {email.date && <div><dt>Date</dt><dd>{email.date}</dd></div>}
      </dl>
      <p className="inspect-progress">{partsLabel(t, seen.size, tabs.length)}</p>
      <div className="inspect-tabs" role="tablist" aria-label={t.emailTabsLabel}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${tab === id ? 'active' : ''}${seen.has(id) ? ' seen' : ''}`} onClick={() => openTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'message' && <div className="inspect-pane"><p className="email-body">{email.body}</p>{email.attachment && <p className="email-attach">{t.tabAttachment}: {email.attachment.name}</p>}{email.qr && <p className="email-attach">{t.tabQr}: {email.qr.label}</p>}</div>}
      {tab === 'sender' && <div className="inspect-pane"><p>{t.tabSender}: <strong>{email.fromName}</strong></p><p><code>{email.fromAddress}</code></p><p className="inspect-hint">{t.emailSenderHint}</p></div>}
      {tab === 'link' && email.link && <div className="inspect-pane"><p><strong>{email.link.display}</strong></p><p><code>{email.link.actual}</code></p><p className="inspect-hint">{email.link.safe ? t.emailLinkSafe : t.emailLinkUnsafe}</p></div>}
      {tab === 'attachment' && (email.attachment || email.qr) && <div className="inspect-pane">
        {email.attachment && <><p><strong>{email.attachment.name}</strong></p><p>{email.attachment.type}</p>{email.attachment.note && <p className="inspect-hint">{email.attachment.note}</p>}</>}
        {email.qr && <><p><strong>{email.qr.label}</strong></p><p><code>{email.qr.destination}</code></p><p className="inspect-hint">{t.emailQrHint}</p></>}
      </div>}
    </article>
  );
}

function SmsInspector({ sms, onInspected, t }: { sms: SmsArtifact; onInspected?: (complete: boolean) => void; t: InspectCopy }) {
  const flaggedIndex = sms.messages.findIndex((message) => message.flagged);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const mark = (part: 'sender' | 'flag') => setSeen((current) => new Set(current).add(part));
  useEffect(() => {
    const needsFlag = flaggedIndex >= 0;
    onInspected?.(seen.has('sender') && (!needsFlag || seen.has('flag')));
  }, [onInspected, seen, flaggedIndex]);

  return (
    <article className="inspect-card sms-inspect">
      <button type="button" className={`sms-header${seen.has('sender') ? ' seen' : ''}`} onClick={() => mark('sender')} aria-pressed={seen.has('sender')}>
        <div className="avatar manager">{sms.contact.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{sms.contact}</strong>
          <small>{sms.number}</small>
        </div>
        <span className="inspect-hint">{t.smsTapSender}</span>
      </button>
      <ol className="sms-thread">
        {sms.messages.map((message, index) => (
          <li key={`${message.text}-${index}`}>
            <button
              type="button"
              className={`sms-bubble ${message.from}${message.flagged ? ' flagged' : ''}${message.flagged && seen.has('flag') ? ' seen' : ''}`}
              onClick={() => { if (message.flagged) mark('flag'); }}
              aria-pressed={message.flagged ? seen.has('flag') : undefined}
            >
              <p>{message.text}</p>
              {message.time && <small>{message.time}</small>}
              {message.flagged && <span className="scam-flag">{seen.has('flag') ? t.smsFlagCheck : t.smsFlagTap}</span>}
            </button>
          </li>
        ))}
      </ol>
      <p className="inspect-progress">{partsLabel(t, seen.size, flaggedIndex >= 0 ? 2 : 1)}</p>
      {flaggedIndex >= 0 && <p className="inspect-hint">{t.smsHintFlagged}</p>}
      {flaggedIndex < 0 && <p className="inspect-hint">{t.smsHintSender}</p>}
    </article>
  );
}

function WhatsAppInspector({ chat, onInspected, t }: { chat: WhatsAppArtifact; onInspected?: (complete: boolean) => void; t: InspectCopy }) {
  const [path, setPath] = useState<string[]>([chat.start]);
  const current = chat.nodes[path[path.length - 1]] ?? chat.nodes[chat.start];
  const history = useMemo(() => path.map((id) => chat.nodes[id]).filter(Boolean), [path, chat.nodes]);
  useEffect(() => { onInspected?.(Boolean(current?.end)); }, [current?.end, onInspected]);

  return (
    <article className="inspect-card whatsapp-inspect">
      <header className="wa-header">
        <div className="avatar manager">{chat.displayName.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{chat.displayName} {chat.verified ? <em className="wa-verified">{t.waVerified}</em> : <em className="wa-unverified">{t.waUnverified}</em>}</strong>
          <small>{chat.number}</small>
        </div>
      </header>
      <div className="wa-thread">
        {history.map((node, index) => (
          <p key={`${node.text}-${index}`} className={`wa-bubble ${node.from}`}>{node.text}</p>
        ))}
      </div>
      {current?.choices?.length ? (
        <div className="wa-choices">
          <p>{t.waReplyPrompt}</p>
          {current.choices.map((choice) => (
            <button key={choice.next + choice.label} type="button" onClick={() => setPath((currentPath) => [...currentPath, choice.next])}>{choice.label}</button>
          ))}
        </div>
      ) : (
        <div className="wa-choices">
          <p className="inspect-hint">{current?.end ? t.waEndHint : t.waContinueHint}</p>
          <button type="button" onClick={() => setPath([chat.start])}>{t.waRestart}</button>
        </div>
      )}
    </article>
  );
}

function CallInspector({ call, onInspected, t }: { call: CallArtifact; onInspected?: (complete: boolean) => void; t: InspectCopy }) {
  useEffect(() => { onInspected?.(true); }, [onInspected]);
  return (
    <article className="inspect-card call-inspect">
      <header className="call-header">
        <span className="call-dot" />
        <div>
          <strong>{t.callIncoming} · {call.caller}</strong>
          <small>Caller ID {call.callerId} · {t.callClaims} {call.claimedOrg}</small>
        </div>
      </header>
      <ol className="call-transcript">
        {call.transcript.map((line, index) => (
          <li key={`${line.speaker}-${index}`}>
            <strong>{line.speaker}</strong>
            <p>{line.text}</p>
          </li>
        ))}
      </ol>
      <p className="inspect-hint">{t.callHint}</p>
    </article>
  );
}

function JobInspector({ job, onInspected, t }: { job: JobArtifact; onInspected?: (complete: boolean) => void; t: InspectCopy }) {
  const [tab, setTab] = useState<'advert' | 'recruiter' | 'offer'>('advert');
  const tabs = [['advert', t.jobAdvert], ['recruiter', t.jobRecruiter], ['offer', t.jobOffer]] as const;
  const [seen, setSeen] = useState<Set<string>>(() => new Set(['advert']));
  useEffect(() => { onInspected?.(tabs.every(([id]) => seen.has(id))); }, [onInspected, seen, t.jobAdvert, t.jobOffer, t.jobRecruiter]);
  const openTab = (id: typeof tab) => {
    setTab(id);
    setSeen((current) => new Set(current).add(id));
  };
  return (
    <article className="inspect-card job-inspect">
      <p className="inspect-progress">{partsLabel(t, seen.size, tabs.length)}</p>
      <div className="inspect-tabs" role="tablist" aria-label={t.jobTabsLabel}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${tab === id ? 'active' : ''}${seen.has(id) ? ' seen' : ''}`} onClick={() => openTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'advert' && <div className="inspect-pane"><p className="card-kicker">{job.advert.source}</p><h3>{job.advert.title}</h3><p>{job.advert.company} · {job.advert.salary}</p><p>{job.advert.body}</p></div>}
      {tab === 'recruiter' && <div className="inspect-pane"><h3>{job.recruiter.name}</h3><p>{job.recruiter.title}</p><p><code>{job.recruiter.email}</code></p><p className="inspect-hint">{job.recruiter.profileNote}</p></div>}
      {tab === 'offer' && <div className="inspect-pane"><p>{job.offer.startDate} · {job.offer.salary}</p><p>{job.offer.letter}</p><p className="inspect-hint">{job.offer.request}</p></div>}
    </article>
  );
}

function PaymentInspector({ payment, onInspected, t }: { payment: PaymentArtifact; onInspected?: (complete: boolean) => void; t: InspectCopy }) {
  useEffect(() => { onInspected?.(true); }, [onInspected]);
  return (
    <article className="inspect-card payment-inspect">
      <p className="card-kicker">{payment.invoiceNumber}</p>
      <h3>{payment.vendor}</h3>
      <p className="payment-amount">{payment.amount}</p>
      <div className="payment-banks">
        <div>
          <span>{t.paymentOnFile}</span>
          <strong>{payment.previousBank}</strong>
        </div>
        <div className="changed">
          <span>{t.paymentRequested}</span>
          <strong>{payment.newBank}</strong>
        </div>
      </div>
      <p>{payment.notice}</p>
      <p className="inspect-hint">{t.paymentHint}</p>
    </article>
  );
}
