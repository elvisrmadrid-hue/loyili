import { createClient } from "@/lib/supabase/server";
import type { ReportPeriod } from "./rules";
import type { MerchantReport } from "./types";

// Shape of the JSON built by get_merchant_report() (snake_case, numbers may arrive as numbers).
type RawReport = {
  currency: string;
  customers: { total: number; new: number; active: number };
  purchases: { count: number; amount_minor: number };
  points: { earned: number; redeemed: number; in_circulation: number };
  redemptions: {
    count: number;
    top_rewards: { reward_id: string | null; name: string; count: number; points: number }[];
  };
  branches: { id: string | null; name: string | null; count: number; amount_minor: number }[];
  top_customers: { membership_id: string; full_name: string; count: number; amount_minor: number; points: number }[];
};

/**
 * The owner's report for a period, computed in the database. Returns null if the current
 * user is not the owner (the function refuses).
 */
export async function getMerchantReport(merchantId: string, period: ReportPeriod): Promise<MerchantReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_merchant_report", {
    p_merchant_id: merchantId,
    p_days: period.days,
  });
  if (error) {
    if (error.code !== "42501") console.error("[reports] get_merchant_report:", error.code, error.message);
    return null;
  }

  const raw = data as RawReport;
  return {
    currency: raw.currency,
    customers: raw.customers,
    purchases: { count: raw.purchases.count, amountMinor: Number(raw.purchases.amount_minor) },
    points: { earned: raw.points.earned, redeemed: raw.points.redeemed, inCirculation: raw.points.in_circulation },
    redemptions: {
      count: raw.redemptions.count,
      topRewards: raw.redemptions.top_rewards.map((r) => ({ rewardId: r.reward_id, name: r.name, count: r.count, points: r.points })),
    },
    branches: raw.branches.map((b) => ({ id: b.id, name: b.name, count: b.count, amountMinor: Number(b.amount_minor) })),
    topCustomers: raw.top_customers.map((c) => ({
      membershipId: c.membership_id,
      fullName: c.full_name,
      count: c.count,
      amountMinor: Number(c.amount_minor),
      points: c.points,
    })),
  };
}
