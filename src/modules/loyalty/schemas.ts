import { z } from "zod";
import {
  BLOCK_AMOUNT_MAX,
  BLOCK_AMOUNT_MIN,
  POINTS_PER_BLOCK_MAX,
  POINTS_PER_BLOCK_MIN,
  parseWholeAmount,
} from "./rules";

const POINTS_ERROR = `Escribe un número entero de puntos entre ${POINTS_PER_BLOCK_MIN} y ${POINTS_PER_BLOCK_MAX.toLocaleString("es")}.`;
const AMOUNT_ERROR = `Escribe un monto entero, sin decimales, entre ${BLOCK_AMOUNT_MIN} y ${BLOCK_AMOUNT_MAX.toLocaleString("es")}.`;

/**
 * Earning-rule form. Both fields arrive as text from the form; the block amount is in
 * whole currency units (the action converts it to minor units with the merchant's currency).
 */
export const loyaltyProgramSchema = z.object({
  pointsPerBlock: z
    .string({ error: POINTS_ERROR })
    .trim()
    .regex(/^\d+$/, { error: POINTS_ERROR })
    .transform(Number)
    .pipe(z.number().int().min(POINTS_PER_BLOCK_MIN, { error: POINTS_ERROR }).max(POINTS_PER_BLOCK_MAX, { error: POINTS_ERROR })),
  blockAmount: z
    .string({ error: AMOUNT_ERROR })
    .transform((text, ctx) => {
      const units = parseWholeAmount(text);
      if (units === null) {
        ctx.addIssue({ code: "custom", message: AMOUNT_ERROR });
        return z.NEVER;
      }
      return units;
    })
    .pipe(z.number().int().min(BLOCK_AMOUNT_MIN, { error: AMOUNT_ERROR }).max(BLOCK_AMOUNT_MAX, { error: AMOUNT_ERROR })),
});
