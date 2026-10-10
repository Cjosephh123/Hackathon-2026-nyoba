create table if not exists public.loan_due_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('due_soon', 'due_in_2_days')),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (loan_id, reminder_kind)
);

create index if not exists loan_due_reminder_logs_retry_idx
  on public.loan_due_reminder_logs(status, last_attempt_at)
  where status in ('pending', 'sending', 'failed');

alter table public.loan_due_reminder_logs enable row level security;
revoke all on public.loan_due_reminder_logs from public, anon, authenticated;

create or replace function public.claim_due_loan_reminders()
returns table (
  reminder_id uuid,
  recipient_email text,
  recipient_name text,
  book_title text,
  due_at timestamptz,
  reminder_kind text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.'
      using errcode = '42501';
  end if;

  insert into public.loan_due_reminder_logs (loan_id, reminder_kind)
  select
    loan.id,
    case
      when loan.due_at <= now() + interval '24 hours' then 'due_soon'
      else 'due_in_2_days'
    end
  from public.loans as loan
  where loan.returned_at is null
    and loan.due_at > now()
    and loan.due_at <= now() + interval '48 hours'
  on conflict on constraint loan_due_reminder_logs_loan_id_reminder_kind_key
    do nothing;

  return query
  with eligible as (
    select
      reminder.id,
      auth_user.email::text as email,
      coalesce(profile.full_name, profile.username, 'Library member') as full_name,
      book.title as title,
      loan.due_at as due_date,
      reminder.reminder_kind as kind
    from public.loan_due_reminder_logs as reminder
    join public.loans as loan on loan.id = reminder.loan_id
    join public.copies as copy on copy.id = loan.copy_id
    join public.books as book on book.id = copy.book_id
    join public.profiles as profile on profile.id = loan.user_id
    join auth.users as auth_user on auth_user.id = loan.user_id
    where loan.returned_at is null
      and loan.due_at > now()
      and loan.due_at <= now() + interval '48 hours'
      and (
        (reminder.reminder_kind = 'due_in_2_days' and loan.due_at > now() + interval '24 hours')
        or (reminder.reminder_kind = 'due_soon' and loan.due_at <= now() + interval '24 hours')
      )
      and reminder.status in ('pending', 'sending', 'failed')
      and (
        reminder.last_attempt_at is null
        or reminder.last_attempt_at < now() - interval '15 minutes'
      )
  ),
  claimed as (
    update public.loan_due_reminder_logs as reminder
    set status = 'sending',
        attempt_count = reminder.attempt_count + 1,
        last_attempt_at = now(),
        last_error = null
    from eligible
    where reminder.id = eligible.id
      and reminder.status in ('pending', 'sending', 'failed')
      and (
        reminder.last_attempt_at is null
        or reminder.last_attempt_at < now() - interval '15 minutes'
      )
    returning reminder.id
  )
  select eligible.id, eligible.email, eligible.full_name, eligible.title,
         eligible.due_date, eligible.kind
  from eligible
  join claimed on claimed.id = eligible.id;
end;
$function$;

create or replace function public.complete_due_loan_reminder(
  p_reminder_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required.'
      using errcode = '42501';
  end if;

  update public.loan_due_reminder_logs
  set status = case when p_success then 'sent' else 'failed' end,
      sent_at = case when p_success then now() else null end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Email delivery failed.'), 1000) end
  where id = p_reminder_id
    and status = 'sending';

  if not found then
    raise exception 'Reminder is not currently claimed.'
      using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.claim_due_loan_reminders() from public, anon, authenticated;
revoke all on function public.complete_due_loan_reminder(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_due_loan_reminders() to service_role;
grant execute on function public.complete_due_loan_reminder(uuid, boolean, text) to service_role;
