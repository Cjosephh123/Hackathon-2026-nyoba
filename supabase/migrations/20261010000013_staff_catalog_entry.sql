create or replace function public.staff_add_catalog_book(
  p_title text,
  p_authors text[] default '{}',
  p_publisher text default null,
  p_publication_year integer default null,
  p_type text default 'book',
  p_category text default null,
  p_description text default null,
  p_frequency text default null,
  p_cover_url text default null,
  p_copy_barcodes text[] default '{}',
  p_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  book_id uuid;
  selected_category_id uuid;
  category_name text := nullif(btrim(p_category), '');
  category_slug text;
  copy_barcode text;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required.'
      using errcode = '42501';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 300 then
    raise exception 'Title must contain between 1 and 300 characters.'
      using errcode = '22023';
  end if;
  if p_type is null or p_type not in ('book', 'journal') then
    raise exception 'Type must be book or journal.'
      using errcode = '22023';
  end if;
  if p_publication_year is not null and p_publication_year not between 1 and 9999 then
    raise exception 'Publication year must be between 1 and 9999.'
      using errcode = '22023';
  end if;
  if coalesce(cardinality(p_copy_barcodes), 0) > 100 then
    raise exception 'A catalog request may register at most 100 physical copies.'
      using errcode = '22023';
  end if;

  if category_name is not null then
    if char_length(category_name) > 80 then
      raise exception 'Category must be 80 characters or fewer.'
        using errcode = '22023';
    end if;
    category_slug := trim(both '-' from lower(regexp_replace(category_name, '[^a-zA-Z0-9]+', '-', 'g')));
    if category_slug = '' then
      raise exception 'Category must contain at least one letter or number.'
        using errcode = '22023';
    end if;

    insert into public.categories (name, slug)
    values (category_name, category_slug)
    on conflict (name) do update set name = excluded.name
    returning id into selected_category_id;
  end if;

  insert into public.books (
    title,
    authors,
    publisher,
    publication_year,
    type,
    category_id,
    description,
    frequency,
    cover_url
  )
  values (
    btrim(p_title),
    coalesce(p_authors, '{}'),
    nullif(btrim(p_publisher), ''),
    p_publication_year,
    p_type::public.book_type,
    selected_category_id,
    nullif(btrim(p_description), ''),
    nullif(btrim(p_frequency), ''),
    nullif(btrim(p_cover_url), '')
  )
  returning id into book_id;

  foreach copy_barcode in array coalesce(p_copy_barcodes, '{}') loop
    if copy_barcode is null or char_length(btrim(copy_barcode)) not between 1 and 120 then
      raise exception 'Every barcode must contain between 1 and 120 characters.'
        using errcode = '22023';
    end if;
    insert into public.copies (book_id, barcode, format, status, location)
    values (
      book_id,
      btrim(copy_barcode),
      'physical',
      'available',
      nullif(btrim(p_location), '')
    );
  end loop;

  return book_id;
end;
$function$;

revoke all on function public.staff_add_catalog_book(
  text, text[], text, integer, text, text, text, text, text, text[], text
) from public, anon;
grant execute on function public.staff_add_catalog_book(
  text, text[], text, integer, text, text, text, text, text, text[], text
) to authenticated;
