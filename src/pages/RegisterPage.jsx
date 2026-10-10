import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import AuthInput from '../components/AuthInput.jsx';
import { LockIcon, MailIcon, UserIcon } from '../components/Icons.jsx';
import { isUsernameAvailable, register } from '../services/authService.js';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 6;

function validate({ username, password, confirm }) {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3–20 characters: letters, numbers or underscore.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const isComplete = Object.values(form).every(Boolean);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      const username = form.username.trim();
      if (!(await isUsernameAvailable(username))) {
        throw new Error('That username is taken. Try another one.');
      }

      const { session } = await register({
        username,
        email: form.email.trim(),
        password: form.password,
      });

      if (session) {
        navigate('/', { replace: true });
      } else {
        setMessage('Account created. Check your email to confirm it, then sign in.');
      }
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign Up"
      footer={
        <>
          Already have an account? <Link to="/login">Sign In</Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <AuthInput
          id="username"
          label="Username"
          type="text"
          autoComplete="username"
          icon={<UserIcon />}
          value={form.username}
          onChange={update('username')}
          required
        />
        <AuthInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          icon={<MailIcon />}
          value={form.email}
          onChange={update('email')}
          required
        />
        <AuthInput
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          icon={<LockIcon />}
          value={form.password}
          onChange={update('password')}
          required
        />
        <AuthInput
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          icon={<LockIcon />}
          value={form.confirm}
          onChange={update('confirm')}
          required
        />

        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth__message" role="status">
            {message}
          </p>
        )}

        <button className="auth__submit" type="submit" disabled={loading || !isComplete}>
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>
    </AuthLayout>
  );
}
