# Módulo 01 — Conexión a Supabase y autenticación base

- **Estado**: borrador
- **Fecha**: 2026-11-10

## Objetivo

Conectar la aplicación a un proyecto Supabase de desarrollo y permitir que cualquier persona cree una cuenta, inicie y cierre sesión con email y contraseña. Las áreas privadas (`/panel` y `/wallet`) quedan protegidas: sin sesión, se redirige al login. Es la base sobre la que se apoyan todos los módulos siguientes.

## Decisiones tomadas (2026-11-10)

| Tema | Decisión | Motivo |
|---|---|---|
| Método de acceso | **Email + contraseña** | Lo más simple y gratuito. Otros métodos (código por email, SMS) se pueden añadir después sin rehacer nada. |
| Tipo de cuenta | **Una sola cuenta para todos** | No se elige rol al registrarse. Lo que la persona puede hacer lo dan sus relaciones: dueño/personal de un comercio (Módulo 2) o cliente de un comercio (Módulo 4). Una misma persona puede ser ambas cosas. |
| Confirmación de email | **Desactivada por ahora** | Agiliza las pruebas en desarrollo. Se reconsidera antes del despliegue (Módulo 10). |

## Alcance

**Incluye**
- Creación del proyecto Supabase de desarrollo (plan gratuito) — la hace el usuario, guiado paso a paso.
- Instalación de `@supabase/ssr`, `@supabase/supabase-js` y `zod`.
- Instalación de la **CLI de Supabase como dependencia del proyecto** (`npm install -D supabase`, no global) para aplicar migraciones con `npx supabase db push`. Así el esquema siempre sale de `supabase/migrations/`, nunca de cambios a mano en el panel.
- Configuración de `.env.local` (la completa el usuario; Claude no lee ese archivo).
- Clientes de Supabase en `src/lib/supabase/`: `client.ts`, `server.ts`, `proxy.ts`.
- `src/proxy.ts`: refresco de la sesión en cada petición y redirección optimista.
- Tabla `profiles` (1:1 con `auth.users`), creada automáticamente al registrarse, con RLS.
- Pantallas: registro, inicio de sesión, recuperar contraseña, restablecer contraseña.
- Cierre de sesión desde las áreas privadas.
- Protección de `/panel` y `/wallet`.

**No incluye**
- Roles, comercios o membresías (Módulos 2 y 4).
- Edición del perfil (nombre, teléfono).
- Otros métodos de acceso (código por email, SMS, Google…).
- Confirmación de email obligatoria.
- Proveedor de correo propio (SMTP). Se usa el envío de correos incluido en Supabase, que tiene un límite bajo (ver *Riesgos*).
- `admin.ts` con la clave secreta: este módulo no la necesita.
- Pruebas automáticas (Vitest): no hay todavía lógica de negocio propia; la verificación es manual + script de comprobación de RLS.

## Historias de usuario

- Como **visitante**, quiero **crear una cuenta con mi nombre, email y contraseña** para **empezar a usar Loyili**.
- Como **usuario registrado**, quiero **iniciar sesión** para **acceder a mi billetera o a mi panel**.
- Como **usuario con sesión**, quiero **cerrar sesión** para **que nadie más use mi cuenta en este dispositivo**.
- Como **usuario que olvidó su contraseña**, quiero **recibir un enlace por correo para crear una nueva** para **recuperar el acceso**.
- Como **visitante sin sesión**, si intento abrir `/panel` o `/wallet`, quiero **ser llevado al login y, tras entrar, volver a donde iba**.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_profiles.sql`

**Tabla `public.profiles`**

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, `references auth.users(id) on delete cascade` |
| `full_name` | `text` | `not null`, entre 1 y 100 caracteres (sin espacios sobrantes) |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()`, actualizada por trigger |

`profiles` no tiene `merchant_id`: no es dato de un comercio, es el dato de la persona. Aun así lleva **RLS activado**.

**Políticas RLS**
- `select`: un usuario solo ve su propia fila (`id = auth.uid()`).
- `update`: un usuario solo modifica su propia fila y no puede cambiar el `id`. (Este módulo no tiene pantalla de edición; la política se deja lista.)
- Sin políticas de `insert` ni `delete` para usuarios: la fila la crea el trigger y se borra en cascada si se borra la cuenta.

**Funciones y triggers**
- `handle_new_user()` (trigger `after insert on auth.users`): crea la fila en `profiles` con el `full_name` enviado en el registro. Es `security definer` con `search_path` fijado (buena práctica de seguridad de Supabase).
- `set_updated_at()` (trigger `before update on profiles`): mantiene `updated_at`.

## Lógica de servidor

`src/modules/auth/`
- `schemas.ts` — Zod:
  - `signUpSchema`: `fullName` (1–100, se recortan espacios), `email` (formato válido), `password` (mínimo 8 caracteres).
  - `signInSchema`: `email`, `password` (no vacía).
  - `requestPasswordResetSchema`: `email`.
  - `updatePasswordSchema`: `password` (mínimo 8) + confirmación igual.
- `actions.ts` — Server Actions: `signUp`, `signIn`, `signOut`, `requestPasswordReset`, `updatePassword`. Validan con Zod en el servidor y devuelven errores en español para el formulario.
- `queries.ts` — `getCurrentUser()` y `requireUser()` (redirige a `/login` si no hay sesión). Las páginas privadas llaman a `requireUser()`: es la comprobación **definitiva**; la de `proxy.ts` es solo optimista.
- `index.ts` — lo que el resto de la app puede importar de este módulo.

Otras piezas:
- `src/app/auth/confirm/route.ts` — Route Handler que recibe el enlace del correo de recuperación, valida el token con Supabase y crea la sesión.
- Parámetro `next` en el login (volver a donde se iba): solo se aceptan rutas internas que empiecen por `/`, para evitar redirecciones a sitios externos (*open redirect*).

## Pantallas

| Ruta | Grupo | Qué muestra |
|---|---|---|
| `/registro` | `(public)` | Formulario: nombre, email, contraseña. Enlace a login. Tras registrarse entra directo. |
| `/login` | `(public)` | Formulario: email, contraseña. Enlaces a registro y a "¿Olvidaste tu contraseña?". |
| `/recuperar` | `(public)` | Formulario: email. Mensaje genérico de "si el correo existe, te enviamos un enlace" (no revela si la cuenta existe). |
| `/restablecer` | `(public)` | Formulario: nueva contraseña + confirmación. Solo funciona llegando desde el enlace del correo. |
| `/wallet` | `(wallet)` | Protegida. Saludo con el nombre del usuario + botón "Cerrar sesión". (El contenido real llega en módulos posteriores.) |
| `/panel` | `(merchant)` | Protegida. Igual que `/wallet`. |
| `/` | `(public)` | Landing actual + botones "Iniciar sesión" / "Crear cuenta" (o "Ir a mi billetera" si ya hay sesión). |

Comportamiento:
- Usuario **con sesión** que abre `/login` o `/registro` → se le lleva a `/wallet`.
- Tras iniciar sesión sin `next` → `/wallet` (ver *Preguntas abiertas*).
- Formularios con estado de "enviando…" y mensajes de error claros en español.

## Configuración en el panel de Supabase (no es esquema)

Pasos que hace el usuario, guiado:
1. Crear cuenta en supabase.com y un proyecto `loyili-dev` (plan gratuito), guardando la contraseña de la base de datos.
2. Copiar URL del proyecto y claves a `.env.local`.
3. *Authentication → Sign In / Providers → Email*: desactivar **Confirm email**; contraseña mínima 8.
4. *Authentication → URL Configuration*: Site URL `http://localhost:3000` y URL de redirección `http://localhost:3000/**`.
5. *Authentication → Email Templates → Reset password*: ajustar el enlace para que apunte a `/auth/confirm` (se indicará el texto exacto).
6. `npx supabase login` y `npx supabase link` para conectar la CLI con el proyecto.

## Criterios de aceptación

- [ ] La app arranca con `.env.local` configurado y se conecta al proyecto Supabase.
- [ ] La migración se aplica con `npx supabase db push` y crea `profiles` con RLS activado.
- [ ] Un visitante crea una cuenta en `/registro` y queda con sesión iniciada en `/wallet`, viendo su nombre.
- [ ] Al registrarse se crea automáticamente su fila en `profiles`.
- [ ] Registro con email ya usado, email inválido o contraseña de menos de 8 caracteres muestra un error claro y no crea nada.
- [ ] Un usuario inicia sesión en `/login`; con credenciales incorrectas ve "Email o contraseña incorrectos".
- [ ] "Cerrar sesión" termina la sesión y lleva a `/`; después, `/wallet` ya no es accesible.
- [ ] Sin sesión, `/panel` y `/wallet` redirigen a `/login?next=...` y, tras entrar, se vuelve a la ruta original.
- [ ] Un `next` externo (p. ej. `https://otro-sitio.com`) se ignora.
- [ ] La sesión se mantiene al recargar la página y al cerrar y abrir el navegador.
- [ ] Recuperación: `/recuperar` envía el correo; el enlace lleva a `/restablecer`; tras cambiarla, se entra con la contraseña nueva.
- [ ] RLS: un usuario no puede leer el perfil de otro (comprobado con script).
- [ ] `SUPABASE_SECRET_KEY` no aparece en ningún archivo que llegue al navegador.
- [ ] `npm run lint`, `npm run typecheck` y `npm run build` pasan sin errores.

## Verificación

- **Automática**: `npm run lint`, `npm run typecheck`, `npm run build`.
- **RLS**: script temporal (fuera del proyecto, en la carpeta temporal de la sesión) que inicia sesión con dos usuarios de prueba usando la clave publicable y comprueba que cada uno solo ve su propio perfil.
- **Manual en el navegador**: recorrer cada criterio de aceptación (registro, login, errores, logout, rutas protegidas, `next`, recarga, recuperación).

## Riesgos

- **Límite de correos de Supabase**: sin SMTP propio, el plan gratuito solo envía unos pocos correos por hora. Afecta únicamente a la recuperación de contraseña (la confirmación está desactivada). Si molesta en pruebas, se decide configurar un SMTP en un módulo posterior.
- **Cuentas con emails ajenos**: al no confirmar el email, alguien podría registrarse con un correo que no es suyo. Aceptable en desarrollo; se revisa antes del despliegue.

## Preguntas abiertas

- [ ] Tras iniciar sesión (sin `next`), ¿a dónde va el usuario? Propuesta: `/wallet`, porque toda persona puede ser cliente; quien tenga comercio entrará al panel desde un enlace. Se puede refinar en el Módulo 2 (p. ej. ir a `/panel` si la persona es dueña de un comercio).
- [ ] Región del proyecto Supabase: conviene la más cercana a los usuarios (depende del país objetivo, pregunta abierta en [vision.md](../vision.md)). Para desarrollo da igual; para producción (Módulo 10) importa.
