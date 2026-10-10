-- =====================================================================
-- DEMO DATA so the Home page has something to show
-- Run AFTER migration_home_page.sql, and after you have signed up at least
-- one account (the demo loans are attached to the oldest account).
-- Safe to re-run: it does nothing if the demo data already exists.
-- Delete later from the Table Editor (books named below, cascade removes copies).
-- =====================================================================
do $$
declare
  v_user uuid;
begin
  if exists (select 1 from public.books where title = 'The Midnight Library') then
    raise notice 'Demo data already exists - nothing to do.';
    return;
  end if;

  select id into v_user from public.profiles order by created_at limit 1;
  if v_user is null then
    raise exception 'Sign up at least one account on the website first, then run this seed.';
  end if;

  insert into public.categories (name, slug) values
    ('Literature', 'literature'), ('Science', 'science'),
    ('Self-help', 'self-help'), ('Spirituality', 'spirituality'), ('Medicine', 'medicine')
  on conflict do nothing;

  -- Books & journals
  insert into public.books (title, authors, publisher, publication_year, type, category_id, description, frequency)
  select v.title, v.authors, v.publisher, v.yr, v.typ::public.book_type,
         (select c.id from public.categories c where c.slug = v.cat), v.descr, v.freq
  from (values
    ('The Midnight Library', array['Matt Haig'],         'Canongate', 2020,         'book',    'literature',   'A novel about a library between life and death.', null::text),
    ('Atomic Habits',        array['James Clear'],       'Avery',     2018,         'book',    'self-help',    'Small changes that build remarkable habits.',      null),
    ('The Power of Now',     array['Eckhart Tolle'],     'Namaste',   1997,         'book',    'spirituality', 'A guide to living in the present moment.',         null),
    ('Laskar Pelangi',       array['Andrea Hirata'],     'Bentang',   2005,         'book',    'literature',   'A story of ten children and their teacher.',       null),
    ('Nature',               array['Nature Research'],   'Springer Nature', null::int, 'journal', 'science',    'International weekly journal of science',          'Weekly'),
    ('The Lancet',           array['Lancet Group'],      'Elsevier',  null,         'journal', 'medicine',     'Leading international medical journal',            'Weekly'),
    ('Science',              array['AAAS'],              'AAAS',      null,         'journal', 'science',      'Peer-reviewed journal of scientific research',     'Weekly')
  ) as v(title, authors, publisher, yr, typ, cat, descr, freq);

  -- Copies (borrowed copies match the active loans below)
  insert into public.copies (book_id, barcode, format, status, location)
  select b.id, v.barcode, v.fmt::public.copy_format, v.st::public.copy_status, v.loc
  from (values
    ('The Midnight Library', 'MID-001', 'physical', 'borrowed',  'Shelf A1'),
    ('The Midnight Library', 'MID-002', 'physical', 'borrowed',  'Shelf A1'),
    ('Atomic Habits',        'ATM-001', 'physical', 'borrowed',  'Shelf B2'),
    ('Atomic Habits',        'ATM-002', 'physical', 'available', 'Shelf B2'),
    ('Atomic Habits',        'ATM-003', 'physical', 'available', 'Shelf B2'),
    ('The Power of Now',     'POW-001', 'physical', 'borrowed',  'Shelf C3'),
    ('Laskar Pelangi',       'LP-001',  'physical', 'available', 'Shelf A4'),
    ('Laskar Pelangi',       'LP-002',  'physical', 'available', 'Shelf A4'),
    ('Nature',               'NAT-D1',  'digital',  'available', 'Online'),
    ('The Lancet',           'LAN-001', 'physical', 'available', 'Periodicals'),
    ('Science',              'SCI-D1',  'digital',  'available', 'Online')
  ) as v(title, barcode, fmt, st, loc)
  join public.books b on b.title = v.title;

  -- Loans: borrowed_h / returned_h = hours ago, due_d = days from now
  insert into public.loans (copy_id, user_id, borrowed_at, due_at, returned_at)
  select c.id, v_user,
         now() - make_interval(hours => v.borrowed_h),
         now() + make_interval(days => v.due_d),
         case when v.returned_h is null then null else now() - make_interval(hours => v.returned_h) end
  from (values
    ('MID-001', 3,   2,  null::int),   -- active, due soon
    ('MID-002', 4,   10, null),        -- active
    ('MID-001', 26,  5,  2),           -- returned today
    ('MID-002', 27, -1,  1),           -- returned today, late
    ('ATM-001', 5,   9,  null),        -- active
    ('ATM-002', 29,  5,  5),           -- returned
    ('ATM-003', 28,  5,  3),           -- returned
    ('POW-001', 6,   8,  null),        -- active
    ('LP-001',  50,  5,  40),
    ('LAN-001', 20,  5,  4)
  ) as v(barcode, borrowed_h, due_d, returned_h)
  join public.copies c on c.barcode = v.barcode;

  -- Waitlist
  insert into public.reservations (user_id, book_id, status)
  select v_user, b.id, v.st::public.reservation_status
  from (values
    ('The Power of Now', 'pending'),
    ('The Power of Now', 'pending'),
    ('Laskar Pelangi',   'ready')
  ) as v(title, st)
  join public.books b on b.title = v.title;

  -- Journal views (journals are popular by views, since they are read online)
  insert into public.view_history (user_id, book_id, viewed_at)
  select v_user, b.id, now() - make_interval(mins => series.view_number * 7)
  from (values ('Nature', 12), ('The Lancet', 9), ('Science', 8)) as v(title, n)
  join public.books b on b.title = v.title
  cross join lateral generate_series(1, v.n) as series(view_number);

  -- Website visitors today: 18 different visitors, 42 page views
  insert into public.site_visits (visitor_id, path, visited_at)
  select 'demo-visitor-' || (series.page_number % 18),
         (array['/', '/repository', '/borrow'])[1 + series.page_number % 3],
         now() - make_interval(mins => series.page_number * 5)
  from generate_series(1, 42) as series(page_number);

  raise notice 'Demo data created.';
end $$;
