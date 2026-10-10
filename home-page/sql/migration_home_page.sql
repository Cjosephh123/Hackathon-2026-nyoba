-- =====================================================================
-- MIGRATION: data needed by the Home page
--   - reservations (waitlist)        - site_visits (website viewers)
--   - books.frequency (e.g. Weekly)  - get_popular_titles()
--   - get_library_activity()
-- Run once in Supabase Dashboard > SQL Editor (safe to re-run)
-- =====================================================================

-- 1. Journal frequency ("Weekly", "Monthly", ...)
alter table public.books add column if not exists frequency text;

-- 2. Reservations / waitlist ------------------------------------------
do $$ begin
  create type public.reservation_status as enum ('pending', 'ready', 'fulfilled', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  status     public.reservation_status not null default 'pending',  -- 'ready' = held for pickup
  created_at timestamptz not null default now()
);
create index if not exists reservations_book_idx    on public.reservations(book_id, status);
create index if not exists reservations_created_idx on public.reservations(created_at desc);

alter table public.reservations enable row level security;

drop policy if exists "reservations: read own or staff" on public.reservations;
create policy "reservations: read own or staff" on public.reservations
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "reservations: insert own" on public.reservations;
create policy "reservations: insert own" on public.reservations
  for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "reservations: update own or staff" on public.reservations;
create policy "reservations: update own or staff" on public.reservations
  for update using (user_id = auth.uid() or public.is_staff())
  with check (public.is_staff() or (user_id = auth.uid() and status = 'cancelled'));

-- 3. Website visits (counts viewers, including people who are not logged in) --
create table if not exists public.site_visits (
  id         bigint generated always as identity primary key,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),  -- anonymous id from the browser
  user_id    uuid references public.profiles(id) on delete set null,
  path       text,
  visited_at timestamptz not null default now()
);
create index if not exists site_visits_time_idx on public.site_visits(visited_at desc);

alter table public.site_visits enable row level security;

drop policy if exists "site_visits: anyone can insert" on public.site_visits;
create policy "site_visits: anyone can insert" on public.site_visits
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "site_visits: staff read" on public.site_visits;
create policy "site_visits: staff read" on public.site_visits
  for select using (public.is_staff());

revoke all on table public.reservations, public.site_visits from anon, authenticated;
grant select, insert, update on table public.reservations to authenticated;
grant insert, select on table public.site_visits to authenticated;
grant insert on table public.site_visits to anon;

-- 4. Popular books / journals this month --------------------------------
--    Books:    borrows + reservations this month
--    Journals: borrows + reservations + page views this month
--    security definer: members only receive aggregated numbers, never other users' data.
create or replace function public.get_popular_titles(
  p_type  public.book_type,
  p_limit int  default 3,
  p_tz    text default 'Asia/Jakarta'
)
returns table (
  book_id              uuid,
  title                text,
  authors              text[],
  description          text,
  category             text,
  publication_year     int,
  frequency            text,
  cover_url            text,
  popularity           bigint,
  total_copies         bigint,
  available_copies     bigint,
  pending_reservations bigint,
  has_digital          boolean,
  next_due_at          timestamptz
)
language sql stable security definer set search_path = public as $$
  with m as (
    select (date_trunc('month', now() at time zone p_tz)) at time zone p_tz as month_start
  ),
  loan_n as (
    select c.book_id, count(*) as n
    from public.loans l
    join public.copies c on c.id = l.copy_id
    cross join m
    where l.borrowed_at >= m.month_start
    group by c.book_id
  ),
  res_n as (
    select r.book_id, count(*) as n
    from public.reservations r
    cross join m
    where r.created_at >= m.month_start
    group by r.book_id
  ),
  view_n as (
    select v.book_id, count(*) as n
    from public.view_history v
    cross join m
    where v.viewed_at >= m.month_start
    group by v.book_id
  ),
  copy_s as (
    select c.book_id,
           count(*)                                    as total,
           count(*) filter (where c.status = 'available') as avail,
           bool_or(c.format = 'digital')               as has_digital
    from public.copies c
    group by c.book_id
  ),
  open_res as (
    select r.book_id, count(*) as n
    from public.reservations r
    where r.status in ('pending', 'ready')
    group by r.book_id
  ),
  due as (
    select c.book_id, min(l.due_at) as next_due
    from public.loans l
    join public.copies c on c.id = l.copy_id
    where l.returned_at is null
    group by c.book_id
  )
  select x.book_id, x.title, x.authors, x.description, x.category, x.publication_year, x.frequency,
         x.cover_url, x.popularity, x.total_copies, x.available_copies, x.pending_reservations,
         x.has_digital, x.next_due_at
  from (
    select b.id                         as book_id,
           b.title                      as title,
           b.authors                    as authors,
           b.description                as description,
           cat.name                     as category,
           b.publication_year           as publication_year,
           b.frequency                  as frequency,
           b.cover_url                  as cover_url,
           (coalesce(ln.n, 0) + coalesce(rn.n, 0)
              + case when b.type = 'journal' then coalesce(vn.n, 0) else 0 end)::bigint as popularity,
           coalesce(cs.total, 0)::bigint as total_copies,
           coalesce(cs.avail, 0)::bigint as available_copies,
           coalesce(orr.n, 0)::bigint    as pending_reservations,
           coalesce(cs.has_digital, false) as has_digital,
           d.next_due                   as next_due_at
    from public.books b
    left join public.categories cat on cat.id = b.category_id
    left join loan_n ln  on ln.book_id  = b.id
    left join res_n  rn  on rn.book_id  = b.id
    left join view_n vn  on vn.book_id  = b.id
    left join copy_s cs  on cs.book_id  = b.id
    left join open_res orr on orr.book_id = b.id
    left join due d      on d.book_id   = b.id
    where b.type = p_type
  ) x
  where x.popularity > 0
  order by x.popularity desc, x.title
  limit least(greatest(p_limit, 1), 20);
$$;

-- 5. Library activity for one day -----------------------------------------
create or replace function public.get_library_activity(
  p_day date default null,
  p_tz  text default 'Asia/Jakarta'
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_day        date        := coalesce(p_day, (now() at time zone p_tz)::date);
  v_start      timestamptz := v_day::timestamp at time zone p_tz;
  v_end        timestamptz := (v_day + 1)::timestamp at time zone p_tz;
  v_prev_start timestamptz := (v_day - 1)::timestamp at time zone p_tz;
begin
  return jsonb_build_object(
    'day', v_day,
    'checkouts_today',     (select count(*) from public.loans where borrowed_at >= v_start and borrowed_at < v_end),
    'checkouts_yesterday', (select count(*) from public.loans where borrowed_at >= v_prev_start and borrowed_at < v_start),
    'returns_today',       (select count(*) from public.loans where returned_at >= v_start and returned_at < v_end),
    'returns_on_time',     (select count(*) from public.loans where returned_at >= v_start and returned_at < v_end and returned_at <= due_at),
    'waitlist_today',      (select count(*) from public.reservations where created_at >= v_start and created_at < v_end),
    'waitlist_ready',      (select count(*) from public.reservations where status = 'ready'),
    'visitors_today',      (select count(distinct visitor_id) from public.site_visits where visited_at >= v_start and visited_at < v_end),
    'page_views_today',    (select count(*) from public.site_visits where visited_at >= v_start and visited_at < v_end)
  );
end $$;

revoke execute on function public.get_library_activity(date, text) from public, anon;
revoke execute on function public.get_popular_titles(public.book_type, int, text) from public, anon;
grant  execute on function public.get_library_activity(date, text) to authenticated;
grant  execute on function public.get_popular_titles(public.book_type, int, text) to authenticated;
