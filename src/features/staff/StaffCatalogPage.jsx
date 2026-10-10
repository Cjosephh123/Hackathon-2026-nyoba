import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addCatalogBook, searchCatalogCovers } from './staffService.js';
import './StaffCatalogPage.css';

const INITIAL_BOOK = {
  title: '',
  authors: '',
  publisher: '',
  publicationYear: '',
  type: 'book',
  category: '',
  description: '',
  frequency: '',
  coverUrl: '',
  coverFile: null,
  ebookFile: null,
  copyBarcodes: '',
  location: '',
};

export default function StaffCatalogPage() {
  const [book, setBook] = useState(INITIAL_BOOK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coverResults, setCoverResults] = useState([]);
  const [lookingUpCovers, setLookingUpCovers] = useState(false);

  function update(field, value) {
    setBook((current) => ({ ...current, [field]: value }));
  }

  async function handleCoverSearch() {
    if (!book.title.trim()) {
      setError('Enter a title before searching for a cover.');
      return;
    }
    setError('');
    setCoverResults([]);
    setLookingUpCovers(true);
    try {
      const results = await searchCatalogCovers(book.title, book.authors);
      setCoverResults(results);
      if (!results.length) setNotice('No exact-title cover was found in Open Library. You can upload one or enter a cover URL.');
    } catch (searchError) {
      setError(`Could not search Open Library: ${searchError.message}`);
    } finally {
      setLookingUpCovers(false);
    }
  }

  function selectCover(result) {
    setBook((current) => ({ ...current, coverUrl: result.coverUrl, coverFile: null }));
    setCoverResults([]);
    setNotice(`Open Library cover selected${result.year ? ` (${result.year})` : ''}.`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      let catalogBook = book;
      let coverNotice = '';
      if (!book.coverFile && !book.coverUrl.trim()) {
        setLookingUpCovers(true);
        try {
          const covers = await searchCatalogCovers(book.title, book.authors);
          if (covers[0]) {
            catalogBook = { ...book, coverUrl: covers[0].coverUrl };
            coverNotice = ' A matching cover was found in Open Library.';
          } else {
            coverNotice = ' No matching Open Library cover was found.';
          }
        } catch (lookupError) {
          coverNotice = ` The online cover search failed (${lookupError.message}); the title was saved without a cover.`;
        } finally {
          setLookingUpCovers(false);
        }
      }
      const bookId = await addCatalogBook(catalogBook);
      setNotice(`“${book.title.trim()}” was added to the catalog (${bookId})${book.ebookFile ? ' with digital access' : ''}.${coverNotice}`);
      setBook(INITIAL_BOOK);
      setCoverResults([]);
    } catch (saveError) {
      setError(saveError.message || 'Could not add this title to the catalog.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="staff-catalog">
      <header className="staff-catalog__header">
        <div>
          <p className="staff-catalog__eyebrow">STAFF TOOLS</p>
          <h1>Add to library catalog</h1>
          <p>Create a book or journal record and register any physical copies.</p>
        </div>
        <Link to="/admin">Back to dashboard</Link>
      </header>

      {notice && <p className="staff-catalog__notice" role="status">{notice}</p>}
      {error && <p className="staff-catalog__error" role="alert">{error}</p>}

      <form className="staff-catalog__form" onSubmit={handleSubmit}>
        <div className="staff-catalog__grid">
          <label>
            Title *
            <input value={book.title} onChange={(event) => update('title', event.target.value)} maxLength={300} required />
          </label>
          <label>
            Authors <span>comma-separated</span>
            <input value={book.authors} onChange={(event) => update('authors', event.target.value)} />
          </label>
          <label>
            Type *
            <select value={book.type} onChange={(event) => update('type', event.target.value)}>
              <option value="book">Book</option>
              <option value="journal">Journal</option>
            </select>
          </label>
          <label>
            Publisher
            <input value={book.publisher} onChange={(event) => update('publisher', event.target.value)} />
          </label>
          <label>
            Publication year
            <input
              type="number"
              min="1"
              max="9999"
              value={book.publicationYear}
              onChange={(event) => update('publicationYear', event.target.value)}
            />
          </label>
          <label>
            Category
            <input value={book.category} onChange={(event) => update('category', event.target.value)} maxLength={80} />
          </label>
          <label>
            Journal frequency
            <input value={book.frequency} onChange={(event) => update('frequency', event.target.value)} placeholder="e.g. Monthly" />
          </label>
          <label>
            Cover image URL
            <input
              type="url"
              value={book.coverUrl}
              onChange={(event) => {
                update('coverUrl', event.target.value);
                update('coverFile', null);
              }}
              placeholder="https://…"
            />
          </label>
        </div>
        <div className="staff-catalog__cover-tools">
          <label>
            Upload cover image <span>JPEG, PNG, or WebP · up to 5 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                update('coverFile', file);
                if (file) update('coverUrl', '');
              }}
            />
          </label>
          <button type="button" disabled={lookingUpCovers || saving} onClick={handleCoverSearch}>
            {lookingUpCovers ? 'Searching Open Library…' : 'Search Open Library covers'}
          </button>
        </div>
        {coverResults.length > 0 && (
          <div className="staff-catalog__cover-results" aria-label="Open Library cover search results">
            {coverResults.map((result) => (
              <button
                className="staff-catalog__cover-result"
                type="button"
                key={`${result.coverUrl}-${result.title}`}
                onClick={() => selectCover(result)}
              >
                <img src={result.coverUrl} alt="" />
                <span>
                  <strong>{result.title}</strong>
                  <span>{result.authors.join(', ') || 'Author not listed'}{result.year ? ` · ${result.year}` : ''}</span>
                  <span>Select cover</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <label className="staff-catalog__ebook">
          E-book file <span>Optional · PDF or EPUB · up to 50 MB · stored privately</span>
          <input
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && file.size > 50 * 1024 * 1024) {
                event.target.value = '';
                update('ebookFile', null);
                setError('E-book files must be 50 MB or smaller.');
                return;
              }
              if (file && !/\.(pdf|epub)$/i.test(file.name)) {
                event.target.value = '';
                update('ebookFile', null);
                setError('Choose a PDF or EPUB e-book file.');
                return;
              }
              setError('');
              update('ebookFile', file);
            }}
          />
          {book.ebookFile && <span>Selected: {book.ebookFile.name}</span>}
        </label>
        <label>
          Description
          <textarea value={book.description} onChange={(event) => update('description', event.target.value)} rows={4} />
        </label>
        <div className="staff-catalog__grid staff-catalog__grid--inventory">
          <label>
            Physical copy barcodes <span>one barcode per line; leave blank for catalog-only record</span>
            <textarea
              value={book.copyBarcodes}
              onChange={(event) => update('copyBarcodes', event.target.value)}
              rows={5}
              placeholder={'LIB-000123\nLIB-000124'}
            />
          </label>
          <label>
            Shelf/location
            <input value={book.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Floor 2 · Shelf A3" />
            <span>This location is applied to every new copy.</span>
          </label>
        </div>
        <p className="staff-catalog__hint">
          E-books are private to signed-in library users. Uploaded physical copy barcodes are
          registered as available print copies.
        </p>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving catalog and uploads…' : 'Add to catalog'}
        </button>
      </form>
    </section>
  );
}
