import { useEffect, useMemo, useState } from 'react';
import {
  analyzeSubmission,
  decideSubmission,
  getActiveLoans,
  getDashboardStats,
  getPendingBorrowRequests,
  getPendingLoanReturns,
  getPendingSubmissions,
  getSubmissionFileUrl,
  reviewBorrowRequest,
  returnLoan,
} from './staffService.js';
import './StaffDashboardPage.css';

export default function StaffDashboardPage() {
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loans, setLoans] = useState([]);
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [rows, nextStats, activeLoans, pendingRequests, pendingReturns] = await Promise.all([
        getPendingSubmissions(),
        getDashboardStats(),
        getActiveLoans(),
        getPendingBorrowRequests(),
        getPendingLoanReturns(),
      ]);
      setSubmissions(rows);
      setStats(nextStats);
      setLoans(activeLoans);
      setBorrowRequests(pendingRequests);
      setReturnRequests(pendingReturns);
      setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '');
    } catch (loadError) {
      setError(loadError.message || 'Could not load pending submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    let active = true;
    setAnalysis(selected?.ai_analysis ?? '');
    setNotes('');
    setFileUrl('');
    if (!selected) return () => { active = false; };
    getSubmissionFileUrl(selected.file_path)
      .then((url) => { if (active) setFileUrl(url); })
      .catch((urlError) => { if (active) setError(urlError.message); });
    return () => { active = false; };
  }, [selected]);

  async function handleAnalyze() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    setProgress('Preparing staff review');
    try {
      const result = await analyzeSubmission(selected, setProgress);
      setAnalysis(result);
      setNotice('AI review is ready. Verify its observations and make the decision yourself.');
      await refresh();
    } catch (analysisError) {
      setError(analysisError.message || 'Could not analyze this journal.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function handleDecision(decision) {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await decideSubmission(selected.id, decision, notes);
      setNotice(decision === 'approve'
        ? 'Journal approved and added to the library catalog. A status email is queued for the submitter.'
        : 'Journal submission rejected. A status email is queued for the submitter.');
      await refresh();
    } catch (decisionError) {
      setError(decisionError.message || 'Could not update this submission.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn(loanId) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await returnLoan(loanId);
      setNotice('The loan was marked returned and its copy is available again.');
      await refresh();
    } catch (returnError) {
      setError(returnError.message || 'Could not return this loan.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBorrowDecision(requestId, decision) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await reviewBorrowRequest(requestId, decision, '');
      setNotice(decision === 'approve'
        ? `Borrow request approved. The copy is now checked out and due ${new Date(result.due_at).toLocaleDateString()}.`
        : 'Borrow request rejected. The copy remains available.');
      await refresh();
    } catch (reviewError) {
      setError(reviewError.message || 'Could not review this borrow request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-page">
      <header className="staff-page__header">
        <p className="staff-page__eyebrow">LIBRARY OPERATIONS</p>
        <h1>Staff dashboard</h1>
        <p>Review journal submissions and manage the library collection.</p>
      </header>
      {notice && <p className="staff-page__notice" role="status">{notice}</p>}
      {error && <p className="staff-page__error" role="alert">{error}</p>}

      {stats && (
        <div className="staff-page__stats" aria-label="Library summary">
          <article><span>Catalog titles</span><strong>{stats.book_count}</strong></article>
          <article><span>Pending submissions</span><strong>{stats.pending_submissions}</strong></article>
          <article><span>Active loans</span><strong>{stats.active_loans}</strong></article>
          <article><span>Overdue loans</span><strong>{stats.overdue_loans}</strong></article>
          <article><span>Due within 48 hours</span><strong>{stats.due_soon_loans}</strong></article>
          <article><span>Borrow requests waiting</span><strong>{borrowRequests.length}</strong></article>
          <article><span>Return requests waiting</span><strong>{returnRequests.length}</strong></article>
        </div>
      )}

      <section className="staff-loans">
        <h2>Borrow requests waiting for approval</h2>
        {loading ? <p role="status">Loading borrow requests…</p> : borrowRequests.length === 0
          ? <p>No borrow requests are waiting for review.</p>
          : borrowRequests.map((request) => (
            <article className="staff-loan" key={request.request_id}>
              <div>
                <strong>{request.book_title}</strong>
                <p>{request.member_name} · Requested {new Date(request.requested_at).toLocaleString()}</p>
                <p>The copy remains available until you approve checkout.</p>
              </div>
              <div className="staff-loan__actions">
                <button type="button" disabled={busy} onClick={() => handleBorrowDecision(request.request_id, 'approve')}>
                  Approve checkout
                </button>
                <button type="button" disabled={busy} onClick={() => handleBorrowDecision(request.request_id, 'reject')}>
                  Reject
                </button>
              </div>
            </article>
          ))}
      </section>

      <section className="staff-loans">
        <h2>Return requests waiting for check-in</h2>
        {loading ? <p role="status">Loading return requests…</p> : returnRequests.length === 0
          ? <p>No member return requests are waiting for check-in.</p>
          : returnRequests.map((request) => (
            <article className="staff-loan" key={request.loan_id}>
              <div>
                <strong>{request.book_title}</strong>
                <p>{request.member_name} · Requested {new Date(request.return_requested_at).toLocaleString()}</p>
                <p>Due {new Date(request.due_at).toLocaleDateString()}. Confirm only after receiving the physical book.</p>
              </div>
              <button type="button" disabled={busy} onClick={() => handleReturn(request.loan_id)}>
                Confirm book received
              </button>
            </article>
          ))}
      </section>

      <div className="staff-page__layout">
        <div className="staff-queue">
          <h2>Pending reviews <span>({submissions.length})</span></h2>
          {loading ? <p role="status">Loading review queue…</p> : submissions.length === 0
            ? <p>No submissions are waiting for review.</p>
            : submissions.map((submission) => (
              <button
                className={`staff-queue__item${selectedId === submission.id ? ' is-selected' : ''}`}
                key={submission.id}
                type="button"
                onClick={() => setSelectedId(submission.id)}
              >
                <div>
                  <strong>{submission.title}</strong>
                  <p>{submission.authors.join(', ') || 'Author not provided'} · {new Date(submission.created_at).toLocaleDateString()}</p>
                </div>
                <span>Pending</span>
              </button>
            ))}
        </div>

        <div className="staff-review">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              <p><strong>Authors:</strong> {selected.authors.join(', ') || 'Not provided'}</p>
              {selected.abstract && <p><strong>Abstract:</strong> {selected.abstract}</p>}
              {fileUrl && (
                <a className="staff-review__download" href={fileUrl} target="_blank" rel="noreferrer">
                  Review submitted file: {selected.file_name}
                </a>
              )}
              <p className="ta-upload-page__privacy">
                If you run the AI review, extracted document text is sent to the configured CBN Hackathon AI service.
              </p>
              <button type="button" disabled={busy} onClick={handleAnalyze}>
                {busy ? progress || 'Analyzing…' : 'Analyze with AI'}
              </button>
              {analysis && (
                <div className="staff-review__analysis">
                  <h3>AI review · human decision required</h3>
                  {analysis}
                </div>
              )}
              <label>
                Staff notes for the submitter
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={3000} />
              </label>
              <div className="staff-review__actions">
                <button type="button" disabled={busy} onClick={() => handleDecision('approve')}>
                  Approve and add to catalog
                </button>
                <button type="button" disabled={busy} onClick={() => handleDecision('reject')}>
                  Reject submission
                </button>
              </div>
              <p className="ta-upload-page__privacy">
                AI is assistive only. Verify the uploaded work and bibliographic details before deciding.
              </p>
            </>
          ) : (
            <p>Select a pending submission to review.</p>
          )}
        </div>
      </div>

      <section className="staff-loans">
        <h2>Active loans</h2>
        {loading ? <p role="status">Loading loans…</p> : loans.length === 0
          ? <p>There are no active loans.</p>
          : loans.map((loan) => (
            <article className={`staff-loan${loan.is_overdue ? ' is-overdue' : ''}`} key={loan.loan_id}>
              <div>
                <strong>{loan.book_title}</strong>
                <p>{loan.member_name} · Due {new Date(loan.due_at).toLocaleString()}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => handleReturn(loan.loan_id)}>
                Mark returned
              </button>
            </article>
          ))}
      </section>
    </section>
  );
}
