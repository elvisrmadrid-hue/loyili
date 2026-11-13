"use server";

import { refresh } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formField, type FormState } from "@/lib/forms";
import { getCurrentUser } from "@/modules/auth";
import { getMembership, type MerchantMembership } from "@/modules/merchants";
import { getLoyaltyProgram } from "./queries";
import { toMinorUnits } from "./rules";
import { loyaltyProgramSchema } from "./schemas";

const NOT_ALLOWED = "No tienes permiso para hacer esto en este comercio.";
const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";

function dbErrorMessage(error: PostgrestError, context: string): string {
  if (error.code === "42501") return NOT_ALLOWED;
  console.error(`[loyalty] ${context}:`, error.code, error.message);
  return "No se pudo guardar. Inténtalo de nuevo.";
}

/** Server-side owner check (RLS enforces it again in the database). */
async function ownerMembership(
  merchantId: string,
): Promise<{ membership: MerchantMembership } | { error: string }> {
  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED };
  const membership = await getMembership(merchantId);
  if (!membership || membership.role !== "owner") return { error: NOT_ALLOWED };
  return { membership };
}

/** Creates the program (active) or updates its rule, keeping its current status. */
export async function saveLoyaltyProgram(
  merchantId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    pointsPerBlock: formField(formData, "pointsPerBlock"),
    blockAmount: formField(formData, "blockAmount"),
  };
  const parsed = loyaltyProgramSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const access = await ownerMembership(merchantId);
  if ("error" in access) return { error: access.error, values };

  const rule = {
    points_per_block: parsed.data.pointsPerBlock,
    block_amount_minor: toMinorUnits(parsed.data.blockAmount, access.membership.currency),
  };
  const supabase = await createClient();
  const existing = await getLoyaltyProgram(merchantId);

  if (existing) {
    const { data, error } = await supabase
      .from("loyalty_programs")
      .update(rule)
      .eq("merchant_id", merchantId)
      .select("merchant_id");
    if (error) return { error: dbErrorMessage(error, "update program"), values };
    if (!data?.length) return { error: NOT_ALLOWED, values };

    refresh();
    return {
      message: existing.isActive
        ? "Regla actualizada. Se aplicará a las próximas compras."
        : "Regla actualizada. El programa sigue pausado: pulsa «Reanudar» para volver a dar puntos.",
    };
  }

  const { error } = await supabase
    .from("loyalty_programs")
    .insert({ merchant_id: merchantId, ...rule, is_active: true });
  if (error?.code === "23505") {
    return { error: "El programa ya existe. Recarga la página para ver su regla actual.", values };
  }
  if (error) return { error: dbErrorMessage(error, "create program"), values };

  refresh();
  return { message: "¡Programa creado! Ya está activo." };
}

/** Pauses (false) or resumes (true) the program. The rule is kept either way. */
export async function setLoyaltyProgramActive(merchantId: string, active: boolean): Promise<void> {
  const access = await ownerMembership(merchantId);
  if ("error" in access) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("loyalty_programs")
    .update({ is_active: active })
    .eq("merchant_id", merchantId);
  if (error) throw new Error(dbErrorMessage(error, active ? "resume program" : "pause program"));

  refresh();
}
