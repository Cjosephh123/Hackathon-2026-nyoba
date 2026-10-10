create unique index if not exists reservations_one_active_per_user_book_idx
  on public.reservations(user_id, book_id)
  where status in ('pending', 'ready');

create or replace function public.guard_unavailable_title_waitlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.copies as copy
    where copy.book_id = new.book_id
      and copy.status = 'available'
  ) then
    raise exception 'This title has an available copy and cannot be added to the waitlist.';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_unavailable_title_waitlist() from public;

drop trigger if exists reservations_require_unavailable_title on public.reservations;
create trigger reservations_require_unavailable_title
  before insert on public.reservations
  for each row execute function public.guard_unavailable_title_waitlist();

create or replace function public.get_borrow_catalog(
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
  view_count bigint
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
    coalesce(view_counts.view_count, 0)::bigint
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
