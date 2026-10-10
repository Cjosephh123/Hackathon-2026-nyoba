import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import '../features/home/HomePage.css'; // brings the .app-shell colour tokens
import './AppLayout.css';

/** Sidebar + page area. Use as a layout route: <Route element={<AppLayout />}>...</Route> */
export default function AppLayout({ items, onSignOut, children }) {
  return (
    <div className="app app-shell">
      <Sidebar items={items} onSignOut={onSignOut} />
      <main className="app__main">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
