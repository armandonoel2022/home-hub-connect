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
- `/operaciones/expediente` (`ClientExpediente.tsx`) — selector de fuente **Vivo (GENERAL)** vs **Manual**.
- Modo **Vivo** (`src/components/operations/ExpedienteLive.tsx`): lee el último Reporte Diario de gSafeOne vía `generalSqlApi.expediente()`. Vista 360° con KPIs (clientes, puestos cubiertos, vigilantes, armas, sin arma, con novedad), filtros por botones (Todos/Con armas/Sin arma/Con novedad) + buscador, tarjetas colapsadas por defecto, datos del cliente (dirección/tel/email/RNC/cédula/contacto) y puestos del reporte con vigilante+arma+horas+novedad. PDF por cliente con `exportToPDF`. Botón "Exportar esquema" (PK/FK) vía `generalSqlApi.schemaKeys()`.
- Modo **Manual** (legado): árbol Cliente→Localidad→Puesto→Turno + editores + reporte diario + PDF (`expedientePdf.ts`, membrete A4).
- `/operaciones/boveda` (`WeaponVault.tsx`) — movimientos, estado actual e historial por arma.
- Permisos: módulos `clientExpediente` y `weaponVault` (mismo grupo que Operaciones: Operaciones/Admin/Gerencia/Comercial).

## Backend GENERAL (gSafeOne) para Expediente Vivo
`backend/routes/general-sql.js`: `GET /expediente` arma el 360° del último `ReporteDiario` (ReporteDiario→ReporteDiarioD→ReportePuesto→Cliente/Puesto/Empleado + Armamento por OID). En gSafeOne **Puesto = rol/ocupación** (no localidad); no existe tabla Localidad. `GET /expediente/status` (fecha último reporte) y `GET /schema-keys` (PK/FK desde INFORMATION_SCHEMA).
