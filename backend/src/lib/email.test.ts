import { afterEach, describe, expect, it } from 'vitest';
import { buildEmailVerificationEmail, buildOrganizationInvitationEmail, getEmailProvider, usesResendTestSender } from './email.js';

const emailEnvKeys = ['EMAIL_PROVIDER', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY', 'EMAIL_FROM'] as const;
const savedEnv = Object.fromEntries(emailEnvKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of emailEnvKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('email templates', () => {
  it('builds a safe organization invitation message', () => {
    const message = buildOrganizationInvitationEmail({
      organizationName: 'Namib Mine <Ops>',
      inviterName: "Thandi O'Neil",
      invitationUrl: 'http://localhost:5173/?invite=abc',
    });
    expect(message.subject).toContain('Namib Mine <Ops>');
    expect(message.html).toContain('Namib Mine &lt;Ops&gt;');
    expect(message.html).toContain("Thandi O&#39;Neil");
    expect(message.text).toContain('http://localhost:5173/?invite=abc');
  });

  it('builds a safe verification message', () => {
    const message = buildEmailVerificationEmail({
      verificationUrl: 'http://localhost:5173/#access_token=abc&<script>',
    });
    expect(message.subject).toMatch(/confirm/i);
    expect(message.html).toContain('http://localhost:5173/#access_token=abc&amp;&lt;script&gt;');
    expect(message.text).toContain('http://localhost:5173/#access_token=abc&<script>');
  });

  it('detects the Resend test sender', () => {
    process.env.EMAIL_FROM = 'MARICS Security <onboarding@resend.dev>';
    expect(usesResendTestSender()).toBe(true);
    process.env.EMAIL_FROM = 'MARICS Security <noreply@marics.example>';
    expect(usesResendTestSender()).toBe(false);
  });

  it('prefers SMTP over Resend when both are configured', () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'you@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.RESEND_API_KEY = 're_test';
    delete process.env.EMAIL_PROVIDER;
    expect(getEmailProvider()).toBe('smtp');
  });

  it('uses Resend when SMTP is absent', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.RESEND_API_KEY = 're_test';
    delete process.env.EMAIL_PROVIDER;
    expect(getEmailProvider()).toBe('resend');
  });
});
