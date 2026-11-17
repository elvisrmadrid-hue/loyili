"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { fieldErrorsOf, formField, type FormState } from "@/lib/forms";
import { getCurrentUser } from "@/modules/auth";
import { getMembership } from "./queries";
import {
  branchSchema,
  createMerchantSchema,
  idSchema,
  invitationTokenSchema,
  updateMerchantSchema,
} from "./schemas";
import type { InvitationLinkState } from "./types";

const NOT_ALLOWED = "No tienes permiso para hacer esto en este comercio.";
const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";

function dbErrorMessage(error: PostgrestError, context: string): string {
  if (error.code === "42501") return NOT_ALLOWED;
  console.error(`[merchants] ${context}:`, error.code, error.message);
  return "No se pudo guardar. Inténtalo de nuevo.";
}

/**
 * Server-side role check (RLS enforces it again in the database).
 * Returns an error message, or null if the current user may act.
 */
async function denyUnlessMember(merchantId: string, role?: "owner"): Promise<string | null> {
  if (!idSchema.safeParse(merchantId).success) return NOT_ALLOWED;
  if (!(await getCurrentUser())) return SESSION_EXPIRED;
  const membership = await getMembership(merchantId);
  if (!membership) return NOT_ALLOWED;
  if (role === "owner" && membership.role !== "owner") return NOT_ALLOWED;
  return null;
}

// ---------------------------------------------------------------------------
// Merchant
// ---------------------------------------------------------------------------

export async function createMerchant(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { name: formField(formData, "name"), currency: formField(formData, "currency") };
  const parsed = createMerchantSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_merchant", {
    p_name: parsed.data.name,
    p_currency: parsed.data.currency,
  });
  if (error) return { error: dbErrorMessage(error, "create_merchant"), values };

  redirect(`/panel/${data as string}`);
}

export async function updateMerchant(
  merchantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { name: formField(formData, "name"), currency: formField(formData, "currency") };
  const parsed = updateMerchantSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const denied = await denyUnlessMember(merchantId, "owner");
  if (denied) return { error: denied, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merchants")
    .update({ name: parsed.data.name, currency: parsed.data.currency })
    .eq("id", merchantId)
    .select("id");
  if (error?.message === "currency_locked") {
    return {
      fieldErrors: { currency: ["La moneda ya no se puede cambiar: tu comercio tiene compras registradas."] },
      values,
    };
  }
  if (error) return { error: dbErrorMessage(error, "update merchant"), values };
  if (!data?.length) return { error: NOT_ALLOWED, values };

  refresh();
  return { message: "Cambios guardados." };
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

const DUPLICATE_BRANCH = "Ya existe una sucursal con ese nombre.";

export async function createBranch(
  merchantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { name: formField(formData, "name"), address: formField(formData, "address") };
  const parsed = branchSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const denied = await denyUnlessMember(merchantId, "owner");
  if (denied) return { error: denied, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .insert({ merchant_id: merchantId, name: parsed.data.name, address: parsed.data.address });
  if (error?.code === "23505") return { fieldErrors: { name: [DUPLICATE_BRANCH] }, values };
  if (error) return { error: dbErrorMessage(error, "create branch"), values };

  refresh();
  return { message: `Sucursal «${parsed.data.name}» creada.` };
}

export async function updateBranch(
  merchantId: string,
  branchId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { name: formField(formData, "name"), address: formField(formData, "address") };
  const parsed = branchSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!idSchema.safeParse(branchId).success) return { error: NOT_ALLOWED, values };

  const denied = await denyUnlessMember(merchantId, "owner");
  if (denied) return { error: denied, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .update({ name: parsed.data.name, address: parsed.data.address })
    .eq("id", branchId)
    .eq("merchant_id", merchantId)
    .select("id");
  if (error?.code === "23505") return { fieldErrors: { name: [DUPLICATE_BRANCH] }, values };
  if (error) return { error: dbErrorMessage(error, "update branch"), values };
  if (!data?.length) return { error: NOT_ALLOWED, values };

  refresh();
  return { message: "Sucursal actualizada." };
}

export async function deleteBranch(merchantId: string, branchId: string): Promise<void> {
  if (!idSchema.safeParse(branchId).success) return;
  if (await denyUnlessMember(merchantId, "owner")) return;

  const supabase = await createClient();
  const { error } = await supabase.from("branches").delete().eq("id", branchId).eq("merchant_id", merchantId);
  // 23503: the branch has purchases (the page hides the button in that case; this is the last barrier).
  if (error?.code === "23503") throw new Error("Esta sucursal tiene compras registradas y no se puede eliminar.");
  if (error) throw new Error(dbErrorMessage(error, "delete branch"));

  refresh();
}

// ---------------------------------------------------------------------------
// Team and invitations
// ---------------------------------------------------------------------------

// The previous form state (passed by useActionState) is not needed, so it is not declared.
export async function createInvitation(merchantId: string): Promise<InvitationLinkState> {
  const denied = await denyUnlessMember(merchantId, "owner");
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_merchant_invitation", { p_merchant_id: merchantId });
  if (error) return { error: dbErrorMessage(error, "create invitation") };

  refresh();
  return { url: `${getSiteUrl()}/invitacion/${data as string}` };
}

export async function revokeInvitation(merchantId: string, invitationId: string): Promise<void> {
  if (!idSchema.safeParse(invitationId).success) return;
  if (await denyUnlessMember(merchantId, "owner")) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("merchant_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("merchant_id", merchantId)
    .is("accepted_at", null);
  if (error) throw new Error(dbErrorMessage(error, "revoke invitation"));

  refresh();
}

export async function removeMember(merchantId: string, userId: string): Promise<void> {
  if (!idSchema.safeParse(userId).success) return;
  if (await denyUnlessMember(merchantId, "owner")) return;

  const supabase = await createClient();
  // RLS only lets the owner delete staff rows, never the owner row.
  const { error } = await supabase
    .from("merchant_members")
    .delete()
    .eq("merchant_id", merchantId)
    .eq("user_id", userId)
    .eq("role", "staff");
  if (error) throw new Error(dbErrorMessage(error, "remove member"));

  refresh();
}

const INVITATION_ERRORS: Record<string, string> = {
  invitation_not_found: "Esta invitación no existe o fue revocada. Pide un enlace nuevo al dueño del comercio.",
  invitation_used: "Esta invitación ya se usó. Pide un enlace nuevo al dueño del comercio.",
  invitation_expired: "Esta invitación venció. Pide un enlace nuevo al dueño del comercio.",
};

export async function acceptInvitation(token: string): Promise<FormState> {
  if (!invitationTokenSchema.safeParse(token).success) {
    return { error: INVITATION_ERRORS.invitation_not_found };
  }
  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_merchant_invitation", { p_token: token });
  if (error) {
    return { error: INVITATION_ERRORS[error.message] ?? dbErrorMessage(error, "accept invitation") };
  }

  redirect(`/panel/${data as string}`);
}
