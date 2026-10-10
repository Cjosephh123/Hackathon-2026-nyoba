create or replace function public.get_borrow_book_detail(p_book_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'book_id', book.id,
    'title', book.title,
    'authors', book.authors,
    'publisher', book.publisher,
    'publication_year', book.publication_year,
    'type', book.type,
    'category', category.name,
    'description', book.description,
    'cover_url', book.cover_url,
    'available_copies', coalesce(copy_summary.available_copies, 0),
    'has_digital', coalesce(copy_summary.has_digital, false),
    'location', copy_summary.location,
    'pending_reservations', coalesce(reservation_summary.pending_count, 0),
    'active_loan_due_at', member_loan.due_at
  )
  from public.books as book
  left join public.categories as category on category.id = book.category_id
  left join lateral (
    select
      count(*) filter (
        where copy.status = 'available' and copy.format = 'physical'
      )::bigint as available_copies,
      bool_or(copy.status = 'available' and copy.format = 'digital') as has_digital,
      min(copy.location) filter (
        where copy.status = 'available' and copy.format = 'physical'
      ) as location
    from public.copies as copy
    where copy.book_id = book.id
  ) as copy_summary on true
  left join lateral (
    select count(*)::bigint as pending_count
    from public.reservations as reservation
    where reservation.book_id = book.id
      and reservation.status in ('pending', 'ready')
  ) as reservation_summary on true
  left join lateral (
    select loan.due_at
    from public.loans as loan
    join public.copies as copy on copy.id = loan.copy_id
    where loan.user_id = (select auth.uid())
      and loan.returned_at is null
      and copy.book_id = book.id
    order by loan.borrowed_at desc
    limit 1
  ) as member_loan on true
  where book.id = p_book_id;
$function$;

create or replace function public.borrow_book(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  member_id uuid := (select auth.uid());
  selected_copy_id uuid;
  new_loan_id uuid;
  loan_due_at timestamptz := now() + interval '7 days';
begin
  if member_id is null then
    raise exception 'Sign in before borrowing a title.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(member_id::text || ':' || p_book_id::text, 0)
  );

  if exists (
    select 1
    from public.loans as loan
    join public.copies as copy on copy.id = loan.copy_id
    where loan.user_id = member_id
      and loan.returned_at is null
      and copy.book_id = p_book_id
  ) then
    raise exception 'You already have an active loan for this title.';
  end if;

  select copy.id
  into selected_copy_id
  from public.copies as copy
  where copy.book_id = p_book_id
    and copy.format = 'physical'
    and copy.status = 'available'
  order by copy.created_at, copy.id
  limit 1
  for update skip locked;

  if selected_copy_id is null then
    raise exception 'No physical copies are currently available.';
  end if;

  update public.copies
  set status = 'borrowed'
  where id = selected_copy_id;

  insert into public.loans (copy_id, user_id, borrowed_at, due_at)
  values (selected_copy_id, member_id, now(), loan_due_at)
  returning id into new_loan_id;

  return jsonb_build_object(
    'loan_id', new_loan_id,
    'copy_id', selected_copy_id,
    'book_id', p_book_id,
    'due_at', loan_due_at
  );
end;
$function$;

revoke all on function public.get_borrow_book_detail(uuid) from public, anon;
revoke all on function public.borrow_book(uuid) from public, anon;
grant execute on function public.get_borrow_book_detail(uuid) to authenticated;
grant execute on function public.borrow_book(uuid) to authenticated;
