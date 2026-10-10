create table if not exists public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 2000),
  loan_id uuid unique references public.loans(id) on delete set null,
  constraint borrow_requests_review_state check (
    (status in ('pending', 'cancelled') and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  ),
  constraint borrow_requests_approval_loan check (
    (status = 'approved' and loan_id is not null)
    or (status <> 'approved' and loan_id is null)
  )
);

create unique index if not exists borrow_requests_one_pending_per_user_book_idx
  on public.borrow_requests(user_id, book_id)
  where status = 'pending';
create index if not exists borrow_requests_pending_queue_idx
  on public.borrow_requests(requested_at)
  where status = 'pending';

alter table public.borrow_requests enable row level security;
revoke all on public.borrow_requests from public, anon, authenticated;
grant select, insert on public.borrow_requests to authenticated;

drop policy if exists "Members and staff can read borrow requests" on public.borrow_requests;
create policy "Members and staff can read borrow requests"
  on public.borrow_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists "Members can request available books" on public.borrow_requests;
create policy "Members can request available books"
  on public.borrow_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
    and reviewer_id is null
    and reviewer_notes is null
    and loan_id is null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'member'
    )
  );

create or replace function public.request_borrow_book(p_book_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  member_id uuid := (select auth.uid());
  request_id uuid;
begin
  if member_id is null then
    raise exception 'Sign in before requesting a book.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = member_id and profile.role = 'member'
  ) then
    raise exception 'Only library members can request a book.'
      using errcode = '42501';
  end if;
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
  if not exists (
    select 1
    from public.copies as copy
    where copy.book_id = p_book_id
      and copy.format = 'physical'
      and copy.status = 'available'
  ) then
    raise exception 'No physical copies are currently available. Join the waitlist instead.';
  end if;

  insert into public.borrow_requests (user_id, book_id)
  values (member_id, p_book_id)
  returning id into request_id;

  return request_id;
exception
  when unique_violation then
    raise exception 'You already have a pending request for this title.';
end;
$function$;

create or replace function public.get_staff_pending_borrow_requests(p_limit integer default 100)
returns table (
  request_id uuid,
  member_id uuid,
  member_name text,
  book_id uuid,
  book_title text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required.'
      using errcode = '42501';
  end if;

  return query
  select request.id,
         request.user_id,
         coalesce(profile.full_name, profile.username, 'Library member'),
         request.book_id,
         book.title,
         request.requested_at
  from public.borrow_requests as request
  join public.profiles as profile on profile.id = request.user_id
  join public.books as book on book.id = request.book_id
  where request.status = 'pending'
  order by request.requested_at, request.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$function$;

create or replace function public.review_borrow_request(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  borrow_request public.borrow_requests%rowtype;
  selected_copy_id uuid;
  new_loan_id uuid;
  due_date timestamptz;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required.'
      using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.'
      using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'Staff notes must be 2000 characters or fewer.'
      using errcode = '22023';
  end if;

  select *
  into borrow_request
  from public.borrow_requests as request
  where request.id = p_request_id
  for update;
  if not found or borrow_request.status <> 'pending' then
    raise exception 'This borrow request is no longer pending.'
      using errcode = 'P0002';
  end if;
  if borrow_request.user_id = (select auth.uid()) then
    raise exception 'Staff cannot approve their own borrow request.'
      using errcode = '42501';
  end if;
  if p_decision = 'approve' and exists (
    select 1
    from public.loans as loan
    join public.copies as copy on copy.id = loan.copy_id
    where loan.user_id = borrow_request.user_id
      and loan.returned_at is null
      and copy.book_id = borrow_request.book_id
  ) then
    raise exception 'This member already has an active loan for this title.'
      using errcode = '23505';
  end if;

  if p_decision = 'reject' then
    update public.borrow_requests
    set status = 'rejected',
        reviewed_at = now(),
        reviewer_id = (select auth.uid()),
        reviewer_notes = nullif(btrim(p_notes), '')
    where id = borrow_request.id;
    return jsonb_build_object('status', 'rejected', 'request_id', borrow_request.id);
  end if;

  select copy.id
  into selected_copy_id
  from public.copies as copy
  where copy.book_id = borrow_request.book_id
    and copy.format = 'physical'
    and copy.status = 'available'
  order by copy.created_at, copy.id
  limit 1
  for update skip locked;
  if selected_copy_id is null then
    raise exception 'No copies remain available. The request is still waiting for review.'
      using errcode = 'P0001';
  end if;

  due_date := now() + interval '7 days';
  update public.copies
  set status = 'borrowed'
  where id = selected_copy_id
    and status = 'available';
  if not found then
    raise exception 'The selected copy is no longer available.'
      using errcode = 'P0001';
  end if;

  insert into public.loans (copy_id, user_id, borrowed_at, due_at)
  values (selected_copy_id, borrow_request.user_id, now(), due_date)
  returning id into new_loan_id;

  update public.borrow_requests
  set status = 'approved',
      reviewed_at = now(),
      reviewer_id = (select auth.uid()),
      reviewer_notes = nullif(btrim(p_notes), ''),
      loan_id = new_loan_id
  where id = borrow_request.id;

  return jsonb_build_object(
    'status', 'approved',
    'request_id', borrow_request.id,
    'loan_id', new_loan_id,
    'book_id', borrow_request.book_id,
    'due_at', due_date
  );
end;
$function$;

drop function if exists public.get_borrow_catalog(text, integer);

create function public.get_borrow_catalog(
  p_search text default null,
  p_limit integer default 100
)
returns table (
  book_id uuid,
  title text,
  authors text[],
  description text,
  category text,
  publication_year integer,
  frequency text,
  cover_url text,
  type public.book_type,
  available_copies bigint,
  pending_reservations bigint,
  has_digital boolean,
  view_count bigint,
  has_pending_borrow_request boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    book.id,
    book.title,
    book.authors,
    book.description,
    category.name,
    book.publication_year,
    book.frequency,
    book.cover_url,
    book.type,
    count(copy.id) filter (
      where copy.status = 'available' and copy.format = 'physical'
    ),
    coalesce(reservation_counts.pending_count, 0)::bigint,
    coalesce(bool_or(copy.format = 'digital' and copy.status = 'available'), false),
    coalesce(view_counts.view_count, 0)::bigint,
    exists (
      select 1
      from public.borrow_requests as request
      where request.book_id = book.id
        and request.user_id = (select auth.uid())
        and request.status = 'pending'
    )
  from public.books as book
  left join public.categories as category on category.id = book.category_id
  left join public.copies as copy on copy.book_id = book.id
  left join (
    select reservation.book_id, count(*) as pending_count
    from public.reservations as reservation
    where reservation.status in ('pending', 'ready')
    group by reservation.book_id
  ) as reservation_counts on reservation_counts.book_id = book.id
  left join (
    select history.book_id, count(*) as view_count
    from public.view_history as history
    group by history.book_id
  ) as view_counts on view_counts.book_id = book.id
  where
    p_search is null
    or btrim(p_search) = ''
    or position(lower(btrim(p_search)) in lower(book.title)) > 0
    or exists (
      select 1
      from unnest(book.authors) as author(name)
      where position(lower(btrim(p_search)) in lower(author.name)) > 0
    )
    or position(lower(btrim(p_search)) in lower(coalesce(category.name, ''))) > 0
  group by book.id, category.name, reservation_counts.pending_count, view_counts.view_count
  order by coalesce(view_counts.view_count, 0) desc, book.title
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$function$;

revoke all on function public.get_borrow_catalog(text, integer) from public, anon;
grant execute on function public.get_borrow_catalog(text, integer) to authenticated;

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
    'active_loan_due_at', member_loan.due_at,
    'has_pending_borrow_request', member_request.request_id is not null
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
  left join lateral (
    select request.id as request_id
    from public.borrow_requests as request
    where request.user_id = (select auth.uid())
      and request.book_id = book.id
      and request.status = 'pending'
    limit 1
  ) as member_request on true
  where book.id = p_book_id;
$function$;

revoke all on function public.borrow_book(uuid) from authenticated;
revoke all on function public.request_borrow_book(uuid) from public, anon;
revoke all on function public.get_staff_pending_borrow_requests(integer) from public, anon;
revoke all on function public.review_borrow_request(uuid, text, text) from public, anon;
grant execute on function public.request_borrow_book(uuid) to authenticated;
grant execute on function public.get_staff_pending_borrow_requests(integer) to authenticated;
grant execute on function public.review_borrow_request(uuid, text, text) to authenticated;
