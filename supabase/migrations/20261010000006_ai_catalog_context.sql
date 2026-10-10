create or replace function public.get_ai_catalog_context(
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
  type public.book_type,
  cover_url text,
  added_at timestamptz,
  available_physical_copies bigint,
  borrowed_physical_copies bigint,
  maintenance_physical_copies bigint,
  available_digital_copies bigint,
  borrowed_digital_copies bigint
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
    book.type,
    book.cover_url,
    book.created_at,
    count(copy.id) filter (
      where copy.format = 'physical' and copy.status = 'available'
    ),
    count(copy.id) filter (
      where copy.format = 'physical' and copy.status = 'borrowed'
    ),
    count(copy.id) filter (
      where copy.format = 'physical' and copy.status = 'maintenance'
    ),
    count(copy.id) filter (
      where copy.format = 'digital' and copy.status = 'available'
    ),
    count(copy.id) filter (
      where copy.format = 'digital' and copy.status = 'borrowed'
    )
  from public.books as book
  left join public.categories as category on category.id = book.category_id
  left join public.copies as copy on copy.book_id = book.id
  where p_search is null
    or btrim(p_search) = ''
    or position(lower(btrim(p_search)) in lower(book.title)) > 0
    or exists (
      select 1
      from unnest(book.authors) as author(name)
      where position(lower(btrim(p_search)) in lower(author.name)) > 0
    )
    or position(lower(btrim(p_search)) in lower(coalesce(category.name, ''))) > 0
  group by book.id, category.name
  order by book.created_at desc, book.title
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$function$;

revoke all on function public.get_ai_catalog_context(text, integer) from public, anon;
grant execute on function public.get_ai_catalog_context(text, integer) to authenticated;
