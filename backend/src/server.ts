import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const port = Number(process.env.PORT ?? 4000);
const emailFrom = process.env.EMAIL_FROM?.trim() || '';
const smtpReady = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
const resendReady = Boolean(process.env.RESEND_API_KEY?.trim());
const emailProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  || (smtpReady ? 'smtp' : resendReady ? 'resend' : 'none');
const aiReady = Boolean(process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || process.env.AI_PROVIDER_API_KEY?.trim());
console.info(`[config] email: provider=${emailProvider} SMTP=${smtpReady ? 'present' : 'missing'} RESEND=${resendReady ? 'present' : 'missing'} EMAIL_FROM=${emailFrom ? 'present' : 'missing'} SUPABASE_URL=${process.env.SUPABASE_URL ? 'present' : 'missing'} AI=${aiReady ? 'present' : 'missing'}`);
if (!aiReady) {
  console.warn('[config] No Claude key on this server. Set CLAUDE_API_KEY (or ANTHROPIC_API_KEY / AI_PROVIDER_API_KEY) on Render, then restart. Chat and AI practice will return 503 until then.');
}
if (!smtpReady && /onboarding@resend\.dev/i.test(emailFrom)) {
  console.warn('[config] No SMTP configured and EMAIL_FROM uses onboarding@resend.dev — add Gmail SMTP (or similar) for tester delivery, or verify a Resend domain later.');
}
const app = buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error, 'Unable to start API');
  process.exit(1);
}