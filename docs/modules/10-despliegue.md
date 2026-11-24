# Módulo 10 — Despliegue

- **Estado**: en curso: código en GitHub y migraciones aplicadas a `loyili-prod` (2026-11-24)
- **Fecha**: 2026-11-21

## Objetivo

Publicar Loyili en internet, con **HTTPS**, para que comercios y clientes la usen desde cualquier lugar. Con HTTPS, además:
- la app se instala en el teléfono (Módulo 8);
- la cámara del cajero escanea el QR (Módulo 7).

Cada mejora futura se publicará sola al guardarla en Git.

## Recomendaciones (el usuario aceptó de antemano las recomendaciones del proyecto)

| Tema | Recomendación | Motivo |
|---|---|---|
| Hosting de la app | **Vercel**, plan gratuito para empezar. | Lo hacen los creadores de Next.js. Usa HTTPS automático, publica al hacer `git push` y crea una vista previa de cada cambio. Admite Node 26, la versión del proyecto, por defecto (comprobado en su documentación). |
| Código en la nube | Repositorio **privado en GitHub**. Vercel publica desde ahí. | Copia de seguridad del código fuera de la computadora y publicación automática. Se usa el Git ya instalado: al primer `git push`, se abre el navegador para iniciar sesión, sin instalar nada más. |
| Base de datos de producción | **Un proyecto de Supabase nuevo y separado** (`loyili-prod`). El actual (`loyili-dev`) sigue para desarrollo y pruebas. | Las pruebas crean usuarios y movimientos que, por las reglas del ledger, **no se pueden borrar**. Mezclarlos con clientes reales ensuciaría para siempre los datos y los reportes. |
| Región | Supabase y Vercel **en la misma región, la más cercana a tus clientes** (pregunta abierta: ¿en qué país estarán?). | Si la app y la base de datos están lejos entre sí, cada pantalla tarda más. |
| Esquema de producción | Se crea **aplicando las mismas migraciones** con la CLI de Supabase. Nunca a mano. | Producción queda idéntica a desarrollo y se puede repetir. |
| Comprobación en producción | **No** se ejecuta `verify:rls` (crea datos que no se pueden borrar). En su lugar, un script nuevo **de solo lectura** (`npm run verify:prod`) comprueba que un visitante sin sesión no lee nada y que las migraciones coinciden. | Verificar sin ensuciar producción. |
| Dirección web | Empezar con la dirección gratuita de Vercel (p. ej. `loyili.vercel.app`, si está libre). | Gratis e inmediato. Un dominio propio (`loyili.com`…) se puede añadir después sin cambiar nada más. |
| Correos | Mientras no haya dominio propio, se mantienen **sin confirmación de correo** al registrarse, como hasta ahora. | El envío de correos incluido en Supabase es muy limitado. Un proveedor de correo propio necesita un dominio propio. |
| Cabeceras de seguridad | Añadir las cabeceras recomendadas por la guía de Next.js: no incrustar la app en otras webs, no adivinar tipos de archivo, limitar la información de origen y permitir la cámara solo a la propia app. | Protección básica que todo sitio público debería tener. |

## Alcance

**Incluye**
- Repositorio privado en GitHub con todo el historial; el primer `git push` lo haces tú en la ventana de inicio de sesión.
- Proyecto `loyili-prod` en Supabase con las 8 migraciones aplicadas y la configuración de autenticación de producción:
  - dirección del sitio;
  - direcciones de retorno permitidas;
  - contraseña mínima de 8;
  - sin confirmación de correo.
- Proyecto en Vercel conectado al repositorio, con las variables de entorno de producción. Las escribes tú en el panel de Vercel; nunca pasan por el chat.
- `next.config.ts` con cabeceras de seguridad. Región de las funciones de Vercel igual a la de Supabase.
- Script `npm run verify:prod` de solo lectura.
- Guía paso a paso en `docs/despliegue.md`: cómo se publica, cómo se aplica una migración a producción y qué hacer si algo falla.
- Prueba completa en producción, con datos reales tuyos (tu comercio):
  - instalar la app en el teléfono;
  - escanear el QR con la cámara del cajero;
  - registrar una compra y un canje.

**No incluye**
- Dominio propio ni proveedor de correo (SMTP). Recuperar la contraseña seguirá funcionando solo desde el mismo navegador, como hasta ahora. Son el siguiente paso natural cuando compres un dominio.
- Planes de pago. Ver "Riesgos" sobre los límites del plan gratuito.
- Copias de seguridad programadas propias, más allá de las que incluye Supabase.

## Lo que necesito de ti (pasos que solo puedes hacer tú)

1. **Crear una cuenta en GitHub** (gratis), si no la tienes, y un repositorio **privado** vacío llamado `loyili`.
2. **Crear una cuenta en Vercel** con "Continuar con GitHub".
3. **Crear el proyecto `loyili-prod` en Supabase**, con la región que acordemos, y guardar su contraseña de base de datos en tu gestor de contraseñas.
4. **Copiar las claves de producción** desde Supabase a las variables de entorno de Vercel, siguiendo la guía. **Nunca las pegues en el chat.**

Yo preparo el código, aplico las migraciones con tu sesión de la CLI, escribo la guía y verifico todo.

## Historias de usuario

- Como **comercio**, quiero **usar Loyili desde cualquier lugar** para **atender sin depender de una computadora concreta**.
- Como **cajero**, quiero **escanear el QR con la cámara del teléfono** para **identificar al cliente al instante**.
- Como **cliente**, quiero **instalar la billetera en mi teléfono** para **tenerla a un toque**.

## Base de datos

Sin migraciones nuevas. Se aplican las 8 existentes al proyecto `loyili-prod`.

## Lógica de servidor

Sin cambios de lógica. Cambios de configuración:
- `next.config.ts`: cabeceras de seguridad.
- `vercel.json`: región de las funciones.
- `scripts/verify-prod.mjs`: comprobación de solo lectura.

## Pantallas

Sin pantallas nuevas.

## Criterios de aceptación

- [ ] El código está en un repositorio privado de GitHub y cada `git push` a `main` publica en Vercel.
- [ ] La app responde en su dirección `https://…`, con candado, y todas las pantallas funcionan.
- [ ] `loyili-prod` tiene las mismas migraciones que `loyili-dev`. `npm run verify:prod` pasa: un visitante sin sesión no lee ninguna tabla y la configuración es la esperada.
- [ ] Las cabeceras de seguridad están presentes.
- [ ] En el teléfono, la app se instala y la cámara escanea el QR de "Mi código" en la caja.
- [ ] Ningún secreto está en el repositorio. Se comprueba con una búsqueda antes del primer `git push`.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm run verify:rls` (contra desarrollo) pasan.

## Verificación

- **Antes de publicar**: buscar secretos en el historial de Git, build de producción, pruebas de humo y recorrido en el navegador.
- **Después de publicar**:
  - `npm run verify:prod`;
  - recorrido en el navegador real contra la dirección pública: cargas, errores y cabeceras;
  - comprobación de que Chrome considera la app instalable.
- **Manual**: tu prueba en el teléfono (instalar, escanear y comprar).

## Riesgos

- **Plan gratuito de Supabase**: un proyecto sin actividad durante una semana se **pausa** y hay que reactivarlo desde el panel. Además, sus copias de seguridad son limitadas. Para un negocio con clientes reales, conviene pasar al plan de pago (unos 25 USD al mes) antes de abrirlo al público.
- **Plan gratuito de Vercel** ("Hobby"): pensado para proyectos personales y no comerciales. Para uso comercial, Vercel pide el plan Pro (unos 20 USD al mes por persona). Para el piloto, Hobby sirve.
- **Recuperar la contraseña** solo funciona en el mismo navegador hasta tener dominio y correo propios.
- **Errores en producción**: no tendremos todavía un servicio de alertas. Vercel guarda los registros de las funciones y se revisan desde su panel.

## Preguntas abiertas

- [x] **¿En qué país (o países) estarán tus comercios y clientes?** Panamá primero, luego Centroamérica y países cercanos (2026-11-23). Región elegida: **`us-east-1` (N. Virginia)** en Supabase e **`iad1`** en Vercel. Es la región con menor latencia hacia Panamá y Centroamérica, y sirve bien a todo el continente si Loyili se extiende. La región de un proyecto de Supabase no se puede cambiar después: requeriría migrar a un proyecto nuevo.
- [x] ¿Tienes ya cuenta en GitHub, Vercel o ambas? Sí, en las dos (2026-11-21).
- [x] ¿Dominio propio ahora o más adelante? Más adelante, junto con el correo propio (se siguen las recomendaciones).
