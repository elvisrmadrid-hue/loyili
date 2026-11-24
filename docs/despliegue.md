# Despliegue de Loyili

Cómo está publicada Loyili, cómo se publica un cambio y qué hacer si algo falla. Decisiones en el [Módulo 10](modules/10-despliegue.md).

## Piezas

| Pieza | Servicio | Para qué |
|---|---|---|
| Código | GitHub, repositorio **privado** `loyili` | Copia de seguridad y origen de las publicaciones. |
| App (Next.js) | Vercel, proyecto `loyili` | Sirve la web con HTTPS. Cada `git push` a `main` publica. |
| Base de datos de producción | Supabase, proyecto **`loyili-prod`** (referencia `ktmwrrvbelgtufbtkzot`) | Datos reales. **Nunca** se usa para pruebas. |
| Base de datos de desarrollo | Supabase, proyecto `loyili-dev` (vinculado a la CLI) | Desarrollo, `verify:rls` y pruebas de humo. |

**Regla de oro**: las pruebas automáticas (`verify:rls`, pruebas de humo) solo se ejecutan contra `loyili-dev`. Crean usuarios y movimientos que el ledger no permite borrar nunca. Contra producción solo se ejecuta `npm run verify:prod`, que no escribe nada.

## Región

Supabase y las funciones de Vercel deben estar en la misma región. Si están lejos entre sí, cada pantalla tarda más. La región de Vercel se fija en `vercel.json`.

| Clientes principalmente en… | Supabase | Vercel (`vercel.json`) |
|---|---|---|
| EE. UU. este, México, Centroamérica, Caribe, Colombia, Venezuela | `us-east-1` (N. Virginia) | `iad1` |
| Brasil, Argentina, Chile, Uruguay, Paraguay, Perú, Bolivia | `sa-east-1` (São Paulo) | `gru1` |
| EE. UU. oeste | `us-west-1` (N. California) | `sfo1` |
| España y Europa | `eu-central-1` (Fráncfort) | `fra1` |

`loyili-dev` está en `us-east-1`. **Decisión (2026-11-23)**: `loyili-prod` también va en `us-east-1`, con Vercel en `iad1`. Mercado inicial: Panamá y Centroamérica.

## Primera publicación (una sola vez)

### 1. Subir el código a GitHub
1. En github.com: **New repository** → nombre `loyili` → **Private**. **No** añadir README, `.gitignore` ni licencia; el repositorio debe nacer vacío.
2. En una terminal, dentro de `C:\Dev\Loyili`:
   ```
   git remote add origin https://github.com/TU-USUARIO/loyili.git
   git push -u origin main
   ```
3. Se abre el navegador para iniciar sesión en GitHub (Git Credential Manager). Autoriza y el envío continúa.

### 2. Crear la base de datos de producción
1. En supabase.com: **New project** → nombre `loyili-prod`, región según la tabla, contraseña de base de datos fuerte. Guárdala en tu gestor de contraseñas; no hace falta compartirla.
2. Cuando el proyecto esté listo, su **referencia** (*project ref*) aparece en la dirección del panel: `supabase.com/dashboard/project/<ref>`. La referencia no es secreta.
3. Aplicar las migraciones, sin cambiar el proyecto vinculado (que sigue siendo `loyili-dev`):
   ```
   npx supabase db push --remote=ktmwrrvbelgtufbtkzot --dry-run
   npx supabase db push --remote=ktmwrrvbelgtufbtkzot
   ```
4. Configuración de autenticación, en el panel de `loyili-prod`:
   - **Authentication → Sign In / Providers → Email**: desactivar **Confirm email** (no hay proveedor de correo propio) y fijar la **longitud mínima de contraseña en 8**.
   - **Authentication → URL Configuration**: **Site URL** = la dirección de Vercel (`https://….vercel.app`), y en **Redirect URLs** añadir `https://….vercel.app/**`. Se completa tras el paso 3, cuando se conozca la dirección.

### 3. Publicar en Vercel
1. En vercel.com: **Add New → Project** → importar el repositorio `loyili`. Vercel detecta Next.js solo.
2. **Environment Variables**: copia cada valor **directamente desde el panel de `loyili-prod`** (Project Settings → API Keys / Data API). Nunca los pegues en el chat.

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto `loyili-prod` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de `loyili-prod` |
   | `NEXT_PUBLIC_SITE_URL` | `https://….vercel.app`; si aún no la sabes, ponla tras la primera publicación y vuelve a publicar |

   `SUPABASE_SECRET_KEY` **no** se configura: la app no la usa. Menos secretos repartidos, menos riesgo.
3. **Deploy**. Al terminar, Vercel muestra la dirección pública.
4. Si `NEXT_PUBLIC_SITE_URL` cambió: **Deployments → … → Redeploy**. Después completa el paso 2.4.

### 4. Comprobar
1. Crea en `C:\Dev\Loyili` el archivo `.env.production.local`, ignorado por Git, **solo con los valores públicos**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   NEXT_PUBLIC_SITE_URL=https://....vercel.app
   ```
2. `npm run verify:prod`: tablas inaccesibles para visitantes, funciones presentes, contraseña mínima, HTTPS, cabeceras de seguridad, manifiesto y redirecciones.
3. En el teléfono: abrir la dirección, registrarse, instalar la app, crear tu comercio y escanear el QR de "Mi código" desde la caja.

## Publicar un cambio (día a día)

1. Desarrollar y verificar en local contra `loyili-dev` (lint, typecheck, build, `npm test`, `verify:rls`).
2. **Si el cambio incluye una migración**, aplicarla a producción **antes** de publicar el código que la usa:
   ```
   npx supabase db push --remote=ktmwrrvbelgtufbtkzot --dry-run
   npx supabase db push --remote=ktmwrrvbelgtufbtkzot
   ```
3. `git push`. Vercel publica en uno o dos minutos. Cada rama distinta de `main` recibe una dirección de vista previa.
4. `npm run verify:prod`.

## Si algo falla

- **La publicación falla en Vercel**: el registro del build (Deployments → la publicación → Build Logs) dice por qué. Producción sigue con la versión anterior mientras tanto.
- **Una versión publicada tiene un error**: Deployments → elegir la última versión buena → **Promote to Production** (vuelve atrás en segundos). Luego se corrige con calma.
- **Errores en el servidor**: Vercel → proyecto → **Logs**.
- **La base de datos "duerme"**: en el plan gratuito, Supabase pausa un proyecto tras una semana sin actividad. Se reactiva desde su panel (**Restore**).
- **Una migración aplicada a producción tiene un error**: nunca se edita. Se crea una migración nueva que lo corrige.
