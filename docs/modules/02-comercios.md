# Módulo 02 — Comercios

- **Estado**: implementado (2026-11-10), pendiente de prueba manual
- **Fecha**: 2026-11-10

## Objetivo

Que cualquier persona con cuenta en Loyili pueda crear su comercio, registrar sus sucursales y sumar a su personal (cajeros) mediante un enlace de invitación. Cada comercio queda aislado de los demás por RLS: nadie ve ni toca datos de un comercio al que no pertenece. Es la base del panel del comercio y de los módulos siguientes (programa, clientes, puntos).

## Decisiones tomadas (2026-11-10)

| Tema | Decisión | Motivo |
|---|---|---|
| Alta de personal | **Enlace de invitación** | El dueño lo comparte por WhatsApp u otro medio. No depende del correo de Supabase (limitado en el plan gratuito) y no permite averiguar qué emails tienen cuenta. |
| Moneda | **Cada comercio elige la suya** de una lista corta | Se usará en el Módulo 3 para calcular puntos por monto gastado. |
| Comercios por persona | **Varios** | Una persona con dos negocios los gestiona con una sola cuenta. |
| Sucursales | **Opcionales** | Un negocio con un solo local no necesita crear ninguna. |
| Cambio de moneda | **Permitido mientras el comercio no tenga compras registradas** | Corrige un error al elegirla sin borrar el comercio ni pedir soporte. Con compras ya registradas, cambiarla alteraría el significado de los montos guardados. En este módulo todavía no hay compras, así que siempre se puede cambiar; en el Módulo 5 la base de datos bloqueará el cambio en cuanto exista el primer movimiento. Si la regla de acumulación del Módulo 3 depende de la moneda, al cambiarla habrá que revisarla. |

## Propuestas validadas (2026-11-10)

| Tema | Propuesta |
|---|---|
| Vigencia del enlace de invitación | **7 días** y **un solo uso**. Si vence o se usa, el dueño genera otro. |
| Quién puede crear un comercio | **Cualquier persona con cuenta**, sin aprobación de un administrador. La administración de la plataforma llegará en una fase posterior. |
| Destino tras iniciar sesión (sin `next`) | **`/panel`** si la persona pertenece a algún comercio; si no, **`/wallet`** (como hasta ahora). |
| Roles | Solo **`owner`** (dueño, quien crea el comercio) y **`staff`** (personal). Un comercio tiene un único dueño en este módulo. |

## Alcance

**Incluye**
- Crear un comercio (nombre + moneda). Quien lo crea queda como dueño.
- Panel del comercio: lista de "mis comercios", portada de cada comercio y navegación entre secciones.
- Editar el nombre del comercio (solo el dueño).
- Sucursales: crear, editar y eliminar (dueño); ver la lista (dueño y personal).
- Personal:
  - el dueño genera enlaces de invitación de un solo uso, ve los pendientes y puede revocarlos;
  - la persona invitada acepta tras iniciar sesión o registrarse;
  - el dueño puede quitar a un miembro del personal.
- El registro y el login conservan el parámetro `next`, para que quien llega desde una invitación sin cuenta vuelva a la invitación tras registrarse.
- Script de verificación de RLS ampliado a las tablas nuevas.

**No incluye**
- Identificador público del comercio (`slug`) y página pública: pasa al Módulo 4, cuando se decida cómo se une un cliente a un comercio.
- Eliminar un comercio, transferir la propiedad o tener varios dueños.
- Asignar personal a sucursales concretas, o permisos distintos por persona.
- Logo, imágenes, horarios o datos de contacto del comercio.
- Invitaciones por correo.
- Lo que el personal hará en caja (acreditar y canjear): Módulos 5–7. En este módulo el personal solo ve la portada y las sucursales.

## Historias de usuario

- Como **persona con cuenta**, quiero **crear mi comercio** para **empezar mi programa de fidelización**.
- Como **dueño**, quiero **registrar mis sucursales** para **saber más adelante en qué local se hizo cada compra**.
- Como **dueño**, quiero **invitar a mis cajeros con un enlace** para **que puedan operar en mi comercio con su propia cuenta**.
- Como **dueño**, quiero **quitar a alguien de mi personal** para **que deje de tener acceso cuando ya no trabaje conmigo**.
- Como **persona invitada**, quiero **abrir el enlace y aceptar** para **unirme al comercio**, tenga o no cuenta todavía.
- Como **dueño de dos negocios**, quiero **cambiar entre mis comercios** desde el mismo panel.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_merchants.sql`

**Tabla `public.merchants`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` |
| `name` | `text` | `not null`, 1–100 caracteres, sin espacios sobrantes |
| `currency` | `text` | `not null`, código ISO 4217 de 3 letras mayúsculas (`^[A-Z]{3}$`) |
| `created_at`, `updated_at` | `timestamptz` | `not null default now()`; `updated_at` mantenida por trigger |

La lista de monedas permitidas vive en el código (Zod + formulario):
- MXN, COP, PEN, CLP, ARS, BOB, PYG, UYU, BRL, GTQ, HNL, NIO, CRC, DOP, USD, EUR.

En la base de datos solo se exige el formato, para poder añadir monedas sin migración. Algunas monedas (CLP, PYG) no usan decimales. Esto importa en el Módulo 3, al guardar montos en unidades mínimas.

**Tabla `public.merchant_members`**: quién pertenece a cada comercio.

| Columna | Tipo | Restricciones |
|---|---|---|
| `merchant_id` | `uuid` | FK → `merchants(id) on delete cascade` |
| `user_id` | `uuid` | FK → `profiles(id) on delete cascade` |
| `role` | `text` | `not null`, `owner` o `staff` |
| `created_at` | `timestamptz` | `not null default now()` |

- PK (`merchant_id`, `user_id`): una persona aparece una sola vez por comercio.
- Índice único parcial: un solo `owner` por comercio.

**Tabla `public.branches`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `merchant_id` | `uuid` | FK → `merchants(id) on delete cascade` |
| `name` | `text` | `not null`, 1–100, sin espacios sobrantes; único por comercio (sin distinguir mayúsculas) |
| `address` | `text` | opcional, hasta 200 caracteres |
| `created_at`, `updated_at` | `timestamptz` | como arriba |

En el Módulo 5, si una sucursal ya tiene compras asociadas, se revisará si se puede eliminar o solo archivar.

**Tabla `public.merchant_invitations`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `merchant_id` | `uuid` | FK → `merchants(id) on delete cascade` |
| `role` | `text` | `not null default 'staff'`, solo `staff` |
| `token_hash` | `text` | `not null unique`. Huella SHA-256 del código secreto del enlace. |
| `created_by` | `uuid` | FK → `profiles(id)` |
| `expires_at` | `timestamptz` | `not null default now() + interval '7 days'` |
| `accepted_by` | `uuid` | FK → `profiles(id)`, nulo hasta que se acepta |
| `accepted_at` | `timestamptz` | nulo hasta que se acepta |
| `created_at` | `timestamptz` | `not null default now()` |

**El código del enlace nunca se guarda tal cual**, solo su huella, igual que una contraseña. Si alguien leyera la tabla, no podría usar las invitaciones. Por eso el enlace se muestra una sola vez, al generarlo.

**Funciones auxiliares** (esquema `private`, no expuesto por la API):
- `private.is_merchant_member(merchant_id)` y `private.is_merchant_owner(merchant_id)`.
- Ambas son `security definer` y `stable`, con `search_path = ''`.
- Las usan las políticas RLS para no consultar `merchant_members` desde sus propias políticas, lo que causaría recursión.

**Funciones de la API** (todas `security definer`, `search_path = ''`, ejecutables solo por `authenticated`):

| Función | Qué hace (en una sola transacción) |
|---|---|
| `create_merchant(name, currency)` | Crea el comercio y añade a quien la llama como `owner`. Devuelve el `id`. |
| `create_merchant_invitation(merchant_id)` | Solo el dueño. Genera un código aleatorio, guarda su huella y devuelve el código (una única vez). |
| `get_invitation_preview(token)` | Devuelve el nombre del comercio y el estado de la invitación (válida, vencida, usada, no existe), para la pantalla de aceptar. No expone nada más. |
| `accept_merchant_invitation(token)` | Valida que la invitación exista, no haya vencido y no se haya usado. Si todo es correcto, añade a quien la llama como `staff`, marca la invitación como usada y devuelve el `merchant_id`. Si la persona ya es miembro, no duplica nada. |

**Políticas RLS y permisos**

| Tabla | Leer | Crear | Modificar | Borrar |
|---|---|---|---|---|
| `merchants` | miembros | solo vía `create_merchant` | dueño (`name`, `currency`) | nadie (fuera de alcance) |
| `merchant_members` | la propia fila; el dueño ve todas las de su comercio | solo vía funciones | nadie | dueño, solo filas `staff` |
| `branches` | miembros | dueño | dueño (`name`, `address`) | dueño |
| `merchant_invitations` | dueño (sin `token_hash`) | solo vía función | nadie | dueño (revocar pendientes) |

**Cambio en `profiles`** (tabla del Módulo 1): nueva política para que el dueño pueda leer el **nombre** de las personas de su comercio y mostrar la lista de personal. Lo demás sigue igual: cada persona solo ve y edita su propio perfil.

## Lógica de servidor

`src/modules/merchants/`
- `schemas.ts`:
  - `createMerchantSchema` (nombre 1–100, moneda de la lista)
  - `updateMerchantSchema` (nombre, moneda)
  - `branchSchema` (nombre 1–100, dirección opcional ≤200)
  - token de invitación (formato)
- `queries.ts`:
  - `getMyMerchants()`: comercios con mi rol
  - `getMerchantForMember(id)`: devuelve 404 si no soy miembro
  - `getBranches(merchantId)`
  - `getMembers(merchantId)`
  - `getPendingInvitations(merchantId)`
  - `getInvitationPreview(token)`
- `actions.ts`:
  - `createMerchant`, `updateMerchant`
  - `createBranch`, `updateBranch`, `deleteBranch`
  - `createInvitation`, `revokeInvitation`, `acceptInvitation`
  - `removeMember`
  - Todas validan con Zod y comprueban el rol en el servidor; RLS es la última barrera.
- `currencies.ts`: la lista de monedas con su nombre en español.
- `index.ts`: la API pública del módulo.

Cambios en `src/modules/auth/`:
- Sin `next`, tras iniciar sesión se va a **`/inicio`** (Route Handler en `src/app/inicio/route.ts`), que decide el destino: el panel del único comercio, la lista `/panel` si tiene varios, o `/wallet` si no tiene ninguno.
  - Así `auth` no depende de `merchants` (la dependencia va solo en un sentido: `merchants` → `auth`).
- Un usuario con sesión que abre `/login?next=...` va directo a `next`.
- `/login` ↔ `/registro` conservan `next` en sus enlaces, y `signUp` lo respeta (con `safeNextPath`).
- `/invitacion` se añade a las rutas protegidas del proxy.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/panel` | cualquiera con sesión | "Mis comercios": sin comercios, invitación a "Crear mi comercio"; con uno o más, lista con el rol en cada uno y "Crear otro comercio". (Quien tiene un solo comercio entra directo a él al iniciar sesión, vía `/inicio`). |
| `/panel/nuevo` | cualquiera con sesión | Formulario: nombre y moneda. Al guardar, lleva a la portada del comercio nuevo. |
| `/panel/[merchantId]` | miembros | Portada: nombre, moneda y mi rol. Menú: Sucursales, Personal (dueño), Ajustes (dueño). Enlace a "Mis comercios". |
| `/panel/[merchantId]/sucursales` | miembros | Lista de sucursales. El dueño puede añadir, editar y eliminar (con confirmación). |
| `/panel/[merchantId]/personal` | dueño | Miembros (nombre, rol, desde cuándo) con opción "Quitar" para el personal. Botón "Generar enlace de invitación": muestra el enlace con un botón para copiarlo. Lista de invitaciones pendientes con su vencimiento y "Revocar". |
| `/panel/[merchantId]/ajustes` | dueño | Editar el nombre y la moneda (con aviso de que solo se puede cambiar mientras no haya compras registradas). |
| `/invitacion/[token]` | con sesión (si no hay, pasa por login/registro y vuelve) | "Te invitaron a unirte a **Comercio X** como personal" + botón "Aceptar". Mensajes claros si el enlace venció, ya se usó, no existe o si ya eres miembro. |

- Quien no es miembro de un comercio y abre su URL ve una página "no encontrado". No se revela que el comercio existe.
- El personal que abre `personal` o `ajustes` también ve "no encontrado" (o se le devuelve a la portada).

## Criterios de aceptación

- [ ] La migración se aplica con `npx supabase db push --remote` y crea las 4 tablas con RLS activado.
- [ ] Una persona con sesión crea un comercio con nombre y moneda, y queda como dueña.
- [ ] Una persona con dos comercios los ve en `/panel` y puede entrar a cada uno. Con uno solo, al iniciar sesión entra directo a él.
- [ ] El dueño edita el nombre y la moneda; el personal no puede editar ninguno de los dos (ni desde la pantalla ni desde la API).
- [ ] El dueño crea, edita y elimina sucursales. No se permiten dos sucursales con el mismo nombre en un comercio.
- [ ] El dueño genera un enlace de invitación, lo copia y lo ve en la lista de pendientes. Puede revocarlo.
- [ ] Una persona **sin cuenta** abre el enlace, se registra y, tras registrarse, vuelve a la invitación, la acepta y queda como personal.
- [ ] Una persona **con cuenta** abre el enlace, inicia sesión, acepta y queda como personal.
- [ ] Un enlace ya usado, revocado o vencido muestra un mensaje claro y no da acceso.
- [ ] El personal ve la portada y las sucursales, pero no puede crear o editar sucursales, ver el personal ni las invitaciones, ni editar el comercio.
- [ ] El dueño quita a un miembro del personal; esa persona pierde el acceso de inmediato.
- [ ] Nadie ve ni modifica datos de un comercio al que no pertenece, ni siquiera llamando directamente a la API (comprobado con script).
- [ ] Tras iniciar sesión sin `next`, quien pertenece a un comercio va a `/panel` y el resto a `/wallet`.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build.
- **RLS**: `npm run verify:rls` ampliado.
  - Crea tres usuarios: A (dueño del comercio 1), B (dueño del comercio 2) y C (personal del comercio 1, unido por invitación).
  - Comprueba el aislamiento entre comercios, los permisos del personal y que la invitación sea de un solo uso.
  - Comprueba también que el personal no puede editar el comercio, insertarse como miembro directamente ni leer `token_hash`.
- **Vencimiento de invitaciones**: no se puede simular desde la API sin la clave secreta. Se comprueba manualmente en el proyecto de desarrollo:
  1. Generar una invitación de prueba.
  2. Adelantar su `expires_at` con una consulta en el *SQL Editor* de Supabase (son datos de prueba, no un cambio de esquema).
  3. Comprobar que el enlace queda rechazado.
- **Manual en el navegador**: recorrer los criterios con dos navegadores (o una ventana normal y otra privada) para ser dueño y personal a la vez.

**Resultado automático (2026-11-10)**: lint, typecheck y build sin errores; `verify:rls` 52/52 PASS; prueba de humo (script temporal, no versionado) que renderiza cada pantalla con sesión de dueño y de personal contra el servidor de desarrollo: 20/20 PASS. Falta la prueba manual de los formularios en el navegador.

## Riesgos

- **Enlace reenviado**: cualquiera que reciba el enlace puede usarlo mientras sea válido. Lo mitigan el uso único, el vencimiento a los 7 días y la opción de revocar. Además, el dueño ve quién entró y puede quitarlo.
- **Tamaño del módulo**: es más grande que el Módulo 1 (4 tablas y 7 pantallas). Si en la implementación se complica, propongo dividirlo en dos entregas: (a) comercio y sucursales, (b) personal e invitaciones, cada una verificada por separado.

## Preguntas abiertas

- [ ] ¿Debe el personal poder "salir" de un comercio por su cuenta? Por ahora solo el dueño lo puede quitar.
- [ ] ¿Debe haber varios dueños por comercio, o poder transferir la propiedad? Fuera de alcance por ahora.
