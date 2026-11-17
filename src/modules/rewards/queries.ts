import { createClient } from "@/lib/supabase/server";
import { normalizeJoinCode } from "@/modules/customers";
import type { CatalogReward, PublicReward, Reward } from "./types";

type RewardRow = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
  redemptions?: { count: number }[];
};

const toReward = (row: RewardRow): Reward => ({
  id: row.id,
  name: row.name,
  description: row.description,
  pointsCost: row.points_cost,
  isActive: row.is_active,
});

/** Full catalog for the merchant panel: active first, then by cost (RLS: owner and staff). */
export async function getRewards(merchantId: string): Promise<CatalogReward[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewards")
    .select("id, name, description, points_cost, is_active, redemptions:point_transactions(count)")
    .eq("merchant_id", merchantId)
    .order("is_active", { ascending: false })
    .order("points_cost")
    .order("name");

  if (error) throw new Error(`No se pudieron leer las recompensas: ${error.message}`);
  return (data as unknown as RewardRow[]).map((row) => ({
    ...toReward(row),
    hasRedemptions: (row.redemptions?.[0]?.count ?? 0) > 0,
  }));
}

/** Active rewards, cheapest first (cash register and wallet; customers only see active ones). */
export async function getActiveRewards(merchantId: string): Promise<Reward[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewards")
    .select("id, name, description, points_cost, is_active")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .order("points_cost")
    .order("name");

  if (error) throw new Error(`No se pudieron leer las recompensas: ${error.message}`);
  return (data as RewardRow[]).map(toReward);
}

/** Active rewards for the public join page (works signed out). */
export async function getPublicRewards(rawCode: string): Promise<PublicReward[]> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_rewards", { p_code: code });
  if (error) throw new Error(`No se pudieron leer las recompensas: ${error.message}`);
  return (data as { name: string; description: string | null; points_cost: number }[]).map((row) => ({
    name: row.name,
    description: row.description,
    pointsCost: row.points_cost,
  }));
}
