// All backend calls for authentication live here.
// If the backend changes, only this file needs to change.
import { supabase } from '../lib/supabaseClient.js';

/**
 * Sign in with email + password, then load the user's role from `profiles`.
 * @returns {Promise<{ user: object, profile: { role: 'member'|'staff'|'admin', full_name: string } }>}
 */
export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw new Error(profileError.message);

  return { user: data.user, profile };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Create a new member account.
 * `username` is passed as metadata; a database trigger copies it into `profiles`.
 * @returns {Promise<{ user: object|null, session: object|null }>}
 *   `session` is null when email confirmation is turned on in Supabase.
 */
export async function register({ username, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: username },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw new Error(error.message);
  return { user: data.user, session: data.session };
}

/** True when nobody has taken this username yet (case-insensitive). */
export async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error) throw new Error(error.message);
  return data;
}
