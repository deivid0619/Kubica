# Configuración de Kubica — plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pantalla de Configuración (`/settings`) con modo oscuro, los datos de la empresa y el equipo, y lo que hoy está regado por la app.

**Architecture:** Página React nueva en `frontend/src/modules/configuracion/`, a la que se entra desde el menú del avatar. Los ajustes de la empresa y del equipo se guardan en la tabla `app_settings` que ya existe, mediante un módulo nuevo `backend/app/modules/ajustes/`. Las variables de entorno quedan como valor por defecto. El modo oscuro son tokens CSS bajo `:root[data-tema="oscuro"]`, y para eso se separa el color de las barras (`--chrome`) del color del texto (`--ink`).

**Tech Stack:** FastAPI + SQLAlchemy + pytest · React + Vite + vitest · CSS con tokens (`styles/global.css`, `styles/marcas.css`).

**Spec:** `docs/superpowers/specs/2026-10-25-configuracion-design.md`

## Global Constraints

- Textos en español, con el vocabulario de la app ("prendas", "bodega", "reserva").
- Marca Kubica por tokens: nunca un hex nuevo dentro de una regla, siempre un token.
- Contraste AA (4,5:1 en texto, 3:1 en texto grande e íconos), en claro y en oscuro.
- Las variables de entorno siguen siendo el valor por defecto; un valor guardado en la app manda sobre ellas. Ninguna instalación cambia al desplegar.
- El repositorio es público: nada de datos de clientes ni secretos en código o pruebas.
- Puertos propios: página 5190, servidor 8090.
- Antes de cada commit, abrir en el navegador cada pantalla tocada y revisar la consola: el build y vitest no detectan variables sin definir.
- Commits locales en `main`. Nada se sube sin el visto bueno de David.
- Después de tocar código: `graphify update .`

## Review Focus

1. Un admin se baja el rol a sí mismo cuando hay otro admin. Se permite y su sesión sigue como operador; si es el último, la app lo impide. Prueba en Task 4: `test_demote_self_when_other_admin_exists`.
2. Una persona a la que le quitaron el acceso tiene la app abierta. Su siguiente llamada da 401 y la app vuelve al login con el mensaje. Prueba en Task 4: `test_inactive_token_rejected`.
3. Modo "Automático" y el celular cambia de claro a oscuro con la app abierta: la app cambia sola. Prueba en Task 2: `watchTema` llama al callback cuando cambia `matchMedia`.
4. Se cambian las tallas mientras hay un borrador de remisión guardado: el borrador conserva sus filas y no falla; las tallas nuevas solo aplican a referencias nuevas. Prueba en Task 3: `tallas.test.js` con `newRows` sobre la lista actual.
5. Se guarda una tienda en línea que no responde: el estado muestra "Sin conexión" y la app sigue funcionando. Si se guarda vacía, el catálogo queda apagado. Prueba en Task 3: `test_catalog_url_saved_and_cleared`.

---

### Task 1: La pantalla y lo que se mueve

**Files:**
- Create: `frontend/src/modules/configuracion/Settings.jsx` (la página)
- Create: `frontend/src/modules/configuracion/sections.js` (qué secciones ve cada rol)
- Create: `frontend/src/modules/configuracion/configuracion.css` (filas y tarjetas; estilos del boceto aprobado)
- Create: `frontend/src/modules/configuracion/sections.test.js`
- Modify: `frontend/src/App.jsx` (ruta `/settings`; `AccountMenu` queda con nombre, "Configuración" y "Cerrar sesión"; la instalación y su hoja de iOS se mueven a Settings)
- Modify: `frontend/src/modules/resumen/Summary.jsx` (se quitan datos de prueba, "Empezar de cero" y `<ViewLink />`; se quedan las descargas de Excel, copiar inventario y traer fotos)
- Modify: `frontend/src/modules/avisos/NotificationBell.jsx` (se extrae el contenido de ajustes de `TeamBell` a `export function NotificationPrefs()`, que usan la campana y Settings)
- Modify: `frontend/src/modules/bodega/Warehouse.jsx` (`?editar=1` abre en modo edición si es admin y luego limpia el parámetro, como ya hace con `loc`/`sku`)
- Modify: `backend/app/modules/reportes/router.py` (`GET /api/reports/demo` → `{"demo": bool}` con `inv.has_demo_data`, solo admin)
- Test: `backend/tests/test_reports.py` (agregar `test_demo_status`)

**Interfaces:**
- Produces: `sectionsFor(role: 'admin'|'operator'|'viewer'): string[]` en `sections.js`, con el orden fijo `['apariencia','bodega','empresa','equipo','avisos','datos','cuenta']` filtrado por rol: admin todas; operator `['apariencia','avisos','cuenta']`; viewer `['apariencia','cuenta']`. Settings pinta cada sección que tenga componente; `apariencia` llega en Task 2, `empresa` en Task 3 y Personas y Código en Task 4.
- Produces: `NotificationPrefs()` (sin props) en `NotificationBell.jsx`.
- Produces: componente `SettingsRow({ icon, title, hint, value, tone, onClick })` en `Settings.jsx`. `tone` es `'hi'` (ícono amarillo) o `'danger'`; si hay `onClick` es un `<button>`.

- [ ] **Step 1:** Escribir `sections.test.js`: `sectionsFor('admin')` es igual a la lista completa; `sectionsFor('operator')` es `['apariencia','avisos','cuenta']`; `sectionsFor('viewer')` es `['apariencia','cuenta']`; un rol desconocido devuelve lo mismo que viewer.
- [ ] **Step 2:** `npx vitest run src/modules/configuracion` → FAIL (no existe el módulo).
- [ ] **Step 3:** Escribir `test_demo_status` en `test_reports.py`: como admin, `GET /api/reports/demo` → `{"demo": false}`; después de `POST /api/reports/demo` → `{"demo": true}`; operador → 403.
- [ ] **Step 4:** `venv/Scripts/python.exe -m pytest -q tests/test_reports.py -k demo` → FAIL (405).
- [ ] **Step 5:** Implementar `sections.js`, la ruta `GET /api/reports/demo`, `NotificationPrefs`, `?editar=1` y `Settings.jsx`, con el contenido del boceto:
  - **Tu bodega:** "Armar la bodega con fotos" lleva a `/?editar=1` con el aviso "Pronto podrás armarla con fotos. Por ahora, edítala a mano."; "Editar a mano" lleva a `/?editar=1`; "Empezar de cero" abre `ResetSheet`.
  - **Equipo:** `<ViewLink />`.
  - **Avisos:** `NotificationPrefs` en una hoja.
  - **Datos:** "Descargar respaldo" baja `inventory.csv` y `movements.csv` con `downloadCsv`; "Datos de prueba" es un interruptor que lee `GET` y cambia con `POST /api/reports/demo`, con la confirmación de hoy.
  - **Cuenta:** instalar y cerrar sesión.
- [ ] **Step 6:** Correr las dos pruebas → PASS, y la suite completa (`pytest -q`, `npx vitest run`) → PASS.
- [ ] **Step 7:** Revisar en el navegador `/settings` como admin y como operador (crear un operador local con "Crear cuenta" y el código `bodega`), el Resumen y el menú del avatar. Consola sin errores.
- [ ] **Step 8:** Commit: `Configuracion: la pantalla y lo que se mueve desde el Resumen y el menu`.

### Task 2: Modo oscuro

**Files:**
- Create: `frontend/src/core/tema.js`
- Create: `frontend/src/core/tema.test.js`
- Create: `frontend/src/styles/oscuro.css` (importado en `main.jsx` después de `marcas.css`)
- Modify: `frontend/src/styles/global.css` (token `--chrome` y `--chrome-rgb`, por defecto iguales a `--ink` / `--ink-rgb`; cada superficie oscura que hoy usa `background:var(--ink)` o `rgba(var(--ink-rgb),…)` pasa a `--chrome`; `color:var(--ink)` no cambia; los `background:#fff` que son superficie pasan a `var(--paper)`)
- Modify: `frontend/src/styles/marcas.css` (Pigmalion: `--chrome:#0B0B0B; --chrome-rgb:11,11,11`)
- Modify: `frontend/index.html` (el script del `<head>` también aplica el tema antes de pintar)
- Modify: `frontend/src/modules/configuracion/Settings.jsx` (sección Apariencia: Automático · Claro · Oscuro)

**Interfaces:**
- Produces, en `tema.js`:
  - `getTema(): 'auto'|'claro'|'oscuro'` (lee `localStorage['tema']`; un valor inválido o un error da `'auto'`)
  - `setTema(t): void` (guarda y aplica)
  - `resolveTema(t, prefersDark: boolean): 'claro'|'oscuro'`
  - `applyTema(t): void` (pone o quita `data-tema="oscuro"` en `<html>` y ajusta `meta[name=theme-color]`)
  - `watchTema(onChange): () => void` (escucha `matchMedia('(prefers-color-scheme: dark)')`; devuelve la función para dejar de escuchar)
- Consumes: `SettingsRow` (Task 1).

- [ ] **Step 1:** Escribir `tema.test.js`:
  - `resolveTema('auto', true) === 'oscuro'`, `resolveTema('auto', false) === 'claro'` y `resolveTema('claro', true) === 'claro'`.
  - Con `localStorage['tema'] = 'xx'`, `getTema() === 'auto'`.
  - `applyTema('oscuro')` deja `document.documentElement.dataset.tema === 'oscuro'` y `applyTema('claro')` lo quita.
  - `watchTema(cb)` llama a `cb` cuando el `matchMedia` falso emite `change` (usar un mock de `window.matchMedia` con `addEventListener`).
- [ ] **Step 2:** `npx vitest run src/core/tema.test.js` → FAIL.
- [ ] **Step 3:** Implementar `tema.js`, el script de `index.html` (misma lógica, sin importar módulos), `--chrome` en `global.css` y `marcas.css`, `oscuro.css` con los valores de la tabla del diseño, y la sección Apariencia. App se suscribe con `watchTema` cuando el tema es `auto`.
  - Valores de la tabla: `--fog #121316`, `--paper #1B1D21`, `--fog-2 #24272C`, `--fog-3 #30343A`, `--ink #EEEAE2`, `--graphite #CFCAC0`, `--muted #A9A396`, `--faint #7E796F`, `--line #2A2D33`, `--line-2 #3B3F46`, `--red #FF8A73`, `--red-soft #3A1D17`, `--chrome #0B0C0E`, sombras en `none`.
  - Los `--n-*` oscuros: calcularlos con AA.
  - La flecha del `select.input` (SVG con trazo oscuro) necesita su versión clara.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Revisar en el navegador, en oscuro y en claro: Bodega 3D, Inventario, Escanear (incluida la hoja de factura), Reserva, Resumen, Configuración y el login. Medir el contraste de `--muted` sobre `--paper` y sobre `--fog`. Con `?marca=pigmalion`, el claro debe quedar idéntico a antes. Consola sin errores.
- [ ] **Step 6:** Commit: `Modo oscuro: automatico, claro u oscuro (Configuracion > Apariencia)`.

### Task 3: Tu empresa — nombre, tallas y tienda

**Files:**
- Create: `backend/app/modules/ajustes/__init__.py`, `router.py`, `schemas.py`, `service.py`
- Create: `backend/tests/test_ajustes.py`
- Modify: `backend/app/main.py` (incluir el router; en el arranque cargar la tienda guardada con `catalog.set_url`)
- Modify: `backend/app/modules/catalogo/service.py` (`set_url(url: str) -> None`, `current_url() -> str`; las 4 lecturas de `settings.catalog_url` pasan a `current_url()`)
- Modify: `backend/app/modules/reportes/excel.py` (la constante `APP` pasa a `app_name(db) -> str`, que agrega `empresa_nombre` si tiene valor; `base` usa `catalog.current_url()`)
- Create: `frontend/src/core/tallas.js`, `frontend/src/core/tallas.test.js`
- Modify: `frontend/src/core/marca.js` (`setEmpresa(nombre: string)`; si no está vacío, manda sobre `empresa` en `datosMarca()` y `nombreApp()`)
- Modify: `frontend/src/core/useApi.js` (`useAjustes()` = `usePolling('/api/settings', { interval: 60000 })`)
- Modify: `frontend/src/App.jsx` (Shell: al llegar los ajustes, `setEmpresa` y `setTallas`)
- Modify: `frontend/src/modules/remisiones/refs.js` y `frontend/src/modules/despacho/parcelParts.js` + `ParcelSheet.jsx` (`TEMPLATE` y `SIZES` pasan a `tallas()`)
- Modify: `frontend/src/modules/configuracion/Settings.jsx` (sección Tu empresa con tres hojas: nombre, tallas y tienda)

**Interfaces:**
- Produces (backend, `ajustes/service.py`):
  - `ajustes(db) -> dict` con `empresa_nombre: str` (por defecto `''`), `tallas: list[str]` (por defecto `["S","M","L","XL","2XL","3XL","4XL"]`) y `catalogo_url: str` (por defecto `settings.catalog_url`).
  - `guardar(db, cambios: dict) -> dict`.
  - Filas de `AppSetting` con las claves `ajuste:empresa_nombre`, `ajuste:tallas` (JSON) y `ajuste:catalogo_url`.
- Produces (rutas):
  - `GET /api/settings` (cualquier sesión, incluido "solo ver") → `{empresa_nombre, tallas, catalogo_url}`.
  - `PUT /api/settings` (admin; campos opcionales) → lo mismo.
  - Validación (422): `empresa_nombre` de hasta 60 caracteres; `tallas` de 1 a 20 elementos, cada uno de 1 a 8 caracteres, sin espacios a los lados, en mayúsculas y sin repetidas; `catalogo_url` vacía o `http(s)://…` de hasta 300 caracteres.
  - Al guardar la tienda: `catalog.set_url` y refresco en segundo plano.
- Produces (frontend):
  - `tallas(): string[]` y `setTallas(list: string[]): void` en `core/tallas.js`. Por defecto la lista de arriba; una lista vacía o inválida deja la de antes.
  - `newRows(): {size, qty}[]` en `refs.js` usa `tallas()`.

- [ ] **Step 1:** Escribir `test_ajustes.py`:
  - `test_defaults`: `GET` como operador da `empresa_nombre == ''` y las tallas por defecto.
  - `test_admin_saves_and_reads`: `PUT {"empresa_nombre":"Distribuidora Uno","tallas":["S","M","L"]}` y el `GET` lo devuelve.
  - `test_operator_cannot_save`: 403.
  - `test_invalid_tallas`: `[]` y una lista de 21 → 422.
  - `test_catalog_url_saved_and_cleared`: guardar `https://tienda.example/products.json` hace que `catalog.current_url()` lo devuelva; guardar `''` deja `current_url() == ''` y `GET /api/catalog/status` da `enabled == False`.
  - `test_excel_uses_empresa`: con el nombre guardado, `wb.properties.title` del `inventory.xlsx` contiene "Distribuidora Uno".
  - Usar el patrón de `tests/test_view_only.py`; dejar los ajustes como estaban al final de cada prueba.
- [ ] **Step 2:** `pytest -q tests/test_ajustes.py` → FAIL.
- [ ] **Step 3:** Escribir `tallas.test.js`:
  - `tallas()` por defecto es `['S','M','L','XL','2XL','3XL','4XL']`.
  - `setTallas(['28','30','32'])` y luego `tallas()` devuelve eso.
  - `setTallas([])` deja la anterior.
  - `newRows()` (de `refs.js`) devuelve una fila por talla actual con `qty` 0.
  - Un borrador guardado con otras tallas no se toca.
  - Agregar en `marca.test.js` o en el mismo archivo: `setEmpresa('Uno')` → `nombreApp() === 'Uno · Kubica'`; `setEmpresa('')` → `'Kubica'`.
- [ ] **Step 4:** `npx vitest run` → FAIL.
- [ ] **Step 5:** Implementar el módulo `ajustes`, `set_url`/`current_url`, `app_name(db)`, `tallas.js`, `setEmpresa`, `useAjustes` y la sección Tu empresa. La hoja de la tienda muestra el estado de `GET /api/catalog/status`.
- [ ] **Step 6:** `pytest -q` y `npx vitest run` → PASS.
- [ ] **Step 7:** Revisar en el navegador:
  - guardar nombre, tallas y tienda en Configuración;
  - abrir una remisión nueva: sus filas son las tallas guardadas;
  - abrir "Anotar algo de paso" y descargar un PDF de remisión: el encabezado dice "Distribuidora Uno · Kubica".
  - Dejar los ajustes locales como estaban al terminar.
- [ ] **Step 8:** Commit: `Configuracion: nombre de la empresa, tallas y tienda en linea`.

### Task 4: Equipo — roles, quitar el acceso y código para unirse

**Files:**
- Modify: `backend/app/modules/auth/models.py` (`active = Column(Boolean, nullable=False, default=True)`)
- Modify: `backend/app/core/migrations.py` (`"users": [("active", "BOOLEAN NOT NULL DEFAULT TRUE")]` en `_NEW_COLUMNS`)
- Modify: `backend/app/core/deps.py` (`_authenticated`: si `not user.active` → 401 "Esta cuenta ya no tiene acceso. Habla con un administrador.")
- Modify: `backend/app/modules/auth/router.py`:
  - login: misma respuesta 401 para una cuenta inactiva;
  - registro: el código sale de `ajustes.codigo_registro(db)`;
  - `GET /api/users` y `PATCH /api/users/{id}`.
- Modify: `backend/app/modules/auth/schemas.py` (`UserAdminOut {id, name, email, role, active, created_at}`, `UserPatchIn {role?: Literal['admin','operator'], active?: bool}`)
- Modify: `backend/app/modules/ajustes/service.py` y `router.py`:
  - `codigo_registro(db) -> str`: `ajuste:registration_code` o `settings.registration_code`.
  - `GET /api/settings` agrega `codigo_registro` solo si quien pide es admin.
  - `PUT` lo acepta: de 4 a 40 caracteres, sin espacios a los lados.
- Create: `backend/tests/test_equipo.py`
- Modify: `frontend/src/modules/configuracion/Settings.jsx` (filas Personas y Código para unirse) y crear `frontend/src/modules/configuracion/Personas.jsx`
- Modify: `frontend/src/core/api.js` o `AuthContext.jsx`, solo si hace falta: ante un 401 con ese mensaje, volver al login mostrándolo.

**Interfaces:**
- Consumes: `ajustes`/`guardar` (Task 3).
- Produces:
  - `GET /api/users` (admin) → `UserAdminOut[]` sin la cuenta "solo ver" (`role == 'viewer'`), activas primero y por nombre.
  - `PATCH /api/users/{id}` (admin) → `UserAdminOut`.
  - Errores con `detail` en español: 409 "Kubica necesita al menos un administrador." si dejaría cero administradores activos; 409 "No puedes quitarte el acceso a ti mismo." si es uno mismo con `active=false`; 404 si no existe.

- [ ] **Step 1:** Escribir `test_equipo.py`:
  - `test_list_users_admin_only`: un operador recibe 403; el admin ve su cuenta y no la de "solo ver".
  - `test_promote_and_demote`.
  - `test_cannot_remove_last_admin`: bajarse el rol siendo el único admin → 409; quitarle el acceso al último admin activo → 409.
  - `test_demote_self_when_other_admin_exists`: se permite.
  - `test_cannot_deactivate_self`: 409.
  - `test_inactive_cannot_login` y `test_inactive_token_rejected`: el token de antes da 401 en `/api/auth/me`.
  - `test_reactivate`: vuelve a entrar.
  - `test_history_kept`: un movimiento hecho por la persona sigue saliendo con su nombre en `/api/movements` después de quitarle el acceso.
  - `test_registration_code_override`: el código guardado sirve y el de antes no; el operador no ve `codigo_registro` en `GET /api/settings`.
  - Dejar el código como estaba al final.
- [ ] **Step 2:** `pytest -q tests/test_equipo.py` → FAIL.
- [ ] **Step 3:** Implementar la columna, las revisiones de `active`, las rutas, `codigo_registro` y la pantalla Personas:
  - lista de activas y, aparte, las que no tienen acceso;
  - en cada persona: "Hacer administrador" / "Quitar administrador" y "Quitar acceso" / "Devolver acceso", con confirmación;
  - el admin se ve marcado como "Tú".
  - La hoja del código lleva un campo, "Copiar" y una nota de que el código de antes deja de servir.
- [ ] **Step 4:** `pytest -q` y `npx vitest run` → PASS.
- [ ] **Step 5:** Revisar en el navegador con dos cuentas locales (admin y un operador creado para la prueba):
  - quitar el acceso al operador y comprobar que su sesión vuelve al login con el mensaje;
  - devolverlo;
  - cambiar el código y crear una cuenta con el nuevo.
  - Al final borrar de la base local la cuenta de prueba y dejar el código como estaba.
- [ ] **Step 6:** Commit: `Configuracion: equipo (roles, quitar y devolver el acceso, codigo para unirse)`.

### Task 5: Cierre

- [ ] **Step 1:** README:
  - en "Variables del servidor", aclarar que `REGISTRATION_CODE` y `CATALOG_URL` son el valor por defecto y que Configuración manda sobre ellas;
  - agregar `configuracion` a la tabla de módulos (`backend/app/modules/README.md`) junto con `ajustes`.
- [ ] **Step 2:** Pasar todas las pruebas (`pytest -q`, `npx vitest run`) y el build con las dos marcas (`npx vite build`, `VITE_MARCA=pigmalion npx vite build`).
- [ ] **Step 3:** Hacer un recorrido final en el navegador, en claro y en oscuro, como admin y como operador. Consola sin errores.
- [ ] **Step 4:** `graphify update .` y commit: `Configuracion: README y modulos`.
- [ ] **Step 5:** Pasarle a David la lista de qué revisar en http://localhost:5190 y preguntarle si se sube.
