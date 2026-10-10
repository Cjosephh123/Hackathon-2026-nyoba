create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_role_valid check (role in ('member', 'staff', 'admin'))
);

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  new_username text;
  new_full_name text;
begin
  new_username := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  new_full_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');

  if new_username is null or new_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'A valid username is required to create a profile.';
  end if;

  insert into public.profiles (id, username, full_name)
  values (new.id, new_username, coalesce(new_full_name, new_username));

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  );
$function$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_username ~ '^[A-Za-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles as profile
      where lower(profile.username) = lower(p_username)
    ),
    false
  );
$function$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
