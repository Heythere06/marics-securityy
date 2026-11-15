import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type CachedClient = { url: string; key: string; client: SupabaseClient };

let serviceClientCache: CachedClient | null = null;

export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service client is not configured');
  if (serviceClientCache && serviceClientCache.url === url && serviceClientCache.key === key) {
    return serviceClientCache.client;
  }
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  serviceClientCache = { url, key, client };
  return client;
}

/** Trusted client for scoring, answer keys, and integrity-sensitive writes (CIA). */
export function requireScoringClient(fallback?: SupabaseClient): SupabaseClient {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return createServiceClient();
  if (process.env.NODE_ENV === 'production') throw new Error('SERVICE_ROLE_REQUIRED');
  if (fallback) return fallback;
  throw new Error('SERVICE_ROLE_REQUIRED');
}

export function toPublicInvitation(invitation: { id: string; email: string; expiresAt: string; token?: string }) {
  return { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt };
}