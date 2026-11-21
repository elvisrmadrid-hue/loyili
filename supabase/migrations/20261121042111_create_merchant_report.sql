-- Module 9: merchant reports — docs/modules/09-reportes.md
--
-- One function computes the whole report inside the database (no table changes):
-- * Owner only (staff, customers and other merchants get not_allowed).
-- * Period: the last 7, 30 or 90 days counted back from now, or null = since the beginning.
--   "Last N days" needs no time zone (calendar months or daily charts would).
-- * A purchase (EARN) or a redemption (REDEEM) counts only if it was NOT reversed, even if
--   the reversal happened later or in another period: a corrected mistake inflates nothing.
-- * Active customer = at least one counted purchase or redemption in the period.
-- * Points in circulation = sum of all customers' balances today (independent of the period).
-- The existing index point_transactions (merchant_id, created_at desc) serves the date filter.

create or replace function public.get_merchant_report(p_merchant_id uuid, p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_report jsonb;
begin
  if not private.is_merchant_owner(p_merchant_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_days is not null and p_days not in (7, 30, 90) then
    raise exception 'invalid_period';
  end if;
  v_since := case when p_days is null then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;

  with counted as (
    -- Purchases and redemptions of the period that were not reversed.
    select t.*
    from public.point_transactions t
    where t.merchant_id = p_merchant_id
      and t.type in ('EARN', 'REDEEM')
      and t.created_at >= v_since
      and not exists (
        select 1 from public.point_transactions r
        where r.reference_id = t.id and r.type = 'REVERSAL'
      )
  ),
  purchases as (select * from counted where type = 'EARN'),
  redemptions as (select * from counted where type = 'REDEEM')
  select jsonb_build_object(
    'currency', (select m.currency from public.merchants m where m.id = p_merchant_id),
    'customers', jsonb_build_object(
      'total', (select count(*) from public.memberships ms where ms.merchant_id = p_merchant_id),
      'new', (select count(*) from public.memberships ms where ms.merchant_id = p_merchant_id and ms.created_at >= v_since),
      'active', (select count(distinct c.membership_id) from counted c)
    ),
    'purchases', jsonb_build_object(
      'count', (select count(*) from purchases),
      'amount_minor', (select coalesce(sum(p.purchase_amount_minor), 0) from purchases p)
    ),
    'points', jsonb_build_object(
      'earned', (select coalesce(sum(p.points), 0) from purchases p),
      'redeemed', (select coalesce(-sum(r.points), 0) from redemptions r),
      'in_circulation', (select coalesce(sum(ms.points_balance), 0) from public.memberships ms where ms.merchant_id = p_merchant_id)
    ),
    'redemptions', jsonb_build_object(
      'count', (select count(*) from redemptions),
      'top_rewards', (
        select coalesce(jsonb_agg(x order by x.count desc, x.name), '[]'::jsonb)
        from (
          select
            r.reward_id,
            -- Current name if the reward still exists, otherwise the copy kept in the ledger.
            coalesce(rw.name, (array_agg(r.reward_name order by r.created_at desc))[1]) as name,
            count(*) as count,
            -sum(r.points) as points
          from redemptions r
          left join public.rewards rw on rw.id = r.reward_id
          group by r.reward_id, rw.name
          order by count(*) desc, name
          limit 5
        ) x
      )
    ),
    -- Every branch of the merchant (also with no purchases), plus purchases without a branch.
    'branches', (
      select coalesce(jsonb_agg(b order by b.amount_minor desc, b.name), '[]'::jsonb)
      from (
        select br.id, br.name, count(p.id) as count, coalesce(sum(p.purchase_amount_minor), 0) as amount_minor
        from public.branches br
        left join purchases p on p.branch_id = br.id
        where br.merchant_id = p_merchant_id
        group by br.id, br.name
        union all
        select null, null, count(*), coalesce(sum(p.purchase_amount_minor), 0)
        from purchases p
        where p.branch_id is null
          and exists (select 1 from public.branches br where br.merchant_id = p_merchant_id)
        having count(*) > 0
      ) b
    ),
    'top_customers', (
      select coalesce(jsonb_agg(x order by x.amount_minor desc, x.full_name), '[]'::jsonb)
      from (
        select p.membership_id, pr.full_name, count(*) as count,
               sum(p.purchase_amount_minor) as amount_minor, sum(p.points) as points
        from purchases p
        join public.memberships ms on ms.id = p.membership_id
        join public.profiles pr on pr.id = ms.customer_id
        group by p.membership_id, pr.full_name
        order by sum(p.purchase_amount_minor) desc, pr.full_name
        limit 5
      ) x
    )
  )
  into v_report;

  return v_report;
end;
$$;

revoke all on function public.get_merchant_report(uuid, integer) from public, anon;
grant execute on function public.get_merchant_report(uuid, integer) to authenticated;
