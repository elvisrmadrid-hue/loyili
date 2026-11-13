# ADR 0004 — Lógica pura en `rules.ts`, pruebas con Vitest y consultas de Supabase solo al momento de la visita

- **Fecha**: 2026-11-12
- **Estado**: Aceptada

## Contexto

El Módulo 3 introduce la primera regla de negocio con cálculos: los puntos que da una compra. El mismo cálculo se necesita en dos sitios:
- en el **servidor**, que guarda la regla;
- en el **navegador**, donde la calculadora de ejemplo responde mientras el dueño escribe.

Hasta ahora, los componentes de navegador no podían importar nada de un módulo de dominio, porque su `index.ts` arrastra código de servidor.

Además, la lista de monedas vivía dentro del módulo `merchants` y ahora también la necesita el módulo `loyalty`.

Durante la verificación apareció un error en el registro del servidor de desarrollo: "unstable value `Date.now()` while prerendering". Next.js 16, con *Cache Components* y *Partial Prefetching* activados, prepara por adelantado una parte de cada página con los datos de sesión (cookies), el llamado *App Shell*. El cliente de Supabase consulta la hora para saber si la sesión expiró, y leer la hora durante esa preparación está prohibido. Afectaba a todas las páginas con sesión, incluidas las del Módulo 2.

## Decisión

1. **Lógica pura en `src/modules/<modulo>/rules.ts`**: funciones sin base de datos ni código de servidor. Es la parte del módulo que los componentes de navegador pueden importar directamente (excepción documentada en [src/modules/README.md](../../../src/modules/README.md)).
2. **Vitest** como herramienta de pruebas unitarias, instalada como dependencia de desarrollo (`npm test`). Las pruebas viven junto al código (`rules.test.ts`) y cubren la lógica pura.
   - Para instalarlo se actualizó `@types/node` de la versión 20 a la 26, la misma versión de Node que usa el proyecto (`.nvmrc`). La anterior era un resto de la plantilla inicial.
3. **Datos de referencia compartidos en `src/lib/`**: la lista de monedas pasa a [src/lib/currencies.ts](../../../src/lib/currencies.ts), con su número de decimales (ISO 4217) y el formato local de cada país.
4. **`connection()` en el cliente de Supabase del servidor** ([src/lib/supabase/server.ts](../../../src/lib/supabase/server.ts)): toda consulta a Supabase se hace solo al momento de la visita, nunca durante la preparación anticipada. Es la solución que indica la guía de Next.js para el código que lee la hora o valores aleatorios.

## Consecuencias

- La calculadora del navegador y el servidor usan exactamente la misma función: no hay dos cálculos que puedan diferir en TypeScript. El Módulo 5 calculará también en PostgreSQL y comparará ambos resultados con pruebas.
- Cada regla de negocio con cálculos tendrá sus pruebas automáticas, que se ejecutan en segundos con `npm test`.
- Las partes de una página que dependen de Supabase siempre se cargan al visitarla (con su indicador de "Cargando…") y no se adelantan con la navegación. En una aplicación donde casi todo depende del usuario, es el comportamiento esperado.
