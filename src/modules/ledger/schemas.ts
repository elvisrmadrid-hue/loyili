import { z } from "zod";
import { REVERSAL_REASON_MAX, REVERSAL_REASON_MIN } from "./rules";

const NOT_FOUND = "Elige un cliente de la lista.";

/**
 * Purchase form, except the amount: it is parsed with the merchant's currency in the
 * action (parseMoneyAmount), because its format depends on the country.
 */
export const purchaseSchema = z.object({
  membershipId: z.uuid({ error: NOT_FOUND }),
  // Empty means "no branch" (allowed only when the merchant has none; the database checks it).
  branchId: z.union([z.literal("").transform(() => null), z.uuid({ error: "Elige una sucursal." })]),
  idempotencyKey: z.uuid({ error: "Recarga la página e inténtalo de nuevo." }),
});

export const reversalSchema = z.object({
  reason: z
    .string({ error: "Escribe el motivo de la anulación." })
    .trim()
    .min(REVERSAL_REASON_MIN, { error: `El motivo debe tener al menos ${REVERSAL_REASON_MIN} caracteres.` })
    .max(REVERSAL_REASON_MAX, { error: `El motivo no puede tener más de ${REVERSAL_REASON_MAX} caracteres.` }),
});
