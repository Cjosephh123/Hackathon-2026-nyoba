import { useState } from 'react';
import { Link } from 'react-router-dom';
import './BorrowBookCard.css';

function BookCover({ book }) {
  const [failed, setFailed] = useState(false);

  if (book.cover_url && !failed) {
    return <img src={book.cover_url} alt="" onError={() => setFailed(true)} />;
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
    </svg>
  );
}

function getStatus(book) {
  if (book.available_copies > 0) {
    return {
      label: 'Available',
      detail: book.has_pending_borrow_request ? 'Request waiting for staff' : 'On shelf',
      tone: 'available',
    };
  }
  if (book.has_digital) return { label: 'Digital', detail: 'Read online', tone: 'digital' };
  if (book.pending_reservations > 0) return { label: 'Waiting', detail: 'Waitlist', tone: 'reserved' };
  return { label: 'Borrowed', detail: 'Checked out', tone: 'borrowed' };
}

export default function BorrowBookCard({ book, requesting, onJoinWaitlist }) {
  const status = getStatus(book);
  const tags = [book.category, book.publication_year, book.frequency].filter(Boolean);
  const waitlistAvailable = !book.has_digital && book.available_copies === 0;

  return (
    <article className="borrow-book">
      <Link className="borrow-book__details" to={`/borrow/${book.book_id}`}>
        <span className="borrow-book__cover"><BookCover book={book} /></span>
        <span className="borrow-book__body">
          <span className="borrow-book__title">{book.title}</span>
          <span className="borrow-book__author">{(book.authors || []).join(', ')}</span>
          <span className="borrow-book__tags">
            {tags.map((tag) => <span className="borrow-book__tag" key={tag}>{tag}</span>)}
          </span>
        </span>
        <span className="borrow-book__status">
          <span>{status.label}</span>
          <span className={`borrow-book__badge borrow-book__badge--${status.tone}`}>{status.detail}</span>
        </span>
      </Link>

      {waitlistAvailable && (
        <div className="borrow-book__list-actions">
          <button
            className="borrow-book__request"
            type="button"
            disabled={requesting}
            onClick={() => onJoinWaitlist(book)}
          >
            {requesting ? 'Joining waitlist…' : 'Join waitlist'}
          </button>
        </div>
      )}
    </article>
  );
}
