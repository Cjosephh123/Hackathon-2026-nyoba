import { supabase } from '../../../lib/supabaseClient.js';

const EBOOK_BUCKET = 'library-ebooks';

export async function getBorrowCatalog(search = '') {
  const { data, error } = await supabase.rpc('get_borrow_catalog', {
    p_search: search.trim() || null,
    p_limit: 100,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBorrowBookDetail(bookId) {
  const { data, error } = await supabase.rpc('get_borrow_book_detail', {
    p_book_id: bookId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('This title could not be found.');
  return data;
}

export async function requestBorrowBook(bookId) {
  const { data, error } = await supabase.rpc('request_borrow_book', {
    p_book_id: bookId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function joinWaitlist(bookId) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error('Sign in to join a waitlist.');

  const { error } = await supabase
    .from('reservations')
    .insert({ user_id: user.id, book_id: bookId, status: 'pending' });

  if (error?.code === '23505') {
    throw new Error('You already have an active waitlist request for this title.');
  }
  if (error) throw new Error(error.message);
}

export async function getCatalogEbookUrl(bookId) {
  const { data: filePath, error } = await supabase.rpc('get_catalog_ebook_file', {
    p_book_id: bookId,
  });
  if (error) throw new Error(error.message);
  if (!filePath) throw new Error('No e-book file is available for this title.');
  const { data, error: linkError } = await supabase.storage
    .from(EBOOK_BUCKET)
    .createSignedUrl(filePath, 300, { download: true });
  if (linkError) throw new Error(linkError.message);
  return data.signedUrl;
}
