# Módulo 07 — Identificación por QR

- **Estado**: implementado (2026-11-17), pendiente de prueba manual
- **Fecha**: 2026-11-17

## Objetivo

Que el cliente se identifique en caja **mostrando un código QR** desde su billetera, y que el cajero lo escanee con la cámara (o escriba el código corto que aparece debajo) para abrir su ficha al instante y registrar la compra o el canje. Reemplaza la búsqueda por nombre, que sigue disponible como alternativa, y elimina la confusión entre clientes con el mismo nombre.

## Recomendaciones (el usuario aceptó de antemano las recomendaciones del proyecto, 2026-11-17)

| Tema | Recomendación | Motivo |
|---|---|---|
| Qué contiene el QR | Un **código temporal**, no un dato fijo del cliente. **Vale 5 minutos** y la billetera lo **renueva sola** mientras está abierta. | Si el QR fuera fijo, una captura de pantalla serviría para siempre: alguien podría canjear los puntos de otra persona. Con un código que caduca, una captura deja de servir en minutos. |
| Un código para todos los comercios | Cada cliente tiene **un solo código vigente**, válido en cualquier comercio donde sea cliente. | El cliente abre "Mi código" sin elegir comercio; el comercio solo ve a sus propios clientes. |
| Código corto escrito | Debajo del QR se ven **8 caracteres** (ej. `K7P2-QX4M`), sin caracteres que se confundan. El cajero puede escribirlo si la cámara no funciona. | Alternativa sin cámara y para cuando la luz o la pantalla no ayudan. |
| No es de un solo uso | Durante sus 5 minutos, el código puede escanearse varias veces. | Si el cajero se equivoca o necesita escanear de nuevo, el cliente no tiene que hacer nada. Lo que protege es la caducidad. |
| Cliente que aún no está unido | Si el código es de alguien que **no es cliente** del comercio, el cajero ve "Aún no es cliente" y un botón **Unirlo al programa** (si el programa está activo). Al mostrar su código, el cliente da su consentimiento. | Cumple lo anunciado en el Módulo 4: escanear en caja también puede unir al cliente. Menos pasos en la primera visita. |
| Personal del comercio | Si el código es del dueño o del personal del propio comercio, se rechaza con "Trabaja en este comercio". | Igual que en el Módulo 4: nadie se da puntos a sí mismo. |
| Lector de QR | **jsQR**, una librería pequeña que lee el QR de la imagen de la cámara en el navegador. Se carga solo al pulsar "Escanear". | Funciona en cualquier navegador moderno, también en Windows y iPhone, donde el lector integrado del navegador no existe o no es fiable. |

## Alcance

**Incluye**
- Tabla `customer_codes` (un código vigente por persona; solo se guarda su huella, como las invitaciones).
- Funciones para emitir un código (el cliente), resolverlo (el personal) y unir al cliente desde caja.
- Billetera: botón **Mi código** → pantalla con el QR grande, el código corto y la cuenta atrás. Se renueva solo.
- Caja:
  - botón **Escanear QR** (cámara);
  - campo **Escribir código**;
  - al reconocerlo, se abre la ficha del cliente con compra y canje, como hoy;
  - se mantiene la búsqueda por nombre.
- Mensajes claros si el código caducó, no existe, es de alguien del personal o de alguien que aún no es cliente (con la opción de unirlo).
- Pruebas de Vitest para el formato del código corto y script de verificación ampliado.

**No incluye**
- Instalar la billetera en el teléfono como aplicación y verse mejor en móvil: Módulo 8.
- Escanear desde el teléfono del cajero contra el servidor de tu computadora. La cámara del navegador solo funciona con HTTPS o en `localhost`; desde el teléfono se podrá con el despliegue (Módulo 10). Ver "Riesgos".
- Códigos de barras, NFC o tarjetas físicas.

## Historias de usuario

- Como **cliente**, quiero **mostrar mi código QR en caja** para **que me identifiquen al instante**.
- Como **cajero**, quiero **escanear el QR del cliente** (o escribir su código) para **abrir su ficha sin buscarlo por nombre**.
- Como **cajero**, quiero **unir a un cliente nuevo con su QR** para **acreditarle su primera compra sin que tenga que buscar el enlace del comercio**.
- Como **cliente**, quiero que **una captura de mi código no sirva después** para **que nadie use mis puntos**.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_customer_codes.sql`

**Tabla `public.customer_codes`** (sin acceso directo desde la API: solo mediante funciones)

| Columna | Tipo | Restricciones |
|---|---|---|
| `user_id` | `uuid` | PK, FK → `profiles(id) on delete cascade` (un código vigente por persona) |
| `code_hash` | `text` | `not null unique`. Huella SHA-256 del código; el código en sí no se guarda |
| `expires_at` | `timestamptz` | `not null`, 5 minutos después de emitirlo |
| `created_at` | `timestamptz` | `not null default now()` |

**Funciones** (`security definer`, `search_path = ''`, solo `authenticated`)

| Función | Quién | Qué hace |
|---|---|---|
| `issue_customer_code()` | cualquier persona con sesión | Genera un código nuevo de 8 caracteres (reemplaza el anterior) y devuelve el código y su vencimiento. |
| `resolve_customer_code(merchant_id, code)` | dueño y personal | Busca un código vigente. Devuelve el estado (`customer`, `not_customer`, `member`, `expired_or_unknown`), el nombre de la persona y, si es cliente, su membresía. No revela nada de un código caducado o inexistente. |
| `enroll_customer_by_code(merchant_id, code)` | dueño y personal | Si el código es vigente, el programa está activo y la persona no trabaja en el comercio, crea la membresía (o devuelve la existente). |

## Lógica de servidor

`src/modules/identification/` (módulo nuevo)
- `rules.ts`: `normalizeCustomerCode(texto)`, que acepta minúsculas, espacios y guiones y devuelve el código o `null`. Probado con Vitest.
- `actions.ts`:
  - `issueMyCode()`: devuelve el código, su vencimiento y el QR como imagen;
  - `identifyCustomer(merchantId, …)`: resuelve el código y lleva a la caja con el cliente elegido, o muestra el mensaje que corresponda;
  - `enrollCustomer(merchantId, …)`.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/wallet/codigo` | cliente | QR grande, código corto, "Válido por 4:59" con cuenta atrás y renovación automática. Texto: "Muéstralo en caja para sumar puntos o canjear". Pide mantener la pantalla con buen brillo. |
| `/wallet` | cliente | Botón destacado **Mi código** arriba. |
| `/panel/[merchantId]/caja` | dueño y personal | Arriba: **Escanear QR** (abre la cámara dentro de la página) y un campo **Código del cliente**. Debajo, la búsqueda por nombre como hasta ahora. Al reconocer el código se abre la ficha del cliente. Si aún no es cliente: "Ana aún no es cliente" + **Unirlo al programa**. |

## Criterios de aceptación

- [ ] La migración se aplica y `customer_codes` no es accesible directamente desde la API (comprobado con script).
- [ ] El cliente abre "Mi código" y ve un QR y un código corto que se renuevan solos antes de caducar.
- [ ] En caja, escanear el QR con la cámara abre la ficha del cliente correcto.
- [ ] Escribir el código corto (con o sin guion, en minúsculas o mayúsculas) también abre la ficha.
- [ ] Un código caducado o inexistente muestra "Código no válido o caducado. Pide al cliente que lo actualice".
- [ ] El código de alguien que no es cliente ofrece unirlo (si el programa está activo) y, tras unirlo, abre su ficha.
- [ ] El código del dueño o del personal del comercio se rechaza.
- [ ] Un comercio no puede saber nada de un código de una persona que no es su cliente, salvo su nombre al mostrarle el código en caja. Los clientes no pueden resolver códigos.
- [ ] La búsqueda por nombre sigue funcionando.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build y `npm test`.
- **RLS**: `npm run verify:rls` ampliado:
  - emitir y resolver códigos;
  - caducidad: se comprueba que un código reemplazado deja de funcionar; el vencimiento por tiempo se verifica en la función;
  - quién puede resolver;
  - unir desde caja;
  - la tabla no es accesible.
- **Pruebas de humo**:
  - la pantalla "Mi código";
  - escribir el código en caja abre la ficha;
  - unir a un cliente nuevo.

  Envían los formularios de verdad.
- **Manual en el navegador**: ver "Riesgos" para la cámara.

**Resultado automático (2026-11-17)**:
- lint, typecheck y build sin errores;
- `npm test` 36/36 (7 nuevas: formato del código corto y de la cuenta atrás);
- `verify:rls` 213/213 (26 nuevas: emitir códigos, tabla inaccesible, resolver como dueño o personal, mismo código en varios comercios, persona no cliente, personal, código desconocido, clientes y otros comercios sin acceso, reutilización durante su vigencia, reemplazo del código anterior y unión desde caja con todas sus reglas);
- prueba de humo (script temporal, no versionado) contra el build de producción: 18/18. Cubre "Mi código", escribir el código en caja, códigos caducados, desconocidos o con mal formato, el código del dueño, unir a un cliente nuevo y el programa pausado;
- sin regresiones en las pruebas de humo de los Módulos 2 a 6;
- el servidor de desarrollo responde desde la dirección de red de la computadora (`allowedDevOrigins` se rellena solo con sus direcciones privadas).

**Hallazgo sobre los formularios sin JavaScript**: el `InvariantError` que veníamos anotando desde el Módulo 2 es un fallo de Next.js **solo en modo desarrollo** (`node_modules/next/dist/server/request/cookies.js` compara el objeto de cookies con uno distinto del que acaba de elegir). En producción no ocurre. Además, sin JavaScript la página vuelve a mostrarse **sin el mensaje** de la acción (el mensaje viaja en los datos de la página, pero no se pinta). Esto afecta a todos los formularios desde el Módulo 2, no solo a este. Con JavaScript, que es el uso real, todo funciona. Por eso la prueba de humo llama a las acciones como lo hace el navegador con JavaScript.

Decisión técnica en el [ADR 0007](../architecture/adr/0007-codigo-temporal-del-cliente.md).

Falta la prueba manual en el navegador.

## Riesgos

- **Probar la cámara en desarrollo.** El navegador solo permite usar la cámara en páginas seguras (HTTPS) o en `localhost`. Para probarla:
  - **Con la webcam de tu computadora** (abriendo la caja en `localhost`), escaneando el QR que muestra el teléfono. El teléfono puede abrir la billetera con la dirección de red de tu computadora (como `http://192.168.0.10:3000`) si están en la misma WiFi. Para eso hay que permitir esa dirección en la configuración de desarrollo de Next.js (`allowedDevOrigins`), un ajuste que solo afecta a tu computadora.
  - **Sin webcam**, la prueba se hace escribiendo el código corto. El escaneo con el teléfono del cajero llegará con el despliegue (Módulo 10).
- **Pantallas con poco brillo o luz**: el código corto escrito es la alternativa.

## Preguntas abiertas

- [ ] ¿Duración del código distinta de 5 minutos? Se puede ajustar fácilmente.
- [ ] ¿Mostrar el QR también en la ficha de cada programa de la billetera? Por ahora hay un único botón "Mi código".
