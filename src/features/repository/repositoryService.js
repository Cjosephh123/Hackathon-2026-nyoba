import { supabase } from '../../lib/supabaseClient.js';

export async function getLocalRepository(search = '') {
  const { data, error } = await supabase.rpc('get_ai_catalog_context', {
    p_search: search.trim() || null,
    p_limit: 100,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getApprovedJournalUrl(bookId) {
  const { data: filePath, error } = await supabase.rpc('get_approved_journal_file', {
    p_book_id: bookId,
  });
  if (error) throw new Error(error.message);
  if (!filePath) throw new Error('The approved journal file is not available.');
  const { data, error: linkError } = await supabase.storage
    .from('journal-submissions')
    .createSignedUrl(filePath, 300);
  if (linkError) throw new Error(linkError.message);
  return data.signedUrl;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`External catalog returned HTTP ${response.status}.`);
  return response.json();
}

export async function searchOpenLibrary(search, signal) {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', search);
  url.searchParams.set('limit', '24');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,edition_count');
  const result = await fetchJson(url, signal);
  return (result.docs ?? []).map((book) => ({
    id: book.key,
    source: 'Open Library',
    title: book.title,
    authors: book.author_name ?? [],
    year: book.first_publish_year ?? null,
    url: `https://openlibrary.org${book.key}`,
    coverUrl: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
      : null,
    detail: `${book.edition_count ?? 0} cataloged editions`,
  }));
}

export async function searchOpenAccessResearch(search, signal) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', search);
  url.searchParams.set('filter', 'is_oa:true');
  url.searchParams.set('per-page', '24');
  url.searchParams.set(
    'select',
    'id,doi,title,publication_year,authorships,primary_location,open_access,type',
  );
  const result = await fetchJson(url, signal);
  return (result.results ?? []).map((work) => ({
    id: work.id,
    source: 'OpenAlex · Open Access',
    title: work.title || 'Untitled research work',
    authors: (work.authorships ?? [])
      .slice(0, 3)
      .map((authorship) => authorship.author?.display_name)
      .filter(Boolean),
    year: work.publication_year ?? null,
    url: work.doi
      ? `https://doi.org/${work.doi.replace(/^https?:\/\/doi\.org\//, '')}`
      : work.primary_location?.landing_page_url || work.id,
    coverUrl: null,
    detail: work.primary_location?.source?.display_name || 'Open-access scholarly record',
  }));
}
