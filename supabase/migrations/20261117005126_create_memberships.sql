-- Module 4: customers join a merchant's program through its public join code.
-- Spec: docs/modules/04-clientes.md
--
-- * merchants.join_code: short public code (6 chars, no 0/O/1/I) used in /unirse/<code>
--   and in the printed QR poster. Not a secret.
-- * memberships: customer <-> merchant (the "card" that Module 5 will credit points to).
-- * Joining goes through join_merchant(): it checks that the program is active and that
--   the caller does not work at that merchant (so nobody can credit points to themselves).

-- ---------------------------------------------------------------------------
-- Join code
-- ---------------------------------------------------------------------------
create or replace function private.generate_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- 32 symbols: 256 is a multiple of 32, so every symbol is equally likely.
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.merchants where join_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.generate_join_code() from public;

alter table public.merchants add column join_code text;
update public.merchants set join_code = private.generate_join_code() where join_code is null;

alter table public.merchants
  alter column join_code set not null,
  alter column join_code set default private.generate_join_code(),
  add constraint merchants_join_code_format check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  add constraint merchants_join_code_unique unique (join_code);

comment on column public.merchants.join_code is
  'Public code customers use to join the program (/unirse/<code>). Generated automatically.';

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint memberships_one_per_customer unique (merchant_id, customer_id)
);

comment on table public.memberships is
  'A customer enrolled in a merchant''s loyalty program. Points (Module 5) belong to a membership.';

-- Wallet lookups ("my programs").
create index memberships_customer_id_idx on public.memberships (customer_id);

-- ---------------------------------------------------------------------------
-- Private helpers used by RLS policies
-- ---------------------------------------------------------------------------
create or replace function private.is_merchant_customer(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships ms
    where ms.merchant_id = p_merchant_id
      and ms.customer_id = (select auth.uid())
  );
$$;

-- True when the given profile is a customer of a merchant the current user works at
-- (lets owners and staff read their customers' names).
create or replace function private.is_customer_of_my_merchant(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships ms
    join public.merchant_members mm on mm.merchant_id = ms.merchant_id
    where ms.customer_id = p_profile_id
      and mm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_merchant_customer(uuid) from public;
revoke all on function private.is_customer_of_my_merchant(uuid) from public;
grant execute on function private.is_merchant_customer(uuid) to authenticated;
grant execute on function private.is_customer_of_my_merchant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.memberships enable row level security;

-- A customer sees their own memberships; owner and staff see their merchant's customers.
-- Rows are created only via join_merchant(); nobody updates or deletes them (out of scope).
create policy "memberships: customers can read their own"
  on public.memberships for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "memberships: merchant members can read their customers"
  on public.memberships for select to authenticated
  using ((select private.is_merchant_member(merchant_id)));

-- Customers can read the merchants they belong to (name in the wallet) and their program
-- (rule in the wallet). They still cannot see branches, team, invitations or other customers.
create policy "merchants: customers can read their merchants"
  on public.merchants for select to authenticated
  using ((select private.is_merchant_customer(id)));

create policy "loyalty_programs: customers can read"
  on public.loyalty_programs for select to authenticated
  using ((select private.is_merchant_customer(merchant_id)));

-- Owner and staff can read their customers' profile (only full_name exists).
create policy "profiles: merchant members can read their customers' profiles"
  on public.profiles for select to authenticated
  using ((select private.is_customer_of_my_merchant(id)));

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
revoke all on table public.memberships from anon, authenticated;
grant select on table public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- What /unirse/<code> shows. Callable without a session. Returns no row if the code
-- does not exist. Exposes only the merchant name, currency and earning rule.
--   program_status: active | paused | none
--   viewer_status:  anonymous | none | customer | member (works at the merchant)
create or replace function public.get_join_preview(p_code text)
returns table (
  merchant_name text,
  currency text,
  points_per_block integer,
  block_amount_minor bigint,
  program_status text,
  viewer_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.name,
    m.currency,
    p.points_per_block,
    p.block_amount_minor,
    case
      when p.merchant_id is null then 'none'
      when p.is_active then 'active'
      else 'paused'
    end,
    case
      when (select auth.uid()) is null then 'anonymous'
      when exists (
        select 1 from public.merchant_members mm
        where mm.merchant_id = m.id and mm.user_id = (select auth.uid())
      ) then 'member'
      when exists (
        select 1 from public.memberships ms
        where ms.merchant_id = m.id and ms.customer_id = (select auth.uid())
      ) then 'customer'
      else 'none'
    end
  from public.merchants m
  left join public.loyalty_programs p on p.merchant_id = m.id
  where m.join_code = upper(btrim(p_code));
$$;

-- Enrolls the caller in the merchant's program. Idempotent: joining twice returns the
-- same merchant without duplicating anything. Returns the merchant id.
create or replace function public.join_merchant(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_merchant_id uuid;
  v_program_active boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select m.id, p.is_active
  into v_merchant_id, v_program_active
  from public.merchants m
  left join public.loyalty_programs p on p.merchant_id = m.id
  where m.join_code = upper(btrim(p_code));

  if v_merchant_id is null then
    raise exception 'join_code_not_found';
  end if;

  if exists (
    select 1 from public.memberships
    where merchant_id = v_merchant_id and customer_id = v_user_id
  ) then
    return v_merchant_id;
  end if;

  if exists (
    select 1 from public.merchant_members
    where merchant_id = v_merchant_id and user_id = v_user_id
  ) then
    raise exception 'merchant_member';
  end if;

  if v_program_active is not true then
    raise exception 'program_not_active';
  end if;

  insert into public.memberships (merchant_id, customer_id)
  values (v_merchant_id, v_user_id)
  on conflict (merchant_id, customer_id) do nothing;

  return v_merchant_id;
end;
$$;

revoke all on function public.get_join_preview(text) from public;
revoke all on function public.join_merchant(text) from public, anon;
grant execute on function public.get_join_preview(text) to anon, authenticated;
grant execute on function public.join_merchant(text) to authenticated;
