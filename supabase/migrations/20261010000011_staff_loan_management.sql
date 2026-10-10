create or replace function public.get_staff_dashboard_stats()
returns table (
  book_count bigint,
  pending_submissions bigint,
  active_loans bigint,
  overdue_loans bigint,
  due_soon_loans bigint
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
  select
    (select count(*) from public.books),
    (select count(*) from public.journal_submissions where status = 'pending'),
    (select count(*) from public.loans where returned_at is null),
    (select count(*) from public.loans where returned_at is null and due_at < now()),
    (select count(*) from public.loans where returned_at is null and due_at between now() and now() + interval '48 hours');
end;
$function$;

create or replace function public.get_staff_active_loans(p_limit integer default 100)
returns table (
  loan_id uuid,
  member_name text,
  book_title text,
  borrowed_at timestamptz,
  due_at timestamptz,
  is_overdue boolean
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
  select loan.id,
         coalesce(profile.full_name, profile.username, 'Library member'),
         book.title,
         loan.borrowed_at,
         loan.due_at,
         loan.due_at < now()
  from public.loans as loan
  join public.profiles as profile on profile.id = loan.user_id
  join public.copies as copy on copy.id = loan.copy_id
  join public.books as book on book.id = copy.book_id
  where loan.returned_at is null
  order by loan.due_at, loan.borrowed_at
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$function$;

create or replace function public.staff_return_loan(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  loan_copy_id uuid;
  updated_copies integer;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required.'
      using errcode = '42501';
  end if;

  select loan.copy_id
  into loan_copy_id
  from public.loans as loan
  where loan.id = p_loan_id
    and loan.returned_at is null
  for update;

  if not found then
    raise exception 'This loan is already returned or does not exist.'
      using errcode = 'P0002';
  end if;

  update public.loans
  set returned_at = now()
  where id = p_loan_id;

  update public.copies
  set status = 'available'
  where id = loan_copy_id
    and status = 'borrowed';
  get diagnostics updated_copies = row_count;
  if updated_copies <> 1 then
    raise exception 'The borrowed copy is not in the expected status.'
      using errcode = '23514';
  end if;
end;
$function$;

revoke all on function public.get_staff_dashboard_stats() from public, anon;
revoke all on function public.get_staff_active_loans(integer) from public, anon;
revoke all on function public.staff_return_loan(uuid) from public, anon;
grant execute on function public.get_staff_dashboard_stats() to authenticated;
grant execute on function public.get_staff_active_loans(integer) to authenticated;
grant execute on function public.staff_return_loan(uuid) to authenticated;
