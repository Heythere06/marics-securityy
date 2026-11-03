import nodemailer from 'nodemailer';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProvider = 'smtp' | 'resend';

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || 'MARICS Security <onboarding@resend.dev>';
}

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim()
    && process.env.SMTP_USER?.trim()
    && process.env.SMTP_PASS?.trim(),
  );
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isEmailConfigured() {
  return isSmtpConfigured() || isResendConfigured();
}

export function getEmailProvider(): EmailProvider | null {
  const forced = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (forced === 'smtp') return isSmtpConfigured() ? 'smtp' : null;
  if (forced === 'resend') return isResendConfigured() ? 'resend' : null;
  // Prefer SMTP until a verified domain is ready for Resend.
  if (isSmtpConfigured()) return 'smtp';
  if (isResendConfigured()) return 'resend';
  return null;
}

export async function sendEmail(input: SendEmailInput) {
  const provider = getEmailProvider();
  if (!provider) throw new Error('EMAIL_NOT_CONFIGURED');
  if (provider === 'smtp') return sendWithSmtp(input);
  return sendWithResend(input);
}

async function sendWithSmtp(input: SendEmailInput) {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) throw new Error('EMAIL_NOT_CONFIGURED');

  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true'
    : port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { id: info.messageId ?? null, provider: 'smtp' as const };
  } catch (error) {
    const deliveryError = new Error('EMAIL_DELIVERY_FAILED');
    deliveryError.cause = {
      provider: 'smtp',
      message: error instanceof Error ? error.message : 'SMTP delivery failed',
      name: error instanceof Error ? error.name : 'smtp_error',
      status: null,
    };
    throw deliveryError;
  }
}

async function sendWithResend(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('EMAIL_NOT_CONFIGURED');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string; statusCode?: number };
  if (!response.ok) {
    const deliveryError = new Error('EMAIL_DELIVERY_FAILED');
    deliveryError.cause = {
      provider: 'resend',
      message: payload.message ?? `Resend rejected the message with HTTP ${response.status}`,
      name: payload.name ?? 'resend_error',
      status: payload.statusCode ?? response.status,
    };
    throw deliveryError;
  }
  return { id: payload.id ?? null, provider: 'resend' as const };
}

export function buildOrganizationInvitationEmail(input: { organizationName: string; inviterName: string; invitationUrl: string }) {
  const subject = `You are invited to join ${input.organizationName} on MARICS`;
  const text = [
    `${input.inviterName} invited you to join ${input.organizationName} on MARICS Security.`,
    '',
    'Open this link to accept the invitation after you create or verify your account:',
    input.invitationUrl,
    '',
    'If you were not expecting this invitation, you can ignore this message.',
  ].join('\n');
  const html = `
    <div style="font-family:Georgia,serif;color:#102536;line-height:1.6;max-width:560px">
      <p style="letter-spacing:.08em;text-transform:uppercase;color:#a7472e;font-size:12px;font-family:Arial,sans-serif">MARICS / INVITATION</p>
      <h1 style="font-weight:400;font-size:28px;margin:12px 0 16px">${escapeHtml(input.organizationName)}</h1>
      <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join this organization on MARICS Security.</p>
      <p>Create or verify your account with this email address, then open the invitation link:</p>
      <p><a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;padding:12px 18px;background:#d25d38;color:#fff;text-decoration:none">Accept invitation</a></p>
      <p style="color:#526b7b;font-size:13px">Or paste this URL into your browser:<br />${escapeHtml(input.invitationUrl)}</p>
    </div>
  `;
  return { subject, text, html };
}

export function buildEmailVerificationEmail(input: { verificationUrl: string }) {
  const subject = 'Confirm your MARICS Security email';
  const text = [
    'Confirm your email address to finish creating your MARICS Security account.',
    '',
    'Open this link to verify:',
    input.verificationUrl,
    '',
    'If you did not create a MARICS account, you can ignore this message.',
  ].join('\n');
  const html = `
    <div style="font-family:Georgia,serif;color:#102536;line-height:1.6;max-width:560px">
      <p style="letter-spacing:.08em;text-transform:uppercase;color:#a7472e;font-size:12px;font-family:Arial,sans-serif">MARICS / VERIFY EMAIL</p>
      <h1 style="font-weight:400;font-size:28px;margin:12px 0 16px">Confirm your email</h1>
      <p>Confirm this address to unlock sign-in, learner progress, and organization invitations.</p>
      <p><a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;padding:12px 18px;background:#d25d38;color:#fff;text-decoration:none">Verify email</a></p>
      <p style="color:#526b7b;font-size:13px">Or paste this URL into your browser:<br />${escapeHtml(input.verificationUrl)}</p>
    </div>
  `;
  return { subject, text, html };
}

export function usesResendTestSender() {
  const from = getEmailFrom().toLowerCase();
  return from.includes('onboarding@resend.dev');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
