import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth";
import { normalizeJoinCode } from "./rules";
import type {
  Customer,
  JoinPreview,
  JoinViewerStatus,
  ProgramStatus,
  WalletMembership,
} from "./types";

type PreviewRow = {
  merchant_name: string;
  currency: string;
  points_per_block: number | null;
  block_amount_minor: number | null;
  program_status: ProgramStatus;
  viewer_status: JoinViewerStatus;
};

type WalletRow = {
  id: string;
  created_at: string;
  points_balance: number;
  merchant: {
    id: string;
    name: string;
    currency: string;
    program: { points_per_block: number; block_amount_minor: number; is_active: boolean } | null;
  };
};

type CustomerRow = {
  id: string;
  created_at: string;
  points_balance: number;
  customer: { full_name: string } | null;
};

const CUSTOMER_SELECT = "id, created_at, points_balance, customer:profiles(full_name)";

const toCustomer = (row: CustomerRow): Customer => ({
  membershipId: row.id,
  fullName: row.customer?.full_name ?? "Cliente",
  joinedAt: row.created_at,
  pointsBalance: row.points_balance,
});

/** What the join page shows, or null if the code does not belong to any merchant. Works signed out. */
export async function getJoinPreview(rawCode: string): Promise<JoinPreview | null> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_join_preview", { p_code: code });
  if (error) throw new Error(`No se pudo leer el comercio: ${error.message}`);

  const row = (data as PreviewRow[])[0];
  if (!row) return null;
  return {
    code,
    merchantName: row.merchant_name,
    currency: row.currency,
    rule:
      row.points_per_block !== null && row.block_amount_minor !== null
        ? { pointsPerBlock: row.points_per_block, blockAmountMinor: Number(row.block_amount_minor) }
        : null,
    programStatus: row.program_status,
    viewerStatus: row.viewer_status,
  };
}

/** Programs the signed-in user has joined, oldest first (RLS: own memberships only). */
export const getMyMemberships = cache(async (): Promise<WalletMembership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, created_at, points_balance, merchant:merchants!inner(id, name, currency, program:loyalty_programs(points_per_block, block_amount_minor, is_active))",
    )
    .eq("customer_id", user.id)
    .order("created_at");

  if (error) throw new Error(`No se pudieron leer tus programas: ${error.message}`);
  return (data as unknown as WalletRow[]).map((row) => ({
    id: row.id,
    merchantId: row.merchant.id,
    merchantName: row.merchant.name,
    currency: row.merchant.currency,
    joinedAt: row.created_at,
    pointsBalance: row.points_balance,
    program: row.merchant.program
      ? {
          pointsPerBlock: row.merchant.program.points_per_block,
          blockAmountMinor: Number(row.merchant.program.block_amount_minor),
          isActive: row.merchant.program.is_active,
        }
      : null,
  }));
});

/** Customers of a merchant, newest first (RLS: owner and staff only). */
export async function getCustomers(merchantId: string): Promise<Customer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(CUSTOMER_SELECT)
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return (data as unknown as CustomerRow[]).map(toCustomer);
}

/**
 * Customers whose name contains `text` (case-insensitive), newest first, at most 20.
 * With an empty text, the 10 most recent customers. RLS: owner and staff only.
 */
export async function searchCustomers(merchantId: string, text: string): Promise<Customer[]> {
  const term = text.trim().slice(0, 100);
  const supabase = await createClient();
  let query = supabase
    .from("memberships")
    .select("id, created_at, points_balance, customer:profiles!inner(full_name)")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(term ? 20 : 10);
  if (term) {
    // Escape the LIKE wildcards so "%" or "_" typed by the cashier are matched literally.
    query = query.ilike("customer.full_name", `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron buscar clientes: ${error.message}`);
  return (data as unknown as CustomerRow[]).map(toCustomer);
}

/** One customer of a merchant, or null if the membership is not from that merchant. */
export async function getCustomer(merchantId: string, membershipId: string): Promise<Customer | null> {
  if (!z.uuid().safeParse(membershipId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(CUSTOMER_SELECT)
    .eq("merchant_id", merchantId)
    .eq("id", membershipId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el cliente: ${error.message}`);
  return data ? toCustomer(data as unknown as CustomerRow) : null;
}

/** The signed-in customer's membership in a merchant (for the wallet history), or null. */
export async function getMyMembership(merchantId: string): Promise<WalletMembership | null> {
  if (!z.uuid().safeParse(merchantId).success) return null;
  const memberships = await getMyMemberships();
  return memberships.find((membership) => membership.merchantId === merchantId) ?? null;
}

/** Number of customers of a merchant (RLS: owner and staff only). */
export async function getCustomerCount(merchantId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);

  if (error) throw new Error(`No se pudo contar los clientes: ${error.message}`);
  return count ?? 0;
}
