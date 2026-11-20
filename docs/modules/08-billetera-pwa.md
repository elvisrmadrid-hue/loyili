# Módulo 08 — Billetera PWA

- **Estado**: validado (2026-11-19)
- **Fecha**: 2026-11-19

## Objetivo

Que Loyili se pueda **instalar en el teléfono** como una aplicación, con su ícono en la pantalla de inicio y sin la barra del navegador, y que la billetera, "Mi código" y la caja **se usen cómodamente en un móvil**. No hacen falta tiendas de aplicaciones: es la misma web, instalada.

## Recomendaciones (el usuario aceptó de antemano las recomendaciones del proyecto)

| Tema | Recomendación | Motivo |
|---|---|---|
| Qué se instala | **Una sola app "Loyili"** para clientes y comercios. Al abrirla va a `/inicio`, que ya lleva al panel a quien trabaja en un comercio y a la billetera al resto. | Es la misma web. El cajero también puede instalarla y tener la caja a un toque. |
| Ícono | **Provisional, generado por código**: una "L" blanca sobre fondo negro, a juego con los botones actuales. Se cambia por un logo real tocando un solo archivo. | No hay logo todavía y no hace falta un programa de diseño. Primero que funcione (preferencia del proyecto). |
| Sin conexión | **No se guardan saldos ni páginas** para verlos sin internet. Si se pierde la conexión, aparece un aviso claro: "Sin conexión. Tus datos se actualizarán al volver". | Un saldo guardado puede estar desactualizado y confundir en caja. El QR siempre necesita al servidor porque el código caduca. |
| Service worker | **No por ahora.** Los navegadores actuales permiten instalar sin él. Llegará con las notificaciones (Módulo 11+). | Un service worker guarda copias de la app. Mal configurado, puede dejar a la gente con versiones viejas. Mejor añadirlo cuando aporte algo concreto. |
| Invitar a instalar | Tarjeta en la billetera, **"Instala Loyili en tu teléfono"**: en Android, Chrome o Edge, un botón **Instalar**; en iPhone, los pasos (Compartir → "Añadir a pantalla de inicio"). Se oculta si ya está instalada o si la persona la cierra. | El iPhone no permite un botón de instalar, solo explicar los pasos. |
| "Mi código" | Mantiene la **pantalla encendida** mientras está abierta, donde el navegador lo permita. | Evita que el teléfono se apague mientras el cajero escanea. |
| Diseño móvil | Repaso de las pantallas a **360 px de ancho**, el tamaño de un teléfono pequeño. Ver "Alcance". | "Se ve bien en móvil" es el resultado que pide el roadmap. |

## Alcance

**Incluye**
- Manifiesto de la aplicación: nombre, colores, ícono, abrir en `/inicio` y pantalla completa sin barra del navegador.
- Íconos generados por código: 192 y 512 px, versión "maskable" para Android e ícono de iPhone (`apple-touch-icon`).
- Color de la barra del sistema, claro y oscuro, y respeto de la "muesca" del teléfono en modo app (márgenes seguros).
- Tarjeta "Instala Loyili" en la billetera (botón o instrucciones según el teléfono), que no se muestra dentro de la app instalada.
- Aviso "Sin conexión" en la billetera y en el panel.
- "Mi código" con la pantalla encendida (Wake Lock) mientras está visible.
- Repaso móvil:
  - cabecera con nombres largos;
  - pestañas del panel (desplazables, con "Caja" entre las primeras);
  - billetera, "Mi código", caja con escaneo, listas y formularios;
  - botones de al menos 44 px de alto;
  - campos de texto de 16 px para que el iPhone no haga zoom al escribir.
- Pruebas de Vitest para la lógica pura (detectar si el teléfono es iPhone o Android para mostrar las instrucciones correctas).

**No incluye**
- Uso sin conexión con datos guardados, ni service worker.
- Notificaciones (Módulo 11+).
- Logo y colores de marca definitivos (pregunta abierta).
- Instalar en el teléfono antes del despliegue. Instalar exige HTTPS: en la computadora funciona en `localhost`, pero en el teléfono llegará con el Módulo 10. Ver "Riesgos".

## Historias de usuario

- Como **cliente**, quiero **instalar Loyili en mi teléfono** para **abrir mi billetera con un toque, como cualquier app**.
- Como **cliente**, quiero que **"Mi código" no apague la pantalla** para **que me escaneen sin prisas**.
- Como **cajero**, quiero **usar la caja en el teléfono** para **atender sin computadora**.
- Como **cliente**, quiero **saber cuándo no tengo conexión** para **no fiarme de datos viejos**.

## Base de datos

Sin cambios.

## Lógica de servidor

Sin cambios. Archivos nuevos de configuración de Next.js:
- `src/app/manifest.ts`: el manifiesto.
- Íconos generados con `ImageResponse` (convención de archivos de metadatos de Next.js).
- `viewport` en el layout raíz: color del tema y márgenes seguros.

Lógica pura en `src/lib/device.ts`: `installPlatform(userAgent)` devuelve `ios`, `android` u `other`. Probada con Vitest.

## Pantallas

| Ruta | Quién | Qué cambia |
|---|---|---|
| `/wallet` | cliente | Tarjeta "Instala Loyili en tu teléfono" (descartable). Aviso sin conexión. |
| `/wallet/codigo` | cliente | Pantalla siempre encendida mientras está abierta. |
| `/panel/...` | dueño y personal | Repaso móvil de pestañas, caja y formularios. Aviso sin conexión. |
| Todas | todos | Íconos, color de barra y modo app sin barra del navegador. |

## Criterios de aceptación

- [ ] En Chrome o Edge de la computadora, en `localhost`, aparece la opción de instalar Loyili. Al instalarla abre en su propia ventana y en `/inicio`.
- [ ] El ícono provisional se ve en la ventana instalada, en la pestaña del navegador y en el manifiesto (192, 512 y maskable).
- [ ] La tarjeta "Instala Loyili" muestra el botón en Chrome o Edge y los pasos en iPhone, no aparece dentro de la app instalada y, si se cierra, no vuelve a salir en ese dispositivo.
- [ ] Al cortar la conexión aparece "Sin conexión" y desaparece al volver.
- [ ] "Mi código" mantiene la pantalla encendida donde el navegador lo permite, sin errores donde no.
- [ ] A 360 px de ancho, la billetera, "Mi código", la caja (con escaneo), los clientes, las recompensas y los formularios se ven sin desbordes horizontales y con botones cómodos de tocar.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` pasan.

## Verificación

- **Automática**:
  - lint, typecheck, build y `npm test`;
  - comprobación de que `/manifest.webmanifest` y los íconos responden con el formato correcto;
  - pruebas de humo de los Módulos 2 a 7 sin regresiones.
- **Manual en el navegador**:
  - instalar en Chrome o Edge de la computadora;
  - ver las pantallas en modo teléfono: en el navegador, F12 → icono de móvil;
  - abrir la billetera en el teléfono por la red local para ver el diseño (sin instalar);
  - simular "sin conexión" desde las herramientas del navegador.

## Riesgos

- **Instalar en el teléfono necesita HTTPS.** Hasta el despliegue (Módulo 10), la instalación se prueba en la computadora. En el teléfono, por la red local, se revisa el diseño pero no se puede instalar. Se podría usar un certificado de desarrollo, pero exige instalar software en el equipo y en el teléfono; no compensa con el despliegue tan cerca.
- **iPhone**: Safari no avisa de que se puede instalar. Por eso la tarjeta explica los pasos.

## Preguntas abiertas

- [ ] Logo y color de marca definitivos. El usuario aún no los tiene (2026-11-19): se usa el ícono provisional en blanco y negro.
- [ ] ¿Uso sin conexión con el último saldo guardado? Por ahora no, para no mostrar datos desactualizados.
