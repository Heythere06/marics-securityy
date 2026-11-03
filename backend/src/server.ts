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
console.info(`[config] email: provider=${emailProvider} SMTP=${smtpReady ? 'present' : 'missing'} RESEND=${resendReady ? 'present' : 'missing'} EMAIL_FROM=${emailFrom ? 'present' : 'missing'} SUPABASE_URL=${process.env.SUPABASE_URL ? 'present' : 'missing'}`);
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