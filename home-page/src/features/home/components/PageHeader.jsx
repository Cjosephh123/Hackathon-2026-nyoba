import SearchBox from './SearchBox.jsx';
import './PageHeader.css';

export default function PageHeader({ title, subtitle, searchPath }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      <SearchBox searchPath={searchPath} />
    </header>
  );
}
