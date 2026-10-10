do $types$
begin
  create type public.book_type as enum ('book', 'journal');
exception
  when duplicate_object then null;
end
$types$;

do $types$
begin
  create type public.copy_format as enum ('physical', 'digital');
exception
  when duplicate_object then null;
end
$types$;

do $types$
begin
  create type public.copy_status as enum ('available', 'borrowed', 'maintenance');
exception
  when duplicate_object then null;
end
$types$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text[] not null default '{}',
  publisher text,
  publication_year integer,
  type public.book_type not null default 'book',
  category_id uuid references public.categories(id) on delete set null,
  description text,
  frequency text,
  cover_url text,
  created_at timestamptz not null default now(),
  constraint books_publication_year_valid
    check (publication_year is null or publication_year between 1 and 9999)
);

create index if not exists books_type_title_idx on public.books(type, title);
create index if not exists books_category_idx on public.books(category_id);

create table if not exists public.copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  barcode text not null unique,
  format public.copy_format not null default 'physical',
  status public.copy_status not null default 'available',
  location text,
  created_at timestamptz not null default now()
);

create index if not exists copies_book_status_idx on public.copies(book_id, status);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.copies(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint loans_due_after_checkout check (due_at > borrowed_at),
  constraint loans_return_after_checkout
    check (returned_at is null or returned_at >= borrowed_at)
);

create unique index if not exists loans_one_active_per_copy_idx
  on public.loans(copy_id)
  where returned_at is null;
create index if not exists loans_borrowed_at_idx on public.loans(borrowed_at desc);
create index if not exists loans_returned_at_idx on public.loans(returned_at desc);
create index if not exists loans_user_idx on public.loans(user_id, borrowed_at desc);

create table if not exists public.view_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists view_history_book_viewed_idx
  on public.view_history(book_id, viewed_at desc);
create index if not exists view_history_user_viewed_idx
  on public.view_history(user_id, viewed_at desc);

alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.copies enable row level security;
alter table public.loans enable row level security;
alter table public.view_history enable row level security;

revoke all on table public.categories, public.books, public.copies,
  public.loans, public.view_history from anon, authenticated;

grant select, insert, update, delete on table public.categories,
  public.books, public.copies to authenticated;
grant select, insert, update, delete on table public.loans to authenticated;
grant select, insert on table public.view_history to authenticated;
grant usage, select on sequence public.view_history_id_seq to authenticated;

drop policy if exists "Authenticated users can read categories" on public.categories;
create policy "Authenticated users can read categories"
  on public.categories for select to authenticated using (true);
drop policy if exists "Staff can manage categories" on public.categories;
create policy "Staff can manage categories"
  on public.categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Authenticated users can read books" on public.books;
create policy "Authenticated users can read books"
  on public.books for select to authenticated using (true);
drop policy if exists "Staff can manage books" on public.books;
create policy "Staff can manage books"
  on public.books for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can read and manage copies" on public.copies;
create policy "Staff can read and manage copies"
  on public.copies for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Users can read their own loans or staff can read all" on public.loans;
create policy "Users can read their own loans or staff can read all"
  on public.loans for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
drop policy if exists "Staff can manage loans" on public.loans;
create policy "Staff can manage loans"
  on public.loans for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Users can read their own view history or staff can read all" on public.view_history;
create policy "Users can read their own view history or staff can read all"
  on public.view_history for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
drop policy if exists "Users can add their own view history" on public.view_history;
create policy "Users can add their own view history"
  on public.view_history for insert to authenticated
  with check (user_id = (select auth.uid()));
