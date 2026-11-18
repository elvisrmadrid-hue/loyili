# ADR 0007 — Código temporal del cliente para identificarse en caja

- **Fecha**: 2026-11-17
- **Estado**: Aceptada

## Contexto

En el Módulo 7 el cliente se identifica en caja mostrando un QR desde su billetera. Lo que lleva el QR decide la seguridad: si fuera un dato fijo (su id o un código permanente), una captura de pantalla o una foto bastaría para que otra persona canjeara sus puntos para siempre.

## Decisión

- El QR contiene un **código temporal de 8 símbolos** (32 símbolos posibles sin caracteres que se confundan, unos 40 bits), válido **5 minutos**. La billetera pide uno nuevo 30 segundos antes de que caduque, y también al volver a la pantalla.
- **Un código vigente por persona** (tabla `customer_codes`, clave `user_id`): pedir uno nuevo reemplaza el anterior. Vale en todos los comercios donde la persona es cliente.
- Solo se guarda la **huella SHA-256** del código, como en las invitaciones. La tabla no es accesible desde la API: todo pasa por funciones `security definer`.
- **No es de un solo uso**: durante sus 5 minutos se puede escanear varias veces. Lo que protege es la caducidad.
- `resolve_customer_code` solo lo pueden usar el dueño y el personal del comercio. Un código caducado o desconocido no revela nada. El de alguien que no es cliente revela solo su nombre: al mostrarlo en caja, la persona se identifica y da su consentimiento para unirse.
- `enroll_customer_by_code` sigue las reglas de `join_merchant`: programa activo y nunca alguien que trabaja en el comercio.
- El QR lleva el mismo texto que se ve debajo (`K7P2-QX4M`), así que escanear y escribir siguen el mismo camino. La cámara se lee en el navegador con **jsQR**, que solo se descarga al pulsar "Escanear QR".

## Consecuencias

- Una captura del QR deja de servir en pocos minutos.
- Abrir "Mi código" en dos dispositivos a la vez invalida el código del primero. Basta con volver a abrirlo.
- Adivinar un código vigente es inviable en la práctica: hay más de un billón de combinaciones y cada intento requiere una sesión del personal de un comercio. Si en el futuro hiciera falta, se puede limitar el número de intentos por comercio.
- La cámara del navegador solo funciona con HTTPS o en `localhost`: en desarrollo se escanea con la webcam de la computadora; desde el teléfono del cajero, cuando la aplicación esté publicada (Módulo 10).
