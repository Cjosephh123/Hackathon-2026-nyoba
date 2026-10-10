import { supabase } from '../../lib/supabaseClient.js';
import { analyzeWithAssistant } from '../ai-assistant/services/assistantService.js';

const BUCKET = 'journal-submissions';
const COVER_BUCKET = 'catalog-covers';
const EBOOK_BUCKET = 'library-ebooks';

function extensionForImage(file) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return extensions[file.type] ?? null;
}

export async function addCatalogBook(book) {
  const ebookExtension = book.ebookFile?.name.toLowerCase().match(/\.(pdf|epub)$/)?.[1] ?? null;
  if (book.ebookFile && !ebookExtension) throw new Error('E-book files must be PDF or EPUB.');
  if (book.ebookFile && book.ebookFile.size > 50 * 1024 * 1024) {
    throw new Error('E-book files must be 50 MB or smaller.');
  }

  let uploadedCoverPath = null;
  let uploadedCoverUrl = book.coverUrl.trim() || null;
  if (book.coverFile) {
    const extension = extensionForImage(book.coverFile);
    if (!extension) throw new Error('Cover images must be JPEG, PNG, or WebP.');
    if (book.coverFile.size > 5 * 1024 * 1024) {
      throw new Error('Cover images must be 5 MB or smaller.');
    }
    uploadedCoverPath = `${crypto.randomUUID()}.${extension}`;
    const { error: coverError } = await supabase.storage
      .from(COVER_BUCKET)
      .upload(uploadedCoverPath, book.coverFile, { contentType: book.coverFile.type, upsert: false });
    if (coverError) throw new Error(`Could not upload the cover: ${coverError.message}`);
    uploadedCoverUrl = supabase.storage.from(COVER_BUCKET).getPublicUrl(uploadedCoverPath).data.publicUrl;
  }

  const { data, error } = await supabase.rpc('staff_add_catalog_book', {
    p_title: book.title.trim(),
    p_authors: book.authors.split(',').map((author) => author.trim()).filter(Boolean),
    p_publisher: book.publisher.trim() || null,
    p_publication_year: book.publicationYear ? Number(book.publicationYear) : null,
    p_type: book.type,
    p_category: book.category.trim() || null,
    p_description: book.description.trim() || null,
    p_frequency: book.frequency.trim() || null,
    p_cover_url: uploadedCoverUrl,
    p_copy_barcodes: book.copyBarcodes
      .split(/\r?\n/)
      .map((barcode) => barcode.trim())
      .filter(Boolean),
    p_location: book.location.trim() || null,
  });
  if (error) {
    if (uploadedCoverPath) {
      const { error: cleanupError } = await supabase.storage.from(COVER_BUCKET).remove([uploadedCoverPath]);
      if (cleanupError) throw new Error(`${error.message} The cover upload could not be cleaned up: ${cleanupError.message}`);
    }
    throw new Error(error.message);
  }

  if (book.ebookFile) {
    const ebookPath = `${data}/${crypto.randomUUID()}.${ebookExtension}`;
    const { error: uploadError } = await supabase.storage
      .from(EBOOK_BUCKET)
      .upload(ebookPath, book.ebookFile, {
        contentType: ebookExtension === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Catalog title created (${data}), but the e-book upload failed: ${uploadError.message}`);
    }

    const { error: attachError } = await supabase.rpc('staff_attach_catalog_ebook', {
      p_book_id: data,
      p_file_path: ebookPath,
    });
    if (attachError) {
      const { error: cleanupError } = await supabase.storage.from(EBOOK_BUCKET).remove([ebookPath]);
      const cleanupMessage = cleanupError ? ` Cleanup also failed: ${cleanupError.message}` : '';
      throw new Error(`Catalog title created (${data}), but the e-book could not be attached: ${attachError.message}.${cleanupMessage}`);
    }
  }

  return data;
}

export async function searchCatalogCovers(title, authors, signal) {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('title', title.trim());
  url.searchParams.set('fields', 'title,author_name,cover_i,first_publish_year');
  url.searchParams.set('limit', '10');
  const firstAuthor = authors.split(',').map((author) => author.trim()).find(Boolean);
  if (firstAuthor) url.searchParams.set('author', firstAuthor);

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Open Library returned HTTP ${response.status}.`);
  const result = await response.json();
  const normalizedTitle = title.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return (result.docs ?? [])
    .filter((entry) => entry.cover_i && entry.title?.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === normalizedTitle)
    .slice(0, 5)
    .map((entry) => ({
      title: entry.title,
      authors: entry.author_name ?? [],
      year: entry.first_publish_year ?? null,
      coverUrl: `https://covers.openlibrary.org/b/id/${entry.cover_i}-M.jpg`,
    }));
}

export async function getDashboardStats() {
  const { data, error } = await supabase.rpc('get_staff_dashboard_stats');
  if (error) throw new Error(error.message);
  return data?.[0] ?? {
    book_count: 0,
    pending_submissions: 0,
    active_loans: 0,
    overdue_loans: 0,
    due_soon_loans: 0,
  };
}

export async function getActiveLoans() {
  const { data, error } = await supabase.rpc('get_staff_active_loans', { p_limit: 100 });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPendingLoanReturns() {
  const { data, error } = await supabase.rpc('get_staff_pending_loan_returns', {
    p_limit: 100,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPendingBorrowRequests() {
  const { data, error } = await supabase.rpc('get_staff_pending_borrow_requests', {
    p_limit: 100,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewBorrowRequest(requestId, decision, notes) {
  const { data, error } = await supabase.rpc('review_borrow_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_notes: notes.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function returnLoan(loanId) {
  const { error } = await supabase.rpc('staff_return_loan', { p_loan_id: loanId });
  if (error) throw new Error(error.message);
}

export async function getPendingSubmissions() {
  const { data, error } = await supabase
    .from('journal_submissions')
    .select('id, title, authors, abstract, file_path, file_name, mime_type, created_at, ai_analysis, ai_analyzed_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubmissionFileUrl(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function analyzeSubmission(submission, onProgress) {
  const { data: fileBlob, error } = await supabase.storage
    .from(BUCKET)
    .download(submission.file_path);
  if (error) throw new Error(error.message);
  const file = new File([fileBlob], submission.file_name, { type: submission.mime_type });
  const result = await analyzeWithAssistant({
    prompt: [
      'Review this user-submitted journal as a library staff assistant. Provide a concise, neutral review of:',
      '1. What subject and audience it appears to address.',
      '2. Whether the uploaded text appears readable and complete enough for cataloging.',
      '3. Visible bibliographic details that staff should verify against the source.',
      '4. Any potential content or quality concerns that deserve human review.',
      'Do not make the approval decision, make unsupported claims about plagiarism or authenticity, or reproduce large passages.',
      `Submission title: ${submission.title}`,
      `Submitted authors: ${submission.authors.join(', ') || 'Not provided'}`,
      `Submitter abstract: ${submission.abstract || 'Not provided'}`,
    ].join('\n'),
    history: [],
    libraryContext: [],
    file,
    onProgress,
  });
  const { data: savedAnalysis, error: saveError } = await supabase
    .from('journal_submissions')
    .update({ ai_analysis: result.answer, ai_analyzed_at: new Date().toISOString() })
    .eq('id', submission.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (saveError) throw new Error(`AI review completed but could not be saved: ${saveError.message}`);
  if (!savedAnalysis) throw new Error('The submission was already resolved before the AI review could be saved.');
  return result.answer;
}

export async function decideSubmission(id, decision, notes) {
  const { data, error } = await supabase.rpc('review_journal_submission', {
    p_submission_id: id,
    p_decision: decision,
    p_notes: notes.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}
