import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from './icons.jsx';
import './SearchBox.css';

/** Header search: sends the visitor to `${searchPath}?q=...` */
export default function SearchBox({ searchPath = '/repository' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `${searchPath}?q=${encodeURIComponent(q)}` : searchPath);
  }

  return (
    <form className="search" role="search" onSubmit={handleSubmit}>
      <SearchIcon aria-hidden="true" />
      <input
        className="search__input"
        type="search"
        aria-label="Search books, journals, or authors"
        placeholder="Search books, journals, or authors"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  );
}
