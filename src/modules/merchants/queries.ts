import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth";
import { idSchema, invitationTokenSchema } from "./schemas";
import type {
  Branch,
  InvitationPreview,
  InvitationStatus,
  MerchantMembership,
  MerchantRole,
  PendingInvitation,
  TeamMember,
} from "./types";

// Shapes returned by Supabase for the selects below (no generated DB types yet).
type MembershipRow = {
  role: MerchantRole;
  merchant: { id: string; name: string; currency: string; join_code: string };
};
type TeamRow = {
  user_id: string;
  role: MerchantRole;
  created_at: string;
  profile: { full_name: string } | null;
};

const MEMBERSHIP_SELECT = "role, merchant:merchants!inner(id, name, currency, join_code)";

const toMembership = (row: MembershipRow): MerchantMembership => ({
  id: row.merchant.id,
  name: row.merchant.name,
  currency: row.merchant.currency,
  joinCode: row.merchant.join_code,
  role: row.role,
});

/** Merchants the signed-in user belongs to (as owner or staff), oldest first. */
export const getMyMerchants = cache(async (): Promise<MerchantMembership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchant_members")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", user.id)
    .order("created_at");

  if (error) throw new Error(`No se pudieron leer tus comercios: ${error.message}`);
  return (data as unknown as MembershipRow[]).map(toMembership);
});

/**
 * The merchant with the signed-in user's role in it, or null if the id is invalid,
 * the merchant does not exist or the user is not a member (pages answer 404 in all cases).
 */
export const getMembership = cache(async (merchantId: string): Promise<MerchantMembership | null> => {
  if (!idSchema.safeParse(merchantId).success) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchant_members")
    .select(MEMBERSHIP_SELECT)
    .eq("merchant_id", merchantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el comercio: ${error.message}`);
  return data ? toMembership(data as unknown as MembershipRow) : null;
});

/** Branches of a merchant, alphabetically (RLS: members only). */
export async function getBranches(merchantId: string): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, address")
    .eq("merchant_id", merchantId)
    .order("name");

  if (error) throw new Error(`No se pudieron leer las sucursales: ${error.message}`);
  return data as Branch[];
}

/** People in a merchant: owner first, then staff by join date (RLS: owner only). */
export async function getTeam(merchantId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchant_members")
    .select("user_id, role, created_at, profile:profiles(full_name)")
    .eq("merchant_id", merchantId)
    .order("created_at");

  if (error) throw new Error(`No se pudo leer el personal: ${error.message}`);
  return (data as unknown as TeamRow[])
    .map((row) => ({
      userId: row.user_id,
      fullName: row.profile?.full_name ?? "Usuario",
      role: row.role,
      joinedAt: row.created_at,
    }))
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
}

/** Invitations not accepted yet, newest first (RLS: owner only). */
export async function getPendingInvitations(merchantId: string): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchant_invitations")
    .select("id, created_at, expires_at")
    .eq("merchant_id", merchantId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No se pudieron leer las invitaciones: ${error.message}`);
  const now = Date.now();
  return (data as { id: string; created_at: string; expires_at: string }[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    expired: new Date(row.expires_at).getTime() <= now,
  }));
}

/** What the invitation screen shows. Malformed tokens are reported as not found. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  if (!invitationTokenSchema.safeParse(token).success) {
    return { status: "not_found", merchantName: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token });
  if (error) throw new Error(`No se pudo leer la invitación: ${error.message}`);

  const row = (data as { merchant_name: string | null; status: InvitationStatus }[])[0];
  return row
    ? { status: row.status, merchantName: row.merchant_name }
    : { status: "not_found", merchantName: null };
}

/**
 * Where a signed-in user should land after signing in: the panel of their only
 * merchant, the merchant list if they have several, or the wallet if none.
 */
export async function getHomePathForCurrentUser(): Promise<string> {
  const merchants = await getMyMerchants();
  if (merchants.length === 1) return `/panel/${merchants[0].id}`;
  if (merchants.length > 1) return "/panel";
  return "/wallet";
}
