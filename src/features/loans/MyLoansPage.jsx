import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyActiveLoans, requestLoanReturn } from './loanService.js';
import './MyLoansPage.css';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MyLoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyLoanId, setBusyLoanId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      setLoans(await getMyActiveLoans());
    } catch (loadError) {
      setError(loadError.message || 'Could not load your loans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReturnRequest(loan) {
    setBusyLoanId(loan.loan_id);
    setError('');
    setNotice('');
    try {
      await requestLoanReturn(loan.loan_id);
      setNotice(`Return requested for “${loan.book_title}”. Please bring the book to the library desk. Staff will mark it returned when received.`);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Could not request this return.');
    } finally {
      setBusyLoanId('');
    }
  }

  return (
    <section className="my-loans">
      <header className="my-loans__header">
        <div>
          <p className="my-loans__eyebrow">YOUR LIBRARY ACCOUNT</p>
          <h1>My loans</h1>
          <p>See your active checkouts and request a return whenever you are ready.</p>
        </div>
        <Link to="/borrow">Browse catalog</Link>
      </header>

      <div className="my-loans__instructions">
        <strong>How returns work</strong>
        <p>Request a return here, then bring the physical book to the library desk. It remains checked out until staff confirms they have received it.</p>
      </div>

      {notice && <p className="my-loans__message my-loans__message--success" role="status">{notice}</p>}
      {error && <p className="my-loans__message my-loans__message--error" role="alert">{error}</p>}

      {loading ? (
        <p className="my-loans__empty" role="status">Loading your loans…</p>
      ) : loans.length === 0 ? (
        <div className="my-loans__empty">
          <p>You have no active loans.</p>
          <Link to="/borrow">Find a book to borrow</Link>
        </div>
      ) : (
        <div className="my-loans__list">
          {loans.map((loan) => {
            const returnPending = Boolean(loan.return_requested_at);
            return (
              <article className="my-loans__card" key={loan.loan_id}>
                <div className="my-loans__details">
                  <h2>{loan.book_title}</h2>
                  <p>{loan.authors?.join(', ') || 'Author not listed'}</p>
                  <dl>
                    <div><dt>Borrowed</dt><dd>{formatDate(loan.borrowed_at)}</dd></div>
                    <div><dt>Due date</dt><dd>{formatDate(loan.due_at)}</dd></div>
                  </dl>
                  {returnPending && (
                    <p className="my-loans__pending">
                      Return requested {formatDate(loan.return_requested_at)} · awaiting staff check-in
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={returnPending || busyLoanId === loan.loan_id}
                  onClick={() => handleReturnRequest(loan)}
                >
                  {returnPending
                    ? 'Return requested'
                    : busyLoanId === loan.loan_id
                      ? 'Sending request…'
                      : 'Request return'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
