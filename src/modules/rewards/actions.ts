"use server";

import { refresh } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formField, type FormState } from "@/lib/forms";
import { getCurrentUser } from "@/modules/auth";
import { formatPoints } from "@/modules/loyalty";
import { getMembership } from "@/modules/merchants";
import { redeemSchema, rewardSchema } from "./schemas";

const NOT_ALLOWED = "No tienes permiso para hacer esto en este comercio.";
const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";
const DUPLICATE = "Ya existe una recompensa con ese nombre.";

function dbErrorMessage(error: PostgrestError, context: string): string {
  if (error.code === "42501") return NOT_ALLOWED;
  console.error(`[rewards] ${context}:`, error.code, error.message);
  return "No se pudo guardar. Inténtalo de nuevo.";
}

/** The membership if the current user may act (owner, or any member), else an error message. */
async function access(merchantId: string, role?: "owner") {
  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED } as const;
  const membership = await getMembership(merchantId);
  if (!membership || (role === "owner" && membership.role !== "owner")) return { error: NOT_ALLOWED } as const;
  return { membership } as const;
}

const rewardValues = (formData: FormData) => ({
  name: formField(formData, "name"),
  description: formField(formData, "description"),
  pointsCost: formField(formData, "pointsCost"),
});

// ---------------------------------------------------------------------------
// Catalog (owner only)
// ---------------------------------------------------------------------------

export async function createReward(merchantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = rewardValues(formData);
  const parsed = rewardSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const allowed = await access(merchantId, "owner");
  if ("error" in allowed) return { error: allowed.error, values };

  const supabase = await createClient();
  const { error } = await supabase.from("rewards").insert({
    merchant_id: merchantId,
    name: parsed.data.name,
    description: parsed.data.description,
    points_cost: parsed.data.pointsCost,
  });
  if (error?.code === "23505") return { fieldErrors: { name: [DUPLICATE] }, values };
  if (error) return { error: dbErrorMessage(error, "create reward"), values };

  refresh();
  return { message: `Recompensa «${parsed.data.name}» creada.` };
}

export async function updateReward(
  merchantId: string,
  rewardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = rewardValues(formData);
  const parsed = rewardSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!z.uuid().safeParse(rewardId).success) return { error: NOT_ALLOWED, values };

  const allowed = await access(merchantId, "owner");
  if ("error" in allowed) return { error: allowed.error, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewards")
    .update({ name: parsed.data.name, description: parsed.data.description, points_cost: parsed.data.pointsCost })
    .eq("id", rewardId)
    .eq("merchant_id", merchantId)
    .select("id");
  if (error?.code === "23505") return { fieldErrors: { name: [DUPLICATE] }, values };
  if (error) return { error: dbErrorMessage(error, "update reward"), values };
  if (!data?.length) return { error: NOT_ALLOWED, values };

  refresh();
  return { message: "Recompensa actualizada. Los canjes anteriores conservan su costo." };
}

export async function setRewardActive(merchantId: string, rewardId: string, active: boolean): Promise<void> {
  if (!z.uuid().safeParse(rewardId).success) return;
  if ("error" in (await access(merchantId, "owner"))) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("rewards")
    .update({ is_active: active })
    .eq("id", rewardId)
    .eq("merchant_id", merchantId);
  if (error) throw new Error(dbErrorMessage(error, active ? "activate reward" : "deactivate reward"));

  refresh();
}

export async function deleteReward(merchantId: string, rewardId: string): Promise<void> {
  if (!z.uuid().safeParse(rewardId).success) return;
  if ("error" in (await access(merchantId, "owner"))) return;

  const supabase = await createClient();
  const { error } = await supabase.from("rewards").delete().eq("id", rewardId).eq("merchant_id", merchantId);
  // 23503: it has redemptions (the page hides the button in that case; this is the last barrier).
  if (error?.code === "23503") throw new Error("Esta recompensa ya se canjeó y no se puede eliminar. Desactívala.");
  if (error) throw new Error(dbErrorMessage(error, "delete reward"));

  refresh();
}

// ---------------------------------------------------------------------------
// Redemption (owner and staff)
// ---------------------------------------------------------------------------

const REDEEM_ERRORS: Record<string, string> = {
  not_allowed: NOT_ALLOWED,
  reward_not_available: "Esta recompensa ya no está disponible. Recarga la página.",
  insufficient_balance: "El cliente no tiene puntos suficientes para esta recompensa.",
  idempotency_conflict: "Este canje ya se registró. Recarga la página antes de canjear otra vez.",
};

export async function redeemReward(merchantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = redeemSchema.safeParse({
    membershipId: formField(formData, "membershipId"),
    rewardId: formField(formData, "rewardId"),
    idempotencyKey: formField(formData, "idempotencyKey"),
  });
  if (!parsed.success) return { error: z.flattenError(parsed.error).formErrors[0] ?? "Datos no válidos. Recarga la página." };

  const allowed = await access(merchantId);
  if ("error" in allowed) return { error: allowed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_reward", {
    p_membership_id: parsed.data.membershipId,
    p_reward_id: parsed.data.rewardId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const known = REDEEM_ERRORS[error.message];
    if (!known) console.error("[rewards] redeem_reward:", error.code, error.message);
    return { error: known ?? "No se pudo canjear. Inténtalo de nuevo." };
  }

  const result = (data as { spent_points: number; balance: number }[])[0];
  const { currency } = allowed.membership;
  refresh();
  return {
    message: `Canje registrado: −${formatPoints(result.spent_points, currency)}. Nuevo saldo: ${formatPoints(result.balance, currency)}. Entrega la recompensa al cliente.`,
  };
}
