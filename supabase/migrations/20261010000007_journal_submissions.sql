create table if not exists public.journal_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  authors text[] not null default '{}',
  abstract text check (abstract is null or char_length(abstract) <= 4000),
  file_path text not null unique,
  file_name text not null,
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  ai_analysis text,
  ai_analyzed_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 3000),
  reviewed_at timestamptz,
  book_id uuid references public.books(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint journal_submissions_review_state check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_at is not null)
  )
);

create index if not exists journal_submissions_user_created_idx
  on public.journal_submissions(user_id, created_at desc);
create index if not exists journal_submissions_pending_idx
  on public.journal_submissions(created_at)
  where status = 'pending';

alter table public.journal_submissions enable row level security;
revoke all on public.journal_submissions from anon, authenticated;
grant select, insert on public.journal_submissions to authenticated;
grant update (ai_analysis, ai_analyzed_at) on public.journal_submissions to authenticated;

drop policy if exists "Submitters and staff can read journal submissions"
  on public.journal_submissions;
create policy "Submitters and staff can read journal submissions"
  on public.journal_submissions
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_staff()));

drop policy if exists "Members can submit their own journals"
  on public.journal_submissions;
create policy "Members can submit their own journals"
  on public.journal_submissions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
    and book_id is null
    and ai_analysis is null
    and ai_analyzed_at is null
  );

drop policy if exists "Staff can save journal AI analysis"
  on public.journal_submissions;
create policy "Staff can save journal AI analysis"
  on public.journal_submissions
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'journal-submissions',
  'journal-submissions',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Submitters and staff can read journal submission files"
  on storage.objects;
create policy "Submitters and staff can read journal submission files"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'journal-submissions'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_staff())
    )
  );

drop policy if exists "Members can upload their own journal files"
  on storage.objects;
create policy "Members can upload their own journal files"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'journal-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Members can clean up their own journal files"
  on storage.objects;
create policy "Members can clean up their own journal files"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'journal-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.journal_submissions as submission
      where submission.file_path = name
        and submission.user_id = (select auth.uid())
    )
  );

create or replace function public.review_journal_submission(
  p_submission_id uuid,
  p_decision text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  submission public.journal_submissions%rowtype;
  catalog_book_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Only staff can review journal submissions.'
      using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.'
      using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 3000 then
    raise exception 'Staff notes must be 3000 characters or fewer.'
      using errcode = '22023';
  end if;

  select *
  into submission
  from public.journal_submissions
  where id = p_submission_id
  for update;

  if not found or submission.status <> 'pending' then
    raise exception 'This submission is no longer pending review.'
      using errcode = 'P0002';
  end if;
  if submission.user_id = (select auth.uid()) then
    raise exception 'Staff cannot review their own journal submission.'
      using errcode = '42501';
  end if;

  if p_decision = 'approve' then
    insert into public.books (title, authors, type, description)
    values (submission.title, submission.authors, 'journal', submission.abstract)
    returning id into catalog_book_id;
  end if;

  update public.journal_submissions
  set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      reviewer_id = (select auth.uid()),
      reviewer_notes = nullif(btrim(p_notes), ''),
      reviewed_at = now(),
      book_id = catalog_book_id
  where id = submission.id;

  return catalog_book_id;
end;
$function$;

revoke all on function public.review_journal_submission(uuid, text, text) from public, anon;
grant execute on function public.review_journal_submission(uuid, text, text) to authenticated;
