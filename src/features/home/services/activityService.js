import { supabase } from '../supabase.js';
import { getTimeZone, getTodayISO } from '../utils/date.js';

/**
 * Library numbers for one day (default: today in the visitor's time zone):
 * checkouts, returns, waitlist requests and website visitors.
 */
export async function getLibraryActivity(day = getTodayISO()) {
  const { data, error } = await supabase.rpc('get_library_activity', {
    p_day: day,
    p_tz: getTimeZone(),
  });
  if (error) throw new Error(error.message);
  return data;
}
