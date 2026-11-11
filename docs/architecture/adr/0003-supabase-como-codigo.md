# ADR 0003 — Esquema y configuración de Supabase como código

- **Fecha**: 2026-11-10
- **Estado**: Aceptada

## Contexto

Supabase permite crear tablas, políticas y ajustes de autenticación con clics en su panel web. Es cómodo, pero no queda registro de qué se cambió ni por qué. Además, no se puede reproducir en otro proyecto (por ejemplo, el de producción del Módulo 10) y es fácil olvidar un permiso o dejar una tabla expuesta.

## Decisión

1. **Migraciones con la CLI de Supabase**, instalada como dependencia de desarrollo del proyecto (`npm install -D supabase`, no global).
   - El esquema solo cambia mediante archivos en `supabase/migrations/`, que se aplican con `npx supabase db push --remote`.
   - Antes de aplicar se ensaya con `--dry-run`.
2. **Ajustes de autenticación en [supabase/config.toml](../../../supabase/config.toml)**: URLs permitidas, confirmación de email, longitud mínima de contraseña y plantillas de correo.
   - Se aplican con `npx supabase config push`, revisando antes las diferencias con `npx supabase config diff`.
   - Los valores que no queremos cambiar se alinean con los del proyecto remoto para que el diff muestre solo lo intencionado.
3. **Permisos explícitos**:
   - El proyecto se creó con *Automatically expose new tables* desactivado.
   - Cada migración activa RLS, define sus políticas y concede con `grant` solo los permisos mínimos (por ejemplo, `update` solo sobre las columnas editables).
4. **Funciones `security definer`** (por ejemplo, triggers sobre `auth.users`):
   - siempre con `set search_path = ''`;
   - se les quita el permiso de ejecución (`revoke execute`) a `public`, `anon` y `authenticated`.
5. **Verificación reproducible de RLS**: un script del proyecto (`npm run verify:rls`) actúa como usuarios reales e intenta saltarse las reglas. Se amplía en cada módulo que añada tablas.

## Consecuencias

- Todo cambio de base de datos o de autenticación queda en Git, con su historial y su motivo.
- El entorno de producción se podrá montar repitiendo las mismas migraciones y la misma configuración.
- Hay que acordarse de usar `--remote` en `db push`. Sin esa opción, la CLI intenta usar una base de datos local en Docker, que no tenemos instalada.
- **Limitación del plan gratuito**: con el proveedor de correo por defecto, Supabase no permite modificar plantillas de correo. La plantilla de recuperación en español ([supabase/templates/recovery.html](../../../supabase/templates/recovery.html)) queda guardada pero desactivada en `config.toml`. Se activará al configurar un SMTP propio.
- Cada ejecución de `verify:rls` crea usuarios de prueba en el proyecto de desarrollo, que hay que borrar de vez en cuando. Nunca debe ejecutarse contra producción.
