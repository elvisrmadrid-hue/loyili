# Módulo 05 — Ledger de puntos: acumulación

- **Estado**: verificado (2026-11-17)
- **Fecha**: 2026-11-16

## Objetivo

Que el personal del comercio registre una compra de un cliente y se le acrediten los puntos que marca la regla del programa, de forma segura, sin duplicados y con un historial que nunca se borra. El cliente ve su saldo y sus movimientos en la billetera; el comercio, el saldo y el historial de cada cliente. El dueño puede anular una compra registrada por error.

## Decisiones tomadas (2026-11-16)

| Tema | Decisión | Motivo |
|---|---|---|
| Identificar al cliente en caja | **Buscar por nombre** en la lista de clientes del comercio. | Es lo más simple. El QR del Módulo 7 lo hará más rápido y sin confusiones entre nombres iguales. |
| Anular una compra | **Solo el dueño**, indicando un motivo. La anulación no borra nada: crea un movimiento que descuenta esos puntos. | Reduce el riesgo de abusos. |
| Ajustes manuales de puntos | **No por ahora.** | Mantiene el módulo enfocado en compras. El movimiento `ADJUST` queda previsto para más adelante. |
| Sucursal con compras | **No se puede eliminar**; se le puede cambiar el nombre. | El historial siempre dice en qué local se hizo cada compra. |

Ya decidido en módulos anteriores y que aquí se hace realidad:
- puntos = `floor(monto / monto_del_bloque) × puntos_por_bloque`;
- sin programa, o con el programa pausado, no se acreditan puntos;
- la moneda deja de poder cambiarse en cuanto el comercio tiene su primera compra.

## Propuestas validadas (2026-11-16)

| Tema | Propuesta |
|---|---|
| Quién registra compras | El **dueño y el personal**. |
| Monto con centavos | El monto de la compra se escribe **como se escribe en el país de la moneda**: "25.500" en pesos colombianos, "12.50" en dólares o pesos mexicanos. Se aceptan centavos en las monedas que los tienen (no en CLP ni PYG). Los centavos nunca cambian los puntos, porque el bloque de la regla es un monto entero, pero el historial guarda el monto exacto. |
| Tope por compra | Hasta **100.000.000** unidades de la moneda por compra, para evitar errores de escritura (un cero de más). No es una regla de negocio; se puede ampliar. |
| Antes de registrar | El formulario muestra el nombre del cliente y **cuántos puntos va a recibir** mientras se escribe el monto. Al pulsar "Registrar compra" se acredita sin pantallas extra, y se confirma con el nuevo saldo. |
| Compras que no alcanzan un bloque | **Se registran igualmente, con 0 puntos.** Con "1 punto por cada $1.000", una compra de $900 queda en el historial con 0 puntos. Sirve para los reportes del Módulo 9 (visitas, clientes activos). |
| Sucursal en cada compra | Si el comercio **tiene sucursales**, hay que elegir una al registrar la compra (el formulario recuerda la última usada). Si no tiene, no se pide. |
| Doble clic o red lenta | Cada formulario lleva una **clave única** (idempotencia): si la misma compra llega dos veces, se registra una sola vez. |
| Anulación | Solo de compras, **una vez por compra** y **con motivo obligatorio** (de 3 a 200 caracteres). Se descuentan exactamente los puntos que dio esa compra. Si el cliente ya no tiene suficientes puntos (podrá pasar cuando existan los canjes, en el Módulo 6), la anulación se rechaza, porque el saldo nunca puede ser negativo. No hay plazo límite para anular. |
| Saldo | Se guarda en la membresía y **solo lo cambian las funciones del ledger**, en la misma transacción que crea el movimiento. La base de datos impide que sea negativo. El script de verificación comprueba que el saldo coincide con la suma de los movimientos. |
| Quién ve qué | El **cliente** ve su saldo y sus movimientos (fecha, tipo, monto y puntos). El **dueño y el personal** ven el saldo y el historial de cada cliente de su comercio, con la sucursal. Solo el **dueño** ve quién registró cada compra. |

## Alcance

**Incluye**
- Tabla `point_transactions` (el ledger), inmutable, con RLS. Movimientos `EARN` (compra) y `REVERSAL` (anulación).
- Saldo en `memberships.points_balance`, mantenido solo por las funciones del ledger.
- Funciones `record_purchase` y `reverse_transaction`, atómicas.
- Bloqueo de la moneda en cuanto existe la primera compra (Ajustes lo explica).
- Bloqueo del borrado de sucursales con compras (Sucursales lo explica).
- Pantalla **Registrar compra**: buscar al cliente por nombre, escribir el monto, elegir la sucursal si las hay, ver los puntos y registrar.
- **Clientes**: saldo en la lista y página de detalle de cada cliente con su historial. El dueño puede anular desde ahí.
- **Billetera**: saldo en cada programa y página con los movimientos de cada uno.
- Pruebas de Vitest para leer montos escritos en el formato de cada país, y script de verificación ampliado. El script comprueba en la base de datos los mismos ejemplos de cálculo que las pruebas de Vitest, para que el cálculo del navegador y el del servidor coincidan.

**No incluye**
- Canjes y recompensas: Módulo 6.
- QR del cliente y escaneo: Módulo 7.
- Ajustes manuales (`ADJUST`), vencimiento de puntos (`EXPIRE`) y número de ticket o referencia en la compra.
- Editar una compra (se anula y se registra de nuevo).
- Reportes y totales del comercio: Módulo 9.

## Historias de usuario

- Como **cajero**, quiero **buscar al cliente por su nombre y registrar su compra** para **que reciba sus puntos al momento**.
- Como **cajero**, quiero **ver cuántos puntos recibirá antes de registrar** para **evitar errores**.
- Como **dueño**, quiero **anular una compra registrada por error, con un motivo** para **corregir sin borrar el historial**.
- Como **dueño o cajero**, quiero **ver el saldo y los movimientos de un cliente** para **responder sus dudas**.
- Como **cliente**, quiero **ver mi saldo y mis movimientos en cada comercio**.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_point_transactions.sql`

**Tabla `public.point_transactions`** (el ledger)

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `merchant_id` | `uuid` | FK → `merchants(id)` |
| `membership_id` | `uuid` | FK → `memberships(id)` |
| `type` | `text` | `EARN` o `REVERSAL` (los demás tipos se añadirán en sus módulos) |
| `points` | `integer` | `EARN`: 0 o más. `REVERSAL`: 0 o menos |
| `purchase_amount_minor` | `bigint` | Monto de la compra en unidades mínimas; obligatorio y mayor que 0 en `EARN` |
| `currency` | `text` | Moneda del comercio en el momento de la compra |
| `rule_points_per_block`, `rule_block_amount_minor` | `integer`, `bigint` | Copia de la regla aplicada (`EARN`), para poder auditar el cálculo aunque la regla cambie después |
| `branch_id` | `uuid` | FK → `branches(id)` **sin borrado en cascada**: una sucursal con compras no se puede eliminar |
| `created_by` | `uuid` | FK → `profiles(id)`: quién registró la compra o la anulación |
| `idempotency_key` | `uuid` | Único por comercio |
| `reference_id` | `uuid` | En `REVERSAL`, la compra anulada. Único: una sola anulación por compra |
| `note` | `text` | En `REVERSAL`, el motivo (obligatorio, de 3 a 200 caracteres) |
| `created_at` | `timestamptz` | `not null default now()` |

- **Inmutable**: nadie tiene permiso de `update` ni `delete`, y además un trigger rechaza cualquier intento, por si algún día alguien concede ese permiso por error.
- Índices por membresía y fecha (historial) y por comercio.

**Cambio en `public.memberships`**: `points_balance integer not null default 0`, que nunca puede ser negativo. Nadie puede cambiarlo directamente.

**Bloqueos nuevos**
- Un trigger en `merchants` rechaza el cambio de `currency` si el comercio ya tiene movimientos.
- La clave foránea de `branch_id` impide eliminar una sucursal con compras.

**Funciones** (`security definer`, `search_path = ''`, solo para `authenticated`)

| Función | Qué hace (en una sola transacción) |
|---|---|
| `record_purchase(membership_id, amount_minor, branch_id, idempotency_key)` | Comprueba varias cosas: que quien llama sea dueño o personal del comercio de esa membresía, que el programa esté activo, el monto y su tope, y que la sucursal pertenezca al comercio (obligatoria si tiene sucursales). Después bloquea la membresía, calcula los puntos con la regla vigente, inserta el `EARN`, suma el saldo y devuelve los puntos y el nuevo saldo. Si la clave ya se usó, devuelve el resultado anterior sin duplicar. |
| `reverse_transaction(transaction_id, reason)` | Solo el dueño. Comprueba que el movimiento sea una compra no anulada y que el saldo alcance. Después bloquea la membresía, inserta el `REVERSAL`, resta el saldo y devuelve el nuevo saldo. |

**Políticas RLS y permisos**

| Tabla | Leer | Crear | Modificar | Borrar |
|---|---|---|---|---|
| `point_transactions` | el cliente (sus movimientos); el dueño y el personal (los de su comercio) | solo vía funciones | nadie | nadie |
| `memberships.points_balance` | como el resto de la membresía | — | solo vía funciones | — |

## Lógica de servidor

`src/modules/ledger/` (módulo nuevo)
- `rules.ts`: `parseMoneyAmount(texto, moneda)`, que lee un monto escrito en el formato del país ("25.500", "12.50", "1,234.56") y devuelve unidades mínimas, o `null` si es ambiguo o inválido. Probado con Vitest.
- `schemas.ts`: compra (membresía, monto, sucursal, clave) y anulación (movimiento, motivo).
- `queries.ts`:
  - `searchCustomers(merchantId, texto)`;
  - `getCustomerDetail(merchantId, membershipId)`: saldo e historial;
  - `getMyHistory(merchantId)`: historial del cliente;
  - `merchantHasTransactions(merchantId)`.
- `actions.ts`: `recordPurchase` y `reverseTransaction`.

Cambios en otros módulos:
- `customers`: la lista y la billetera muestran el saldo.
- `merchants`:
  - `deleteBranch` explica por qué no se puede eliminar una sucursal con compras;
  - `updateMerchant` explica que la moneda está bloqueada.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/panel/[merchantId]/compra` | dueño y personal | Buscador por nombre con la lista de coincidencias. Al elegir un cliente: su nombre y saldo, el campo de monto, la sucursal (si hay) y "Recibirá N puntos". Tras registrar: "Se acreditaron N puntos a Ana. Nuevo saldo: X" y el formulario queda listo para la siguiente compra. Si el programa no está activo, lo explica y no deja registrar. |
| `/panel/[merchantId]/clientes` | dueño y personal | La lista suma el **saldo**; cada cliente abre su detalle. |
| `/panel/[merchantId]/clientes/[membershipId]` | dueño y personal | Nombre, saldo e historial (fecha, tipo, monto, puntos y sucursal). El dueño ve además quién registró cada movimiento y un botón **Anular** con un campo para el motivo. |
| `/wallet` | cliente | Cada programa muestra su **saldo** y enlaza a sus movimientos. |
| `/wallet/[merchantId]` | cliente | Saldo e historial de ese programa. |
| `/panel/[merchantId]` (portada) | dueño y personal | Botón destacado **Registrar compra**. |
| Menú del comercio | dueño y personal | Nueva pestaña **Registrar compra**. |
| `ajustes` y `sucursales` | dueño | Mensajes claros cuando la moneda está bloqueada o una sucursal no se puede eliminar. |

## Criterios de aceptación

- [x] La migración se aplica con `npx supabase db push --remote` y crea `point_transactions` con RLS activado.
- [x] El cajero busca a un cliente por nombre, escribe el monto, ve los puntos que recibirá y registra la compra; el saldo sube exactamente esos puntos.
- [x] El cálculo respeta la regla con redondeo hacia abajo, y una compra que no llega a un bloque queda registrada con 0 puntos.
- [x] Los montos se leen en el formato del país (con centavos donde los hay) y los ambiguos o inválidos se rechazan con un mensaje claro.
- [x] Si el comercio tiene sucursales hay que elegir una; si no, no se pide.
- [x] Con el programa pausado o sin configurar no se puede registrar ninguna compra (ni desde la pantalla ni desde la API).
- [x] Enviar dos veces la misma compra (misma clave) la registra una sola vez.
- [x] El dueño anula una compra con motivo; el saldo baja esos puntos y el historial muestra la compra y su anulación. No se puede anular dos veces ni sin motivo. El personal no puede anular.
- [x] Nadie puede modificar ni borrar movimientos, ni cambiar el saldo directamente (comprobado con script).
- [x] El saldo de cada membresía coincide con la suma de sus movimientos (comprobado con script).
- [x] El cliente ve su saldo y sus movimientos; no ve los de otros clientes. Un comercio no ve los movimientos de otro.
- [x] La moneda no se puede cambiar después de la primera compra, y una sucursal con compras no se puede eliminar; en ambos casos con un mensaje claro.
- [x] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build.
- **Vitest**: `parseMoneyAmount` con monedas con y sin centavos, separadores de miles de cada país, montos ambiguos e inválidos, y el tope.
- **RLS y ledger**: `npm run verify:rls` ampliado:
  - el cálculo de la base de datos con los mismos ejemplos que Vitest;
  - la idempotencia;
  - el programa pausado;
  - la sucursal obligatoria y la de otro comercio;
  - el personal no anula;
  - una sola anulación por compra;
  - movimientos inmutables y saldo no editable;
  - saldo igual a la suma de movimientos;
  - aislamiento entre clientes y entre comercios;
  - moneda bloqueada y sucursal no eliminable.
- **Manual en el navegador**:
  - ventana normal como dueño y ventana privada como cliente;
  - registrar compras, ver el saldo subir en la billetera, anular una con motivo;
  - comprobar los bloqueos de moneda y sucursal.

**Resultado automático (2026-11-16)**. Se entregó en dos partes, cada una verificada por separado: (1) compras, saldo e historial; (2) anulación y bloqueos.
- lint, typecheck y build sin errores;
- `npm test` 29/29 (9 nuevas para leer montos);
- `verify:rls` 155/155 (39 nuevas del ledger: cálculo igual al de la aplicación, idempotencia, inmutabilidad, saldo igual a la suma, anulaciones y bloqueos);
- prueba de humo (script temporal, no versionado) contra el servidor de desarrollo: 26/26. **Envía los formularios de verdad**: registrar compra, compra duplicada, monto ambiguo, anular con y sin motivo, y Ajustes con la moneda bloqueada.
- Sin regresiones en las pruebas de humo de los Módulos 2, 3 y 4.

Decisiones técnicas en el [ADR 0005](../architecture/adr/0005-saldo-materializado-y-forma-del-ledger.md).

**Problema conocido (no bloqueante)**: si un formulario se envía **sin JavaScript** y la acción devuelve un error de validación, el registro del servidor muestra un `InvariantError` interno de Next.js ("cookies object does not match"). La respuesta al usuario es correcta. Ya ocurría en el Módulo 2 (formulario de Ajustes), no lo causa `connection()` y no aparece en los envíos correctos. Confirmado tras la prueba manual: en el uso normal con JavaScript no aparece. El registro no mostró ningún error durante la prueba del usuario.

**Resultado manual (2026-11-17)**: el usuario recorrió en el navegador el registro de compras, el saldo y el historial, la anulación con motivo, los bloqueos de moneda y sucursal, y la billetera del cliente. Todo correcto.

Aclaración sobre los montos: el usuario observó que "25.5" se acepta como 25,50. Es el comportamiento previsto en las monedas donde el punto separa los centavos (USD, MXN, PEN, DOP, GTQ, HNL, NIO). Ahí no hay ambigüedad, y la vista previa muestra el monto exacto antes de registrar. En las monedas donde el punto separa los miles (COP, CLP, ARS, etc.), "25.5" se rechaza por ambiguo. Se decidió mantenerlo así (2026-11-17).

## Riesgos

- **Nombres iguales**: dos clientes llamados "Ana" se distinguen solo por la fecha en que se unieron. Lo resuelve el QR del Módulo 7. Mientras tanto, la lista de coincidencias muestra "cliente desde…" para ayudar.
- **Tamaño del módulo**: es el más delicado hasta ahora. Si se complica, propongo entregarlo en dos partes, cada una verificada por separado: (a) registrar compras, saldo e historial; (b) anulación y bloqueos.

## Preguntas abiertas

- [ ] ¿Ajustes manuales de puntos (regalos, compensaciones)? Descartado por ahora.
- [ ] ¿Número de ticket o referencia en cada compra?
- [ ] ¿Qué pasa con el historial si un cliente borra su cuenta? Hoy no existe esa función; se decidirá cuando exista.
