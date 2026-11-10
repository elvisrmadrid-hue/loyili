# ADR 0002 — Ledger de puntos inmutable

- **Fecha**: 2026-11-08
- **Estado**: Aceptada

## Contexto

Los puntos representan valor para el cliente y un pasivo para el comercio. Guardar solo un "saldo" que se sobrescribe impide auditar, corregir errores con trazabilidad y detectar fraudes, y es vulnerable a errores de concurrencia (dos operaciones simultáneas).

## Decisión

- Cada cambio de puntos se registra como un **movimiento** en `point_transactions`; nunca se actualiza ni se borra (se refuerza con permisos/RLS y, si es necesario, triggers).
- El **saldo se deriva** de la suma de movimientos.
- Acumulación y canje se ejecutan en **funciones de PostgreSQL** dentro de una transacción, con bloqueo de la membresía para evitar condiciones de carrera.
- Cada operación lleva una **clave de idempotencia** única por comercio.
- Puntos como **enteros**; montos como **enteros en unidades mínimas**.

## Consecuencias

- Historial completo y auditable para clientes y comercios.
- Las correcciones son visibles (movimiento `REVERSAL`/`ADJUST`).
- Calcular el saldo sumando puede volverse costoso con mucho volumen; si ocurre, se añade un saldo materializado mantenido solo por las funciones del ledger.
