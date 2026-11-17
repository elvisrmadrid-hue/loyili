# Modelo de dominio (borrador)

> Borrador orientativo. Cada tabla se define en detalle (columnas, índices, políticas RLS) en la especificación del módulo que la crea. Las preguntas abiertas de negocio están en [vision.md](../vision.md).

## Diagrama de entidades

```
auth.users (Supabase)
    │ 1:1
profiles ──────────────┬──────────────────────────┐
    │                  │ (como personal)          │ (como cliente)
    │            merchant_members            memberships
    │                  │ N:1                      │ N:1
    │              merchants ◄────────────────────┘
    │                  │ 1:N
    │      ┌───────────┼──────────────┬─────────────┐
    │   branches   loyalty_programs  rewards     point_transactions (ledger)
    │                                  │              ▲
    │                                  │ 1:N          │ 1:1
    │                             redemptions ────────┘
```

## Entidades

| Entidad | Descripción | Módulo |
|---|---|---|
| `profiles` | Datos del usuario (nombre, teléfono). 1:1 con `auth.users` de Supabase. | 1 |
| `merchants` | Comercio: nombre, moneda (editable mientras no haya compras) y código público de unión de 6 caracteres (`join_code`, Módulo 4). | 2 |
| `merchant_members` | Relación usuario ↔ comercio con rol (`owner`, `staff`). | 2 |
| `branches` | Sucursales de un comercio (opcionales). | 2 |
| `merchant_invitations` | Enlaces de invitación de un solo uso (7 días) para unirse como personal. Solo se guarda la huella del código. | 2 |
| `loyalty_programs` | Programa del comercio (uno como máximo): "X puntos por cada Y gastado", redondeando hacia abajo, y estado activo/pausado. Se pausa solo al cambiar la moneda. | 3 |
| `memberships` | Cliente inscrito en un comercio. Única por par (cliente, comercio). Se crea solo con `join_merchant` (enlace o QR del comercio). | 4 |
| `point_transactions` | **Ledger**: cada movimiento de puntos de una membresía. | 5 |
| `rewards` | Recompensas del comercio con su costo en puntos. | 6 |
| `redemptions` | Canje de una recompensa por un cliente, con estado. | 6 |

## Ledger de puntos

Tipos de movimiento:

| Tipo | Signo | Origen |
|---|---|---|
| `EARN` | + | Compra registrada por el personal |
| `REDEEM` | − | Canje de una recompensa |
| `ADJUST` | ± | Ajuste manual autorizado (con motivo obligatorio) |
| `REVERSAL` | ± | Anulación de un movimiento anterior (referencia al original) |
| `EXPIRE` | − | Vencimiento (solo si se define política de vencimiento) |

Columnas previstas: `id`, `merchant_id`, `membership_id`, `type`, `points` (entero con signo), `purchase_amount_minor` (opcional), `currency`, `branch_id`, `created_by`, `idempotency_key`, `reference_id`, `note`, `created_at`.

**Saldo** = suma de `points` de la membresía. Se calcula con una vista o con un saldo materializado que solo actualizan las funciones del ledger (decisión en el Módulo 5).

## Reglas de negocio

1. Los movimientos del ledger nunca se modifican ni se eliminan.
2. El saldo de una membresía nunca puede ser negativo.
3. Una misma operación (misma `idempotency_key` en el mismo comercio) solo se registra una vez.
4. El personal solo opera sobre el comercio al que pertenece.
5. Un cliente solo ve sus propias membresías y movimientos.
6. Los puntos de un comercio solo se canjean en ese comercio.
7. La moneda de un comercio no puede cambiar una vez que tiene compras registradas (se refuerza en la base de datos en el Módulo 5).
8. Puntos de una compra = `floor(monto / monto_del_bloque) × puntos_por_bloque`: solo cuentan los bloques completos. Cambiar la regla solo afecta a compras futuras. Sin programa, o con el programa pausado, no se acreditan puntos (Módulo 5).
9. Un cliente solo puede unirse a un comercio con el programa activo. El dueño y el personal no pueden ser clientes del comercio en el que trabajan (sí de otros).
10. El comercio solo ve el nombre de sus clientes y desde cuándo lo son; nunca su email.

## Estados del canje

```
pending ──► completed
   │
   └──────► cancelled  (genera REVERSAL si ya se descontaron puntos)
```
