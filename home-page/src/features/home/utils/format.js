export const formatNumber = (value) => Number(value ?? 0).toLocaleString('en-US');

/** "+12% vs yesterday" style caption for the checkouts tile. */
export function checkoutCaption(today, yesterday) {
  if (!yesterday) return today ? 'No checkouts yesterday' : 'No checkouts yet today';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs yesterday`;
}
