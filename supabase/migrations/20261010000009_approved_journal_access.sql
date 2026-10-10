create or replace function public.is_approved_journal_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.journal_submissions as submission
      where submission.file_path = p_path
        and submission.status = 'approved'
    );
$function$;

revoke all on function public.is_approved_journal_file(text) from public, anon;
grant execute on function public.is_approved_journal_file(text) to authenticated;

drop policy if exists "Submitters and staff can read journal submission files"
  on storage.objects;
create policy "Submitters staff and members can read approved journal files"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'journal-submissions'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_staff())
      or (select public.is_approved_journal_file(name))
    )
  );

create or replace function public.get_approved_journal_file(p_book_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select submission.file_path
  from public.journal_submissions as submission
  where auth.uid() is not null
    and submission.book_id = p_book_id
    and submission.status = 'approved'
  limit 1;
$function$;

revoke all on function public.get_approved_journal_file(uuid) from public, anon;
grant execute on function public.get_approved_journal_file(uuid) to authenticated;
