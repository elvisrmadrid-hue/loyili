# src/lib/supabase

Clientes de Supabase. Se implementan en el **Módulo 1** con `@supabase/ssr`:

| Archivo | Dónde se usa |
|---|---|
| `client.ts` | Componentes de navegador (`"use client"`) |
| `server.ts` | Server Components, Server Actions y Route Handlers (lee la sesión desde cookies) |
| `proxy.ts` | Usado por `src/proxy.ts` para refrescar la sesión en cada petición |
| `admin.ts` | Solo servidor, con la clave secreta. Uso excepcional y justificado |

La clave secreta nunca debe importarse desde código que llegue al navegador.
