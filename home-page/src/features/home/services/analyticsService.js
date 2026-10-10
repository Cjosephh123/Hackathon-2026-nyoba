// Counts website viewers. Each browser gets a random anonymous id stored locally.
import { supabase } from '../supabase.js';

const VISITOR_KEY = 'library_visitor_id';

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: counts as a new visitor
  }
}

/** Record one page view. Never throws - analytics must not break the page. */
export async function trackVisit(path) {
  try {
    const { data } = await supabase.auth.getSession();
    await supabase.from('site_visits').insert({
      visitor_id: getVisitorId(),
      user_id: data.session?.user?.id ?? null,
      path,
    });
  } catch {
    /* ignore */
  }
}
