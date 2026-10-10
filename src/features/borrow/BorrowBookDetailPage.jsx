import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBorrowBookDetail, getCatalogEbookUrl, requestBorrowBook } from './services/borrowService.js';
import './BorrowBookDetailPage.css';

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export default function BorrowBookDetailPage() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [borrowing, setBorrowing] = useState(false);
  const [openingEbook, setOpeningEbook] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setBook(null);

    getBorrowBookDetail(bookId)
      .then((result) => {
        if (active) setBook(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load this title.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId]);

  async function handleBorrow() {
    setBorrowing(true);
    setError('');
    setNotice('');
    try {
      await requestBorrowBook(bookId);
      setBook((current) => ({ ...current, has_pending_borrow_request: true }));
      setNotice(`Your request for “${book.title}” is waiting for staff approval. The copy stays available until it is approved.`);
    } catch (borrowError) {
      setError(borrowError.message || 'Could not borrow this title. Please try again.');
    } finally {
      setBorrowing(false);
    }
  }

  async function handleOpenEbook() {
    setOpeningEbook(true);
    setError('');
    try {
      const url = await getCatalogEbookUrl(bookId);
      window.location.assign(url);
    } catch (ebookError) {
      setError(ebookError.message || 'Could not open this e-book.');
    } finally {
      setOpeningEbook(false);
    }
  }

  if (loading) {
    return <main className="borrow-detail__state" role="status">Loading title…</main>;
  }

  if (error && !book) {
    return (
      <main className="borrow-detail__state">
        <p className="borrow-detail__error" role="alert">{error}</p>
        <Link to="/borrow" className="borrow-detail__back">Back to Borrow</Link>
      </main>
    );
  }

  if (!book) return null;

  const activeLoanDueAt = book.active_loan_due_at;
  const canRequestBorrow =
    book.available_copies > 0
    && !activeLoanDueAt
    && !book.has_pending_borrow_request;
  const tags = [book.category, book.publication_year, book.frequency].filter(Boolean);

  return (
    <section className="borrow-detail">
      <header className="borrow-detail__header">
        <Link to="/borrow" className="borrow-detail__back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5m0 0 7-7m-7 7 7 7" />
          </svg>
          Back to Borrow
        </Link>
      </header>

      {error && <p className="borrow-detail__error" role="alert">{error}</p>}
      {notice && <p className="borrow-detail__success" role="status">{notice}</p>}

      <article className="borrow-detail__card">
        <div className="borrow-detail__cover">
          {book.cover_url ? <img src={book.cover_url} alt="" /> : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
              <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
            </svg>
          )}
        </div>

        <div className="borrow-detail__content">
          <p className="borrow-detail__eyebrow">{book.type === 'journal' ? 'Journal' : 'Book'}</p>
          <h1>{book.title}</h1>
          <p className="borrow-detail__authors">Author: {(book.authors || []).join(', ') || 'Unknown'}</p>
          {book.publisher && <p className="borrow-detail__meta">Publisher: {book.publisher}</p>}

          <div className="borrow-detail__tags">
            {tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>

          <section className="borrow-detail__overview">
            <h2>Book Overview</h2>
            <p>{book.description || 'No description is available for this title.'}</p>
          </section>

          <div className="borrow-detail__availability">
            <span className={`borrow-detail__badge ${canRequestBorrow || book.has_pending_borrow_request ? 'borrow-detail__badge--available' : 'borrow-detail__badge--unavailable'}`}>
              {activeLoanDueAt
                ? 'Borrowed · in your collection'
                : book.has_pending_borrow_request
                  ? 'Available · request waiting for staff'
                  : canRequestBorrow
                    ? 'Available'
                    : book.has_digital
                      ? 'Digital access'
                      : book.pending_reservations > 0
                        ? 'Waiting list'
                        : 'Borrowed · unavailable'}
            </span>
            {canRequestBorrow && book.location && <span>{book.location}</span>}
            {book.available_copies > 0 && <span>{book.available_copies} available</span>}
            {book.has_pending_borrow_request && <span>Your request is waiting for staff approval</span>}
            {activeLoanDueAt && <span>Due: {formatDate(activeLoanDueAt)}</span>}
            {!canRequestBorrow && !book.has_pending_borrow_request && !activeLoanDueAt && !book.has_digital && book.pending_reservations > 0 && (
              <span>{book.pending_reservations} active waitlist request(s)</span>
            )}
          </div>

          {canRequestBorrow && (
            <button className="borrow-detail__borrow" type="button" onClick={handleBorrow} disabled={borrowing}>
              {borrowing ? 'Sending request…' : 'Request to borrow'}
            </button>
          )}
          {book.has_digital && (
            <button className="borrow-detail__borrow" type="button" onClick={handleOpenEbook} disabled={openingEbook}>
              {openingEbook ? 'Preparing e-book…' : 'Open e-book'}
            </button>
          )}
        </div>
      </article>
    </section>
  );
}
