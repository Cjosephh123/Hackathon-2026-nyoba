import { supabase } from '../../lib/supabaseClient.js';

const BUCKET = 'journal-submissions';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function getMySubmissions() {
  const { data, error } = await supabase
    .from('journal_submissions')
    .select('id, title, authors, status, reviewer_notes, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function submitJournal({ title, authors, abstract, file }) {
  if (!title.trim()) throw new Error('Enter the journal title.');
  if (!file) throw new Error('Choose a PDF or DOCX file to upload.');
  if (file.size > MAX_FILE_SIZE) throw new Error('The file must be 10 MB or smaller.');
  const mimeType = ACCEPTED_TYPES.has(file.type)
    ? file.type
    : file.name.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : file.name.toLowerCase().endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : '';
  if (!mimeType) throw new Error('Only PDF and DOCX files are supported.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Sign in again before submitting a journal.');

  const submissionId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-120);
  const filePath = `${userData.user.id}/${submissionId}/${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from('journal_submissions').insert({
    id: submissionId,
    user_id: userData.user.id,
    title: title.trim(),
    authors: authors.split(',').map((author) => author.trim()).filter(Boolean),
    abstract: abstract.trim() || null,
    file_path: filePath,
    file_name: file.name,
    mime_type: mimeType,
    status: 'pending',
  });
  if (insertError) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (cleanupError) {
      throw new Error(`Could not save submission (${insertError.message}); uploaded file cleanup failed (${cleanupError.message}).`);
    }
    throw new Error(insertError.message);
  }
}
