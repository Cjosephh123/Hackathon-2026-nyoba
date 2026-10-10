/** Browser time zone, e.g. "Asia/Jakarta". Used so "today" matches the visitor's day. */
export const getTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';

/** Today's date as YYYY-MM-DD in the visitor's local time. */
export const getTodayISO = () => new Date().toLocaleDateString('en-CA');

export const formatLongDate = (date = new Date()) =>
  date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
