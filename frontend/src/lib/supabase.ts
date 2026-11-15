import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function clearPersistedAuth() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-') && key.includes('auth')) window.localStorage.removeItem(key);
    }
  } catch {
    /* Private browsing can block storage access. */
  }
}

clearPersistedAuth();

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
