import { supabase } from '../supabase.js';
import { getTimeZone } from '../utils/date.js';

/**
 * Most popular books or journals this month (borrowed + reserved; journals also count views).
 * Each row includes availability numbers so the UI can show Available / Reserved / Borrowed.
 * @param {{ type: 'book' | 'journal', limit?: number }} options
 */
export async function getPopularTitles({ type, limit = 3 }) {
  const { data, error } = await supabase.rpc('get_popular_titles', {
    p_type: type,
    p_limit: limit,
    p_tz: getTimeZone(),
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
