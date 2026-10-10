// Turns the numbers returned by `get_popular_titles` into the labels shown on each row.
const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export function getBookStatus(title) {
  if (title.available_copies > 0) {
    return { label: 'Available', chip: 'On shelf', tone: 'success' };
  }
  if (title.pending_reservations > 0) {
    return { label: 'Reserved', chip: 'Waitlist', tone: 'warning' };
  }
  const dueSoon = title.next_due_at && new Date(title.next_due_at) - Date.now() <= DUE_SOON_MS;
  return { label: 'Borrowed', chip: dueSoon ? 'Due soon' : 'Checked out', tone: 'danger' };
}

export function getJournalStatus(title) {
  if (title.has_digital) {
    return { label: 'Digital', chip: 'Read online', tone: 'success' };
  }
  const onShelf = title.available_copies > 0;
  return { label: 'Print', chip: onShelf ? 'On shelf' : 'Checked out', tone: onShelf ? 'success' : 'danger' };
}
