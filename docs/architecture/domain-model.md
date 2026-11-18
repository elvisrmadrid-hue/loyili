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
    │   branches   loyalty_programs  rewards ──► point_transactions (ledger)
    │                                        (REDEEM: canje de una recompensa)
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
| `memberships` | Cliente inscrito en un comercio. Única por par (cliente, comercio). Se crea con `join_merchant` (enlace o QR del comercio) o, desde caja, con `enroll_customer_by_code` (código del cliente, Módulo 7). | 4 |
| `point_transactions` | **Ledger** inmutable: cada movimiento de puntos de una membresía (`EARN` y `REVERSAL` desde el Módulo 5), con copia de la regla aplicada. | 5 |
| `rewards` | Recompensas del comercio con su costo en puntos (activas o inactivas). Una recompensa canjeada no se puede eliminar. | 6 |
| ~~`redemptions`~~ | No existe: un canje es un movimiento `REDEEM` del ledger ([ADR 0006](adr/0006-canje-como-movimiento-del-ledger.md)). | 6 |
| `customer_codes` | Código temporal (5 minutos) de cada persona para identificarse en caja con su QR. Uno vigente por persona; solo se guarda su huella ([ADR 0007](adr/0007-codigo-temporal-del-cliente.md)). | 7 |

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

**Saldo** = suma de `points` de la membresía. Se guarda materializado en `memberships.points_balance`, que solo actualizan las funciones del ledger en la misma transacción ([ADR 0005](adr/0005-saldo-materializado-y-forma-del-ledger.md)).

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
11. Solo el dueño anula compras y canjes, con motivo obligatorio, una vez por movimiento y sin dejar el saldo negativo. Una sucursal con compras no se puede eliminar.
12. El canje lo hace el personal en caja, una unidad por canje. Pausar el programa detiene la acumulación, no los canjes. Cambiar el costo de una recompensa solo afecta a los canjes futuros.
13. El cliente se identifica en caja con un código temporal (5 minutos) de su billetera. Un comercio solo puede saber de quién es un código si se lo muestran; si la persona no es cliente, ve su nombre y puede unirla (con el programa activo).

## Canje

El canje se registra al momento en caja como un movimiento `REDEEM`; su anulación es un `REVERSAL` que devuelve los puntos. No hay estados pendientes ([ADR 0006](adr/0006-canje-como-movimiento-del-ledger.md)).
