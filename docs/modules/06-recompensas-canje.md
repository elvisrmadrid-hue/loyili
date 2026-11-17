# Módulo 06 — Recompensas y canje

- **Estado**: implementado (2026-11-17), pendiente de prueba manual
- **Fecha**: 2026-11-17

## Objetivo

Que el dueño cree un catálogo de recompensas con su costo en puntos y que el personal las canjee en caja, descontando los puntos al momento y sin dejar nunca un saldo negativo. Los clientes ven el catálogo en su billetera ("te faltan X puntos"), y quien abre el enlace o QR del comercio lo ve antes de unirse.

## Decisiones tomadas (2026-11-17)

| Tema | Decisión | Motivo |
|---|---|---|
| Cómo se canjea | **El cajero canjea en caja**: busca al cliente, elige la recompensa y confirma. Los puntos se descuentan al momento. | Simple, sin canjes pendientes ni puntos reservados. |
| Anular un canje | **Solo el dueño, con motivo.** Los puntos vuelven al cliente con un movimiento nuevo. | Coherente con las compras y con menos riesgo de abusos. |
| Límites de las recompensas | **No por ahora**: sin stock ni fechas. El dueño activa o desactiva cada recompensa. | Se pueden añadir después. |
| Quién ve el catálogo | **Los clientes**, en su billetera, y **cualquiera** en la página pública del enlace o QR. | Animar a unirse y a volver. |

## Propuestas validadas (2026-11-17)

| Tema | Propuesta |
|---|---|
| Quién gestiona el catálogo | Solo el **dueño** crea, edita, activa y desactiva recompensas. El personal ve el catálogo y canjea. |
| Datos de una recompensa | **Nombre** (hasta 80 caracteres, sin repetirse en el comercio), **costo en puntos** (de 1 a 1.000.000) y **descripción** opcional (hasta 200 caracteres). |
| Eliminar una recompensa | Se puede eliminar **solo si nunca se ha canjeado**. Si ya tiene canjes, se desactiva, para que el historial siga diciendo qué se canjeó (igual que con las sucursales). |
| Cambiar el costo | Afecta solo a los **canjes futuros**. Cada canje guarda el nombre y el costo que tenía la recompensa en ese momento. |
| Una unidad por canje | Cada canje es **una unidad**. Para dos cafés gratis, se canjea dos veces. |
| Programa pausado | Pausar el programa **detiene la acumulación, pero no los canjes**: los clientes pueden seguir usando los puntos que ya ganaron. *(Regla de negocio confirmada por el usuario el 2026-11-17.)* |
| Pantalla de caja | La pestaña "Registrar compra" pasa a llamarse **"Caja"**. Tras elegir al cliente, se ven dos secciones: **registrar compra** y **canjear recompensa**. Esta última lista las recompensas activas e indica cuáles le alcanzan al cliente. Así el cajero busca al cliente una sola vez. |
| Confirmación del canje | Al pulsar "Canjear", el navegador pide confirmar ("¿Canjear Café gratis por 100 puntos para Ana?"). Al confirmar se descuentan los puntos y se muestra el nuevo saldo. Lleva clave de idempotencia, igual que las compras. |
| En la billetera | Cada programa muestra su catálogo: las recompensas que ya le alcanzan ("¡Ya puedes canjearla! Pídela en caja") y las demás con "te faltan X puntos". |
| En la página pública | Debajo de la regla, la lista de recompensas activas (nombre y costo). |
| Cómo se guarda un canje | Como un **movimiento del ledger** de tipo `REDEEM`, con puntos negativos, la recompensa y una copia de su nombre y costo. No se crea una tabla aparte de "canjes": como no hay solicitudes pendientes, el canje es el propio movimiento. Su anulación es un `REVERSAL` que devuelve los puntos, igual que con las compras. Esto simplifica lo previsto en el modelo de dominio (tabla `redemptions` con estados), que se actualizará. |

## Alcance

**Incluye**
- Tabla `rewards` con RLS.
- Movimiento `REDEEM` en el ledger y función `redeem_reward`, atómica y con idempotencia.
- Anulación de canjes por el dueño, ampliando `reverse_transaction`.
- Panel:
  - pestaña **Recompensas**: el dueño gestiona el catálogo y el personal lo ve;
  - la pestaña "Registrar compra" pasa a ser **Caja**, con compra y canje.
- El historial del cliente muestra los canjes y el dueño puede anularlos.
- Billetera: catálogo con lo que le falta al cliente para cada recompensa.
- Página pública `/unirse/[código]`: lista de recompensas activas.
- Script de verificación ampliado.

**No incluye**
- Solicitudes de canje desde la billetera, o canjes que haga el propio cliente.
- Stock, fechas de vigencia, imágenes o categorías de recompensas.
- Varias unidades en un mismo canje.
- QR del cliente: Módulo 7.

## Historias de usuario

- Como **dueño**, quiero **crear recompensas con su costo en puntos** para **que mis clientes tengan algo que ganar**.
- Como **cajero**, quiero **canjear una recompensa al cliente que tengo delante** y **ver si le alcanzan los puntos**.
- Como **dueño**, quiero **anular un canje hecho por error, con un motivo**, devolviendo los puntos.
- Como **cliente**, quiero **ver qué recompensas puedo canjear y cuánto me falta para las demás**.
- Como **visitante**, quiero **ver las recompensas antes de unirme** para **decidir si me interesa**.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_rewards.sql`

**Tabla `public.rewards`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `merchant_id` | `uuid` | FK → `merchants(id) on delete cascade` |
| `name` | `text` | 1–80 caracteres, sin espacios sobrantes; único por comercio (sin distinguir mayúsculas) |
| `description` | `text` | opcional, hasta 200 caracteres |
| `points_cost` | `integer` | 1–1.000.000 |
| `is_active` | `boolean` | `not null default true` |
| `created_at`, `updated_at` | `timestamptz` | como en las demás tablas |

**Cambios en `public.point_transactions`**
- Nuevo tipo `REDEEM`: puntos negativos (el costo), con `reward_id` (FK → `rewards`, **sin cascada**: una recompensa canjeada no se puede eliminar) y `reward_name` (copia del nombre). Lleva clave de idempotencia; no lleva monto de compra.
- `REVERSAL` puede anular una compra (resta puntos) o un canje (devuelve puntos). Su signo siempre es el contrario del movimiento original.

**Funciones**

| Función | Quién | Qué hace (en una sola transacción) |
|---|---|---|
| `redeem_reward(membership_id, reward_id, idempotency_key)` | dueño y personal | Comprueba que la recompensa sea del comercio y esté activa. Después bloquea la membresía, comprueba que el saldo alcance, inserta el `REDEEM`, resta el saldo y devuelve los puntos gastados y el nuevo saldo. Si la clave ya se usó, devuelve el resultado anterior. |
| `reverse_transaction(transaction_id, reason)` (ampliada) | dueño | Acepta también canjes: inserta un `REVERSAL` que devuelve los puntos. |
| `get_public_rewards(code)` | cualquiera | Recompensas activas (nombre, descripción y costo) de un comercio, para la página pública. No expone nada más. |

**Políticas RLS y permisos**

| Tabla | Leer | Crear | Modificar | Borrar |
|---|---|---|---|---|
| `rewards` | dueño y personal (todas); clientes del comercio (solo las activas) | dueño | dueño (`name`, `description`, `points_cost`, `is_active`) | dueño, solo si nunca se canjeó |

## Lógica de servidor

`src/modules/rewards/` (módulo nuevo)
- `schemas.ts`: recompensa (nombre, descripción, costo) y canje (membresía, recompensa, clave).
- `queries.ts`:
  - `getRewards(merchantId)`: panel;
  - `getActiveRewards(merchantId)`: caja y billetera;
  - `getPublicRewards(code)`: página pública.
- `actions.ts`:
  - `createReward`, `updateReward`, `setRewardActive` y `deleteReward` (solo el dueño);
  - `redeemReward` (dueño y personal).

Cambios en otros módulos:
- `ledger`: el historial muestra los canjes; la anulación acepta canjes.
- Panel: la página de caja reúne compra y canje.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/panel/[merchantId]/recompensas` | miembros | Catálogo con nombre, costo, descripción y estado (Activa / Inactiva). **Dueño**: formulario para añadir y, en cada recompensa, editar, activar o desactivar, y eliminar (solo si nunca se canjeó). **Personal**: solo lectura. |
| `/panel/[merchantId]/caja` (antes `/compra`) | dueño y personal | Buscar cliente → saldo → **Registrar compra** y **Canjear recompensa** (lista de recompensas activas: "Canjear" si le alcanza, "Le faltan X puntos" si no). Sin recompensas activas: "Este comercio aún no tiene recompensas". Si el programa está pausado, el canje sigue disponible. |
| `/panel/[merchantId]/clientes/[membershipId]` | miembros | El historial muestra "Canje: Café gratis −100 puntos". El dueño puede anularlo con motivo. |
| `/wallet/[merchantId]` | cliente | Debajo del saldo, el catálogo: "¡Ya puedes canjearla! Pídela en caja" o "Te faltan X puntos". |
| `/unirse/[código]` | cualquiera | Lista de recompensas activas debajo de la regla. |
| Menú del comercio | miembros | Nueva pestaña **Recompensas**; "Registrar compra" pasa a llamarse **Caja**. |

## Criterios de aceptación

- [ ] La migración se aplica con `npx supabase db push --remote` y crea `rewards` con RLS activado.
- [ ] El dueño crea, edita, activa y desactiva recompensas. No se permiten nombres repetidos ni costos fuera de rango.
- [ ] Una recompensa sin canjes se puede eliminar; una con canjes no (se explica y se ofrece desactivarla).
- [ ] El cajero busca al cliente, ve qué recompensas le alcanzan y canjea una; el saldo baja exactamente su costo.
- [ ] No se puede canjear sin saldo suficiente, ni una recompensa inactiva o de otro comercio (ni desde la pantalla ni desde la API).
- [ ] Enviar dos veces el mismo canje (misma clave) lo registra una sola vez.
- [ ] El historial muestra el canje con el nombre y el costo del momento, aunque después cambien.
- [ ] El dueño anula un canje con motivo y los puntos vuelven al cliente; el personal no puede anular.
- [ ] El cliente ve el catálogo en su billetera, con lo que le falta para cada recompensa.
- [ ] La página pública muestra las recompensas activas sin iniciar sesión.
- [ ] El personal no puede crear, editar ni eliminar recompensas; un cliente no ve las inactivas; un comercio no ve las recompensas de otro (comprobado con script).
- [ ] El saldo sigue coincidiendo con la suma de los movimientos (comprobado con script).
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build y `npm test`.
- **RLS y ledger**: `npm run verify:rls` ampliado:
  - catálogo: quién crea, edita, ve y elimina recompensas;
  - canje: saldo insuficiente, recompensa inactiva o ajena, idempotencia y copia del nombre y el costo;
  - anulación de canjes;
  - el saldo sigue igual a la suma de los movimientos;
  - recompensas públicas por código.
- **Pruebas de humo** que envían los formularios de verdad: crear una recompensa, canjear, intentar canjear sin saldo y anular un canje.
- **Manual en el navegador**: el dueño crea el catálogo, el cajero canjea, el dueño anula y el cliente ve su catálogo; la página pública muestra las recompensas.

**Resultado automático (2026-11-17)**:
- lint, typecheck y build sin errores;
- `npm test` 29/29;
- `verify:rls` 187/187 (32 nuevas: catálogo, canje, idempotencia, saldo insuficiente, recompensas inactivas o ajenas, canje con el programa pausado, copia del nombre y el costo, borrado bloqueado, anulación de canjes y saldo igual a la suma);
- prueba de humo (script temporal, no versionado) que envía los formularios de verdad: 17/17. Cubre crear recompensas, nombre repetido, canjear en caja, anular el canje, desactivar, el catálogo de la billetera y la página pública.
- Sin regresiones en las pruebas de humo de los Módulos 2 a 5 (la ruta de caja cambió de `/compra` a `/caja`).

Decisión técnica en el [ADR 0006](../architecture/adr/0006-canje-como-movimiento-del-ledger.md).

Falta la prueba manual en el navegador.

## Preguntas abiertas

- [ ] ¿Stock o fechas de vigencia? Descartado por ahora.
- [ ] ¿Imágenes de las recompensas? Fuera de alcance; requeriría almacenamiento de archivos (Supabase Storage).
- [ ] ¿Solicitudes de canje desde la billetera? Descartado por ahora.
