import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currencies";

const merchantName = z
  .string({ error: "Ingresa el nombre del comercio." })
  .trim()
  .min(1, { error: "Ingresa el nombre del comercio." })
  .max(100, { error: "El nombre no puede tener más de 100 caracteres." });

const currency = z.enum(CURRENCY_CODES, { error: "Elige una moneda de la lista." });

export const createMerchantSchema = z.object({ name: merchantName, currency });

export const updateMerchantSchema = z.object({ name: merchantName, currency });

export const branchSchema = z.object({
  name: z
    .string({ error: "Ingresa el nombre de la sucursal." })
    .trim()
    .min(1, { error: "Ingresa el nombre de la sucursal." })
    .max(100, { error: "El nombre no puede tener más de 100 caracteres." }),
  // Empty address means "no address".
  address: z
    .string()
    .trim()
    .max(200, { error: "La dirección no puede tener más de 200 caracteres." })
    .transform((value) => (value === "" ? null : value)),
});

/** IDs that come from the URL or from hidden form fields. */
export const idSchema = z.uuid();

/** Invitation token: 43 base64url characters (32 random bytes). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
