# ADR 0006 — El canje es un movimiento del ledger (sin tabla `redemptions`)

- **Fecha**: 2026-11-17
- **Estado**: Aceptada

## Contexto

El modelo de dominio inicial preveía una tabla `redemptions` con estados (`pending` → `completed` / `cancelled`), pensada para que el cliente solicitara un canje y el personal lo confirmara después. En el Módulo 6 se decidió que **el cajero canjea en caja, al momento**. No existen solicitudes pendientes ni puntos reservados.

## Decisión

- Un canje se guarda como un movimiento `REDEEM` en `point_transactions`:
  - puntos negativos (el costo de la recompensa);
  - `reward_id`;
  - copia del nombre de la recompensa (`reward_name`).
- Su anulación es un `REVERSAL` que devuelve los puntos, con la misma función y las mismas reglas que la anulación de una compra (solo el dueño, con motivo, una vez).
- `redeem_reward` sigue el mismo patrón que `record_purchase`: bloqueo de la membresía, clave de idempotencia y saldo nunca negativo. No exige que el programa esté activo: pausar detiene la acumulación, no los canjes.
- La clave foránea `reward_id` no tiene cascada: una recompensa ya canjeada no se puede eliminar, solo desactivar.

## Consecuencias

- Una sola fuente de verdad para el saldo y el historial: el ledger. No hay una segunda tabla que pueda desincronizarse.
- Menos código: el canje reutiliza el bloqueo, la idempotencia, la anulación y la verificación del saldo del Módulo 5.
- Si en el futuro se añaden **solicitudes de canje desde la billetera** (con puntos reservados), habrá que crear una entidad de solicitud con estados. El movimiento `REDEEM` se seguiría insertando al completarla.
