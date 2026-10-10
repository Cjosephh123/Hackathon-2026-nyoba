create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  model_key text not null default 'qwen3.8-flash'
    check (model_key in (
      'deepseek-v4.1-flash',
      'qwen3-coder-flash',
      'qwen3.7-plus',
      'qwen3.8-flash',
      'qwen3.8-omni-flash'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  attachment_name text,
  model_key text,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

revoke all on table public.ai_conversations, public.ai_messages from anon, authenticated;
grant select, insert, update, delete on table public.ai_conversations to authenticated;
grant select, insert, delete on table public.ai_messages to authenticated;

drop policy if exists "Users manage their own AI conversations" on public.ai_conversations;
create policy "Users manage their own AI conversations"
  on public.ai_conversations
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users read messages in their own AI conversations" on public.ai_messages;
create policy "Users read messages in their own AI conversations"
  on public.ai_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ai_conversations as conversation
      where conversation.id = ai_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users add messages to their own AI conversations" on public.ai_messages;
create policy "Users add messages to their own AI conversations"
  on public.ai_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ai_conversations as conversation
      where conversation.id = ai_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users delete messages in their own AI conversations" on public.ai_messages;
create policy "Users delete messages in their own AI conversations"
  on public.ai_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.ai_conversations as conversation
      where conversation.id = ai_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );
