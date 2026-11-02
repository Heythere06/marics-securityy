import { useEffect, useMemo, useState } from 'react';

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

export function ScenarioInspector({ content, onInspected }: { content: ScenarioContent; onInspected?: (complete: boolean) => void }) {
  const interaction = inferInteraction(content);
  if (interaction === 'email' && content.email) return <EmailInspector email={content.email} onInspected={onInspected} />;
  if (interaction === 'sms' && content.sms) return <SmsInspector sms={content.sms} onInspected={onInspected} />;
  if (interaction === 'whatsapp' && content.chat) return <WhatsAppInspector chat={content.chat} onInspected={onInspected} />;
  if (interaction === 'phone' && content.call) return <CallInspector call={content.call} onInspected={onInspected} />;
  if (interaction === 'job' && content.job) return <JobInspector job={content.job} onInspected={onInspected} />;
  if (interaction === 'payment' && content.payment) return <PaymentInspector payment={content.payment} onInspected={onInspected} />;

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

function EmailInspector({ email, onInspected }: { email: EmailArtifact; onInspected?: (complete: boolean) => void }) {
  const [tab, setTab] = useState<'message' | 'sender' | 'link' | 'attachment'>('message');
  const tabs = [
    ['message', 'Message'],
    ['sender', 'Sender'],
    ['link', email.link ? 'Link' : null],
    ['attachment', email.attachment || email.qr ? (email.qr ? 'QR code' : 'Attachment') : null],
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
      <div className="email-window-bar"><span /><span /><span /><strong>Inbox preview</strong></div>
      <dl className="email-headers">
        <div><dt>From</dt><dd>{email.fromName} &lt;{email.fromAddress}&gt;</dd></div>
        {email.to && <div><dt>To</dt><dd>{email.to}</dd></div>}
        <div><dt>Subject</dt><dd>{email.subject}</dd></div>
        {email.date && <div><dt>Date</dt><dd>{email.date}</dd></div>}
      </dl>
      <p className="inspect-progress">{seen.size} of {tabs.length} parts inspected</p>
      <div className="inspect-tabs" role="tablist" aria-label="Inspect this email">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${tab === id ? 'active' : ''}${seen.has(id) ? ' seen' : ''}`} onClick={() => openTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'message' && <div className="inspect-pane"><p className="email-body">{email.body}</p>{email.attachment && <p className="email-attach">Attachment: {email.attachment.name}</p>}{email.qr && <p className="email-attach">QR code: {email.qr.label}</p>}</div>}
      {tab === 'sender' && <div className="inspect-pane"><p>Display name: <strong>{email.fromName}</strong></p><p>Address: <code>{email.fromAddress}</code></p><p className="inspect-hint">Check whether the address matches the organisation’s known domain, not only the display name.</p></div>}
      {tab === 'link' && email.link && <div className="inspect-pane"><p>Visible text: <strong>{email.link.display}</strong></p><p>Actual destination: <code>{email.link.actual}</code></p><p className="inspect-hint">{email.link.safe ? 'This destination matches a known official channel.' : 'The visible text and the real destination do not match. Hovering a link before clicking is a core email habit.'}</p></div>}
      {tab === 'attachment' && (email.attachment || email.qr) && <div className="inspect-pane">
        {email.attachment && <><p>File: <strong>{email.attachment.name}</strong></p><p>Type: {email.attachment.type}</p>{email.attachment.note && <p className="inspect-hint">{email.attachment.note}</p>}</>}
        {email.qr && <><p>QR label: <strong>{email.qr.label}</strong></p><p>Hidden destination: <code>{email.qr.destination}</code></p><p className="inspect-hint">QR codes can hide a lookalike login page. Open the service from a known bookmark instead.</p></>}
      </div>}
    </article>
  );
}

function SmsInspector({ sms, onInspected }: { sms: SmsArtifact; onInspected?: (complete: boolean) => void }) {
  const flaggedIndex = sms.messages.findIndex((message) => message.flagged);
  useEffect(() => { onInspected?.(true); }, [onInspected]);
  return (
    <article className="inspect-card sms-inspect">
      <header className="sms-header">
        <div className="avatar manager">{sms.contact.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{sms.contact}</strong>
          <small>{sms.number}</small>
        </div>
      </header>
      <ol className="sms-thread">
        {sms.messages.map((message, index) => (
          <li key={`${message.text}-${index}`} className={`sms-bubble ${message.from}${message.flagged ? ' flagged' : ''}`}>
            <p>{message.text}</p>
            {message.time && <small>{message.time}</small>}
            {message.flagged && <span className="scam-flag">Scam begins here</span>}
          </li>
        ))}
      </ol>
      {flaggedIndex >= 0 && <p className="inspect-hint">The conversation became unsafe at message {flaggedIndex + 1}. Pressure, a link, or a request for codes is usually the turning point.</p>}
    </article>
  );
}

function WhatsAppInspector({ chat, onInspected }: { chat: WhatsAppArtifact; onInspected?: (complete: boolean) => void }) {
  const [path, setPath] = useState<string[]>([chat.start]);
  const current = chat.nodes[path[path.length - 1]] ?? chat.nodes[chat.start];
  const history = useMemo(() => path.map((id) => chat.nodes[id]).filter(Boolean), [path, chat.nodes]);
  useEffect(() => { onInspected?.(Boolean(current?.end) || path.length > 1); }, [current?.end, onInspected, path.length]);

  return (
    <article className="inspect-card whatsapp-inspect">
      <header className="wa-header">
        <div className="avatar manager">{chat.displayName.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{chat.displayName} {chat.verified ? <em className="wa-verified">verified</em> : <em className="wa-unverified">unverified number</em>}</strong>
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
          <p>How do you reply?</p>
          {current.choices.map((choice) => (
            <button key={choice.next + choice.label} type="button" onClick={() => setPath((currentPath) => [...currentPath, choice.next])}>{choice.label}</button>
          ))}
        </div>
      ) : (
        <div className="wa-choices">
          <p className="inspect-hint">{current?.end ? 'The scammer adapts to whatever you say. Independent verification is the safer exit.' : 'Continue the conversation, then decide what you would do.'}</p>
          <button type="button" onClick={() => setPath([chat.start])}>Restart conversation</button>
        </div>
      )}
    </article>
  );
}

function CallInspector({ call, onInspected }: { call: CallArtifact; onInspected?: (complete: boolean) => void }) {
  useEffect(() => { onInspected?.(true); }, [onInspected]);
  return (
    <article className="inspect-card call-inspect">
      <header className="call-header">
        <span className="call-dot" />
        <div>
          <strong>Incoming call · {call.caller}</strong>
          <small>Caller ID {call.callerId} · claims to be {call.claimedOrg}</small>
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
      <p className="inspect-hint">Caller ID can be spoofed. End the call and use a number from the back of your card, the official app, or a known internal directory.</p>
    </article>
  );
}

function JobInspector({ job, onInspected }: { job: JobArtifact; onInspected?: (complete: boolean) => void }) {
  const [tab, setTab] = useState<'advert' | 'recruiter' | 'offer'>('advert');
  const tabs = [['advert', 'Job advert'], ['recruiter', 'Recruiter profile'], ['offer', 'Offer letter']] as const;
  const [seen, setSeen] = useState<Set<string>>(() => new Set(['advert']));
  useEffect(() => { onInspected?.(tabs.every(([id]) => seen.has(id))); }, [onInspected, seen]);
  const openTab = (id: typeof tab) => {
    setTab(id);
    setSeen((current) => new Set(current).add(id));
  };
  return (
    <article className="inspect-card job-inspect">
      <p className="inspect-progress">{seen.size} of {tabs.length} parts inspected</p>
      <div className="inspect-tabs" role="tablist" aria-label="Inspect this job opportunity">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${tab === id ? 'active' : ''}${seen.has(id) ? ' seen' : ''}`} onClick={() => openTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'advert' && <div className="inspect-pane"><p className="card-kicker">{job.advert.source}</p><h3>{job.advert.title}</h3><p>{job.advert.company} · {job.advert.salary}</p><p>{job.advert.body}</p></div>}
      {tab === 'recruiter' && <div className="inspect-pane"><h3>{job.recruiter.name}</h3><p>{job.recruiter.title}</p><p>Email: <code>{job.recruiter.email}</code></p><p className="inspect-hint">{job.recruiter.profileNote}</p></div>}
      {tab === 'offer' && <div className="inspect-pane"><p>Start {job.offer.startDate} · {job.offer.salary}</p><p>{job.offer.letter}</p><p className="inspect-hint">Requested next step: {job.offer.request}</p></div>}
    </article>
  );
}

function PaymentInspector({ payment, onInspected }: { payment: PaymentArtifact; onInspected?: (complete: boolean) => void }) {
  useEffect(() => { onInspected?.(true); }, [onInspected]);
  return (
    <article className="inspect-card payment-inspect">
      <p className="card-kicker">Invoice {payment.invoiceNumber}</p>
      <h3>{payment.vendor}</h3>
      <p className="payment-amount">{payment.amount}</p>
      <div className="payment-banks">
        <div>
          <span>On file</span>
          <strong>{payment.previousBank}</strong>
        </div>
        <div className="changed">
          <span>Requested change</span>
          <strong>{payment.newBank}</strong>
        </div>
      </div>
      <p>{payment.notice}</p>
      <p className="inspect-hint">Changed supplier bank details should be verified with a known contact already on file, never using the contact details in the change request.</p>
    </article>
  );
}
