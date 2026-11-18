"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { qrSvgDataUrl } from "@/lib/qr";
import { formField, type FormState } from "@/lib/forms";
import { getCurrentUser } from "@/modules/auth";
import { getMembership } from "@/modules/merchants";
import { formatCustomerCode } from "./rules";
import { customerCodeSchema } from "./schemas";
import type { IssuedCode } from "./types";

const NOT_ALLOWED = "No tienes permiso para hacer esto en este comercio.";
const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";
const CODE_INVALID = "Código no válido o caducado. Pide al cliente que lo actualice en su billetera.";

// ---------------------------------------------------------------------------
// Customer: "Mi código"
// ---------------------------------------------------------------------------

/**
 * Issues a new code for the signed-in person (replacing the previous one) with its QR.
 * Used by the "Mi código" page when it loads and by the wallet to renew it before it expires.
 */
export async function issueMyCode(): Promise<IssuedCode | { error: string }> {
  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_customer_code");
  const row = (data as { code: string; valid_seconds: number }[] | null)?.[0];
  if (error || !row) {
    console.error("[identification] issue_customer_code:", error?.code, error?.message);
    return { error: "No se pudo generar tu código. Revisa tu conexión." };
  }

  const display = formatCustomerCode(row.code);
  return { display, qr: await qrSvgDataUrl(display), validSeconds: row.valid_seconds };
}

// ---------------------------------------------------------------------------
// Register: identify and enroll (owner and staff)
// ---------------------------------------------------------------------------

/** The current user's membership in the merchant, or an error message. */
async function access(merchantId: string) {
  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED } as const;
  const membership = await getMembership(merchantId);
  if (!membership) return { error: NOT_ALLOWED } as const;
  return { membership } as const;
}

type Resolution = { status: string; full_name: string | null; membership_id: string | null };

/**
 * Looks up the code typed or scanned at the register. A customer opens straight away;
 * someone who is not a customer yet comes back as `values.status = "not_customer"` so the
 * register can offer to enroll them.
 */
export async function identifyCustomer(merchantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formField(formData, "code");
  const parsed = customerCodeSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: { code: [parsed.error.issues[0].message] }, values: { code: raw } };

  const allowed = await access(merchantId);
  if ("error" in allowed) return { error: allowed.error, values: { code: raw } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_customer_code", {
    p_merchant_id: merchantId,
    p_code: parsed.data,
  });
  const found = (data as Resolution[] | null)?.[0];
  if (error || !found) {
    if (error?.code === "42501") return { error: NOT_ALLOWED };
    console.error("[identification] resolve_customer_code:", error?.code, error?.message);
    return { error: "No se pudo comprobar el código. Inténtalo de nuevo.", values: { code: raw } };
  }

  const name = found.full_name ?? "Esta persona";
  switch (found.status) {
    case "customer":
      redirect(`/panel/${merchantId}/caja?cliente=${found.membership_id}`);
    case "not_customer":
      return { values: { code: formatCustomerCode(parsed.data), status: "not_customer", name } };
    case "member":
      return { error: `${name} trabaja en este comercio, así que no puede sumar puntos ni canjear aquí.` };
    default:
      return { error: CODE_INVALID, values: { code: raw } };
  }
}

const ENROLL_ERRORS: Record<string, string> = {
  not_allowed: NOT_ALLOWED,
  code_invalid: CODE_INVALID,
  merchant_member: "Esta persona trabaja en este comercio, así que no puede ser cliente aquí.",
  program_not_active: "El programa de puntos no está activo: no se pueden unir clientes nuevos.",
};

/** Enrolls the owner of the code in the program and opens them at the register. */
export async function enrollCustomer(merchantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerCodeSchema.safeParse(formField(formData, "code"));
  if (!parsed.success) return { error: CODE_INVALID };

  const allowed = await access(merchantId);
  if ("error" in allowed) return { error: allowed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enroll_customer_by_code", {
    p_merchant_id: merchantId,
    p_code: parsed.data,
  });
  if (error) {
    const known = ENROLL_ERRORS[error.message];
    if (!known) console.error("[identification] enroll_customer_by_code:", error.code, error.message);
    return { error: known ?? "No se pudo unir al cliente. Inténtalo de nuevo." };
  }

  redirect(`/panel/${merchantId}/caja?cliente=${data as string}&nuevo=1`);
}
