// =====================================================================
// CONNECT YOUR DATABASE HERE (the only file that creates/imports a client)
//
// Option A (default): standalone client from env vars in your .env
//   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon-public-key>
//
// Option B: reuse the client your app already has. Replace everything below with:
//   export { supabase } from '../../lib/supabaseClient.js';   // <- your path
// =====================================================================
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('[home] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key');
