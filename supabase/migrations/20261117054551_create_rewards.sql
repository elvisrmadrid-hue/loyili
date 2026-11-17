-- Module 6: rewards catalog and redemption — docs/modules/06-recompensas-canje.md
--
-- * rewards: catalog of each merchant (owner manages it; staff read; customers read active ones).
-- * A redemption is a ledger movement of type REDEEM (negative points) with a copy of the
--   reward name; its cancellation is a REVERSAL that gives the points back. No separate
--   "redemptions" table: there are no pending requests (the cashier redeems at the counter).
-- * Redeeming does NOT require an active program: pausing stops earning, not spending
--   (business rule confirmed on 2026-11-17).

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  name text not null,
  description text,
  points_cost integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rewards_name_length check (char_length(name) between 1 and 80),
  constraint rewards_name_trimmed check (name = btrim(name)),
  constraint rewards_description_valid check (
    description is null or (char_length(description) between 1 and 200 and description = btrim(description))
  ),
  constraint rewards_points_cost_range check (points_cost between 1 and 1000000)
);

comment on table public.rewards is 'Rewards a merchant offers, with their cost in points.';

-- Names are unique per merchant, ignoring case. Also serves merchant_id lookups.
create unique index rewards_merchant_name_unique on public.rewards (merchant_id, lower(name));

create trigger rewards_set_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

alter table public.rewards enable row level security;

create policy "rewards: members can read"
  on public.rewards for select to authenticated
  using ((select private.is_merchant_member(merchant_id)));

create policy "rewards: customers can read active ones"
  on public.rewards for select to authenticated
  using (is_active and (select private.is_merchant_customer(merchant_id)));

create policy "rewards: owners can create"
  on public.rewards for insert to authenticated
  with check ((select private.is_merchant_owner(merchant_id)));

create policy "rewards: owners can update"
  on public.rewards for update to authenticated
  using ((select private.is_merchant_owner(merchant_id)))
  with check ((select private.is_merchant_owner(merchant_id)));

-- Rewards already redeemed cannot be deleted: the ledger's foreign key blocks it.
create policy "rewards: owners can delete"
  on public.rewards for delete to authenticated
  using ((select private.is_merchant_owner(merchant_id)));

revoke all on table public.rewards from anon, authenticated;
grant select, delete on table public.rewards to authenticated;
grant insert (merchant_id, name, description, points_cost, is_active) on table public.rewards to authenticated;
grant update (name, description, points_cost, is_active) on table public.rewards to authenticated;

-- ---------------------------------------------------------------------------
-- Ledger: REDEEM movements
-- ---------------------------------------------------------------------------
alter table public.point_transactions
  -- No cascade: a reward that has been redeemed cannot be deleted.
  add column reward_id uuid references public.rewards (id),
  -- Copy of the reward name when it was redeemed (the cost is -points).
  add column reward_name text;

alter table public.point_transactions drop constraint point_transactions_type;
alter table public.point_transactions
  add constraint point_transactions_type check (type in ('EARN', 'REDEEM', 'REVERSAL'));

alter table public.point_transactions
  add constraint point_transactions_redeem_shape check (
    type <> 'REDEEM' or (
      points < 0
      and reward_id is not null
      and reward_name is not null
      and idempotency_key is not null
      and purchase_amount_minor is null
      and reference_id is null
    )
  );

-- A reversal may now cancel a purchase (negative) or a redemption (positive). The ledger
-- functions always insert the opposite sign of the original movement.
alter table public.point_transactions drop constraint point_transactions_reversal_shape;
alter table public.point_transactions
  add constraint point_transactions_reversal_shape check (
    type <> 'REVERSAL' or (
      reference_id is not null
      and note is not null
      and char_length(note) between 3 and 200
      and note = btrim(note)
    )
  );

create index point_transactions_reward_idx
  on public.point_transactions (reward_id)
  where reward_id is not null;

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- Redeems one unit of a reward for a customer. Owner or staff of the merchant.
-- Replaying the same idempotency key returns the original result without duplicating.
create or replace function public.redeem_reward(
  p_membership_id uuid,
  p_reward_id uuid,
  p_idempotency_key uuid
)
returns table (transaction_id uuid, spent_points integer, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_merchant_id uuid;
  v_balance integer;
  v_existing public.point_transactions%rowtype;
  v_reward public.rewards%rowtype;
  v_currency text;
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

  select * into v_existing
  from public.point_transactions pt
  where pt.merchant_id = v_merchant_id and pt.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.type <> 'REDEEM'
       or v_existing.membership_id <> p_membership_id
       or v_existing.reward_id is distinct from p_reward_id then
      raise exception 'idempotency_conflict';
    end if;
    return query select v_existing.id, -v_existing.points, v_balance;
    return;
  end if;

  select * into v_reward
  from public.rewards r
  where r.id = p_reward_id and r.merchant_id = v_merchant_id and r.is_active;
  if not found then
    raise exception 'reward_not_available';
  end if;

  -- The balance can never be negative.
  if v_balance < v_reward.points_cost then
    raise exception 'insufficient_balance';
  end if;

  select m.currency into v_currency from public.merchants m where m.id = v_merchant_id;

  insert into public.point_transactions (
    merchant_id, membership_id, type, points, currency, reward_id, reward_name, created_by, idempotency_key
  )
  values (
    v_merchant_id, p_membership_id, 'REDEEM', -v_reward.points_cost, v_currency,
    v_reward.id, v_reward.name, v_user_id, p_idempotency_key
  )
  returning id into v_transaction_id;

  update public.memberships
  set points_balance = points_balance - v_reward.points_cost
  where id = p_membership_id
  returning points_balance into v_balance;

  return query select v_transaction_id, v_reward.points_cost, v_balance;
end;
$$;

-- Same as Module 5, now also for redemptions (the reversal gives the points back).
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
  if v_original.type not in ('EARN', 'REDEEM') then
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
  -- Reversing a purchase takes its points away: never below zero.
  if v_balance - v_original.points < 0 then
    raise exception 'insufficient_balance';
  end if;
  if v_balance::bigint - v_original.points > 2147483647 then
    raise exception 'points_overflow';
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

-- Active rewards of a merchant for its public join page. Callable without a session.
-- Exposes only name, description and cost.
create or replace function public.get_public_rewards(p_code text)
returns table (name text, description text, points_cost integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.name, r.description, r.points_cost
  from public.rewards r
  join public.merchants m on m.id = r.merchant_id
  where m.join_code = upper(btrim(p_code)) and r.is_active
  order by r.points_cost, r.name;
$$;

revoke all on function public.redeem_reward(uuid, uuid, uuid) from public, anon;
revoke all on function public.reverse_transaction(uuid, text) from public, anon;
revoke all on function public.get_public_rewards(text) from public;
grant execute on function public.redeem_reward(uuid, uuid, uuid) to authenticated;
grant execute on function public.reverse_transaction(uuid, text) to authenticated;
grant execute on function public.get_public_rewards(text) to anon, authenticated;
