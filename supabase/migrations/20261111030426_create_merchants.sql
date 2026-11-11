-- Module 2: merchants, members (owner/staff), branches and staff invitations.
-- Spec: docs/modules/02-comercios.md
--
-- Security model:
--   * Every table has RLS enabled and explicit, minimal privileges (the project does
--     NOT auto-expose new tables to the Data API).
--   * Membership (merchant_members) is the key: policies ask "is the current user a
--     member / the owner of this merchant?" through helper functions in the `private`
--     schema (not exposed by the API). They are SECURITY DEFINER so that policies on
--     merchant_members itself do not recurse.
--   * Writes that must be atomic or that a non-member must perform (create a merchant
--     and become its owner, accept an invitation) go through SECURITY DEFINER functions
--     with a fixed search_path, executable only by signed-in users.

-- pgcrypto provides gen_random_bytes() for invitation tokens (Supabase keeps it in `extensions`).
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- ISO 4217 code. The list of allowed currencies lives in the app (Zod), so adding
  -- one does not require a migration. From Module 5 on, it cannot change once the
  -- merchant has point transactions.
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint merchants_name_length check (char_length(name) between 1 and 100),
  constraint merchants_name_trimmed check (name = btrim(name)),
  constraint merchants_currency_format check (currency ~ '^[A-Z]{3}$')
);

comment on table public.merchants is 'A business with its own loyalty program (tenant).';

create table public.merchant_members (
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),

  primary key (merchant_id, user_id),
  constraint merchant_members_role check (role in ('owner', 'staff'))
);

comment on table public.merchant_members is
  'Who belongs to each merchant and with which role (owner or staff).';

-- Exactly one owner per merchant (Module 2 scope).
create unique index merchant_members_one_owner
  on public.merchant_members (merchant_id)
  where role = 'owner';

-- "Which merchants do I belong to?" lookups.
create index merchant_members_user_id_idx on public.merchant_members (user_id);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint branches_name_length check (char_length(name) between 1 and 100),
  constraint branches_name_trimmed check (name = btrim(name)),
  constraint branches_address_valid check (
    address is null or (char_length(address) between 1 and 200 and address = btrim(address))
  )
);

comment on table public.branches is 'Physical locations of a merchant (optional).';

-- Branch names are unique per merchant, ignoring case. Also serves merchant_id lookups.
create unique index branches_merchant_name_unique
  on public.branches (merchant_id, lower(name));

create table public.merchant_invitations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  role text not null default 'staff',
  -- SHA-256 (hex) of the secret token in the invitation link. The token itself is
  -- never stored, so reading this table does not allow using the invitations.
  token_hash text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint merchant_invitations_role check (role = 'staff'),
  constraint merchant_invitations_accepted check (accepted_at is not null or accepted_by is null)
);

comment on table public.merchant_invitations is
  'Single-use links (valid 7 days) that let a person join a merchant as staff.';

create index merchant_invitations_merchant_id_idx on public.merchant_invitations (merchant_id);

-- updated_at maintenance (function created in the profiles migration)
create trigger merchants_set_updated_at
  before update on public.merchants
  for each row execute function public.set_updated_at();

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private helpers used by RLS policies
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_merchant_member(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchant_members m
    where m.merchant_id = p_merchant_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_merchant_owner(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchant_members m
    where m.merchant_id = p_merchant_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- True when the given profile belongs to a merchant owned by the current user
-- (lets owners read the names of their staff).
create or replace function private.is_member_of_owned_merchant(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchant_members member
    join public.merchant_members owner
      on owner.merchant_id = member.merchant_id
     and owner.user_id = (select auth.uid())
     and owner.role = 'owner'
    where member.user_id = p_profile_id
  );
$$;

revoke all on function private.is_merchant_member(uuid) from public;
revoke all on function private.is_merchant_owner(uuid) from public;
revoke all on function private.is_member_of_owned_merchant(uuid) from public;
grant execute on function private.is_merchant_member(uuid) to authenticated;
grant execute on function private.is_merchant_owner(uuid) to authenticated;
grant execute on function private.is_member_of_owned_merchant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.merchants enable row level security;
alter table public.merchant_members enable row level security;
alter table public.branches enable row level security;
alter table public.merchant_invitations enable row level security;

-- merchants: members read; owner edits name/currency. Created only via create_merchant().
create policy "merchants: members can read their merchants"
  on public.merchants for select to authenticated
  using ((select private.is_merchant_member(id)));

create policy "merchants: owners can update their merchant"
  on public.merchants for update to authenticated
  using ((select private.is_merchant_owner(id)))
  with check ((select private.is_merchant_owner(id)));

-- merchant_members: everyone sees their own memberships; owners see their whole team.
-- Owners can remove staff (never the owner row). Rows are added only via functions.
create policy "merchant_members: users can read their own memberships"
  on public.merchant_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "merchant_members: owners can read their team"
  on public.merchant_members for select to authenticated
  using ((select private.is_merchant_owner(merchant_id)));

create policy "merchant_members: owners can remove staff"
  on public.merchant_members for delete to authenticated
  using (role = 'staff' and (select private.is_merchant_owner(merchant_id)));

-- branches: members read; owner creates, edits and deletes.
create policy "branches: members can read"
  on public.branches for select to authenticated
  using ((select private.is_merchant_member(merchant_id)));

create policy "branches: owners can create"
  on public.branches for insert to authenticated
  with check ((select private.is_merchant_owner(merchant_id)));

create policy "branches: owners can update"
  on public.branches for update to authenticated
  using ((select private.is_merchant_owner(merchant_id)))
  with check ((select private.is_merchant_owner(merchant_id)));

create policy "branches: owners can delete"
  on public.branches for delete to authenticated
  using ((select private.is_merchant_owner(merchant_id)));

-- merchant_invitations: owner reads and revokes pending ones. Created/accepted only via functions.
create policy "merchant_invitations: owners can read"
  on public.merchant_invitations for select to authenticated
  using ((select private.is_merchant_owner(merchant_id)));

create policy "merchant_invitations: owners can revoke pending"
  on public.merchant_invitations for delete to authenticated
  using (accepted_at is null and (select private.is_merchant_owner(merchant_id)));

-- profiles (Module 1 table): owners can read the profile (name) of their team members.
create policy "profiles: merchant owners can read their team's profiles"
  on public.profiles for select to authenticated
  using ((select private.is_member_of_owned_merchant(id)));

-- ---------------------------------------------------------------------------
-- Table privileges (WHAT each role may do; RLS decides on WHICH rows)
-- ---------------------------------------------------------------------------
revoke all on table public.merchants from anon, authenticated;
grant select on table public.merchants to authenticated;
grant update (name, currency) on table public.merchants to authenticated;

revoke all on table public.merchant_members from anon, authenticated;
grant select, delete on table public.merchant_members to authenticated;

revoke all on table public.branches from anon, authenticated;
grant select, delete on table public.branches to authenticated;
grant insert (merchant_id, name, address) on table public.branches to authenticated;
grant update (name, address) on table public.branches to authenticated;

revoke all on table public.merchant_invitations from anon, authenticated;
-- token_hash is deliberately left out.
grant select (id, merchant_id, role, created_by, expires_at, accepted_by, accepted_at, created_at)
  on table public.merchant_invitations to authenticated;
grant delete on table public.merchant_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- Creates a merchant and makes the caller its owner, in one transaction.
create or replace function public.create_merchant(p_name text, p_currency text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_merchant_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.merchants (name, currency)
  values (btrim(p_name), upper(btrim(p_currency)))
  returning id into v_merchant_id;

  insert into public.merchant_members (merchant_id, user_id, role)
  values (v_merchant_id, v_user_id, 'owner');

  return v_merchant_id;
end;
$$;

-- Owner only. Returns the secret token ONCE; only its SHA-256 hash is stored.
create or replace function public.create_merchant_invitation(p_merchant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not private.is_merchant_owner(p_merchant_id) then
    raise exception 'not_merchant_owner' using errcode = '42501';
  end if;

  -- 32 random bytes, base64url without padding (43 characters).
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.merchant_invitations (merchant_id, token_hash, created_by)
  values (
    p_merchant_id,
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    (select auth.uid())
  );

  return v_token;
end;
$$;

-- What the invitation screen needs, and nothing more.
-- status: valid | already_member | expired | used | not_found
-- merchant_name is only returned for valid / already_member.
create or replace function public.get_invitation_preview(p_token text)
returns table (merchant_name text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invitation public.merchant_invitations%rowtype;
  v_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.merchant_invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  if not found then
    return query select null::text, 'not_found'::text;
    return;
  end if;

  select m.name into v_name from public.merchants m where m.id = v_invitation.merchant_id;

  if exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = v_invitation.merchant_id and mm.user_id = (select auth.uid())
  ) then
    return query select v_name, 'already_member'::text;
  elsif v_invitation.accepted_at is not null then
    return query select null::text, 'used'::text;
  elsif v_invitation.expires_at <= now() then
    return query select null::text, 'expired'::text;
  else
    return query select v_name, 'valid'::text;
  end if;
end;
$$;

-- Joins the caller to the merchant as staff and consumes the invitation, atomically.
-- If the caller is already a member, nothing changes and the invitation stays unused.
-- Errors (message): invitation_not_found | invitation_used | invitation_expired
create or replace function public.accept_merchant_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.merchant_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Lock the row so two people cannot use the same link at the same time.
  select * into v_invitation
  from public.merchant_invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = v_invitation.merchant_id and mm.user_id = v_user_id
  ) then
    return v_invitation.merchant_id;
  end if;

  if v_invitation.accepted_at is not null then
    raise exception 'invitation_used';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'invitation_expired';
  end if;

  insert into public.merchant_members (merchant_id, user_id, role)
  values (v_invitation.merchant_id, v_user_id, v_invitation.role);

  update public.merchant_invitations
  set accepted_by = v_user_id, accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.merchant_id;
end;
$$;

-- Only signed-in users may call the API functions.
revoke all on function public.create_merchant(text, text) from public, anon;
revoke all on function public.create_merchant_invitation(uuid) from public, anon;
revoke all on function public.get_invitation_preview(text) from public, anon;
revoke all on function public.accept_merchant_invitation(text) from public, anon;
grant execute on function public.create_merchant(text, text) to authenticated;
grant execute on function public.create_merchant_invitation(uuid) to authenticated;
grant execute on function public.get_invitation_preview(text) to authenticated;
grant execute on function public.accept_merchant_invitation(text) to authenticated;
