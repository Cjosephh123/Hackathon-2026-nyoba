import PageHeader from './components/PageHeader.jsx';
import PopularCard from './components/PopularCard.jsx';
import TitleRow from './components/TitleRow.jsx';
import ActivityPanel from './components/ActivityPanel.jsx';
import useAsyncData from './hooks/useAsyncData.js';
import { getPopularTitles } from './services/catalogService.js';
import { getLibraryActivity } from './services/activityService.js';
import { getBookStatus, getJournalStatus } from './utils/titleStatus.js';
import './HomePage.css';

/**
 * Home page content (header, popular books, popular journals, library activity).
 * It brings its own styles and has no dependency on your auth or layout code.
 *
 * Props (all optional) - change them to match your own routes:
 *   searchPath   where the header search sends people      (default /repository)
 *   booksPath    "View all" link for books                  (default /repository?type=book)
 *   journalsPath "View all" link for journals               (default /repository?type=journal)
 */
export default function HomePage({
  searchPath = '/repository',
  booksPath = '/repository?type=book',
  journalsPath = '/repository?type=journal',
}) {
  const books = useAsyncData(() => getPopularTitles({ type: 'book', limit: 3 }));
  const journals = useAsyncData(() => getPopularTitles({ type: 'journal', limit: 3 }));
  const activity = useAsyncData(() => getLibraryActivity());

  return (
    <div className="home-page">
      <PageHeader title="Home" subtitle="Explore popular books and journals" searchPath={searchPath} />

      <div className="home__grid">
        <PopularCard
          title="Popular Books"
          subtitle="Most borrowed titles this month"
          viewAllTo={booksPath}
          query={books}
          emptyText="No books have been borrowed or reserved this month yet."
          renderItem={(book, index) => (
            <TitleRow
              highlighted={index === 0}
              title={book.title}
              subtitle={book.authors?.join(', ')}
              tags={[book.category, book.publication_year]}
              status={getBookStatus(book)}
              coverUrl={book.cover_url}
            />
          )}
        />

        <PopularCard
          title="Popular Journals"
          subtitle="Top digital and print subscriptions"
          viewAllTo={journalsPath}
          query={journals}
          emptyText="No journal activity this month yet."
          renderItem={(journal, index) => (
            <TitleRow
              highlighted={index === 0}
              title={journal.title}
              subtitle={journal.description}
              tags={[journal.category, journal.frequency]}
              status={getJournalStatus(journal)}
              coverUrl={journal.cover_url}
            />
          )}
        />
      </div>

      <ActivityPanel query={activity} />
    </div>
  );
}
