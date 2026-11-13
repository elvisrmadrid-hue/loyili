-- Module 3: loyalty program (earning rule) of each merchant.
-- Spec: docs/modules/03-programa-fidelizacion.md
--
-- Rule: "points_per_block points for every block_amount_minor spent", rounded down:
--   points = floor(purchase_amount_minor / block_amount_minor) * points_per_block
-- (applied by the Module 5 ledger functions; Module 3 only stores the rule).
--
-- Security model: same as Module 2. RLS enabled, explicit column privileges,
-- policies based on the private.is_merchant_member/owner helpers.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.loyalty_programs (
  -- One program per merchant.
  merchant_id uuid primary key references public.merchants (id) on delete cascade,
  points_per_block integer not null,
  -- Block amount in the merchant currency's minor units (cents), like all money in Loyili.
  block_amount_minor bigint not null,
  -- Paused programs keep their rule; Module 5 will not credit points while paused.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint loyalty_programs_points_range check (points_per_block between 1 and 1000),
  constraint loyalty_programs_block_positive check (block_amount_minor > 0)
);

comment on table public.loyalty_programs is
  'Earning rule of a merchant: points_per_block points per block_amount_minor spent (rounded down).';

create trigger loyalty_programs_set_updated_at
  before update on public.loyalty_programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Changing the merchant currency pauses its program: "1 point per 1,000" means
-- something very different in another currency, so the owner must review it.
-- ---------------------------------------------------------------------------
create or replace function private.pause_program_on_currency_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.loyalty_programs
  set is_active = false
  where merchant_id = new.id
    and is_active;
  return null;
end;
$$;

revoke all on function private.pause_program_on_currency_change() from public;

create trigger merchants_pause_program_on_currency_change
  after update of currency on public.merchants
  for each row
  when (old.currency is distinct from new.currency)
  execute function private.pause_program_on_currency_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.loyalty_programs enable row level security;

-- Members (owner and staff) read the rule; only the owner creates and edits it.
-- Nobody deletes it: the owner pauses it instead.
create policy "loyalty_programs: members can read"
  on public.loyalty_programs for select to authenticated
  using ((select private.is_merchant_member(merchant_id)));

create policy "loyalty_programs: owners can create"
  on public.loyalty_programs for insert to authenticated
  with check ((select private.is_merchant_owner(merchant_id)));

create policy "loyalty_programs: owners can update"
  on public.loyalty_programs for update to authenticated
  using ((select private.is_merchant_owner(merchant_id)))
  with check ((select private.is_merchant_owner(merchant_id)));

-- ---------------------------------------------------------------------------
-- Table privileges (WHAT each role may do; RLS decides on WHICH rows)
-- ---------------------------------------------------------------------------
revoke all on table public.loyalty_programs from anon, authenticated;
grant select on table public.loyalty_programs to authenticated;
grant insert (merchant_id, points_per_block, block_amount_minor, is_active)
  on table public.loyalty_programs to authenticated;
grant update (points_per_block, block_amount_minor, is_active)
  on table public.loyalty_programs to authenticated;
