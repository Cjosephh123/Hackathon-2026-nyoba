import { useEffect, useState } from 'react';
import { getMySubmissions, submitJournal } from './taUploadService.js';
import './TAUploadPage.css';

export default function TAUploadPage() {
  const [submissions, setSubmissions] = useState([]);
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [abstract, setAbstract] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshSubmissions() {
    setLoading(true);
    try {
      setSubmissions(await getMySubmissions());
    } catch (loadError) {
      setError(loadError.message || 'Could not load your submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSubmissions();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setError('');
    setNotice('');
    setSending(true);
    try {
      await submitJournal({ title, authors, abstract, file });
      setTitle('');
      setAuthors('');
      setAbstract('');
      setFile(null);
      form.reset();
      setNotice('Your journal was submitted for staff review.');
      await refreshSubmissions();
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your journal.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="ta-upload-page">
      <header className="ta-upload-page__header">
        <p className="ta-upload-page__eyebrow">CONTRIBUTE TO THE COLLECTION</p>
        <h1>TA Upload</h1>
        <p>Submit a journal for staff review. Approved journals will be added to the library catalog.</p>
      </header>
      {notice && <p className="ta-upload-page__notice" role="status">{notice}</p>}
      {error && <p className="staff-page__error" role="alert">{error}</p>}
      <div className="ta-upload-page__layout">
        <form className="ta-upload-form" onSubmit={handleSubmit}>
          <label>
            Journal title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required />
          </label>
          <label>
            Author names <span>(separate with commas)</span>
            <input value={authors} onChange={(event) => setAuthors(event.target.value)} maxLength={500} />
          </label>
          <label>
            Abstract or note for staff
            <textarea value={abstract} onChange={(event) => setAbstract(event.target.value)} maxLength={4000} />
          </label>
          <label>
            Journal file (PDF or DOCX, max 10 MB)
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          <p className="ta-upload-page__privacy">
            Files are private while pending review. If approved, the journal file becomes available to signed-in library users.
          </p>
          <button type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Submit for review'}</button>
        </form>
        <div className="ta-submission-list">
          <h2>Your submissions</h2>
          {loading ? <p role="status">Loading submissions…</p> : submissions.length === 0
            ? <p>You have not submitted a journal yet.</p>
            : submissions.map((submission) => (
              <article className="ta-submission-row" key={submission.id}>
                <div>
                  <strong>{submission.title}</strong>
                  <p>{new Date(submission.created_at).toLocaleDateString()}</p>
                  {submission.status === 'rejected' && submission.reviewer_notes && (
                    <p>Staff note: {submission.reviewer_notes}</p>
                  )}
                </div>
                <span>{submission.status}</span>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
