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

**Trigger (disparador)** — Instrucción que la base de datos ejecuta sola cuando ocurre algo. Ej.: "cuando se cree un usuario, crea su perfil". Funciona como un sensor de movimiento que enciende la luz.

**Política RLS** — Cada regla concreta de RLS. Ej.: "un usuario solo puede leer la fila cuyo `id` es el suyo". Sin una política que lo permita, la base de datos responde como si la fila no existiera.

**`grant` / `revoke`** — Comandos SQL que dan o quitan permisos sobre una tabla (leer, insertar, modificar ciertas columnas). Trabajan junto con RLS: `grant` decide *qué acciones* se permiten; RLS, *sobre qué filas*.

**`security definer`** — Función de la base de datos que se ejecuta con los permisos de quien la creó, no de quien la llama. Es potente, como una llave maestra, por eso se protege fijando `search_path` y quitando el permiso de ejecutarla directamente.

**Idempotencia** — Propiedad de una operación que, si se repite por error (doble clic, reintento de red), produce el mismo resultado que hacerla una sola vez.

**PWA (aplicación web progresiva)** — Una web que se puede instalar en el teléfono como una app: ícono en la pantalla de inicio y sin la barra del navegador. No pasa por las tiendas de aplicaciones y se actualiza sola al publicar cambios.

**Manifiesto** — Ficha de la app (`/manifest.webmanifest`) que le dice al teléfono su nombre, su ícono, sus colores y en qué página abrir. Es lo que hace instalable una web.

**Service worker** — Un pequeño programa que el navegador mantiene en segundo plano para una web: guarda copias para usarla sin conexión y recibe notificaciones. Loyili aún no lo usa; llegará con las notificaciones.

**Puntos en circulación** — Suma de los saldos de todos los clientes de un comercio: los puntos que el comercio "debe" y que pueden canjearse en cualquier momento. Sirve para prever cuántas recompensas habrá que entregar.

**Agregar (en un reporte)** — Resumir muchos registros en pocas cifras: contar, sumar o promediar. Loyili lo hace dentro de la base de datos, que es mucho más rápido que traer todos los movimientos a la aplicación.

## Seguridad

**Variable de entorno** — Valor de configuración (como una contraseña o una URL) que se guarda fuera del código, en `.env.local`, para no publicarlo.

**`NEXT_PUBLIC_`** — Prefijo que hace que una variable de entorno sea visible en el navegador. Solo para datos no secretos.

**Autenticación vs. autorización** — Autenticación es comprobar *quién eres* (como mostrar el DNI en la puerta). Autorización es decidir *qué puedes hacer* una vez dentro (a qué salas puedes entrar). El Módulo 1 resuelve la primera; RLS y los roles, la segunda.

**Sesión** — El "pase" que recibe el navegador tras iniciar sesión, para no pedir la contraseña en cada página. En Loyili se guarda en *cookies* y `proxy.ts` lo renueva antes de que caduque.

**Código temporal** — Código que caduca solo al cabo de poco tiempo, como los que mandan los bancos por SMS. No hace falta impedir que alguien lo copie: pasado ese tiempo, la copia no sirve. El QR de "Mi código" vale 5 minutos.

**Contexto seguro (HTTPS)** — El navegador solo deja usar la cámara, el micrófono o la ubicación en páginas con HTTPS (o en `localhost`, tu propia computadora). Así una web cualquiera sin cifrar no puede espiarte. Por eso el escaneo desde el teléfono llegará con la publicación.

**Open redirect** — Fallo de seguridad en el que un enlace como `/login?next=https://sitio-malo.com` lleva al usuario a otra web tras iniciar sesión. Se evita aceptando solo rutas internas.

## Herramientas

**Git** — Sistema que guarda el historial de cambios del proyecto, como "puntos de guardado" a los que se puede volver.

**Commit** — Un punto de guardado en Git, con un mensaje que describe el cambio.

**Repositorio** — La carpeta del proyecto más su historial de Git (guardado en la carpeta oculta `.git/`).

**`.gitignore`** — Lista de archivos que Git no debe guardar nunca: secretos (`.env.local`), dependencias descargables (`node_modules/`) y archivos generados (`.next/`).

**winget** — El instalador de programas de Windows desde la terminal, como una "tienda de aplicaciones" por comandos.

**CLI** — *Command Line Interface*: un programa que se usa escribiendo comandos en la terminal en vez de con ventanas y botones. Ej.: la CLI de Supabase (`npx supabase ...`).

**Configuración como código** — Guardar los ajustes de un servicio (como Supabase) en archivos del proyecto en vez de cambiarlos con clics. Así quedan en Git, se pueden revisar y repetir en otro entorno.

**Dry-run (ensayo)** — Ejecutar un comando en modo simulación: muestra lo que haría sin hacerlo. Como la vista previa antes de imprimir.

**SMTP** — El protocolo para enviar correos. Un "proveedor SMTP propio" es un servicio de envío de correos que contratas (con un plan gratuito o de pago) para no depender del envío limitado de Supabase.

**ESLint** — Herramienta que revisa el código en busca de errores comunes y malas prácticas.

**Build** — Proceso que prepara la aplicación para producción y, de paso, comprueba que todo compila sin errores.

**ADR** — Documento corto que registra una decisión técnica y su porqué.
