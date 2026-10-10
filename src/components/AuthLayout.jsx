import bookshelf from '../assets/login-bg.jpg';
import './AuthLayout.css';

export default function AuthLayout({ title, footer, children }) {
  return (
    <main className="auth">
      <div
        className="auth__image"
        style={{ backgroundImage: `url(${bookshelf})` }}
        role="img"
        aria-label="Shelves of novels in a bookstore"
      />

      <section className="auth__panel">
        <h1 className="auth__title">{title}</h1>
        {children}
        {footer && <p className="auth__footer">{footer}</p>}
      </section>
    </main>
  );
}
