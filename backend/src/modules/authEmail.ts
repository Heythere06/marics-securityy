import { z } from 'zod';
import { buildEmailVerificationEmail, isEmailConfigured, sendEmail } from '../lib/email.js';
import { createServiceClient } from '../lib/supabase.js';

export const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(320),
});

function frontendRedirectUrl() {
  return process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
}

function isMissingUserError(error: { message?: string; status?: number; code?: string }) {
  const message = (error.message ?? '').toLowerCase();
  return message.includes('user not found')
    || message.includes('unable to find')
    || message.includes('email not found')
    || error.code === 'user_not_found'
    || error.status === 404;
}

export async function sendSignupVerificationEmail(email: string) {
  if (!isEmailConfigured()) throw new Error('EMAIL_NOT_CONFIGURED');

  let service;
  try {
    service = createServiceClient();
  } catch {
    throw new Error('VERIFICATION_UNAVAILABLE');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { redirectTo: frontendRedirectUrl() },
  });

  if (error) {
    if (isMissingUserError(error)) return { sent: false as const, reason: 'not_found' as const };
    throw error;
  }

  if (data.user?.email_confirmed_at) return { sent: false as const, reason: 'already_confirmed' as const };

  const verificationUrl = data.properties?.action_link;
  if (!verificationUrl) throw new Error('VERIFICATION_LINK_UNAVAILABLE');

  await sendEmail({
    to: normalizedEmail,
    ...buildEmailVerificationEmail({ verificationUrl }),
  });
  return { sent: true as const };
}

export async function requestSignupVerificationEmail(email: string) {
  return sendSignupVerificationEmail(email);
}
