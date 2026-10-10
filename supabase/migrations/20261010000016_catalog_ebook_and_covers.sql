alter table public.copies
  add column if not exists digital_file_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-ebooks',
  'library-ebooks',
  false,
  52428800,
  array['application/pdf', 'application/epub+zip']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-covers',
  'catalog-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff can upload catalog ebooks" on storage.objects;
create policy "Staff can upload catalog ebooks"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'library-ebooks' and (select public.is_staff()));

drop policy if exists "Staff and members can read available catalog ebooks" on storage.objects;
create policy "Staff and members can read available catalog ebooks"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'library-ebooks'
    and (
      (select public.is_staff())
      or exists (
        select 1
        from public.copies as copy
        where copy.digital_file_path = name
          and copy.format = 'digital'
          and copy.status = 'available'
      )
    )
  );

drop policy if exists "Staff can remove catalog ebooks" on storage.objects;
create policy "Staff can remove catalog ebooks"
  on storage.objects for delete to authenticated
  using (bucket_id = 'library-ebooks' and (select public.is_staff()));

drop policy if exists "Anyone can view catalog covers" on storage.objects;
create policy "Anyone can view catalog covers"
  on storage.objects for select to public
  using (bucket_id = 'catalog-covers');

drop policy if exists "Staff can upload catalog covers" on storage.objects;
create policy "Staff can upload catalog covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-covers' and (select public.is_staff()));

drop policy if exists "Staff can remove catalog covers" on storage.objects;
create policy "Staff can remove catalog covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-covers' and (select public.is_staff()));

create or replace function public.staff_attach_catalog_ebook(
  p_book_id uuid,
  p_file_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  digital_copy_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required.'
      using errcode = '42501';
  end if;
  if p_file_path is null or p_file_path !~ ('^' || p_book_id::text || '/[0-9a-f-]+\.(pdf|epub)$') then
    raise exception 'The uploaded e-book path is invalid.'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'library-ebooks'
      and object.name = p_file_path
  ) then
    raise exception 'The e-book file was not found in storage.'
      using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.books where id = p_book_id) then
    raise exception 'The catalog title does not exist.'
      using errcode = 'P0002';
  end if;

  select copy.id
  into digital_copy_id
  from public.copies as copy
  where copy.book_id = p_book_id
    and copy.format = 'digital'
    and copy.status = 'available'
    and not exists (
      select 1
      from public.loans as loan
      where loan.copy_id = copy.id
        and loan.returned_at is null
    )
  order by copy.created_at, copy.id
  limit 1
  for update;

  if digital_copy_id is null then
    insert into public.copies (
      book_id,
      barcode,
      format,
      status,
      digital_file_path
    )
    values (
      p_book_id,
      'EBOOK-' || replace(gen_random_uuid()::text, '-', ''),
      'digital',
      'available',
      p_file_path
    );
  else
    update public.copies
    set digital_file_path = p_file_path,
        status = 'available'
    where id = digital_copy_id;
  end if;
end;
$function$;

create or replace function public.get_catalog_ebook_file(p_book_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  file_path text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to access this e-book.'
      using errcode = '42501';
  end if;

  select copy.digital_file_path
  into file_path
  from public.copies as copy
  where copy.book_id = p_book_id
    and copy.format = 'digital'
    and copy.status = 'available'
    and copy.digital_file_path is not null
  order by copy.created_at
  limit 1;

  if file_path is null then
    raise exception 'No digital file is available for this title.'
      using errcode = 'P0002';
  end if;

  return file_path;
end;
$function$;

revoke all on function public.staff_attach_catalog_ebook(uuid, text) from public, anon;
revoke all on function public.get_catalog_ebook_file(uuid) from public, anon;
grant execute on function public.staff_attach_catalog_ebook(uuid, text) to authenticated;
grant execute on function public.get_catalog_ebook_file(uuid) to authenticated;
