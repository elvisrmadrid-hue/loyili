# ADR 0001 — Next.js full-stack con Supabase

- **Fecha**: 2026-11-08
- **Estado**: Aceptada

## Contexto

Loyili necesita una billetera para clientes, un panel para comercios, autenticación, base de datos relacional confiable (los puntos tienen valor) y aislamiento entre comercios. El desarrollo es progresivo y el usuario está aprendiendo, por lo que conviene minimizar piezas móviles.

La propuesta inicial contemplaba un monorepo con API separada (NestJS) y dos apps Next.js. El usuario eligió Next.js y Supabase.

## Decisión

- **Una sola aplicación Next.js** (App Router) que contiene la billetera, el panel y la lógica de servidor (Server Components, Server Actions, Route Handlers).
- **Supabase** como backend gestionado: PostgreSQL, Auth y Storage.
- **Seguridad multi-tenant con Row Level Security (RLS)** de PostgreSQL.
- **Operaciones críticas de puntos como funciones SQL** transaccionales.
- **Migraciones SQL versionadas** en `supabase/migrations/`.
- **npm** como gestor de paquetes (ya instalado; evita una herramienta más).

## Consecuencias

**A favor**
- Un solo proyecto, un solo lenguaje (TypeScript + SQL), un solo despliegue.
- Supabase resuelve autenticación, base de datos y almacenamiento sin servidores propios.
- Sigue siendo PostgreSQL estándar: los datos y el SQL no quedan atados a Supabase.
- Una futura app nativa puede usar el mismo Supabase directamente.

**En contra / riesgos**
- La lógica queda repartida entre Server Actions y SQL: se mitiga con la regla de que las operaciones de puntos viven en funciones SQL y el resto en `src/modules/`.
- Dependencia de un proveedor para Auth: aceptable en esta etapa.
- Si en el futuro se necesita una API pública para terceros (POS), se añadirá con Route Handlers o un servicio separado (nuevo ADR).
