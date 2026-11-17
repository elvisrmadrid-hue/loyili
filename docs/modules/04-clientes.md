# Módulo 04 — Clientes y membresías

- **Estado**: validado (2026-11-16)
- **Fecha**: 2026-11-13

## Objetivo

Que un cliente se una al programa de un comercio abriendo su enlace o escaneando su QR, y que lo vea en su billetera. Que el comercio vea la lista de sus clientes. La **membresía** (cliente ↔ comercio) es la "tarjeta" sobre la que el Módulo 5 acumulará los puntos.

## Decisiones tomadas (2026-11-13)

| Tema | Decisión | Motivo |
|---|---|---|
| Cómo se une un cliente | Abre el **enlace o QR del comercio**, inicia sesión o crea su cuenta y pulsa "Unirme". | No da trabajo al personal ni depende del correo. Más adelante (Módulo 7), escanear el QR del cliente en caja también podrá unirlo. |
| Enlace público | **Código corto aleatorio**, por ejemplo `/unirse/K7P2QX`. | Se genera solo, nunca choca con otro comercio y no cambia si el comercio cambia de nombre. Pensado para imprimirse como QR. |
| Datos que ve el comercio | **Solo el nombre y desde cuándo es cliente.** El saldo se añade en el Módulo 5. | Protege la privacidad: el comercio no obtiene emails ni teléfonos. |
| Salir de un programa | **No por ahora.** | Qué pasa con los puntos al salir se decide cuando exista el saldo (Módulo 5). |

## Propuestas validadas (2026-11-16)

| Tema | Propuesta |
|---|---|
| Formato del código | **6 caracteres** de un alfabeto sin caracteres que se confundan: sin `0`, `O`, `1` ni `I`. Da unos mil millones de combinaciones. Se acepta en mayúsculas o minúsculas. |
| Comercios existentes | La migración genera un código para cada comercio que ya existe; los nuevos lo reciben al crearse. |
| Cambiar el código | **No en este módulo.** Cambiarlo invalidaría los carteles ya impresos. El código no es secreto: su función es que lo vea cualquiera. |
| Página pública | `/unirse/[código]` se ve **sin iniciar sesión**: nombre del comercio, su regla ("Gana 1 punto por cada $ 1.000") y el botón para unirse. Así, quien escanea el cartel sabe de qué se trata antes de crear una cuenta. |
| Programa no activo | Si el comercio **no tiene programa o lo tiene pausado**, la página lo explica y **no permite unirse**. Quien ya es cliente lo sigue siendo y lo ve como "Pausado" en su billetera. |
| El personal no se une a su propio comercio | El dueño y el personal **no pueden ser clientes del comercio en el que trabajan**. Así nadie podrá acreditarse puntos a sí mismo en el Módulo 5. Sí pueden ser clientes de otros comercios. |
| Quién ve la lista de clientes | El **dueño y el personal**: el personal la necesitará en caja (Módulos 5 y 7). Solo ven el nombre y la fecha. |
| Cartel con QR | El dueño ve el enlace con un botón para copiarlo, el **QR** y un botón **"Imprimir cartel"**: una página lista para imprimir con el nombre del comercio, la regla y el QR. |

## Alcance

**Incluye**
- Código de unión por comercio (columna nueva en `merchants`).
- Tabla `memberships` con RLS.
- Página pública `/unirse/[código]` y unión con un clic (o tras iniciar sesión o registrarse, volviendo a la misma página).
- Billetera `/wallet`: "Mis programas", con el nombre del comercio, su regla, su estado y desde cuándo soy cliente.
- Panel del comercio:
  - nueva pestaña **Clientes**: número de clientes y lista con nombre y fecha;
  - para el dueño, una tarjeta "Invita a tus clientes" con el enlace, el QR y "Imprimir cartel".
- Página de cartel imprimible.
- Librería para dibujar el QR (dependencia nueva del proyecto: `qrcode`).
- Script de verificación de RLS ampliado y pruebas de Vitest para el formato del código.

**No incluye**
- Saldo, puntos o movimientos: Módulo 5.
- QR personal del cliente y escaneo en caja: Módulo 7.
- Alta de clientes por el personal, o búsqueda y filtros en la lista.
- Salir de un programa, bloquear clientes o cambiar el código del comercio.
- Datos de contacto del cliente (email, teléfono).

## Historias de usuario

- Como **cliente**, quiero **escanear el QR del mostrador y unirme** para **empezar a ganar puntos en ese comercio**.
- Como **cliente sin cuenta**, quiero **crear mi cuenta desde el enlace y volver a él** para **unirme sin perderme**.
- Como **cliente**, quiero **ver en mi billetera los programas a los que pertenezco** y la regla de cada uno.
- Como **dueño**, quiero **imprimir un cartel con mi QR** para **ponerlo en el mostrador**.
- Como **dueño o personal**, quiero **ver la lista de clientes** del comercio.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_memberships.sql`

**Cambio en `public.merchants`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `join_code` | `text` | `not null unique`, formato `^[A-HJ-NP-Z2-9]{6}$`, generado por defecto con `private.generate_join_code()` |

**Tabla `public.memberships`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK (el ledger del Módulo 5 apuntará aquí) |
| `merchant_id` | `uuid` | FK → `merchants(id) on delete cascade` |
| `customer_id` | `uuid` | FK → `profiles(id) on delete cascade` |
| `created_at` | `timestamptz` | `not null default now()` |

- Único (`merchant_id`, `customer_id`): una sola membresía por cliente y comercio.
- Índice por `customer_id`, para la billetera.

**Funciones**

| Función | Quién | Qué hace |
|---|---|---|
| `get_join_preview(code)` | cualquiera, también sin sesión | Devuelve el nombre del comercio, su moneda y su regla (o "sin programa / pausado"). Si quien llama tiene sesión, indica además si ya es cliente o si trabaja en ese comercio. No expone nada más. |
| `join_merchant(code)` | con sesión | Valida el código, que el programa esté activo y que quien llama no trabaje en el comercio. Crea la membresía, o no hace nada si ya existía, y devuelve el `merchant_id`. |

Ambas son `security definer` con `search_path = ''`.

**Políticas RLS y permisos**

| Tabla | Leer | Crear | Modificar | Borrar |
|---|---|---|---|---|
| `memberships` | el propio cliente; el dueño y el personal del comercio | solo vía `join_merchant` | nadie | nadie (fuera de alcance) |
| `merchants` (nuevo) | también sus clientes (para mostrar el nombre en la billetera) | — | — | — |
| `loyalty_programs` (nuevo) | también los clientes del comercio (para mostrar la regla) | — | — | — |
| `profiles` (nuevo) | el dueño y el personal pueden leer el **nombre** de sus clientes | — | — | — |

Los clientes **no** ven las sucursales, el personal, las invitaciones ni a otros clientes.

## Lógica de servidor

`src/modules/customers/` (módulo nuevo)
- `rules.ts`: `normalizeJoinCode(text)`, que pasa a mayúsculas, quita espacios y valida el formato. Probada con Vitest.
- `queries.ts`:
  - `getJoinPreview(code)`;
  - `getMyMemberships()`: la billetera;
  - `getCustomers(merchantId)`: la lista del comercio.
- `actions.ts`: `joinMerchant(code)`, que al terminar lleva a `/wallet` con un mensaje de bienvenida.
- `index.ts`: la API pública. El módulo usa `merchants`, `loyalty` y `auth` a través de sus `index.ts`.

Cambios en otros módulos:
- `/unirse` **no** se añade a las rutas protegidas: la página es pública y solo el botón exige sesión.
- `merchants` expone el código de unión del comercio, que solo ven sus miembros.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/unirse/[código]` | cualquiera | Nombre del comercio y su regla. **Sin sesión**: "Crear cuenta para unirme" e "Ya tengo cuenta", que vuelven aquí. **Con sesión**: botón "Unirme". Mensajes claros si ya soy cliente (con enlace a la billetera), si trabajo en el comercio, si el programa no está activo o si el código no existe. |
| `/wallet` | con sesión | "Mis programas": una tarjeta por comercio con su nombre, su regla, "Pausado" si aplica y "Cliente desde…". Sin programas: "Escanea el QR de un comercio para unirte". Se mantiene el enlace al panel del comercio. |
| `/panel/[merchantId]/clientes` | miembros | Número de clientes y lista (nombre, cliente desde). **Dueño**: tarjeta "Invita a tus clientes" con el enlace, el botón de copiar, el QR y "Imprimir cartel". |
| `/panel/[merchantId]/clientes/cartel` | dueño | Página para imprimir: nombre del comercio, "Únete y gana puntos", la regla, el QR grande y el enlace escrito. |
| Menú del comercio | miembros | Nueva pestaña **Clientes**. |
| Portada del comercio | miembros | Añade el número de clientes. |

## Criterios de aceptación

- [ ] La migración se aplica con `npx supabase db push --remote`. Los comercios existentes reciben su código y `memberships` queda con RLS activado.
- [ ] Sin iniciar sesión, `/unirse/[código]` muestra el comercio y su regla. Un código inexistente muestra un mensaje claro.
- [ ] Una persona **sin cuenta** abre el enlace, se registra, vuelve a la página, se une y ve el programa en su billetera.
- [ ] Una persona **con cuenta** abre el enlace, inicia sesión (si hace falta) y se une con un clic.
- [ ] Unirse dos veces no duplica nada; la página dice "Ya eres cliente".
- [ ] Con el programa pausado o sin configurar no se puede unir nadie (ni desde la pantalla ni desde la API).
- [ ] El dueño y el personal no pueden unirse como clientes de su propio comercio.
- [ ] La billetera muestra cada programa con su regla y su estado.
- [ ] El dueño y el personal ven la lista de clientes (solo nombre y fecha), y el número en la portada.
- [ ] El dueño copia el enlace, ve el QR e imprime el cartel. El QR escaneado con un teléfono abre la página de unión.
- [ ] Un cliente no ve las sucursales, el personal, las invitaciones ni a otros clientes de un comercio, ni puede modificar nada del comercio (comprobado con script).
- [ ] Un comercio no ve los clientes de otro comercio.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build.
- **Vitest**: `normalizeJoinCode` (minúsculas, espacios, caracteres no permitidos, longitud).
- **RLS**: `npm run verify:rls` ampliado:
  - vista previa sin sesión con un código válido y con uno inválido;
  - sin sesión no se puede unir;
  - unirse, y unirse dos veces sin duplicar;
  - no se puede unir con el programa pausado o sin programa;
  - el personal y el dueño no pueden unirse a su propio comercio;
  - qué ve y qué no ve un cliente;
  - aislamiento entre comercios;
  - nadie inserta ni borra membresías directamente.
- **Manual en el navegador**:
  - ventana normal como dueño (enlace, QR, cartel, lista de clientes);
  - ventana privada como cliente nuevo (abrir el enlace sin sesión, registrarse, unirse, ver la billetera);
  - escanear el QR con el teléfono.

## Riesgos

- **Prueba del QR en el teléfono**: mientras la aplicación corre en tu computadora (`localhost`), el teléfono no puede abrir ese enlace. Opciones para probarlo:
  - escanear el QR solo para comprobar que contiene el enlace correcto;
  - o abrir la aplicación desde el teléfono con la dirección de red local (como `http://192.168.0.10:3000`), si ambos están en la misma red WiFi.

  La prueba completa desde el teléfono llegará con el despliegue (Módulo 10).

## Preguntas abiertas

- [ ] ¿Puede un cliente salir de un programa? ¿Qué pasa con sus puntos? (Decidir en el Módulo 5 o después.)
- [ ] ¿Debe poder el dueño cambiar el código del comercio (por ejemplo, si quiere invalidar carteles viejos)?
- [ ] ¿Alta de clientes en caja por el personal? (Descartado por ahora.)
