import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { LoyaltyProgram } from "./types";

type ProgramRow = {
  merchant_id: string;
  points_per_block: number;
  block_amount_minor: number;
  is_active: boolean;
  updated_at: string;
};

/** The merchant's program, or null if it has none yet (RLS: members only). */
export const getLoyaltyProgram = cache(async (merchantId: string): Promise<LoyaltyProgram | null> => {
  if (!z.uuid().safeParse(merchantId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loyalty_programs")
    .select("merchant_id, points_per_block, block_amount_minor, is_active, updated_at")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el programa: ${error.message}`);
  if (!data) return null;
  const row = data as ProgramRow;
  return {
    merchantId: row.merchant_id,
    pointsPerBlock: row.points_per_block,
    blockAmountMinor: Number(row.block_amount_minor),
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
});
