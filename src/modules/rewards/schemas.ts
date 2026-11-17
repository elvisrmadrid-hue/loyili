import { z } from "zod";

export const REWARD_COST_MIN = 1;
export const REWARD_COST_MAX = 1_000_000;

const COST_ERROR = `Escribe un número entero de puntos entre ${REWARD_COST_MIN} y ${REWARD_COST_MAX.toLocaleString("es")}.`;

export const rewardSchema = z.object({
  name: z
    .string({ error: "Escribe el nombre de la recompensa." })
    .trim()
    .min(1, { error: "Escribe el nombre de la recompensa." })
    .max(80, { error: "El nombre no puede tener más de 80 caracteres." }),
  // Empty description means "no description".
  description: z
    .string()
    .trim()
    .max(200, { error: "La descripción no puede tener más de 200 caracteres." })
    .transform((value) => (value === "" ? null : value)),
  pointsCost: z
    .string({ error: COST_ERROR })
    .trim()
    .regex(/^\d+$/, { error: COST_ERROR })
    .transform(Number)
    .pipe(z.number().int().min(REWARD_COST_MIN, { error: COST_ERROR }).max(REWARD_COST_MAX, { error: COST_ERROR })),
});

export const redeemSchema = z.object({
  membershipId: z.uuid({ error: "Elige un cliente." }),
  rewardId: z.uuid({ error: "Elige una recompensa." }),
  idempotencyKey: z.uuid({ error: "Recarga la página e inténtalo de nuevo." }),
});
