# Módulo 03 — Programa de fidelización

- **Estado**: validado (2026-11-12)
- **Fecha**: 2026-11-12

## Objetivo

Que el dueño de un comercio configure **cuántos puntos gana un cliente por lo que gasta** (por ejemplo, "1 punto por cada $1.000") y pueda pausar o reanudar su programa. La regla queda guardada y aislada por comercio. En el Módulo 5 se usará para calcular los puntos de cada compra.

## Decisiones tomadas (2026-11-12)

| Tema | Decisión | Motivo |
|---|---|---|
| Forma de la regla | **Por monto gastado**: "X puntos por cada Y de dinero". | Es el modelo más común y premia más a quien más gasta. |
| Redondeo | **Hacia abajo**: solo cuentan los bloques completos. Con "1 punto por cada $1.000", una compra de $2.700 da 2 puntos y una de $900 da 0. | Es lo habitual y fácil de explicar al cliente. |
| Monto mínimo de compra | **No por ahora.** | Mantiene el módulo simple; se puede añadir después sin romper nada. |
| Vencimiento de puntos | **Se decide más adelante.** Por ahora los puntos no vencen. | El ledger del Módulo 5 ya contempla el movimiento `EXPIRE` para cuando se defina. |

## Propuestas validadas (2026-11-12)

| Tema | Propuesta |
|---|---|
| Un programa por comercio | Cada comercio tiene **como máximo un programa**. Al principio no tiene ninguno: el dueño lo crea al guardar su regla por primera vez. |
| Estado | El programa está **activo** o **pausado**. Pausarlo no borra la regla ni los puntos que ya tengan los clientes. En el Módulo 5, un comercio sin programa o con el programa pausado **no podrá acreditar puntos**. |
| Cambiar la regla | El dueño puede cambiarla cuando quiera. **Solo afecta a las compras futuras**: los puntos ya ganados no se recalculan, porque cada movimiento del ledger guarda los puntos que se dieron en su momento. |
| Montos sin decimales | El monto del bloque se escribe en **unidades enteras** de la moneda ($1.000, US$1, S/ 10). No se permite "1 punto por cada US$1,50". Simplifica el formulario y cubre los casos habituales. |
| Límites del formulario | Puntos por bloque: **1 a 1.000**. Monto del bloque: **1 a 100.000.000** unidades de la moneda. Son topes para evitar errores de escritura, no reglas de negocio; se pueden ampliar. |
| Si se cambia la moneda | Si el dueño cambia la moneda en Ajustes (permitido mientras no haya compras), **el programa se pausa automáticamente**. "1 punto por cada 1.000" significa algo muy distinto en pesos colombianos que en dólares, así que el dueño debe revisar la regla y reactivarlo. |
| Quién lo ve | El **dueño** lo crea, edita, pausa y reanuda. El **personal** ve la regla (le servirá en caja), pero no la cambia. Los clientes lo verán en la billetera a partir del Módulo 4. |

## Alcance

**Incluye**
- Tabla `loyalty_programs` con RLS.
- Pantalla "Programa" en el panel del comercio:
  - el dueño crea o edita la regla y pausa o reanuda el programa;
  - el personal la ve en modo lectura.
- Una **calculadora de ejemplo** en esa pantalla: "Con esta regla, una compra de $X da Y puntos". Así el dueño comprueba la regla antes de guardarla.
- Resumen del programa en la portada del comercio, o "Configura tu programa" si aún no existe.
- Aviso en Ajustes: cambiar la moneda pausa el programa.
- Pausa automática del programa al cambiar la moneda (en la base de datos).
- Instalación de **Vitest** (solo en el proyecto) y primeras pruebas automáticas: el cálculo de puntos y la conversión de montos.
- Script de verificación de RLS ampliado.

**No incluye**
- Acreditar puntos por compras reales: Módulo 5.
- Puntos por visita, bonos, monto mínimo, multiplicadores o promociones por fechas.
- Vencimiento de puntos.
- Nombre personalizado de los puntos ("estrellas", "sellos"…) o del programa.
- Historial de cambios de la regla.
- Que los clientes vean el programa: Módulo 4.

## Historias de usuario

- Como **dueño**, quiero **definir cuántos puntos da cada compra según el monto** para **premiar a mis clientes frecuentes**.
- Como **dueño**, quiero **probar la regla con un monto de ejemplo** para **saber cuántos puntos daría antes de guardarla**.
- Como **dueño**, quiero **pausar mi programa** para **dejar de dar puntos temporalmente sin perder la configuración**.
- Como **personal**, quiero **ver la regla del programa** para **poder explicársela a los clientes**.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_loyalty_programs.sql`

**Tabla `public.loyalty_programs`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `merchant_id` | `uuid` | PK y FK → `merchants(id) on delete cascade` (un programa por comercio) |
| `points_per_block` | `integer` | `not null`, 1–1.000 |
| `block_amount_minor` | `bigint` | `not null`, mayor que 0. Monto del bloque en **unidades mínimas** (centavos), como todo el dinero en Loyili |
| `is_active` | `boolean` | `not null default true` |
| `created_at`, `updated_at` | `timestamptz` | `not null default now()`; `updated_at` mantenida por trigger |

**Cómo se guarda el monto.** El dueño escribe "1.000" y el servidor lo convierte a unidades mínimas según la moneda:
- en pesos colombianos (2 decimales) se guarda `100000`;
- en pesos chilenos (sin decimales) se guarda `1000`.

Así se cumple la regla del proyecto de guardar el dinero como entero en unidades mínimas.

**Fórmula de cálculo** (la usará el Módulo 5; en este módulo solo la calculadora de ejemplo):

```
puntos = floor(monto_compra_minor / block_amount_minor) × points_per_block
```

**Trigger en `merchants`**: si cambia `currency`, pone `is_active = false` en el programa de ese comercio (si existe).

**Políticas RLS y permisos**

| Tabla | Leer | Crear | Modificar | Borrar |
|---|---|---|---|---|
| `loyalty_programs` | miembros del comercio | dueño | dueño (`points_per_block`, `block_amount_minor`, `is_active`) | nadie (se pausa en lugar de borrar) |

Se reutilizan las funciones auxiliares del Módulo 2 (`private.is_merchant_member`, `private.is_merchant_owner`).

## Lógica de servidor

`src/modules/loyalty/` (módulo nuevo)
- `rules.ts`: funciones puras, sin base de datos, cubiertas con Vitest:
  - `calculatePoints(amountMinor, rule)`: aplica la fórmula con redondeo hacia abajo;
  - `toMinorUnits(amount, currency)` y `fromMinorUnits(amountMinor, currency)`.
- `schemas.ts`: `loyaltyProgramSchema` (puntos 1–1.000; monto entero 1–100.000.000).
- `queries.ts`: `getLoyaltyProgram(merchantId)` (devuelve `null` si no existe).
- `actions.ts`:
  - `saveLoyaltyProgram(merchantId, …)`: crea o actualiza la regla;
  - `setLoyaltyProgramActive(merchantId, active)`: pausa o reanuda.
  - Ambas validan con Zod y comprueban en el servidor que quien llama es el dueño; RLS es la última barrera.
- `index.ts`: la API pública del módulo.

Cambios en `src/modules/merchants/`:
- `currencies.ts` añade los **decimales de cada moneda** (0 para CLP y PYG; 2 para las demás), que necesita la conversión a unidades mínimas.
- El módulo `loyalty` usa `merchants` (moneda y permisos) a través de su `index.ts`. La dependencia va en un solo sentido: `loyalty` → `merchants`.

**Vitest.** Se instala como dependencia de desarrollo del proyecto, no de forma global. Se añade `npm test`.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/panel/[merchantId]/programa` | miembros | **Dueño, sin programa**: explicación breve y formulario "Gana [X] puntos por cada [$ Y]" con calculadora de ejemplo y botón "Crear programa". **Dueño, con programa**: la regla actual, el estado (Activo / Pausado), el mismo formulario para editarla y un botón "Pausar" o "Reanudar". **Personal**: la regla y el estado, en modo lectura (o "El dueño aún no ha configurado el programa"). |
| `/panel/[merchantId]` (portada) | miembros | Añade una tarjeta "Programa": la regla y el estado, o "Configura tu programa" (dueño) si aún no existe. |
| `/panel/[merchantId]/ajustes` | dueño | Añade el aviso: "Si cambias la moneda, tu programa se pausará para que revises la regla". |
| Menú del comercio | miembros | Nueva pestaña **Programa**, visible para el dueño y el personal. |

## Criterios de aceptación

- [ ] La migración se aplica con `npx supabase db push --remote` y crea `loyalty_programs` con RLS activado.
- [ ] El dueño crea el programa con "X puntos por cada $Y"; queda activo y se ve en la portada.
- [ ] La calculadora muestra el resultado correcto con redondeo hacia abajo (1 por cada $1.000: $2.700 → 2; $900 → 0).
- [ ] En una moneda sin decimales (CLP) y en una con decimales (COP), el monto se guarda bien en unidades mínimas y se muestra igual que como se escribió.
- [ ] El dueño edita la regla y el cambio se refleja al instante.
- [ ] El dueño pausa y reanuda el programa; el estado se ve en la pantalla y en la portada.
- [ ] El formulario rechaza valores fuera de rango, con decimales o vacíos, con mensajes claros (también si se salta la validación del navegador).
- [ ] El personal ve la regla pero no puede crearla, editarla ni pausarla (ni desde la pantalla ni desde la API).
- [ ] Cambiar la moneda en Ajustes pausa el programa automáticamente.
- [ ] Nadie ve ni modifica el programa de un comercio al que no pertenece (comprobado con script).
- [ ] `npm test` pasa (cálculo de puntos y conversión de montos).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build.
- **Pruebas unitarias (Vitest)**: `calculatePoints` y la conversión de montos:
  - redondeo hacia abajo;
  - monto menor que un bloque;
  - varios puntos por bloque;
  - monedas con y sin decimales;
  - montos grandes.
- **RLS**: `npm run verify:rls` ampliado:
  - el dueño crea, edita y pausa;
  - el personal solo lee;
  - el dueño de otro comercio no lee ni escribe;
  - nadie borra;
  - la base de datos rechaza valores fuera de rango;
  - cambiar la moneda pausa el programa.
- **Manual en el navegador**: crear el programa, probar la calculadora, editar, pausar y reanudar como dueño; comprobar con la sesión de personal que solo puede ver; cambiar la moneda y ver que el programa queda pausado.

## Riesgos

- **Dos cálculos de puntos**: la calculadora de ejemplo usa TypeScript y el Módulo 5 calculará en PostgreSQL (dentro de la transacción). Si alguna vez difieren, el cliente vería un número distinto del que recibe. Mitigación: la fórmula es de una línea y el Módulo 5 incluirá pruebas que comparen ambos resultados.

## Preguntas abiertas

- [ ] ¿Los puntos vencen? ¿Con qué política? (Decidir antes de un módulo posterior al 5.)
- [ ] ¿Monto mínimo de compra para ganar puntos? (Descartado por ahora; se puede añadir).
- [ ] ¿Puntos por visita o bonos? (Descartado por ahora).
