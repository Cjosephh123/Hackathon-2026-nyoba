alter table public.loans
  add column if not exists return_requested_at timestamptz;

create or replace function public.get_member_active_loans()
returns table (
  loan_id uuid,
  book_title text,
  authors text[],
  borrowed_at timestamptz,
  due_at timestamptz,
  return_requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to view your loans.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'member'
  ) then
    raise exception 'Only library members can view member loans.'
      using errcode = '42501';
  end if;

  return query
  select loan.id,
         book.title,
         book.authors,
         loan.borrowed_at,
         loan.due_at,
         loan.return_requested_at
  from public.loans as loan
  join public.copies as copy on copy.id = loan.copy_id
  join public.books as book on book.id = copy.book_id
  where loan.user_id = (select auth.uid())
    and loan.returned_at is null
  order by loan.due_at, loan.borrowed_at;
end;
$function$;

create or replace function public.request_loan_return(p_loan_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  loan_record public.loans%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to request a return.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'member'
  ) then
    raise exception 'Only library members can request a return.'
      using errcode = '42501';
  end if;

  select loan.*
  into loan_record
  from public.loans as loan
  where loan.id = p_loan_id
    and loan.user_id = (select auth.uid())
  for update;

  if not found or loan_record.returned_at is not null then
    raise exception 'This active loan could not be found.'
      using errcode = 'P0002';
  end if;

  if loan_record.return_requested_at is null then
    update public.loans
    set return_requested_at = now()
    where id = loan_record.id
    returning return_requested_at into loan_record.return_requested_at;
  end if;

  return loan_record.return_requested_at;
end;
$function$;

create or replace function public.get_staff_pending_loan_returns(p_limit integer default 100)
returns table (
  loan_id uuid,
  member_name text,
  book_title text,
  due_at timestamptz,
  return_requested_at timestamptz
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
         loan.due_at,
         loan.return_requested_at
  from public.loans as loan
  join public.profiles as profile on profile.id = loan.user_id
  join public.copies as copy on copy.id = loan.copy_id
  join public.books as book on book.id = copy.book_id
  where loan.returned_at is null
    and loan.return_requested_at is not null
  order by loan.return_requested_at, loan.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$function$;

revoke all on function public.get_member_active_loans() from public, anon;
revoke all on function public.request_loan_return(uuid) from public, anon;
revoke all on function public.get_staff_pending_loan_returns(integer) from public, anon;
grant execute on function public.get_member_active_loans() to authenticated;
grant execute on function public.request_loan_return(uuid) to authenticated;
grant execute on function public.get_staff_pending_loan_returns(integer) to authenticated;
