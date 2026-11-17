import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Transaction, TransactionType } from "./types";

type TransactionRow = {
  id: string;
  type: TransactionType;
  points: number;
  purchase_amount_minor: number | null;
  currency: string;
  note: string | null;
  created_at: string;
  reference_id: string | null;
  branch?: { name: string } | null;
  author?: { full_name: string } | null;
};

const HISTORY_LIMIT = 100;

/**
 * Points history of a membership, newest first (last 100 movements). RLS: the customer
 * sees their own; owner and staff see their merchant's.
 *   forMerchant: include the branch name (customers cannot read branches).
 *   withAuthor:  include who recorded each movement (the owner's view only, by design).
 */
export async function getTransactions(
  membershipId: string,
  { forMerchant = false, withAuthor = false }: { forMerchant?: boolean; withAuthor?: boolean } = {},
): Promise<Transaction[]> {
  if (!z.uuid().safeParse(membershipId).success) return [];

  const columns = "id, type, points, purchase_amount_minor, currency, note, created_at, reference_id";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("point_transactions")
    .select(
      [columns, forMerchant && "branch:branches(name)", withAuthor && "author:profiles(full_name)"]
        .filter(Boolean)
        .join(", "),
    )
    .eq("membership_id", membershipId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
  const rows = data as unknown as TransactionRow[];
  // A reversal is always newer than its purchase, so both are inside the same window.
  const reversedIds = new Set(rows.filter((row) => row.type === "REVERSAL").map((row) => row.reference_id));

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    points: row.points,
    purchaseAmountMinor: row.purchase_amount_minor === null ? null : Number(row.purchase_amount_minor),
    currency: row.currency,
    note: row.note,
    createdAt: row.created_at,
    branchName: row.branch?.name ?? null,
    authorName: row.author?.full_name ?? null,
    reversed: row.type === "EARN" && reversedIds.has(row.id),
  }));
}

/** Whether the merchant has any movement yet (then its currency is locked). */
export async function merchantHasTransactions(merchantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("point_transactions")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .limit(1);

  if (error) throw new Error(`No se pudo consultar el historial: ${error.message}`);
  return (count ?? 0) > 0;
}
