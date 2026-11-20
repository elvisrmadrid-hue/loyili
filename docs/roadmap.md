# Roadmap

Desarrollo progresivo: un módulo a la vez, cada uno especificado, implementado, verificado y validado por el usuario antes de pasar al siguiente. Cada módulo incluye su parte de base de datos **y** sus pantallas.

Estados: ⬜ pendiente · 🟦 en curso · 🟨 en verificación · ✅ completado

| # | Módulo | Resultado verificable | Estado |
|---|---|---|---|
| 0 | **Entorno y fundamentos** | Proyecto Next.js arranca; estructura, documentación y `CLAUDE.md` listos | ✅ |
| 1 | **Conexión a Supabase y autenticación base** | Proyecto Supabase creado y conectado; registro, inicio y cierre de sesión funcionan; rutas protegidas | ✅ |
| 2 | **Comercios** | Un usuario crea su comercio, sus sucursales e invita personal; RLS aísla cada comercio | ✅ |
| 3 | **Programa de fidelización** | El comercio configura su regla de acumulación | ✅ |
| 4 | **Clientes y membresías** | Un cliente queda asociado a un comercio; el comercio ve su lista de clientes | ✅ |
| 5 | **Ledger de puntos: acumulación** | El personal registra una compra y se acreditan los puntos correctos; saldo e historial correctos (con pruebas automáticas) | ✅ |
| 6 | **Recompensas y canje** | Catálogo de recompensas; canje que descuenta puntos y nunca deja saldo negativo | ✅ |
| 7 | **Identificación por QR** | El cliente muestra su QR; el personal lo escanea para acreditar o canjear | ✅ |
| 8 | **Billetera PWA** | La billetera se instala en el teléfono y se ve bien en móvil | 🟨 |
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

### Módulo 4 — Clientes y membresías
- 2026-11-16: especificación validada ([04-clientes.md](modules/04-clientes.md)). Unión por enlace o QR con código corto; el comercio solo ve nombre y fecha; sin salida del programa por ahora.
- 2026-11-16: implementado. Migración `create_memberships` aplicada (código de unión por comercio, tabla `memberships` con RLS, funciones `get_join_preview` y `join_merchant`). Página pública `/unirse/[código]`, billetera "Mis programas", pestaña "Clientes" con enlace, QR y cartel imprimible. `npm test` 20/20, `verify:rls` 116/116. Pendiente: prueba manual del usuario.
- 2026-11-16: prueba manual del usuario correcta. Módulo cerrado.

### Módulo 5 — Ledger de puntos: acumulación
- 2026-11-16: especificación validada ([05-ledger-acumulacion.md](modules/05-ledger-acumulacion.md)). Búsqueda por nombre en caja, anulación solo del dueño con motivo, sin ajustes manuales, sucursales con compras no eliminables.
- 2026-11-16: implementado en dos partes. Migración `create_point_transactions` aplicada (ledger inmutable, saldo materializado, `record_purchase`, `reverse_transaction`, bloqueos de moneda y sucursal). Pantalla "Registrar compra", detalle de cliente con historial y anulación, saldo y movimientos en la billetera. `npm test` 29/29, `verify:rls` 155/155. Decisiones en [ADR 0005](architecture/adr/0005-saldo-materializado-y-forma-del-ledger.md). Pendiente: prueba manual del usuario.
- 2026-11-17: prueba manual del usuario correcta, sin errores en el registro del servidor. Se mantiene la lectura de montos según el formato de cada moneda. Módulo cerrado.

### Módulo 6 — Recompensas y canje
- 2026-11-17: especificación validada ([06-recompensas-canje.md](modules/06-recompensas-canje.md)). Canje en caja por el personal; anulación solo del dueño con motivo; sin stock ni fechas; catálogo visible para clientes y en la página pública; con el programa pausado se puede seguir canjeando.
- 2026-11-17: implementado. Migración `create_rewards` aplicada (catálogo con RLS, movimiento `REDEEM`, `redeem_reward`, anulación de canjes, `get_public_rewards`). Pestañas "Recompensas" y "Caja" (compra y canje), canjes en el historial, catálogo en la billetera y en la página pública. `verify:rls` 187/187. Decisión en [ADR 0006](architecture/adr/0006-canje-como-movimiento-del-ledger.md). Pendiente: prueba manual del usuario.
- 2026-11-17: prueba manual del usuario correcta. Módulo cerrado.

### Módulo 7 — Identificación por QR
- 2026-11-17: especificación validada ([07-identificacion-qr.md](modules/07-identificacion-qr.md)). Código temporal de 5 minutos que se renueva solo, un código por persona, código corto de 8 caracteres, unión de clientes nuevos desde caja.
- 2026-11-17: implementado. Migración `create_customer_codes` aplicada (tabla sin acceso directo, `issue_customer_code`, `resolve_customer_code`, `enroll_customer_by_code`). Pantalla "Mi código" en la billetera; en caja, escanear QR (jsQR), escribir el código y "Unirlo al programa". `npm test` 36/36, `verify:rls` 213/213. Decisión en [ADR 0007](architecture/adr/0007-codigo-temporal-del-cliente.md). Pendiente: prueba manual del usuario.
- 2026-11-19: prueba manual del usuario correcta. Corregido un caso: al volver a "Mi código" se veía una copia guardada con el código anterior; ahora el navegador pide siempre un código nuevo. Módulo cerrado.

### Módulo 8 — Billetera PWA
- 2026-11-19: especificación validada ([08-billetera-pwa.md](modules/08-billetera-pwa.md)). Una sola app que abre en `/inicio`, ícono provisional (sin logo todavía), sin modo sin conexión ni service worker, tarjeta para instalar, pantalla encendida en "Mi código".
- 2026-11-19: implementado. Manifiesto, íconos generados por código, color de barra y márgenes seguros, tarjeta "Instala Loyili", aviso "Sin conexión", Wake Lock en "Mi código" y botones de 44 px. `npm test` 41/41. Pendiente: prueba manual del usuario.
