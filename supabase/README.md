# supabase

Todo lo relativo a la base de datos.

| Ruta | Contenido |
|---|---|
| `migrations/` | Archivos SQL versionados (`AAAAMMDDHHMMSS_descripcion.sql`). Es la **única** forma de cambiar el esquema. |
| `seed.sql` | Datos de prueba para desarrollo (se crea cuando haya tablas). |
| `config.toml` | Configuración de la CLI de Supabase (se genera si se adopta la CLI). |

Reglas:
- Toda tabla con datos de negocio activa RLS y define políticas explícitas.
- `point_transactions` (ledger) solo admite inserciones.
- Las migraciones ya aplicadas no se editan: se crea una nueva.
