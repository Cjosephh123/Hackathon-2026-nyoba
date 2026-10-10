import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthInput from '../components/AuthInput.jsx';
import { LockIcon, UserIcon } from '../components/Icons.jsx';
import { login } from '../services/authService.js';
import bookshelf from '../assets/login-bg.jpg';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { profile } = await login({ email: email.trim(), password });
      // Members go to the library site, staff/admin go to the dashboard.
      navigate(profile.role === 'member' ? '/' : '/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <div
        className="login__image"
        style={{ backgroundImage: `url(${bookshelf})` }}
        role="img"
        aria-label="Shelves of novels in a bookstore"
      />

      <section className="login__panel">
        <h1 className="login__title">Sign In</h1>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <AuthInput
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            icon={<UserIcon />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthInput
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            icon={<LockIcon />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <button className="login__submit" type="submit" disabled={loading || !email || !password}>
            {loading ? 'Signing in…' : 'Log In'}
          </button>
        </form>

        <Link className="login__register" to="/register">
          Make an account
        </Link>
      </section>
    </main>
  );
}
