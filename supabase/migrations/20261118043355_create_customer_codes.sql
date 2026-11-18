-- Module 7: identifying customers at the register with a QR — docs/modules/07-identificacion-qr.md
--
-- * customer_codes: one current code per person. The code is 8 symbols without look-alikes
--   (40 bits), valid for 5 minutes, shown as a QR plus "XXXX-XXXX" in the wallet. Only its
--   SHA-256 fingerprint is stored (like invitations). Issuing a new code replaces the old one.
-- * The table has no API access at all: everything goes through the functions below.
-- * A code is not single-use: during its 5 minutes it can be scanned again. Expiry is what
--   protects against screenshots.
-- * resolve_customer_code tells the merchant's staff who the code belongs to:
--     customer            -> their membership (the register opens it)
--     not_customer        -> only the person's name (the register offers to enroll them;
--                            showing the code is the person's consent)
--     member              -> the person works at this merchant (rejected)
--     expired_or_unknown  -> nothing at all
-- * enroll_customer_by_code enrolls the code's owner (same rules as join_merchant:
--   active program, not someone who works at the merchant).

create table public.customer_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint customer_codes_code_hash_unique unique (code_hash)
);

comment on table public.customer_codes is
  'Current temporary identification code of each person (QR in the wallet). Only the hash is stored.';

-- RLS on and no policies: nobody reads or writes the table through the API.
alter table public.customer_codes enable row level security;
revoke all on table public.customer_codes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Uppercase, without spaces or dashes ("k7p2-qx4m" -> "K7P2QX4M").
create or replace function private.normalize_customer_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
$$;

-- Owner of a current (not expired) code, or null.
create or replace function private.customer_code_owner(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.user_id
  from public.customer_codes c
  where c.code_hash = encode(sha256(convert_to(private.normalize_customer_code(p_code), 'UTF8')), 'hex')
    and c.expires_at > now();
$$;

revoke all on function private.normalize_customer_code(text) from public;
revoke all on function private.customer_code_owner(text) from public;

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- Gives the caller a new code (replacing the previous one). Returns the code in clear text
-- (the only time it exists) and how many seconds it is valid, so the wallet can count down
-- with its own clock.
create or replace function public.issue_customer_code()
returns table (code text, expires_at timestamptz, valid_seconds integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- 32 symbols: 256 is a multiple of 32, so every symbol is equally likely.
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_validity constant interval := interval '5 minutes';
  v_user_id uuid := (select auth.uid());
  v_bytes bytea;
  v_code text;
  v_expires_at timestamptz := now() + v_validity;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.customer_codes as c (user_id, code_hash, expires_at, created_at)
      values (v_user_id, encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), v_expires_at, now())
      on conflict (user_id) do update
        set code_hash = excluded.code_hash,
            expires_at = excluded.expires_at,
            created_at = excluded.created_at;
      exit;
    exception when unique_violation then
      -- Another person holds the same code (1 in 2^40 per person): draw again.
      null;
    end;
  end loop;

  return query select v_code, v_expires_at, extract(epoch from v_validity)::integer;
end;
$$;

-- Who a code belongs to, from the point of view of one merchant. Owner and staff only.
-- Reveals nothing about an expired or unknown code.
create or replace function public.resolve_customer_code(p_merchant_id uuid, p_code text)
returns table (status text, full_name text, membership_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_membership_id uuid;
begin
  if not private.is_merchant_member(p_merchant_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  v_owner := private.customer_code_owner(p_code);
  if v_owner is null then
    return query select 'expired_or_unknown'::text, null::text, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.merchant_members
    where merchant_id = p_merchant_id and user_id = v_owner
  ) then
    return query select 'member'::text, p.full_name, null::uuid
      from public.profiles p where p.id = v_owner;
    return;
  end if;

  select ms.id into v_membership_id
  from public.memberships ms
  where ms.merchant_id = p_merchant_id and ms.customer_id = v_owner;

  return query
    select case when v_membership_id is null then 'not_customer' else 'customer' end,
           p.full_name,
           v_membership_id
    from public.profiles p
    where p.id = v_owner;
end;
$$;

-- Enrolls the code's owner in the merchant's program, from the register. Idempotent:
-- returns the existing membership if they already are a customer. Owner and staff only.
create or replace function public.enroll_customer_by_code(p_merchant_id uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_membership_id uuid;
begin
  if not private.is_merchant_member(p_merchant_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  v_owner := private.customer_code_owner(p_code);
  if v_owner is null then
    raise exception 'code_invalid';
  end if;

  select ms.id into v_membership_id
  from public.memberships ms
  where ms.merchant_id = p_merchant_id and ms.customer_id = v_owner;
  if v_membership_id is not null then
    return v_membership_id;
  end if;

  if exists (
    select 1 from public.merchant_members
    where merchant_id = p_merchant_id and user_id = v_owner
  ) then
    raise exception 'merchant_member';
  end if;

  if not exists (
    select 1 from public.loyalty_programs
    where merchant_id = p_merchant_id and is_active
  ) then
    raise exception 'program_not_active';
  end if;

  insert into public.memberships (merchant_id, customer_id)
  values (p_merchant_id, v_owner)
  on conflict (merchant_id, customer_id) do nothing
  returning id into v_membership_id;

  if v_membership_id is null then
    -- Enrolled at the same moment by someone else (or by themselves via the join link).
    select ms.id into v_membership_id
    from public.memberships ms
    where ms.merchant_id = p_merchant_id and ms.customer_id = v_owner;
  end if;

  return v_membership_id;
end;
$$;

revoke all on function public.issue_customer_code() from public, anon;
revoke all on function public.resolve_customer_code(uuid, text) from public, anon;
revoke all on function public.enroll_customer_by_code(uuid, text) from public, anon;
grant execute on function public.issue_customer_code() to authenticated;
grant execute on function public.resolve_customer_code(uuid, text) to authenticated;
grant execute on function public.enroll_customer_by_code(uuid, text) to authenticated;
