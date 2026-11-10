# Loyili

Plataforma de fidelización digital para negocios: cada comercio crea su programa de puntos y recompensas, y los clientes los gestionan desde una billetera digital, sin tarjetas físicas.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth)

## Requisitos

- Node.js 26 (ver `.nvmrc`)
- npm
- Una cuenta y un proyecto en [Supabase](https://supabase.com) (a partir del Módulo 1)
- Git (recomendado)

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # en PowerShell: Copy-Item .env.example .env.local
# completar .env.local con los datos del proyecto Supabase
npm run dev
```

Abrir http://localhost:3000.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | Análisis estático (ESLint) |
| `npm run typecheck` | Verificación de tipos (TypeScript) |

## Documentación

- [Visión del producto](docs/vision.md)
- [Roadmap](docs/roadmap.md)
- [Arquitectura](docs/architecture/overview.md)
- [Modelo de dominio](docs/architecture/domain-model.md)
- [Decisiones (ADR)](docs/architecture/adr/)
- [Especificaciones de módulos](docs/modules/)
- [Glosario de aprendizaje](docs/aprendizaje/glosario.md)

Instrucciones para Claude Code: [CLAUDE.md](CLAUDE.md).
