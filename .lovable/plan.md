# Expediente 360° Vivo — datos detallados, CRUD y bóveda unificada

## Problema
El modo **Vivo (GENERAL)** de *Expediente de Clientes* lee el último reporte diario, pero:
- Los puestos y vigilantes **no son clicables** (no abren ficha).
- No muestra el detalle de arma (serial, marca, calibre, licencia, estado, fotos) que sí tiene *Personal Armado y Puestos*.
- No hay forma de **editar** ni de subir **licencia/fotos** de cada arma.
- La **bóveda** está en otra pantalla separada.

## Restricción técnica clave
La conexión a GENERAL (gSafeOne / SQL Server) es **solo lectura** (`writeEnabled()=false`). Por eso:
- Los datos base (cliente, puesto, vigilante, arma asignada del reporte) se **leen** de GENERAL.
- Toda edición/CRUD y las **fotos/licencias** se guardan en un **overlay local JSON** (mismo motor de archivos en C: que el resto de la intranet), enlazado por **Serie del arma** (estable) y por OID de línea.

## Tabla Armamento (confirmado del Excel)
`OID, Codigo, Marca(FK#), Serie, Categoria, Estatus, Tipo(FK#), Calibre(FK#), NoLicencia, FotoLicenciaFrente/Dorso, FotoArma1..4, Permanente, Vence, Nota, Propietario`
→ Marca/Tipo/Calibre son códigos numéricos; se resolverán contra sus tablas de catálogo en GENERAL (con respaldo al número si no hay catálogo). Las columnas de foto vienen vacías en la BD, por eso las fotos van al overlay local.

## Alcance

### 1. Backend — enriquecer lectura de armas (`backend/routes/general-sql.js`)
- Ampliar `weaponsMap()` para incluir `noLicencia, calibre, marca, tipo, estatus, permanente, vence, propietario`, resolviendo Marca/Tipo/Calibre contra catálogos (descubrimiento dinámico, con caché y respaldo al valor crudo).
- En `/expediente`, cada puesto devolverá el objeto `arma` completo (oid, serie, marca, modelo, calibre, tipo, noLicencia, estatus) y datos del vigilante (código, nombre, OID) para poder abrir fichas.

### 2. Backend — overlay editable + bóveda (`backend/routes/expediente-overlay.js`, nuevo)
- `GET /expediente-overlay` → devuelve overlays por serie: `{ estatus, nota, fotosArma[], fotoLicenciaFrente, fotoLicenciaDorso, noLicencia, custodioOverride, ... }`.
- `PUT /expediente-overlay/:serie` → guarda/edita campos del arma (persistente en JSON local). **Gateado** a editores autorizados.
- `POST /expediente-overlay/:serie/photo` (multipart) → sube foto de arma o de licencia al storage local (uploads/operaciones/armas/…), devuelve URL.
- Movimientos FROM→TO de armas y traslados de personal: reutilizar/extender `vault-movements.js` y registrar `{ arma/serie, desde, hacia, quién, cuándo, motivo }`; endpoint de historial por serie.
- Guard de escritura: lista de correos autorizados (Samuel, Aurelio Pérez, Armando Noel) + super admin.

### 3. Permisos (`src/lib/permissions.ts`)
- Añadir `OPS_EXPEDIENTE_EDITORS` (correos de Samuel, Aurelio Pérez, `anoel`, super) y helper `canEditExpediente(user)`. El backend valida lo mismo del lado servidor.

### 4. API cliente (`src/lib/api.ts`)
- Tipos ampliados `GeneralExpedientePuesto.arma` (serie, marca, modelo, calibre, tipo, noLicencia, estatus) y `vigilanteOID`.
- `expedienteOverlayApi`: `list()`, `save(serie, data)`, `uploadPhoto(serie, file, kind)`, `movements(serie)`, `addMovement(...)`.

### 5. Frontend — Expediente Vivo unificado (`src/components/operations/ExpedienteLive.tsx`)
- **Cliente → (agrupación por dirección/localidad) → Puesto → Vigilante/Arma**, tarjetas colapsables como hoy pero con detalle enriquecido.
- **Puesto clicable** → abre *Ficha del Puesto* (reusar estilo de `lib/ficha.ts`).
- **Vigilante clicable** → abre ficha del agente (nombre, código, puesto, turno; cruza con Personal Armado si existe).
- **Arma**: muestra `Tipo · Marca · Serial · Calibre · No. Licencia · Estatus` con color de estado (igual que `PostsView`), miniaturas de fotos y de licencia.
- **Panel/Dialog de arma** (solo editores): editar estatus/nota/No. licencia, subir múltiples fotos del arma y foto de licencia (frente/dorso), ver historial de movimientos FROM→TO, registrar traslado de arma y de personal.
- Mezcla overlay local sobre los datos de GENERAL (las ediciones prevalecen visualmente).
- Mantener KPIs, filtros, búsqueda, export PDF/Excel y “Exportar esquema”.

### 6. Unificar Bóveda + Clientes (`src/pages/ClientExpediente.tsx`)
- Añadir un tercer sub-modo/sección **Bóveda** dentro de la misma pantalla (tabs: *Vivo*, *Bóveda*, *Manual*), o integrar la bóveda como panel lateral del modo Vivo. La bóveda lista armas (de Armamento) con su ubicación actual (puesto/custodio del último reporte) y su registro de entradas/salidas FROM→TO.
- Mantener el modo Manual existente como respaldo.

## Detalles técnicos
- Storage de fotos: `uploads/operaciones/armas/<serie>/...` vía `fileStorage`/multer (mismo patrón que otros adjuntos).
- Overlay keyed por **Serie** (estable entre reportes) con índice secundario por OID.
- Resolución de catálogos Marca/Tipo/Calibre: intentar tablas tipo `Marca`, `TipoArma`, `Calibre` (o equivalentes) por descubrimiento; si no existen, mostrar el código. 
- Todo el guardado server-side revalida el correo del usuario autenticado (no confiar solo en el front).
- Auditoría: cada edición/movimiento se registra en el audit log (acción crítica) según memoria del proyecto.

## Fuera de alcance
- Escritura directa a SQL Server (permanece de solo lectura).
- Cambios en el módulo *Personal Armado y Puestos* (se reutiliza como referencia/seed).
