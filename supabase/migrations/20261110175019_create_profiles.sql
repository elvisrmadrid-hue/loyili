-- Module 1: profiles (1:1 with auth.users)
-- A profile holds personal data of any Loyili user (customer, merchant owner or staff).
-- It is not merchant-scoped data, but RLS is enabled anyway: each user only sees their own row.

-- ---------------------------------------------------------------------------
-- Generic helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: sets updated_at to now() before each UPDATE.';

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_full_name_length check (char_length(full_name) between 1 and 100),
  constraint profiles_full_name_trimmed check (full_name = btrim(full_name))
);

comment on table public.profiles is
  'Personal data of a Loyili user. One row per auth.users row, created by trigger on sign up.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No INSERT/DELETE policies: rows are created by the trigger below and
-- removed by ON DELETE CASCADE when the auth user is deleted.

-- Explicit table privileges (the project does NOT auto-expose new tables to the Data API).
-- They work together with RLS: privileges say WHAT a role may do, policies say on WHICH rows.
-- Start from zero, then grant only what is needed:
--   anon (visitors):         nothing
--   authenticated (users):   read, and change only full_name (never id or timestamps)
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Create the profile automatically when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    -- Name sent from the sign-up form. Technical fallback (e.g. users created
    -- from the Supabase dashboard): the part of the email before "@".
    coalesce(
      nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'full_name'), 100)), ''),
      nullif(btrim(left(split_part(new.email, '@', 1), 100)), ''),
      'Usuario'
    )
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger function (security definer): creates public.profiles row for each new auth.users row.';

-- Only the trigger may run it; never callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
