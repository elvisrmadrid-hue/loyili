# Architecture Decision Records (ADR)

Un ADR registra una decisión técnica importante: el contexto, la decisión y sus consecuencias. Sirve para recordar **por qué** se hizo algo así.

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-nextjs-supabase.md) | Next.js full-stack con Supabase | Aceptada |
| [0002](0002-ledger-inmutable.md) | Ledger de puntos inmutable | Aceptada |
| [0003](0003-supabase-como-codigo.md) | Esquema y configuración de Supabase como código | Aceptada |
| [0004](0004-logica-pura-y-pruebas-unitarias.md) | Lógica pura en `rules.ts`, pruebas con Vitest y consultas de Supabase solo al momento de la visita | Aceptada |
| [0005](0005-saldo-materializado-y-forma-del-ledger.md) | Saldo materializado y forma del ledger | Aceptada |
| [0006](0006-canje-como-movimiento-del-ledger.md) | El canje es un movimiento del ledger (sin tabla `redemptions`) | Aceptada |
| [0007](0007-codigo-temporal-del-cliente.md) | Código temporal del cliente para identificarse en caja | Aceptada |

Para una nueva decisión: copiar el formato de un ADR existente, numerar de forma consecutiva y añadirlo a esta tabla. Un ADR no se edita para cambiar la decisión: se crea uno nuevo que lo reemplaza.
