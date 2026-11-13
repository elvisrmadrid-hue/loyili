# Roadmap

Desarrollo progresivo: un módulo a la vez, cada uno especificado, implementado, verificado y validado por el usuario antes de pasar al siguiente. Cada módulo incluye su parte de base de datos **y** sus pantallas.

Estados: ⬜ pendiente · 🟦 en curso · 🟨 en verificación · ✅ completado

| # | Módulo | Resultado verificable | Estado |
|---|---|---|---|
| 0 | **Entorno y fundamentos** | Proyecto Next.js arranca; estructura, documentación y `CLAUDE.md` listos | ✅ |
| 1 | **Conexión a Supabase y autenticación base** | Proyecto Supabase creado y conectado; registro, inicio y cierre de sesión funcionan; rutas protegidas | ✅ |
| 2 | **Comercios** | Un usuario crea su comercio, sus sucursales e invita personal; RLS aísla cada comercio | ✅ |
| 3 | **Programa de fidelización** | El comercio configura su regla de acumulación | ✅ |
| 4 | **Clientes y membresías** | Un cliente queda asociado a un comercio; el comercio ve su lista de clientes | ⬜ |
| 5 | **Ledger de puntos: acumulación** | El personal registra una compra y se acreditan los puntos correctos; saldo e historial correctos (con pruebas automáticas) | ⬜ |
| 6 | **Recompensas y canje** | Catálogo de recompensas; canje que descuenta puntos y nunca deja saldo negativo | ⬜ |
| 7 | **Identificación por QR** | El cliente muestra su QR; el personal lo escanea para acreditar o canjear | ⬜ |
| 8 | **Billetera PWA** | La billetera se instala en el teléfono y se ve bien en móvil | ⬜ |
| 9 | **Reportes del comercio** | Métricas básicas (clientes activos, puntos emitidos/canjeados) | ⬜ |
| 10 | **Despliegue** | La aplicación publicada en internet (p. ej. Vercel + Supabase en producción) | ⬜ |
| 11+ | Notificaciones, administración de la plataforma, niveles, etc. | — | ⬜ |

## Registro de avance

### Módulo 0 — Entorno y fundamentos (2026-11-08)
- Proyecto Next.js 16.4.5 creado (TypeScript, Tailwind 4, ESLint, App Router, `src/`).
- Documentación inicial: visión, arquitectura, modelo de dominio, ADRs, plantilla de módulos, glosario.
- `CLAUDE.md` y configuración de Claude Code (`.claude/settings.json`).
- Estructura de carpetas: route groups `(public)`, `(merchant)`, `(wallet)`; `src/modules`, `src/lib/supabase`, `supabase/migrations`.
- 2026-11-10: Git 2.56 instalado con winget; repositorio inicializado (rama `main`) con el primer commit. Módulo cerrado.

### Módulo 1 — Conexión a Supabase y autenticación base (2026-11-10)
- Especificación validada ([01-supabase-auth.md](modules/01-supabase-auth.md)).
- Proyecto Supabase `loyili-dev` creado y enlazado con la CLI. Ajustes de autenticación versionados en `supabase/config.toml` y aplicados con `config push`.
- Migración `create_profiles` aplicada: tabla `profiles` con RLS, permisos por columna y trigger que crea el perfil al registrarse.
- Registro, inicio y cierre de sesión, recuperación de contraseña y protección de `/panel` y `/wallet` (`proxy.ts` + `requireUser`).
- Verificado: lint, typecheck, build, `npm run verify:rls` (12/12) y recorrido manual del usuario en el navegador. Módulo cerrado.
- Decisión registrada en [ADR 0003](architecture/adr/0003-supabase-como-codigo.md).
- Limitación conocida: la recuperación de contraseña solo funciona abriendo el correo en el mismo navegador, hasta configurar un SMTP propio.

### Módulo 2 — Comercios
- 2026-11-10: especificación validada ([02-comercios.md](modules/02-comercios.md)). Moneda editable mientras no haya compras registradas.
- 2026-11-10: implementado. Migración `create_merchants` aplicada (4 tablas con RLS, funciones `create_merchant`, `create_merchant_invitation`, `get_invitation_preview`, `accept_merchant_invitation`). Panel del comercio, sucursales, personal e invitaciones. Verificación automática: `verify:rls` 52/52. Pendiente: prueba manual del usuario.
- 2026-11-12: prueba manual del usuario en el navegador (dueño y personal en dos sesiones) correcta. Módulo cerrado.

### Módulo 3 — Programa de fidelización
- 2026-11-12: especificación validada ([03-programa-fidelizacion.md](modules/03-programa-fidelizacion.md)). Regla por monto gastado, redondeo hacia abajo, sin monto mínimo; vencimiento pospuesto.
- 2026-11-12: implementado. Migración `create_loyalty_programs` aplicada (tabla con RLS y pausa automática al cambiar la moneda). Pantalla "Programa" con calculadora de ejemplo, tarjeta en la portada y aviso en Ajustes. Vitest instalado (`npm test` 15/15). `verify:rls` 79/79. Decisiones en [ADR 0004](architecture/adr/0004-logica-pura-y-pruebas-unitarias.md). Pendiente: prueba manual del usuario.
- 2026-11-12: prueba manual del usuario correcta (dueño y personal). Módulo cerrado.
