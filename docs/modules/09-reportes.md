# Módulo 09 — Reportes del comercio

- **Estado**: validado (2026-11-20)
- **Fecha**: 2026-11-20

## Objetivo

Que el dueño vea de un vistazo **cómo funciona su programa de fidelización**: cuántos clientes tiene y cuántos vuelven, cuántos puntos ha dado y canjeado, cuánto han comprado sus clientes y qué recompensas se piden más. Con eso puede decidir si ajustar la regla de puntos o el catálogo.

## Recomendaciones (el usuario aceptó de antemano las recomendaciones del proyecto)

| Tema | Recomendación | Motivo |
|---|---|---|
| Quién lo ve | **Solo el dueño** (pestaña "Reportes"). | Son datos del negocio, como el total vendido. El personal ya tiene la caja y los clientes. |
| Periodos | **Últimos 7, 30 y 90 días, y "Desde el inicio"**, contados hacia atrás desde ahora. Por defecto, 30 días. | Contar "los últimos N días" no depende de la zona horaria: un periodo "este mes" o un gráfico por días sí, y los comercios aún no tienen zona horaria guardada (pregunta abierta). |
| Cliente activo | El que tuvo **al menos una compra o un canje en el periodo** (sin contar los anulados). | Es la definición habitual en fidelización. Queda escrita en el reporte para que no haya dudas. |
| Movimientos anulados | **No cuentan**: una compra o un canje anulados desaparecen de los totales, aunque la anulación ocurra en otro periodo. | El reporte debe reflejar lo que realmente pasó. Un error corregido no debe inflar las cifras. |
| Puntos en circulación | Mostrar la **suma de los saldos de todos los clientes**: los puntos que el comercio "debe" y que pueden canjearse en cualquier momento. | Es la cifra que más interesa al dueño para planificar recompensas. No depende del periodo. |
| Presentación | **Números en tarjetas y barras simples** hechas con CSS, sin librerías de gráficos. | Funcionalidad primero (preferencia del proyecto). Se ve bien en el teléfono y carga rápido. |
| Cálculo | **Una función de PostgreSQL** que calcula todo en la base de datos y solo puede usar el dueño. | Más rápido y seguro que traer todos los movimientos a la aplicación. La autorización queda en la base de datos, como en el resto de Loyili. |

## Alcance

**Incluye**
- Pestaña **Reportes** en el panel (solo el dueño), con selector de periodo.
- **Clientes**: total, nuevos en el periodo y activos en el periodo (y qué porcentaje del total son).
- **Compras**: número, monto total y compra media en el periodo.
- **Puntos**: emitidos y canjeados en el periodo; en circulación hoy.
- **Canjes**: número en el periodo y recompensas más canjeadas (hasta 5).
- **Sucursales**: compras y monto por sucursal en el periodo, solo si el comercio tiene sucursales.
- **Mejores clientes**: los 5 que más compraron en el periodo (nombre, número de compras, monto), con enlace a su ficha.
- Mensajes claros cuando aún no hay datos.
- Script de verificación ampliado: el reporte cuadra con los movimientos, ignora los anulados y solo lo ve el dueño.

**No incluye**
- Gráficos por día o semana, y periodos por mes del calendario: necesitan la zona horaria del comercio (pregunta abierta).
- Exportar a Excel o CSV.
- Reportes para el personal o comparativas entre comercios.
- Comparación con el periodo anterior ("+12 % que el mes pasado").

## Historias de usuario

- Como **dueño**, quiero **ver cuántos clientes vuelven** para **saber si el programa funciona**.
- Como **dueño**, quiero **ver los puntos en circulación** para **prever cuántas recompensas tendré que entregar**.
- Como **dueño**, quiero **ver qué recompensas se canjean más** para **ajustar el catálogo**.
- Como **dueño**, quiero **ver a mis mejores clientes** para **reconocerlos**.

## Base de datos

Migración: `supabase/migrations/<timestamp>_create_merchant_report.sql`. Sin tablas nuevas.

**Función** `get_merchant_report(p_merchant_id uuid, p_days integer)`: `security definer`, `search_path = ''`, solo `authenticated`.
- Solo el dueño del comercio; si no, `not_allowed`.
- `p_days` vale 7, 30 o 90, o `null` para "desde el inicio". Cualquier otro valor es un error.
- Devuelve un único JSON con:
  - **clientes**: total, nuevos y activos;
  - **compras**: número, monto y moneda;
  - **puntos**: emitidos, canjeados y en circulación;
  - **canjes**: número y recompensas más canjeadas;
  - **sucursales**: compras y monto de cada una;
  - **mejores clientes**: los 5 primeros.
- Un movimiento `EARN` o `REDEEM` cuenta solo si **no tiene una anulación**.

Índice nuevo `point_transactions (merchant_id, created_at)` si hace falta para filtrar por fechas. Ya existe uno por `merchant_id`; se decidirá al implementar.

## Lógica de servidor

`src/modules/reports/` (módulo nuevo)
- `rules.ts`: periodos válidos (`7`, `30`, `90`, `todo`), lectura del periodo desde la URL y porcentajes. Probado con Vitest.
- `queries.ts`: `getMerchantReport(merchantId, period)`, que llama a la función y adapta el JSON a tipos de TypeScript.
- `types.ts`.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/panel/[merchantId]/reportes?periodo=30` | dueño | Selector de periodo (7 / 30 / 90 días / Desde el inicio). Tarjetas de clientes, compras y puntos. Listas de recompensas más canjeadas, sucursales y mejores clientes, con barras proporcionales. Nota con las definiciones: qué es un cliente activo y que los anulados no cuentan. |
| `/panel/[merchantId]` | dueño | Enlace a Reportes en el inicio del panel. |
| Navegación | dueño | Pestaña "Reportes" (el personal no la ve). |

## Criterios de aceptación

- [ ] Solo el dueño ve la pestaña y la página; el personal, los clientes y otros comercios no pueden obtener el reporte (comprobado con script).
- [ ] Las cifras cuadran con los movimientos: compras, monto, puntos emitidos y canjeados, y canjes.
- [ ] Una compra o un canje anulados no cuentan en ningún total.
- [ ] Los puntos en circulación son iguales a la suma de los saldos de los clientes.
- [ ] Cambiar el periodo cambia las cifras; "Desde el inicio" incluye todo.
- [ ] Un comercio sin movimientos ve mensajes claros, no ceros sin explicación.
- [ ] Se ve bien en el teléfono (360 px).
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**: lint, typecheck, build y `npm test`.
- **RLS**: `npm run verify:rls` ampliado. Crea compras, canjes y anulaciones conocidos y comprueba cada cifra del reporte, además de quién puede pedirlo.
- **Pruebas de humo**: la página del dueño muestra las cifras y el personal no puede abrirla.
- **Navegador real**: recorrido en Chrome invisible (cargas, errores de consola, vista de teléfono) y captura de pantalla.
- **Manual**: el dueño registra algunas compras y canjes y comprueba que el reporte los refleja.

## Preguntas abiertas

- [ ] **Zona horaria del comercio**, necesaria para gráficos por día y periodos como "este mes". ¿Se añade en Ajustes más adelante?
- [ ] ¿Exportar los datos (CSV o Excel)?
