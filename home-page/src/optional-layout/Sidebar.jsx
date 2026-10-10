import { NavLink } from 'react-router-dom';
import logo from './logo.png';
import './Sidebar.css';

export const DEFAULT_NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/repository', label: 'Repository' },
  { to: '/borrow', label: 'Borrow' },
  { to: '/ta-upload', label: 'TA Upload' },
  { to: '/ai-assistant', label: 'AI Assistant' },
];

/**
 * @param items       [{ to, label, end? }]
 * @param onSignOut   optional; the "Sign out" button only shows when you pass it
 */
export default function Sidebar({ items = DEFAULT_NAV_ITEMS, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <img src={logo} alt="Library" />
      </div>

      <nav aria-label="Main">
        <ul className="sidebar__list">
          {items.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {onSignOut && (
        <button type="button" className="sidebar__signout" onClick={onSignOut}>
          Sign out
        </button>
      )}
    </aside>
  );
}
