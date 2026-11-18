import { z } from "zod";
import { normalizeCustomerCode } from "./rules";

export const CODE_FORMAT_ERROR = "El código tiene 8 letras y números, por ejemplo K7P2-QX4M. Revísalo.";

/** A customer code as typed or scanned at the register, normalized ("k7p2-qx4m" → "K7P2QX4M"). */
export const customerCodeSchema = z.string().transform((value, ctx) => {
  const code = normalizeCustomerCode(value);
  if (!code) {
    ctx.addIssue({ code: "custom", message: CODE_FORMAT_ERROR });
    return z.NEVER;
  }
  return code;
});
