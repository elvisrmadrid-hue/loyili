-- Module 5: points ledger (earning) — see ADR 0002 and docs/modules/05-ledger-acumulacion.md
--
-- * point_transactions is append-only: no UPDATE/DELETE privileges, plus a trigger that
--   rejects them anyway. Corrections are new rows (REVERSAL).
-- * memberships.points_balance is a materialized balance, changed ONLY by the ledger
--   functions in the same transaction that inserts the movement. Never negative.
-- * record_purchase / reverse_transaction lock the membership row (FOR UPDATE), so two
--   concurrent operations on the same customer are serialized.
-- * Idempotency: one EARN per (merchant, idempotency_key); one REVERSAL per purchase.

-- ---------------------------------------------------------------------------
-- Balance
-- ---------------------------------------------------------------------------
alter table public.memberships
  add column points_balance integer not null default 0,
  add constraint memberships_points_balance_non_negative check (points_balance >= 0);

comment on column public.memberships.points_balance is
  'Sum of the membership''s point_transactions. Maintained only by the ledger functions.';

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id),
  membership_id uuid not null references public.memberships (id),
  type text not null,
  -- Signed integer: EARN >= 0, REVERSAL <= 0.
  points integer not null,
  -- Purchase amount in minor units (EARN).
  purchase_amount_minor bigint,
  -- Merchant currency when the movement was recorded.
  currency text not null,
  -- Copy of the rule applied (EARN), so the calculation can be audited later.
  rule_points_per_block integer,
  rule_block_amount_minor bigint,
  -- No cascade: a branch with movements cannot be deleted.
  branch_id uuid references public.branches (id),
  created_by uuid not null references public.profiles (id),
  idempotency_key uuid,
  -- REVERSAL: the purchase it cancels.
  reference_id uuid references public.point_transactions (id),
  -- REVERSAL: reason (required).
  note text,
  created_at timestamptz not null default now(),

  constraint point_transactions_type check (type in ('EARN', 'REVERSAL')),
  constraint point_transactions_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint point_transactions_earn_shape check (
    type <> 'EARN' or (
      points >= 0
      and purchase_amount_minor > 0
      and rule_points_per_block is not null
      and rule_block_amount_minor is not null
      and idempotency_key is not null
      and reference_id is null
    )
  ),
  constraint point_transactions_reversal_shape check (
    type <> 'REVERSAL' or (
      points <= 0
      and reference_id is not null
      and note is not null
      and char_length(note) between 3 and 200
      and note = btrim(note)
    )
  ),
  constraint point_transactions_idempotency unique (merchant_id, idempotency_key)
);

comment on table public.point_transactions is
  'Append-only points ledger. Rows are never updated or deleted; corrections are new rows.';

-- One reversal per purchase.
create unique index point_transactions_one_reversal
  on public.point_transactions (reference_id)
  where type = 'REVERSAL';

-- History of a membership, newest first.
create index point_transactions_membership_idx
  on public.point_transactions (membership_id, created_at desc);
-- Merchant-wide lookups (reports, "has any movement?").
create index point_transactions_merchant_idx
  on public.point_transactions (merchant_id, created_at desc);
-- Foreign key lookups when a branch is deleted.
create index point_transactions_branch_idx
  on public.point_transactions (branch_id)
  where branch_id is not null;

-- Defense in depth: even if someone grants UPDATE/DELETE by mistake, the ledger stays intact.
create or replace function private.reject_ledger_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'point_transactions_immutable' using errcode = '42501';
end;
$$;

revoke all on function private.reject_ledger_changes() from public;

create trigger point_transactions_no_update_delete
  before update or delete on public.point_transactions
  for each row execute function private.reject_ledger_changes();

create trigger point_transactions_no_truncate
  before truncate on public.point_transactions
  for each statement execute function private.reject_ledger_changes();

-- ---------------------------------------------------------------------------
-- Locks on other tables
-- ---------------------------------------------------------------------------

-- The currency cannot change once the merchant has movements (domain rule 7).
create or replace function private.reject_currency_change_with_movements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.point_transactions where merchant_id = new.id) then
    raise exception 'currency_locked';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_currency_change_with_movements() from public;

create trigger merchants_lock_currency_with_movements
  before update of currency on public.merchants
  for each row
  when (old.currency is distinct from new.currency)
  execute function private.reject_currency_change_with_movements();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
create or replace function private.is_my_membership(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships ms
    where ms.id = p_membership_id and ms.customer_id = (select auth.uid())
  );
$$;

revoke all on function private.is_my_membership(uuid) from public;
grant execute on function private.is_my_membership(uuid) to authenticated;

alter table public.point_transactions enable row level security;

create policy "point_transactions: customers can read their own"
  on public.point_transactions for select to authenticated
  using ((select private.is_my_membership(membership_id)));

create policy "point_transactions: merchant members can read"
  on public.point_transactions for select to authenticated
  using ((select private.is_merchant_member(merchant_id)));

revoke all on table public.point_transactions from anon, authenticated;
grant select on table public.point_transactions to authenticated;
-- memberships keeps only SELECT for authenticated (Module 4): points_balance is not writable.

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- Records a purchase and credits its points. Owner or staff of the membership's merchant.
-- Replaying the same idempotency key returns the original result without duplicating.
create or replace function public.record_purchase(
  p_membership_id uuid,
  p_amount_minor bigint,
  p_branch_id uuid,
  p_idempotency_key uuid
)
returns table (transaction_id uuid, earned_points integer, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Generous last-resort cap; the app enforces 100,000,000 currency units per purchase.
  c_max_amount_minor constant bigint := 10000000000;
  v_user_id uuid := (select auth.uid());
  v_merchant_id uuid;
  v_balance integer;
  v_currency text;
  v_points_per_block integer;
  v_block_amount_minor bigint;
  v_is_active boolean;
  v_existing public.point_transactions%rowtype;
  v_points bigint;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency_key_required';
  end if;

  -- Lock the customer's membership: concurrent operations on it wait here.
  select ms.merchant_id, ms.points_balance
  into v_merchant_id, v_balance
  from public.memberships ms
  where ms.id = p_membership_id
  for update;

  if v_merchant_id is null or not exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = v_merchant_id and mm.user_id = v_user_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Same request again (double click, retry): return what was recorded the first time.
  select * into v_existing
  from public.point_transactions pt
  where pt.merchant_id = v_merchant_id and pt.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.membership_id <> p_membership_id
       or v_existing.purchase_amount_minor is distinct from p_amount_minor then
      raise exception 'idempotency_conflict';
    end if;
    return query select v_existing.id, v_existing.points, v_balance;
    return;
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > c_max_amount_minor then
    raise exception 'invalid_amount';
  end if;

  select p.points_per_block, p.block_amount_minor, p.is_active
  into v_points_per_block, v_block_amount_minor, v_is_active
  from public.loyalty_programs p
  where p.merchant_id = v_merchant_id;
  if v_is_active is not true then
    raise exception 'program_not_active';
  end if;

  if p_branch_id is null then
    if exists (select 1 from public.branches b where b.merchant_id = v_merchant_id) then
      raise exception 'branch_required';
    end if;
  elsif not exists (
    select 1 from public.branches b where b.id = p_branch_id and b.merchant_id = v_merchant_id
  ) then
    raise exception 'invalid_branch';
  end if;

  select m.currency into v_currency from public.merchants m where m.id = v_merchant_id;

  -- Rounding down: only complete blocks count (integer division of positive numbers).
  v_points := (p_amount_minor / v_block_amount_minor) * v_points_per_block;
  if v_balance + v_points > 2147483647 then
    raise exception 'points_overflow';
  end if;

  insert into public.point_transactions (
    merchant_id, membership_id, type, points, purchase_amount_minor, currency,
    rule_points_per_block, rule_block_amount_minor, branch_id, created_by, idempotency_key
  )
  values (
    v_merchant_id, p_membership_id, 'EARN', v_points::integer, p_amount_minor, v_currency,
    v_points_per_block, v_block_amount_minor, p_branch_id, v_user_id, p_idempotency_key
  )
  returning id into v_transaction_id;

  update public.memberships
  set points_balance = points_balance + v_points::integer
  where id = p_membership_id
  returning points_balance into v_balance;

  return query select v_transaction_id, v_points::integer, v_balance;
end;
$$;

-- Cancels a purchase by inserting a REVERSAL. Owner only, with a reason, once per purchase,
-- and never leaving a negative balance.
create or replace function public.reverse_transaction(p_transaction_id uuid, p_reason text)
returns table (reversal_id uuid, reversed_points integer, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original public.point_transactions%rowtype;
  v_balance integer;
  v_reversal_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 200 then
    raise exception 'invalid_reason';
  end if;

  select * into v_original from public.point_transactions pt where pt.id = p_transaction_id;
  if not found or not exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = v_original.merchant_id and mm.user_id = v_user_id and mm.role = 'owner'
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_original.type <> 'EARN' then
    raise exception 'not_reversible';
  end if;

  select ms.points_balance into v_balance
  from public.memberships ms
  where ms.id = v_original.membership_id
  for update;

  if exists (
    select 1 from public.point_transactions pt
    where pt.reference_id = v_original.id and pt.type = 'REVERSAL'
  ) then
    raise exception 'already_reversed';
  end if;
  if v_balance - v_original.points < 0 then
    raise exception 'insufficient_balance';
  end if;

  begin
    insert into public.point_transactions (
      merchant_id, membership_id, type, points, currency, branch_id, created_by, reference_id, note
    )
    values (
      v_original.merchant_id, v_original.membership_id, 'REVERSAL', -v_original.points,
      v_original.currency, v_original.branch_id, v_user_id, v_original.id, v_reason
    )
    returning id into v_reversal_id;
  exception when unique_violation then
    raise exception 'already_reversed';
  end;

  update public.memberships
  set points_balance = points_balance - v_original.points
  where id = v_original.membership_id
  returning points_balance into v_balance;

  return query select v_reversal_id, -v_original.points, v_balance;
end;
$$;

revoke all on function public.record_purchase(uuid, bigint, uuid, uuid) from public, anon;
revoke all on function public.reverse_transaction(uuid, text) from public, anon;
grant execute on function public.record_purchase(uuid, bigint, uuid, uuid) to authenticated;
grant execute on function public.reverse_transaction(uuid, text) to authenticated;
