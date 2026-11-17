# ADR 0005 — Saldo materializado y forma del ledger

- **Fecha**: 2026-11-16
- **Estado**: Aceptada (concreta el [ADR 0002](0002-ledger-inmutable.md))

## Contexto

El ADR 0002 decidió un ledger inmutable con saldo derivado de los movimientos, y dejó para el Módulo 5 cómo calcular el saldo: sumando cada vez, o guardándolo aparte. También había que concretar cómo se impide modificar el ledger, cómo se evitan duplicados y cómo se audita el cálculo.

## Decisión

1. **Saldo materializado** en `memberships.points_balance`.
   - Solo lo cambian las funciones del ledger (`record_purchase`, `reverse_transaction`), en la misma transacción que insertan el movimiento.
   - Nadie tiene permiso para modificarlo directamente.
   - Una restricción `check` impide que sea negativo.
   - `npm run verify:rls` comprueba que coincide con la suma de los movimientos.
2. **Bloqueo de fila**: cada operación bloquea la membresía (`select … for update`) antes de leer el saldo. Dos operaciones simultáneas sobre el mismo cliente se ejecutan una detrás de otra.
3. **Inmutabilidad en dos capas**: sin permisos de `update`, `delete` ni `truncate`, y además un trigger que los rechaza por si alguien los concediera por error.
4. **Idempotencia**:
   - una compra por (`merchant_id`, `idempotency_key`); repetir la clave devuelve el resultado original, y usarla para una compra distinta se rechaza;
   - una anulación por compra (índice único sobre `reference_id`).
5. **Copia de la regla aplicada** en cada compra (`rule_points_per_block`, `rule_block_amount_minor`) y de la moneda. Así el cálculo se puede auditar aunque la regla cambie después.
6. **Claves foráneas sin cascada** desde el ledger: una sucursal con compras no se puede eliminar.
7. **Funciones `security definer`** para escribir, con comprobación explícita del rol dentro de la función. RLS solo concede lectura.

## Consecuencias

- Leer el saldo es inmediato (una columna), aunque un cliente tenga miles de movimientos.
- El saldo y el historial no pueden desincronizarse: se escriben juntos o no se escribe ninguno.
- Borrar una membresía con movimientos (por ejemplo, si un cliente borra su cuenta) queda bloqueado por las claves foráneas. Habrá que decidir qué hacer cuando exista esa función.
- Cada nuevo tipo de movimiento (`REDEEM`, `ADJUST`, `EXPIRE`) se añadirá en su módulo, ampliando la restricción de tipos y con su propia función atómica.
