---
name: Expediente Digital de Clientes (Operaciones)
description: Jerarquía Cliente→Localidad→Puesto→Turno, reporte diario como fuente viva, bóveda de armas FROM→TO, expediente imprimible
type: feature
---
# Expediente Digital del Cliente

Módulo de Operaciones que modela el expediente completo de cada cliente.

## Jerarquía
Cliente (OpsClient) → Localidad (OpsLocation) → Puesto (OpsPost) → Turno (embebido en puesto).
- Cliente y puesto/localidad tienen geolocalización (lat,lng o link Google Maps).
- `requiereArma` por puesto: no todos los puestos requieren arma; la UI oculta secciones de arma cuando es false.

## Fuente de datos viva
El personal y el arma de cada puesto vienen del **reporte diario** (`DailyReport`). El expediente muestra por defecto el reporte de **ayer** (`yesterdayISO`), o el último digitado por puesto (`getLatestReportDate`/`getLiveSnapshot`). `replaceDailyReport(postId, fecha, rows, by)` reemplaza el reporte de un puesto en una fecha.

## Bóveda de armas
`VaultMovement` registra entrada/salida del almacén con FROM→TO: `tipo (salida|entrada)`, `armaSerial`, `from`, `to`, `personnel` (quién), `authorizedBy` (autoriza), `fecha`. Salida = Bóveda→puesto; entrada = puesto→Bóveda. `getWeaponLocations()` deriva ubicación actual de cada arma según el último movimiento. Etiqueta de bóveda: `VAULT_LABEL`.

## Persistencia
`src/lib/opsExpediente.ts`: localStorage primario (claves `safeone_ops_*_v1`, `safeone_vault_movements_v1`) + sync best-effort al backend cuando la API está configurada. Seed inicial automático desde Personal Armado (`seedFromPersonnel`): agrupa client→province(localidad)→location(puesto), genera turnos por shiftType y un reporte semilla de ayer.

## Backend
Rutas JSON: `ops-clients`, `ops-locations`, `ops-posts`, `ops-daily-reports`, `vault-movements` (patrón createCrudRoutes; daily-reports y vault tienen `/q/filter`).

## UI / rutas / permisos
- `/operaciones/expediente` (`ClientExpediente.tsx`) — tres modos: **Vivo (GENERAL)**, **Bóveda**, **Manual**.
- Modo **Vivo** (`src/components/operations/ExpedienteLive.tsx`): lee el último Reporte Diario de gSafeOne vía `generalSqlApi.expediente()`. Vista 360° con KPIs, filtros + buscador (cliente/vigilante/serial), tarjetas colapsadas. **Puesto, vigilante y arma son CLICABLES** → abren diálogos de ficha. La **ficha de arma** muestra Tipo·Marca·Serial·Calibre·Licencia·Estatus con color de estado, fotos del arma (múltiples) y de la licencia (frente/dorso); editores pueden editar estatus/nota/No. licencia, subir/eliminar fotos y registrar traslados FROM→TO. Ficha de vigilante y de puesto imprimibles (ventana nueva). PDF por cliente incluye estatus y licencia.
- Modo **Bóveda** (`src/components/operations/VaultView.tsx`): tabla de TODAS las armas de Armamento con overlay aplicado (estatus/licencia/fotos), ubicación actual y custodio derivados del último reporte (en uso vs en bóveda), KPIs y exportación Excel + movimientos recientes de armas.
- Modo **Manual** (legado): árbol Cliente→Localidad→Puesto→Turno + editores + reporte diario + PDF.
- Permisos de **edición** del expediente vivo: `canEditExpediente(user)` en `src/lib/permissions.ts` (lista `OPS_EXPEDIENTE_EDITORS` = super admin, Armando Noel `anoel`, Samuel y Aurelio Pérez — confirmar correos exactos) + admins. El backend revalida el correo en `EDITOR_EMAILS` (no confiar solo en el front).

## Backend GENERAL (gSafeOne) — solo lectura + overlay editable local
GENERAL/SQL Server es **SOLO LECTURA** (`sqlServer.writeEnabled()=false`). Por eso toda edición y las fotos/licencias se guardan en un **overlay JSON local** (C:), enlazado por **Serie del arma**.
- `backend/routes/general-sql.js`: `GET /expediente` arma el 360° del último `ReporteDiario`. Cada puesto incluye objeto `arma` completo (serie, marca, tipo, calibre, categoría, noLicencia, estatus, propietario) y datos del vigilante (OID, código, cédula). **Marca/Tipo/Calibre/Categoria son códigos numéricos (FK)** resueltos contra catálogos por descubrimiento dinámico (`catalogMap`), con caché y respaldo al código. `GET /weapons` usa `readWeapons()` con catálogos resueltos.
- Tabla **Armamento**: `OID, Codigo, Marca(FK), Serie, Categoria, Estatus, Tipo(FK), Calibre(FK), NoLicencia, FotoLicenciaFrente/Dorso, FotoArma1..4, Permanente, Vence, Nota, Propietario` (columnas de foto vienen NULL → fotos van al overlay local).
- `backend/routes/expediente-overlay.js`: overlay editable + bóveda. `GET /` (mapa por serie), `GET /can-edit`, `PUT /:serie` (estatus/nota/noLicencia/custodio), `POST|DELETE /:serie/photo` (arma|licenciaFrente|licenciaDorso, base64→`uploads/operaciones/armas/<serie>/`), `GET /movements/all` + `POST /movements` (FROM→TO de armas y personal en `expediente-movements.json`). Escritura gateada a `EDITOR_EMAILS`. Cliente: `expedienteOverlayApi` en `src/lib/api.ts`.

## Espejo vivo con Operaciones + log de escrituras a GENERAL (jun 2026)
- **Manual = espejo vivo de Operaciones**: `syncFromOperaciones(personnel, workPosts, force)` en `opsExpediente.ts` reemplaza al seed-una-vez. Re-deriva Cliente→Localidad→Puesto→Turno+reporte desde **Personal Armado** y desde **Puestos** (`postsData.loadPosts()`), y **mezcla** con lo existente: registros `origin:"ops"` se actualizan; campos manuales (`contrato`, `notas`, `direccion`, `mapsUrl`, coords editadas) y entidades `origin:"manual"` se preservan. Match por `sourceKey` normalizado (`c:|l:|p:`), con backfill para datos legados sin sourceKey. Hash anti-redundancia en `safeone_ops_expediente_sync_hash_v1`. `seedFromPersonnel` quedó como wrapper. `ClientExpediente.tsx` sincroniza al cambiar `personnel` y al evento `safeone:posts-updated`.
- **Vivo (GENERAL) refleja Operaciones**: `src/lib/opsExpedienteMerge.ts` → `mergeOperacionesIntoExpediente(data, personnel, workPosts)` enriquece puestos de GENERAL con armas de Operaciones (cuando falta serial) y agrega puestos/clientes que solo existen en Operaciones, marcados `origen:"operaciones"` / `armaOrigen:"operaciones"` (badge "Operaciones"). Recalcula totales. Si GENERAL cae pero hay datos de Operaciones, igual se muestran con banner de aviso. Tipos `GeneralExpedientePuesto/Cliente` ganaron `origen`/`armaOrigen`.
- **Escrituras a SQL GENERAL blindadas**: `backend/config/sqlServer.js` → `writeEnabled()` ahora lee env `GENERAL_SQL_WRITE=true` (sigue false por defecto). Nuevo `execWrite(text, params, meta)`: solo ejecuta con `GENERAL_SQL_WRITE=true` Y `meta.confirm===true`; SIEMPRE registra intento y resultado en `audit-log.json` (`action:"db-write"`) y notifica a admins (`notifications.json`, `forUserId:"ADMINS"`). No hay endpoints destructivos aún; es el carril seguro para futuras escrituras.
