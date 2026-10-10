import { supabase } from '../../../lib/supabaseClient.js';

export async function getAssistantConfig() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) throw new Error('Your sign-in session expired. Please sign in again.');

  const response = await fetch('/api/ai/config', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    let message = `Could not load AI settings (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
      // Retain the HTTP status when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

export async function loadLatestConversation() {
  const { data: conversation, error: conversationError } = await supabase
    .from('ai_conversations')
    .select('id, title, model_key')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationError) throw new Error(conversationError.message);
  if (!conversation) return null;

  const { data: records, error: messagesError } = await supabase
    .from('ai_messages')
    .select('id, sender, content, attachment_name, created_at, model_key')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  if (messagesError) throw new Error(messagesError.message);
  return {
    conversation,
    messages: (records ?? []).map((record) => ({
      ...record,
      role: record.sender,
      text: record.content,
    })),
  };
}

export async function createConversation(title, model) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error('Sign in again before starting a conversation.');

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: user.id,
      title: title.trim().slice(0, 120) || 'Research help',
      model_key: model,
    })
    .select('id, title, model_key')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveConversationMessage({
  conversationId,
  sender,
  content,
  attachmentName = null,
  model = null,
}) {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      sender,
      content,
      attachment_name: attachmentName,
      model_key: model,
    })
    .select('id, sender, content, attachment_name, created_at, model_key')
    .single();

  if (error) throw new Error(error.message);
  return {
    ...data,
    role: data.sender,
    text: data.content,
  };
}

export async function getLibraryContext() {
  const { data, error } = await supabase.rpc('get_ai_catalog_context', {
    p_search: null,
    p_limit: 100,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((book) => ({
    book_id: book.book_id,
    title: book.title,
    authors: book.authors,
    category: book.category,
    publication_year: book.publication_year,
    type: book.type,
    description: book.description,
    cover_url: book.cover_url,
    added_at: book.added_at,
    availability: {
      physical: {
        available: book.available_physical_copies,
        borrowed: book.borrowed_physical_copies,
        maintenance: book.maintenance_physical_copies,
      },
      digital: {
        available: book.available_digital_copies,
        borrowed: book.borrowed_digital_copies,
      },
    },
  }));
}

export async function analyzeWithAssistant({
  prompt,
  history,
  libraryContext,
  file,
  image,
  onProgress,
}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) throw new Error('Your sign-in session expired. Please sign in again.');

  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('history', JSON.stringify(history));
  formData.append('library_context', JSON.stringify(libraryContext));
  if (file) formData.append('file', file);
  if (image) formData.append('image', image);

  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  if (!response.ok) {
    let message = `AI service request failed (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
      // Retain the HTTP error when the server did not return JSON.
    }
    throw new Error(message);
  }
  if (!response.body) throw new Error('The AI service returned an empty response.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  function consumeEvent(block) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data) return;

    const event = JSON.parse(data);
    if (event.type === 'progress') onProgress(event.stage);
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'result') result = event;
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      blocks.forEach(consumeEvent);
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!result?.answer) throw new Error('The AI service ended without an answer. Please try again.');
  return result;
}
