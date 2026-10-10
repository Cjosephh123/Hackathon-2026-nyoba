import { useEffect, useRef, useState } from 'react';
import {
  getApprovedJournalUrl,
  getLocalRepository,
  searchOpenAccessResearch,
  searchOpenLibrary,
} from './repositoryService.js';
import './RepositoryPage.css';

const TABS = [
  { id: 'local', label: 'Library catalog' },
  { id: 'books', label: 'Open books' },
  { id: 'research', label: 'Open-access research' },
];

export default function RepositoryPage() {
  const [tab, setTab] = useState('local');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [journalUrls, setJournalUrls] = useState({});
  const [openingJournal, setOpeningJournal] = useState('');
  const requestId = useRef(0);
  const controllerRef = useRef(null);

  async function performSearch(source, queryText) {
    const request = ++requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const search = queryText.trim();
    setError('');
    if (source !== 'local' && !search) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextResults = source === 'local'
        ? await getLocalRepository(search)
        : source === 'books'
          ? await searchOpenLibrary(search, controller.signal)
          : await searchOpenAccessResearch(search, controller.signal);
      if (request === requestId.current) setResults(nextResults);
    } catch (searchError) {
      if (request === requestId.current && searchError.name !== 'AbortError') {
        setError(searchError.message || 'Could not search the repository.');
        setResults([]);
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== 'local') return undefined;
    setSearched(true);
    performSearch('local', query);
    return () => controllerRef.current?.abort();
  }, [tab]);

  async function handleSearch(event) {
    event.preventDefault();
    setSearched(true);
    await performSearch(tab, query);
  }

  function handleTabChange(nextTab) {
    requestId.current += 1;
    controllerRef.current?.abort();
    setTab(nextTab);
    setResults([]);
    setError('');
    setSearched(false);
    setJournalUrls({});
  }

  async function handleOpenJournal(bookId) {
    setOpeningJournal(bookId);
    setError('');
    try {
      const url = await getApprovedJournalUrl(bookId);
      setJournalUrls((current) => ({ ...current, [bookId]: url }));
    } catch (journalError) {
      setError(journalError.message || 'Could not open the journal file.');
    } finally {
      setOpeningJournal('');
    }
  }

  return (
    <section className="repository-page">
      <header className="repository-page__header">
        <div>
          <p className="repository-page__eyebrow">DISCOVER & RESEARCH</p>
          <h1>Repository</h1>
          <p>Search the library collection and explore openly available books and research.</p>
        </div>
      </header>

      <div className="repository-page__tabs" role="tablist" aria-label="Repository sources">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => handleTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form className="repository-page__search" onSubmit={handleSearch} role="search">
        <label className="visually-hidden" htmlFor="repository-search">Search the repository</label>
        <input
          id="repository-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === 'local' ? 'Search titles, authors, or categories…' : 'Enter a title, author, or topic…'}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {tab !== 'local' && (
        <p className="repository-page__source-note">
          External results are identified by source. Open-access status is provided by OpenAlex;
          availability may vary by publisher.
        </p>
      )}
      {error && <p className="repository-page__error" role="alert">{error}</p>}
      {loading && <p className="repository-page__empty" role="status">Searching repository…</p>}
      {!loading && searched && results.length === 0 && !error && (
        <p className="repository-page__empty">No results found. Try a different search.</p>
      )}
      {!loading && !searched && tab !== 'local' && (
        <p className="repository-page__empty">Search to explore external collections.</p>
      )}

      <div className="repository-page__grid">
        {results.map((item) => {
          const local = tab === 'local';
          const title = local ? item.title : item.title;
          const authors = local ? item.authors : item.authors;
          const coverUrl = local ? item.cover_url : item.coverUrl;
          const href = local ? `/borrow/${item.book_id}` : item.url;
          const detail = local
            ? [
              item.category,
              item.publication_year,
              item.type,
              `Physical available: ${item.availability?.physical.available ?? 0}`,
              `Digital available: ${item.availability?.digital.available ?? 0}`,
              item.added_at ? `Added ${new Date(item.added_at).toLocaleDateString()}` : null,
            ].filter(Boolean).join(' · ')
            : [item.source, item.year, item.detail].filter(Boolean).join(' · ');
          return (
            <article className="repository-card" key={local ? item.book_id : item.id}>
              <div className="repository-card__cover">
                {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <span aria-hidden="true">BOOK</span>}
              </div>
              <div className="repository-card__content">
                <span className="repository-card__source">{local ? 'Library collection' : item.source}</span>
                <h2>{title}</h2>
                <p className="repository-card__authors">
                  {Array.isArray(authors) && authors.length ? authors.join(', ') : 'Author information unavailable'}
                </p>
                <p className="repository-card__detail">{detail}</p>
                {local && item.description && (
                  <p className="repository-card__description">{item.description}</p>
                )}
                <a href={href} target={local ? undefined : '_blank'} rel={local ? undefined : 'noreferrer'}>
                  {local ? 'View in library' : 'Open source record'}
                </a>
                {local && item.type === 'journal' && (
                  journalUrls[item.book_id] ? (
                    <a href={journalUrls[item.book_id]} target="_blank" rel="noreferrer">Read approved journal</a>
                  ) : (
                    <button
                      className="repository-card__read"
                      type="button"
                      disabled={openingJournal === item.book_id}
                      onClick={() => handleOpenJournal(item.book_id)}
                    >
                      {openingJournal === item.book_id ? 'Preparing…' : 'Read approved journal'}
                    </button>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
