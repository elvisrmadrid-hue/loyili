# Roadmap

Desarrollo progresivo: un módulo a la vez, cada uno especificado, implementado, verificado y validado por el usuario antes de pasar al siguiente. Cada módulo incluye su parte de base de datos **y** sus pantallas.

Estados: ⬜ pendiente · 🟦 en curso · 🟨 en verificación · ✅ completado

| # | Módulo | Resultado verificable | Estado |
|---|---|---|---|
| 0 | **Entorno y fundamentos** | Proyecto Next.js arranca; estructura, documentación y `CLAUDE.md` listos | 🟨 |
| 1 | **Conexión a Supabase y autenticación base** | Proyecto Supabase creado y conectado; registro, inicio y cierre de sesión funcionan; rutas protegidas | ⬜ |
| 2 | **Comercios** | Un usuario crea su comercio, sus sucursales e invita personal; RLS aísla cada comercio | ⬜ |
| 3 | **Programa de fidelización** | El comercio configura su regla de acumulación | ⬜ |
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
- Pendiente: instalar Git e inicializar el repositorio (requiere permiso del usuario).
