"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/forms";
import { getCurrentUser } from "@/modules/auth";
import { normalizeJoinCode } from "./rules";

const JOIN_ERRORS: Record<string, string> = {
  join_code_not_found: "Este código no corresponde a ningún comercio. Revisa el enlace o el QR.",
  program_not_active: "Este comercio no tiene su programa activo en este momento. Inténtalo más tarde.",
  merchant_member: "Trabajas en este comercio, así que no puedes unirte como cliente.",
};

/** Joins the merchant's program and goes to the wallet. Joining twice is harmless. */
export async function joinMerchant(rawCode: string): Promise<FormState> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return { error: JOIN_ERRORS.join_code_not_found };
  if (!(await getCurrentUser())) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_merchant", { p_code: code });
  if (error) {
    const known = JOIN_ERRORS[error.message];
    if (!known) console.error("[customers] join_merchant:", error.code, error.message);
    return { error: known ?? "No se pudo completar. Inténtalo de nuevo." };
  }

  redirect(`/wallet?nuevo=${data as string}`);
}
