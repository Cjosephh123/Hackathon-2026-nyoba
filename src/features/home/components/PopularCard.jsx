import { Link } from 'react-router-dom';
import { ArrowRightIcon } from './icons.jsx';
import './PopularCard.css';

/**
 * Card with a title, "View all" link and a list of items.
 * Handles loading, error and empty states so pages stay simple.
 * @param query       result of useAsyncData(): { data, loading, error, reload }
 * @param renderItem  (item, index) => element; items must have `book_id`
 */
export default function PopularCard({ title, subtitle, viewAllTo, query, emptyText, renderItem }) {
  const { data, loading, error, reload } = query;
  const items = data ?? [];

  let body;
  if (error) {
    body = (
      <div className="popular-card__state" role="alert">
        <p>{error}</p>
        <button type="button" className="popular-card__retry" onClick={reload}>
          Try again
        </button>
      </div>
    );
  } else if (loading && !data) {
    body = (
      <ul className="popular-card__list" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((n) => (
          <li key={n} className="popular-card__skeleton" />
        ))}
      </ul>
    );
  } else if (items.length === 0) {
    body = (
      <p className="popular-card__state">
        {emptyText}
      </p>
    );
  } else {
    body = (
      <ul className="popular-card__list">
        {items.map((item, index) => (
          <li key={item.book_id}>{renderItem(item, index)}</li>
        ))}
      </ul>
    );
  }

  return (
    <section className="popular-card">
      <div className="popular-card__head">
        <div>
          <h2 className="popular-card__title">{title}</h2>
          <p className="popular-card__subtitle">{subtitle}</p>
        </div>
        <Link className="popular-card__link" to={viewAllTo}>
          View all <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
      {body}
    </section>
  );
}
