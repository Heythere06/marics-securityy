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