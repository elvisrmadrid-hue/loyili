# Arquitectura — visión general

## Resumen

Loyili es una **aplicación Next.js full-stack** con **Supabase** como backend gestionado (base de datos PostgreSQL, autenticación y almacenamiento de archivos).

```
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│  Navegador / teléfono        │        │  Supabase (nube)                 │
│                              │        │                                  │
│  Billetera (cliente)  ─┐     │        │  ┌────────────┐  ┌────────────┐  │
│  Panel (comercio)     ─┤     │        │  │  Auth      │  │  Storage   │  │
└────────────────────────┼─────┘        │  └────────────┘  └────────────┘  │
                         │ HTTPS        │  ┌────────────────────────────┐  │
┌────────────────────────▼─────┐        │  │ PostgreSQL                 │  │
│  Next.js (servidor)          │  SQL / │  │  - tablas con RLS          │  │
│                              │  API   │  │  - funciones (earn/redeem) │  │
│  proxy.ts  → sesión          ├───────►│  │  - migraciones versionadas │  │
│  Server Components → lectura │        │  └────────────────────────────┘  │
│  Server Actions    → escritura        └──────────────────────────────────┘
└──────────────────────────────┘
```

## Capas

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| **Presentación** | `src/app/`, `src/components/` | Pantallas, formularios, navegación. Sin reglas de negocio. |
| **Aplicación / dominio** | `src/modules/<modulo>/` | Validación (Zod), consultas, Server Actions, reglas de cada módulo. |
| **Infraestructura** | `src/lib/supabase/` | Creación de clientes de Supabase para navegador, servidor y proxy. |
| **Datos** | `supabase/migrations/` | Esquema, políticas RLS y funciones SQL. Las reglas críticas (saldo, canje) también se aseguran aquí. |

Dirección de dependencias: `app → modules → lib`. Nunca al revés.

## Áreas de la aplicación (route groups)

| Grupo | URL | Para quién |
|---|---|---|
| `(public)` | `/`, `/login`, `/registro` | Visitantes |
| `(merchant)` | `/panel/...` | Dueños y personal del comercio |
| `(wallet)` | `/wallet/...` | Clientes |

Los paréntesis en el nombre de la carpeta agrupan rutas sin aparecer en la URL; permiten que cada área tenga su propio layout.

## Módulos de dominio

| Módulo | Responsabilidad |
|---|---|
| `auth` | Sesión, roles, perfil del usuario |
| `merchants` | Comercios, sucursales, personal |
| `programs` | Regla de acumulación y configuración del programa |
| `customers` | Membresías cliente ↔ comercio |
| `ledger` | Movimientos de puntos y saldo (núcleo crítico) |
| `rewards` | Catálogo de recompensas |
| `redemptions` | Canjes y su estado |
| `identification` | QR dinámico del cliente |

## Seguridad en capas

1. **`proxy.ts`**: refresca la sesión y redirige si no hay usuario (comprobación optimista, no definitiva).
2. **Server Actions**: verifican usuario, rol y validan la entrada con Zod.
3. **RLS en PostgreSQL**: última barrera; aunque el código tenga un error, la base de datos no entrega datos de otro comercio.
4. **Funciones SQL** para operaciones de puntos: atomicidad, idempotencia y saldo no negativo garantizados en la base de datos.

## Entornos

| Entorno | Base de datos | Notas |
|---|---|---|
| Desarrollo | Proyecto Supabase de desarrollo (plan gratuito) | Opcional más adelante: Supabase local con Docker |
| Producción | Proyecto Supabase separado | Se crea en el Módulo 10 |

Ver también: [modelo de dominio](domain-model.md) y [ADRs](adr/).
