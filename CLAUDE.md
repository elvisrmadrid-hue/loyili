# CLAUDE.md — Instrucciones permanentes para Loyili

@AGENTS.md

## 1. Qué es Loyili

Plataforma de fidelización digital para negocios. Cada comercio crea su propio programa de puntos y recompensas; los clientes usan Loyili como billetera digital de lealtad (acumular, consultar, ver recompensas, canjear). Sin tarjetas físicas.

Documentación de referencia (leer antes de trabajar en un módulo):
- [docs/vision.md](docs/vision.md) — producto, usuarios, alcance
- [docs/roadmap.md](docs/roadmap.md) — módulos y su estado
- [docs/architecture/overview.md](docs/architecture/overview.md) — arquitectura y capas
- [docs/architecture/domain-model.md](docs/architecture/domain-model.md) — entidades y reglas de negocio
- [docs/architecture/adr/](docs/architecture/adr/) — decisiones tomadas y su porqué
- [docs/modules/](docs/modules/) — especificación de cada módulo

## 2. Sobre el usuario y la forma de comunicarse

- El usuario **no es programador experto** y quiere **aprender mientras se desarrolla**.
- Comunicación siempre en **español**.
- **Al final de cada respuesta** incluir una sección `## Para aprender` que explique, en lenguaje sencillo y con analogías cuando ayuden, los conceptos técnicos que aparecieron en esa respuesta (qué son, para qué sirven, por qué se eligieron). Breve: 3–6 puntos, sin repetir lo ya explicado en respuestas anteriores salvo que se pida. Si un concepto merece quedar registrado, añadirlo a [docs/aprendizaje/glosario.md](docs/aprendizaje/glosario.md).
- Explicar las decisiones antes de ejecutarlas cuando tengan impacto (instalar software, crear tablas, cambiar arquitectura).
- No inventar reglas de negocio (vencimientos, tasas de acumulación, límites). Si falta un dato, preguntar o dejarlo como **pregunta abierta** en la documentación.

## 3. Forma de trabajo (obligatoria)

Desarrollo **progresivo, un módulo a la vez**. Nunca implementar varios módulos de golpe.

Ciclo de cada módulo:
1. **Especificar**: crear `docs/modules/NN-nombre.md` a partir de [docs/modules/_plantilla.md](docs/modules/_plantilla.md) (objetivo, alcance, tablas, pantallas, criterios de aceptación). Presentarla al usuario y esperar validación.
2. **Implementar** solo lo especificado.
3. **Verificar**: `npm run lint`, `npm run typecheck`, `npm run build`, pruebas del módulo y comprobación manual en el navegador cuando haya UI. Reportar resultados reales, incluidos los fallos.
4. **Cerrar**: actualizar `docs/roadmap.md` y, si hubo decisiones nuevas, un ADR. Esperar confirmación del usuario antes de pasar al siguiente módulo.

## 4. Restricciones de alcance

- Todo el trabajo de Loyili vive en `C:\Dev\Loyili`. **No crear, modificar ni borrar nada fuera de esta carpeta** (otros proyectos de `C:\Dev` incluidos).
- No sobrescribir ni eliminar contenido existente sin revisarlo y sin confirmación del usuario.
- No instalar software global (Git, CLIs, Docker…) sin pedir permiso.

## 5. Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 |
| Base de datos, Auth, Storage | Supabase (PostgreSQL gestionado) |
| Acceso a Supabase desde Next.js | `@supabase/ssr` + `@supabase/supabase-js` (se instalan en el Módulo 1) |
| Validación | Zod (se instala cuando se necesite) |
| Pruebas | Vitest (`npm test`; pruebas unitarias de la lógica pura, ver ADR 0004) |
| Gestor de paquetes | npm |
| Node | 26 (ver `.nvmrc`) |

**Next.js 16 tiene cambios importantes** respecto a versiones anteriores (p. ej. `middleware.ts` ahora se llama `proxy.ts`). Antes de escribir código de Next.js, consultar la guía correspondiente en `node_modules/next/dist/docs/`.

## 6. Estructura del proyecto

```
src/
  app/                 Rutas (App Router). Solo UI y orquestación; sin lógica de negocio.
    (public)/          Landing, login, registro
    (merchant)/panel/  Panel del comercio
    (wallet)/wallet/   Billetera del cliente
    api/               Route Handlers (webhooks e integraciones externas)
  modules/<modulo>/    Lógica de dominio por módulo:
                         schemas.ts  (validación Zod)
                         queries.ts  (lecturas)
                         actions.ts  (Server Actions / escrituras)
                         types.ts
                         rules.ts    (lógica pura, sin servidor; importable desde el navegador)
  lib/supabase/        Clientes de Supabase (browser, server, proxy)
  components/          Componentes de UI reutilizables
  proxy.ts             (Módulo 1) refresco de sesión y redirecciones
supabase/
  migrations/          SQL versionado: única forma de cambiar el esquema
  seed.sql             Datos de prueba
docs/                  Documentación (ver sección 1)
```

Reglas de dependencia: `app/` → `modules/` → `lib/`. Un módulo no importa archivos internos de otro módulo; si necesita algo, se expone desde su `index.ts`.

## 7. Reglas de dominio que no se negocian

1. **Multi-tenant**: todo dato de negocio pertenece a un `merchant_id`. Toda tabla con datos de negocio tiene **RLS activado** con políticas explícitas. Nunca desactivar RLS para "que funcione".
2. **Ledger inmutable**: los movimientos de puntos (`point_transactions`) solo se insertan; nunca `UPDATE` ni `DELETE`. Una corrección es un movimiento nuevo (`REVERSAL` / `ADJUST`). El saldo se deriva de los movimientos.
3. **Operaciones de puntos atómicas**: acumular y canjear se hacen en funciones de PostgreSQL (transacción única) llamadas desde el servidor, con **clave de idempotencia** para evitar duplicados.
4. **Saldo nunca negativo**: el canje se rechaza si el saldo es insuficiente (validado dentro de la transacción).
5. **Tipos numéricos**: puntos = enteros; dinero = entero en unidades mínimas (centavos) + código de moneda. Nunca `float` para dinero o puntos.
6. **Fechas** en UTC (`timestamptz`); la conversión a hora local solo en la UI.
7. **Puntos por comercio**: los puntos de un comercio solo sirven en ese comercio (salvo decisión futura documentada en un ADR).

## 8. Seguridad

- Secretos solo en `.env.local` (ignorado por Git). `.env.example` documenta las variables sin valores.
- Variables `NEXT_PUBLIC_*` llegan al navegador: **nunca** poner allí la clave secreta de Supabase.
- La clave secreta (`SUPABASE_SECRET_KEY`) solo se usa en código de servidor y solo cuando RLS no aplica (tareas administrativas). Por defecto, usar el cliente con la sesión del usuario.
- Validar toda entrada del usuario con Zod en el servidor, aunque ya se valide en el formulario.
- Autorizar en el servidor (Server Actions / RLS); `proxy.ts` solo hace comprobaciones optimistas.

## 9. Convenciones de código

- Código, identificadores, nombres de tablas/columnas y mensajes de commit en **inglés**. Documentación y textos de UI en **español**.
- Tablas y columnas en `snake_case`; TypeScript en `camelCase`; componentes en `PascalCase`.
- Server Components por defecto; `"use client"` solo cuando haga falta interactividad.
- Commits con Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), un commit por unidad lógica.
- Cambios de esquema solo mediante archivos en `supabase/migrations/`, nunca editando tablas a mano en el panel de Supabase.

## 10. Comandos

```
npm run dev        # servidor de desarrollo en http://localhost:3000
npm run build      # build de producción (verifica que todo compila)
npm run lint       # ESLint
npm run typecheck  # verificación de tipos TypeScript
npm test           # pruebas unitarias (Vitest)
npm run verify:rls # comprobación de RLS contra el proyecto de desarrollo
```
