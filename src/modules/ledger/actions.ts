"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, formField, type FormState } from "@/lib/forms";
import { formatMoney } from "@/lib/currencies";
import { getCurrentUser } from "@/modules/auth";
import { formatPoints } from "@/modules/loyalty";
import { getMembership } from "@/modules/merchants";
import { maxPurchaseMinor, parseMoneyAmount } from "./rules";
import { purchaseSchema, reversalSchema } from "./schemas";

const NOT_ALLOWED = "No tienes permiso para hacer esto en este comercio.";
const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";
const GENERIC = "No se pudo completar. Inténtalo de nuevo.";

/** Database errors raised by record_purchase / reverse_transaction, in plain Spanish. */
const LEDGER_ERRORS: Record<string, { field?: string; message: string }> = {
  not_allowed: { message: NOT_ALLOWED },
  program_not_active: { message: "El programa de puntos no está activo. El dueño debe activarlo en «Programa»." },
  branch_required: { field: "branchId", message: "Elige la sucursal donde se hizo la compra." },
  invalid_branch: { field: "branchId", message: "Elige una sucursal de la lista." },
  invalid_amount: { field: "amount", message: "Revisa el monto de la compra." },
  points_overflow: { field: "amount", message: "Esta compra daría demasiados puntos. Revisa el monto." },
  idempotency_conflict: { message: "Esta compra ya se registró. Recarga la página antes de registrar otra." },
  already_reversed: { message: "Esta compra ya fue anulada." },
  not_reversible: { message: "Solo se pueden anular compras." },
  insufficient_balance: {
    message: "El cliente ya no tiene suficientes puntos para anular esta compra (el saldo no puede quedar negativo).",
  },
  invalid_reason: { field: "reason", message: "Escribe el motivo de la anulación (al menos 3 caracteres)." },
};

function ledgerError(error: { code?: string; message: string }, context: string, values?: Record<string, string>): FormState {
  const known = LEDGER_ERRORS[error.message];
  if (!known) console.error(`[ledger] ${context}:`, error.code, error.message);
  const message = known?.message ?? GENERIC;
  return known?.field ? { fieldErrors: { [known.field]: [message] }, values } : { error: message, values };
}

/** Registers a purchase (owner or staff) and credits its points. */
export async function recordPurchase(merchantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    membershipId: formField(formData, "membershipId"),
    amount: formField(formData, "amount"),
    branchId: formField(formData, "branchId"),
    idempotencyKey: formField(formData, "idempotencyKey"),
  };
  const parsed = purchaseSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED, values };
  const membership = await getMembership(merchantId);
  if (!membership) return { error: NOT_ALLOWED, values };

  const { currency } = membership;
  const amountMinor = parseMoneyAmount(values.amount, currency);
  if (amountMinor === null || amountMinor <= 0) {
    return { fieldErrors: { amount: ["Escribe el monto de la compra, por ejemplo como en el ejemplo del campo."] }, values };
  }
  if (amountMinor > maxPurchaseMinor(currency)) {
    return {
      fieldErrors: { amount: [`El monto máximo por compra es ${formatMoney(maxPurchaseMinor(currency), currency)}.`] },
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_purchase", {
    p_membership_id: parsed.data.membershipId,
    p_amount_minor: amountMinor,
    p_branch_id: parsed.data.branchId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return ledgerError(error, "record_purchase", values);

  const result = (data as { earned_points: number; balance: number }[])[0];
  refresh();
  return {
    message: `Compra de ${formatMoney(amountMinor, currency)} registrada: +${formatPoints(result.earned_points, currency)}. Nuevo saldo: ${formatPoints(result.balance, currency)}.`,
  };
}

/** Cancels a purchase with a reason (owner only). */
export async function reverseTransaction(
  merchantId: string,
  transactionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { reason: formField(formData, "reason") };
  const parsed = reversalSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  if (!(await getCurrentUser())) return { error: SESSION_EXPIRED, values };
  const membership = await getMembership(merchantId);
  if (!membership || membership.role !== "owner") return { error: NOT_ALLOWED, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reverse_transaction", {
    p_transaction_id: transactionId,
    p_reason: parsed.data.reason,
  });
  if (error) return ledgerError(error, "reverse_transaction", values);

  const result = (data as { reversed_points: number; balance: number }[])[0];
  refresh();
  return {
    message: `Compra anulada: ${formatPoints(Math.abs(result.reversed_points), membership.currency)} descontados. Nuevo saldo: ${formatPoints(result.balance, membership.currency)}.`,
  };
}
