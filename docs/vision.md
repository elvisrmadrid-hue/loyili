# Visión del producto

## Problema

Los programas de fidelización tradicionales dependen de tarjetas físicas (sellos, tarjetas plásticas) o de sistemas caros y complejos. Los comercios pequeños y medianos no tienen una forma sencilla de premiar a sus clientes frecuentes, y los clientes acumulan tarjetas que pierden u olvidan.

## Propuesta

**Loyili** permite que cada comercio cree su propio programa de puntos y recompensas en minutos, y que sus clientes lo usen desde el teléfono como una billetera digital de lealtad.

## Usuarios

| Usuario | Necesidad principal |
|---|---|
| **Cliente** | Acumular puntos al comprar, consultar saldo y movimientos, ver recompensas, canjear |
| **Dueño del comercio** | Configurar su programa, crear recompensas, ver clientes y métricas |
| **Personal del comercio** (cajero) | Identificar al cliente, registrar compras (acreditar puntos) y confirmar canjes de forma rápida |
| **Administrador de la plataforma** | Supervisar comercios y operación general (fase posterior) |

## Funcionalidades — alcance inicial (MVP)

**Cliente (billetera)**
- Registro e inicio de sesión sencillos.
- Ver los comercios donde participa y su saldo en cada uno.
- Historial de movimientos.
- Catálogo de recompensas por comercio.
- Código QR personal para identificarse en caja.
- Canje de recompensas.

**Comercio (panel)**
- Registro del comercio, sucursales y personal.
- Configuración de la regla de acumulación de puntos.
- Catálogo de recompensas.
- Registro de compras (acreditación) y confirmación de canjes.
- Listado de clientes con su saldo.

## Fuera del alcance inicial

- Apps nativas en tiendas (iOS/Android): primero PWA.
- Coaliciones (puntos compartidos entre comercios).
- Integración con sistemas de punto de venta (POS).
- Pagos o facturación de la suscripción del comercio.
- Notificaciones push / WhatsApp.

## Preguntas abiertas

Estas decisiones son de negocio y se resolverán con el usuario antes del módulo que las necesite:

- [ ] País/es y moneda/s objetivo.
- [x] Forma de la regla de acumulación → **por monto gastado** ("X puntos por cada Y"), **redondeando hacia abajo**, sin monto mínimo por ahora (decidido el 2026-11-12; ver [Módulo 3](modules/03-programa-fidelizacion.md)).
- [ ] ¿Los puntos vencen? Si es así, ¿con qué política? (Pospuesto el 2026-11-12: por ahora no vencen.)
- [x] ¿El cliente se registra solo, o lo registra el comercio en caja? → **se une solo**, con el enlace o QR del comercio (decidido el 2026-11-13; ver [Módulo 4](modules/04-clientes.md)).
- [x] Método de inicio de sesión del cliente → **email + contraseña**, una sola cuenta para clientes y comercios (decidido el 2026-11-10; ver [Módulo 1](modules/01-supabase-auth.md)). Otros métodos podrán añadirse más adelante.
- [ ] Modelo de negocio de Loyili (gratuito, suscripción por comercio, comisión).
