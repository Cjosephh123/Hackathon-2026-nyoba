import { RefreshIcon } from './icons.jsx';
import { formatLongDate } from '../utils/date.js';
import { checkoutCaption, formatNumber } from '../utils/format.js';
import './ActivityPanel.css';

function StatTile({ label, value, caption, tone }) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      <p className={`stat__caption stat__caption--${tone}`}>{caption}</p>
    </div>
  );
}

function buildTiles(a) {
  if (!a) {
    return ['Checkouts today', 'Returns today', 'Waitlist requests', 'Digital access'].map((label) => ({
      label,
      value: '–',
      caption: ' ',
      tone: 'accent',
    }));
  }
  return [
    {
      label: 'Checkouts today',
      value: formatNumber(a.checkouts_today),
      caption: checkoutCaption(a.checkouts_today, a.checkouts_yesterday),
      tone: 'accent',
    },
    {
      label: 'Returns today',
      value: formatNumber(a.returns_today),
      caption: `${formatNumber(a.returns_on_time)} returned on time`,
      tone: 'success',
    },
    {
      label: 'Waitlist requests',
      value: formatNumber(a.waitlist_today),
      caption: `${formatNumber(a.waitlist_ready)} ready for pickup`,
      tone: 'accent',
    },
    {
      label: 'Digital access',
      value: formatNumber(a.visitors_today),
      caption: `${formatNumber(a.page_views_today)} page views today`,
      tone: 'success',
    },
  ];
}

/** "Library Activity" panel. `query` is the result of useAsyncData(getLibraryActivity). */
export default function ActivityPanel({ query }) {
  const { data, loading, error, reload } = query;

  return (
    <section className="activity" aria-busy={loading}>
      <div className="activity__head">
        <div>
          <h2 className="activity__title">Library Activity</h2>
          <p className="activity__subtitle">Live numbers for {formatLongDate()}</p>
        </div>
        <button type="button" className="activity__refresh" onClick={reload} disabled={loading}>
          <RefreshIcon aria-hidden="true" className={loading ? 'activity__spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="activity__error" role="alert">
          {error}
        </p>
      )}

      <div className="activity__grid">
        {buildTiles(data).map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
    </section>
  );
}
