# Glosario de aprendizaje

Conceptos técnicos que aparecen durante el desarrollo de Loyili, explicados en lenguaje sencillo. Se amplía a medida que avanza el proyecto.

## Fundamentos

**Frontend / Backend** — El frontend es lo que el usuario ve y toca (pantallas, botones). El backend es lo que ocurre "detrás del mostrador": guardar datos, verificar permisos, calcular puntos.

**Full-stack** — Un proyecto que contiene frontend y backend juntos. Loyili es full-stack gracias a Next.js.

**Framework** — Un conjunto de herramientas y reglas que da estructura a una aplicación, como un esqueleto prefabricado sobre el que construyes. Next.js es un framework.

**TypeScript** — JavaScript con "etiquetas de tipo" (esto es un número, esto es un texto). Detecta errores antes de ejecutar el programa.

**Dependencia / paquete** — Código escrito por otros que el proyecto reutiliza. Se listan en `package.json` y se descargan a `node_modules/` con `npm install`.

**npm** — El gestor que descarga e instala paquetes y ejecuta los scripts del proyecto (`npm run dev`).

## Next.js

**Next.js** — Framework basado en React para crear aplicaciones web. Une pantallas y lógica de servidor en un mismo proyecto.

**React** — Biblioteca para construir interfaces a partir de piezas reutilizables llamadas *componentes*.

**App Router** — Sistema de Next.js donde las carpetas dentro de `src/app/` se convierten en direcciones web. `src/app/wallet/page.tsx` → `/wallet`.

**Route group** — Carpeta con nombre entre paréntesis, como `(merchant)`. Agrupa rutas para organizarlas sin que el nombre aparezca en la URL.

**Server Component** — Componente que se ejecuta en el servidor; puede leer la base de datos directamente y envía al navegador solo el resultado.

**Server Action** — Función que se ejecuta en el servidor cuando el usuario envía un formulario o pulsa un botón. Es donde se guardan los datos de forma segura.

**proxy.ts** — Archivo que se ejecuta antes de cada petición; en Loyili servirá para mantener la sesión activa y redirigir al login. (En versiones anteriores de Next.js se llamaba `middleware.ts`).

## Base de datos y Supabase

**Base de datos relacional** — Información organizada en tablas (como hojas de cálculo) relacionadas entre sí.

**PostgreSQL** — Uno de los motores de bases de datos relacionales más robustos y usados del mundo. Es gratuito y de código abierto.

**Supabase** — Servicio en la nube que te da una base de datos PostgreSQL ya instalada y administrada, más autenticación de usuarios, almacenamiento de archivos y un panel web. Supabase *usa* PostgreSQL: no son competidores, Supabase es PostgreSQL con servicios añadidos.

**SQL** — El lenguaje para crear tablas y consultar o modificar datos en PostgreSQL.

**Migración** — Archivo SQL que describe un cambio en la estructura de la base de datos (crear una tabla, añadir una columna). Se guardan en orden para poder reconstruir la base de datos desde cero en cualquier momento.

**RLS (Row Level Security)** — Reglas dentro de PostgreSQL que deciden qué filas puede ver o modificar cada usuario. Ejemplo: "un comercio solo ve sus propios clientes". Funciona aunque haya un error en el código de la app.

**Multi-tenant** — Una sola aplicación que sirve a muchos clientes (aquí, comercios) manteniendo los datos de cada uno separados.

**Ledger (libro mayor)** — Registro de movimientos que solo se añade, nunca se borra, como un libro de contabilidad. El saldo es la suma de los movimientos.

**Transacción** — Grupo de operaciones en la base de datos que se ejecutan todas o ninguna. Evita, por ejemplo, descontar puntos sin registrar el canje.

**Idempotencia** — Propiedad de una operación que, si se repite por error (doble clic, reintento de red), produce el mismo resultado que hacerla una sola vez.

## Seguridad

**Variable de entorno** — Valor de configuración (como una contraseña o una URL) que se guarda fuera del código, en `.env.local`, para no publicarlo.

**`NEXT_PUBLIC_`** — Prefijo que hace que una variable de entorno sea visible en el navegador. Solo para datos no secretos.

## Herramientas

**Git** — Sistema que guarda el historial de cambios del proyecto, como "puntos de guardado" a los que se puede volver.

**Commit** — Un punto de guardado en Git, con un mensaje que describe el cambio.

**ESLint** — Herramienta que revisa el código en busca de errores comunes y malas prácticas.

**Build** — Proceso que prepara la aplicación para producción y, de paso, comprueba que todo compila sin errores.

**ADR** — Documento corto que registra una decisión técnica y su porqué.
