# Configuración de Kubica — diseño

Fecha: 2026-10-25 · Estado: aprobado el boceto de la pantalla; este documento
espera la aprobación de David antes de construir.

## Para qué

Kubica se va a usar en varias empresas, cada una con su propia instalación
(su Render y su base de datos). Hoy, adaptarla a una empresa exige tocar
código o variables de Render: el nombre de la empresa sale de `MARCA`, el
código para crear cuenta de `REGISTRATION_CODE`, el catálogo de
`CATALOG_URL`, las tallas están fijas en el código y para hacer
administrador a alguien hay que editar la base de datos. Lo que sí se puede
cambiar desde la app está regado: los avisos en la campana, los enlaces
"solo ver" y la instalación en el menú del avatar, y los datos de prueba,
el respaldo y "Empezar de cero" al final del Resumen.

David pidió dos cosas concretas para esta pantalla:

- **Modo oscuro.**
- **Volver a armar la bodega en 3D con fotos**, por si el modelo quedó mal.

Además aprobó el resto del boceto ("Está perfecto"), con mis
recomendaciones de *Tu empresa* y *Equipo*.

## Lo que se ve (boceto aprobado)

Se entra desde el menú del avatar (la letra arriba a la derecha) con
"Configuración", ruta `/settings`. Es una página como las demás de la app
(móvil primero, marca Kubica): título, una frase y secciones con tarjetas de
filas. Cada fila tiene ícono, título, una línea de explicación y, a la
derecha, su valor o una flecha.

| Sección | Filas | Quién la ve |
|---|---|---|
| Apariencia | Modo oscuro: Automático · Claro · Oscuro | todos |
| Tu bodega | Armar la bodega con fotos · Editar a mano · Empezar de cero | admin |
| Tu empresa | Nombre de la empresa · Tallas que manejan · Tienda en línea | admin |
| Equipo | Personas · Código para unirse · Enlaces «solo ver» | admin |
| Avisos | Avisos al celular | admin y operador |
| Datos | Descargar respaldo · Datos de prueba | admin |
| Cuenta | Instalar en este celular · Cerrar sesión | todos |

"Solo ver" (la cuenta de los enlaces) ve solo Apariencia y Cuenta.

## Metas

1. Modo oscuro en toda la app, con tres opciones; "Automático" sigue el modo
   del celular.
2. Un solo lugar para ajustar la app. Lo que hoy está regado se mueve aquí.
3. Que un administrador adapte la app a su empresa sin tocar código ni
   Render: nombre de la empresa, tallas y tienda en línea.
4. Que un administrador maneje su equipo: ver quién entra, quién es
   administrador, quitar o devolver el acceso y cambiar el código para crear
   cuenta.
5. Dejar listo el acceso a "Armar la bodega con fotos", que es un proyecto
   aparte.

## No metas

- Varias empresas en una misma instalación. Cada empresa sigue con la suya.
- Cambiar los colores de la marca desde la app. Siguen siendo tokens en el
  código y `VITE_MARCA`.
- Armar el 3D con fotos. Es el proyecto siguiente; aquí solo va el botón.
- Recuperar contraseñas, cobros y planes.

## Antimetas (sería un fracaso aunque funcione)

- Que una instalación que ya funciona cambie sola. Las variables de entorno
  siguen valiendo como valor por defecto, y un valor guardado en la app
  manda sobre ellas.
- Que un administrador se quede sin acceso: no se puede quitar el último
  administrador ni quitarse el rol uno mismo si es el único.
- Un modo oscuro que no se lee (texto por debajo de AA) o un 3D que se
  vuelve ilegible.
- Opciones repetidas en dos lugares que se contradicen. Lo que se mueve,
  se quita de donde estaba (salvo la campana, ver abajo).

## Cómo funciona cada parte

### Apariencia: modo oscuro

- Se guarda por persona en este dispositivo (`localStorage`, clave
  `tema`): `auto` (por defecto), `claro` u `oscuro`. Es la misma idea que el
  modo oscuro que ya se hizo en Pigmapp.
- `index.html` lo aplica antes de pintar, igual que hoy aplica la marca:
  pone `data-tema="oscuro"` en `<html>` cuando toca. En `auto` usa
  `prefers-color-scheme` y escucha si el celular cambia.
- **Separar el color de texto del color de las barras.** Hoy `--ink` es a la
  vez el texto y el fondo de la barra de arriba, el dock, las tarjetas
  oscuras (`kpi.dark`, `code.dark`, `tag-out`, `btn-ink`...) y el interruptor
  encendido. Hay que crear un token para el cromo oscuro (por ejemplo
  `--chrome`) y usarlo en esos lugares. En modo oscuro `--ink` pasa a ser el
  texto claro y `--chrome` sigue oscuro.
- Colores propuestos (los del boceto):

  | token | oscuro |
  |---|---|
  | `--fog` (página) | `#121316` |
  | `--paper` (tarjetas) | `#1B1D21` |
  | `--fog-2` / `--fog-3` | `#24272C` / `#30343A` |
  | `--ink` (texto) | `#EEEAE2` |
  | `--graphite` / `--muted` / `--faint` | `#CFCAC0` / `#A9A396` / `#7E796F` |
  | `--line` / `--line-2` | `#2A2D33` / `#3B3F46` |
  | `--red` / `--red-soft` | `#FF8A73` / `#3A1D17` |
  | barra de arriba | `#0B0C0E` |

  El amarillo de la marca no cambia. Los grises `--n-*` necesitan su
  versión oscura. Las sombras se apagan.
- Revisar a mano: el visor 3D (su fondo y etiquetas), los PDF y el Excel (no
  cambian: siempre claros), el login y la pantalla de carga, que ya son
  oscuros.
- Aplica a cualquier marca: los tokens oscuros son neutros y el acento sigue
  siendo el de la marca.

### Tu bodega

- **Armar la bodega con fotos.** Mientras el proyecto de fotos no exista,
  abre el editor de la bodega con un aviso de que pronto se podrá armar con
  fotos.
- **Editar a mano.** Abre la Bodega 3D en modo edición (el lápiz de hoy).
- **Empezar de cero.** La hoja de hoy (`ResetSheet`), que se quita del
  final del Resumen.

### Tu empresa (admin)

- Se guarda en la tabla `app_settings`, que ya existe, con las claves
  `empresa_nombre`, `tallas` y `catalogo_url`.
- Rutas nuevas: `GET /api/settings` para cualquier usuario con sesión, y
  `PUT /api/settings` solo para admin.
- **Nombre de la empresa.** Si tiene valor, reemplaza al de la marca en
  `nombreApp()` (PDF), en el título del Excel y en el texto del enlace
  "solo ver". Vacío: como hoy.
- **Tallas que manejan.** Una lista ordenada, por defecto la de hoy
  (`S, M, L, XL, 2XL, 3XL, 4XL`). Se usa donde hoy está fija: la plantilla de
  tallas de la remisión (`remisiones/refs.js`) y del conteo de lo de paso
  (`despacho/parcelParts.js`). No cambia los productos que ya existen.
- **Tienda en línea.** La dirección del catálogo (Shopify `products.json`).
  Si tiene valor, manda sobre `CATALOG_URL`. Al guardarla se vuelve a leer
  el catálogo. Vacía: apagado (o el de `CATALOG_URL` si existe).

### Equipo (admin)

- **Personas.** Lista con nombre, correo, rol y fecha. Se puede cambiar el
  rol entre administrador y operador. Rutas: `GET /api/users` y
  `PATCH /api/users/{id}` (solo admin). Nunca queda la instalación sin un
  administrador.
- **Quitar el acceso** (David, 2026-10-25). Un administrador puede quitarle
  el acceso a una persona, por ejemplo si se fue de la empresa:
  - No se borra la cuenta: sus movimientos, documentos y su nombre en el
    historial quedan como estaban. La cuenta queda inactiva (columna nueva
    `active` en `users`, verdadera por defecto, agregada con el mecanismo de
    `ensure_columns`).
  - Una cuenta inactiva no puede iniciar sesión, y una sesión abierta deja de
    servir de inmediato (`get_current_user` revisa `active`).
  - Nunca se le quita el acceso al último administrador activo, y nadie se
    lo quita a sí mismo desde aquí.
  - Se puede devolver el acceso desde la misma lista.
  - Las personas inactivas aparecen aparte, al final de la lista.
- **Código para unirse.** Se guarda en `app_settings`
  (`registration_code`) y manda sobre `REGISTRATION_CODE`. El registro lo
  lee de ahí primero.
- **Enlaces «solo ver».** La pantalla de hoy (`ViewLink`), movida aquí.

### Avisos

- Los ajustes de qué avisos llegan al celular (hoy en la campana y en
  `PushBox`) se ven aquí. La campana se queda arriba como atajo a esos mismos
  ajustes: es el mismo componente y el mismo estado, así que no se pueden
  contradecir.

### Datos (admin)

- **Descargar respaldo.** Los CSV de inventario e historial que ya existen.
- **Datos de prueba.** El interruptor que hoy está en el Resumen
  (`POST /api/reports/demo`), que se quita de ahí.

### Cuenta

- **Instalar en este celular** y **Cerrar sesión**, que hoy están en el menú
  del avatar. El menú queda con el nombre, "Configuración" y "Cerrar sesión".

## Restricciones

- Móvil primero (PWA), textos en español, marca Kubica por tokens, contraste
  AA en claro y en oscuro.
- Las variables de entorno siguen funcionando como valor por defecto. Ninguna
  instalación cambia al desplegar.
- El repositorio es público: nada de datos de clientes ni secretos en el
  código o las pruebas.
- Pruebas con pytest y vitest, y revisar en el navegador cada pantalla
  tocada antes del commit. El build y vitest no detectan variables sin
  definir.
- Commit local; se sube solo con el visto bueno de David.

## Orden sugerido

1. La pantalla y lo que se mueve (Apariencia sin el modo oscuro todavía,
   Tu bodega, Avisos, Datos, Cuenta, Enlaces).
2. Modo oscuro: separar `--chrome` de `--ink` y agregar los tokens oscuros.
3. Tu empresa: `app_settings` y rutas, nombre, tallas y tienda.
4. Equipo: personas y roles, quitar y devolver el acceso, y el código para
   unirse.

## Decisiones que tomé yo (Claude), para que David las revise

- El modo oscuro se guarda por dispositivo, no en la cuenta. Igual que en
  Pigmapp; si alguien usa dos celulares, lo elige en cada uno.
- "Descargar respaldo" y "Datos de prueba" son solo para administradores.
- "Empezar de cero" y "Datos de prueba" salen del Resumen. La campana se
  queda como atajo a los mismos ajustes de avisos.
- Las tallas son una lista libre en el orden que la escriba la empresa
  (sirve para S/M/L, números o "Única").
- Quitar el acceso desactiva la cuenta en vez de borrarla, se puede devolver,
  y nadie se lo quita a sí mismo.
- El modo oscuro aplica a cualquier marca, con su propio acento.

## Lo que queda a criterio de quien lo construye

- Los valores exactos de los grises oscuros que no están en la tabla, con
  contraste AA.
- Cómo se dividen los componentes y si `GET /api/settings` se guarda en caché
  (`useApi`).
- Los íconos de cada fila, de los que ya hay en `ui/Icon.jsx`.
- El diseño de cada hoja interna (personas, tallas, tienda), siguiendo el
  estilo de las hojas de la app.
