import { Link } from 'react-router-dom';
import { logout } from '../services/authService.js';

// Temporary page so the login redirect has somewhere to land.
export default function PlaceholderPage({ title }) {
  return (
    <main style={{ padding: '3rem', textAlign: 'center' }}>
      <h1>{title}</h1>
      <p>
        <Link to="/login" onClick={() => logout().catch(() => {})}>
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
