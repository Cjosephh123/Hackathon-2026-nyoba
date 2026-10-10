create table if not exists public.journal_submission_email_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.journal_submissions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (submission_id)
);

create index if not exists journal_submission_email_logs_retry_idx
  on public.journal_submission_email_logs(status, last_attempt_at)
  where status in ('pending', 'sending', 'failed');

alter table public.journal_submission_email_logs enable row level security;
revoke all on public.journal_submission_email_logs from public, anon, authenticated;

create or replace function public.queue_journal_submission_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.journal_submission_email_logs (submission_id)
    values (new.id)
    on conflict (submission_id) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists journal_submission_status_email_queue on public.journal_submissions;
create trigger journal_submission_status_email_queue
  after update of status on public.journal_submissions
  for each row execute function public.queue_journal_submission_email();

create or replace function public.claim_journal_submission_emails()
returns table (
  notification_id uuid,
  recipient_email text,
  recipient_name text,
  title text,
  status text,
  reviewer_notes text
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

  return query
  with eligible as (
    select
      notification.id,
      auth_user.email::text as email,
      coalesce(profile.full_name, profile.username, 'Library member') as full_name,
      submission.title as submission_title,
      submission.status as submission_status,
      submission.reviewer_notes as notes
    from public.journal_submission_email_logs as notification
    join public.journal_submissions as submission
      on submission.id = notification.submission_id
    join public.profiles as profile on profile.id = submission.user_id
    join auth.users as auth_user on auth_user.id = submission.user_id
    where submission.status in ('approved', 'rejected')
      and notification.status in ('pending', 'sending', 'failed')
      and (
        notification.last_attempt_at is null
        or notification.last_attempt_at < now() - interval '15 minutes'
      )
  ),
  claimed as (
    update public.journal_submission_email_logs as notification
    set status = 'sending',
        attempt_count = notification.attempt_count + 1,
        last_attempt_at = now(),
        last_error = null
    from eligible
    where notification.id = eligible.id
      and notification.status in ('pending', 'sending', 'failed')
      and (
        notification.last_attempt_at is null
        or notification.last_attempt_at < now() - interval '15 minutes'
      )
    returning notification.id
  )
  select eligible.id, eligible.email, eligible.full_name, eligible.submission_title,
         eligible.submission_status, eligible.notes
  from eligible
  join claimed on claimed.id = eligible.id;
end;
$function$;

create or replace function public.complete_journal_submission_email(
  p_notification_id uuid,
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

  update public.journal_submission_email_logs
  set status = case when p_success then 'sent' else 'failed' end,
      sent_at = case when p_success then now() else null end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Email delivery failed.'), 1000) end
  where id = p_notification_id
    and status = 'sending';

  if not found then
    raise exception 'Notification is not currently claimed.'
      using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.queue_journal_submission_email() from public, anon, authenticated;
revoke all on function public.claim_journal_submission_emails() from public, anon, authenticated;
revoke all on function public.complete_journal_submission_email(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_journal_submission_emails() to service_role;
grant execute on function public.complete_journal_submission_email(uuid, boolean, text) to service_role;
