import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (
  !url ||
  !anonKey ||
  url.includes('your-project-id') ||
  anonKey === 'your-anon-public-key'
) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env before using authentication.');
}

export const supabase = createClient(url, anonKey);
