import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BorrowBookCard from './components/BorrowBookCard.jsx';
import { getBorrowCatalog, joinWaitlist } from './services/borrowService.js';
import './BorrowPage.css';

export default function BorrowPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestingId, setRequestingId] = useState(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const results = await getBorrowCatalog(search);
        if (active) setBooks(results);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load the library catalog.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  async function handleWaitlist(book) {
    setRequestingId(book.book_id);
    setError('');
    setNotice('');
    try {
      await joinWaitlist(book.book_id);
      setNotice(`You joined the waitlist for “${book.title}”.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not join the waitlist.');
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <section className="borrow-page">
      <header className="borrow-page__header">
        <div>
          <h1 className="borrow-page__title">Borrow</h1>
          <p className="borrow-page__subtitle">Find books and journals in the library catalog.</p>
        </div>
        <form className="borrow-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="visually-hidden" htmlFor="borrow-search-input">
            Search books, journals, or authors
          </label>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            id="borrow-search-input"
            type="search"
            placeholder="Search books, journals, or authors"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>
      </header>

      <div className="borrow-page__intro">
        <div>
          <h2>{search.trim() ? `Search results for “${search.trim()}”` : 'Most searched books and journals'}</h2>
          <p>Select a title to view its details. Unavailable print titles can be added to your waitlist.</p>
        </div>
        <button className="borrow-page__back" type="button" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5m0 0 7-7m-7 7 7 7" />
          </svg>
          Home
        </button>
      </div>

      {error && <p className="borrow-page__message borrow-page__message--error" role="alert">{error}</p>}
      {notice && <p className="borrow-page__message borrow-page__message--success" role="status">{notice}</p>}

      {loading ? (
        <p className="borrow-page__state" role="status">Loading catalog…</p>
      ) : books.length === 0 ? (
        <p className="borrow-page__state">
          {error ? 'The catalog could not be loaded.' : 'No books or journals match your search.'}
        </p>
      ) : (
        <div className="borrow-page__grid">
          {books.map((book) => (
            <BorrowBookCard
              key={book.book_id}
              book={book}
              requesting={requestingId === book.book_id}
              onJoinWaitlist={handleWaitlist}
            />
          ))}
        </div>
      )}
    </section>
  );
}
