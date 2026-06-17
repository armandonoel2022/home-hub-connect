# Unificar Expediente Clientes con Operaciones + Log de escrituras a GENERAL

## Objetivo
1. Que la matriz importada y los cambios de **Operaciones (Personal Armado y Puestos)** se reflejen en **Expediente Clientes**, en sus dos vistas: **Manual** y **Vivo (GENERAL)**.
2. Conservar las ediciones hechas directamente dentro del Expediente (merge, no sobrescritura).
3. Que **toda escritura a la base SQL GENERAL** quede registrada en el Audit Log y se notifique.

## Estado actual (por qué no se refleja hoy)
- El modo **Manual** se siembra **una sola vez** (`seedFromPersonnel`, bandera `K_SEED`) y luego queda desconectado de Operaciones.
- El modo **Vivo** lee solo de SQL GENERAL (último reporte diario); ignora la matriz manual.
- `general-sql.js` es **solo lectura** (existe `writeEnabled()` pero no hay escrituras ni log de ellas).

## Cambios

### A. Manual = espejo vivo de Operaciones (conservar y mezclar)
En `src/lib/opsExpediente.ts`:
- Reemplazar la lógica "sembrar una vez" por `syncFromOperaciones(personnel, workPosts)` que **re-deriva** la estructura (Cliente → Localidad → Puesto → Turno + reporte/armas) desde Personal Armado y desde los Puestos de `postsData`, y la **mezcla** con lo existente:
  - Match por claves normalizadas (cliente por nombre, localidad por provincia/nombre, puesto por localidad+nombre).
  - Registros con `origin: "ops"`: se actualizan campos derivados (existencia, `requiereArma`, armas/agentes del reporte).
  - Se **preservan** campos manuales: `contrato`, `notas`, `direccion`, `mapsUrl`, coordenadas editadas a mano.
  - Registros con `origin: "manual"` (creados dentro del Expediente) se conservan intactos aunque no tengan origen en Operaciones.
  - Cada entidad se etiqueta con `origin` y `sourceKey`.
- Disparar el sync al cargar y al cambiar Personal Armado / Puestos (escuchar eventos existentes), usando un hash de contenido para evitar escrituras redundantes.
- En `ClientExpediente.tsx`: cambiar el `useEffect` de seed por el nuevo sync; mostrar una etiqueta de origen ("Operaciones" / "Manual") en clientes/puestos.

### B. Vivo (GENERAL) refleja Operaciones
En `src/components/operations/ExpedienteLive.tsx`:
- Mezclar el snapshot de GENERAL con los datos de Operaciones (Personal Armado + `postsData`): cuando un cliente/puesto/arma exista en Operaciones pero falte en el último reporte de GENERAL, **agregarlo** marcado con un badge **"Manual/Operaciones"**.
- Así ambas vistas muestran las armas de la matriz importada; los KPIs cuentan ambas fuentes con distinción visual.

### C. Escrituras a SQL GENERAL: bloqueadas por defecto, logueadas y notificadas
En `backend/config/sqlServer.js`:
- Añadir `execWrite(query, params, meta)` que:
  - Solo procede si `writeEnabled()` (env `GENERAL_SQL_WRITE=true`) **y** `meta.confirm === true`; si no, lanza error claro.
  - Antes de ejecutar, registra en **Audit Log** (`module: "general-sql"`, `action: "db-write"`, `details`: SQL + parámetros + usuario) y crea una **notificación** a administradores.
  - Devuelve filas afectadas y vuelve a loguear el resultado.

En `backend/routes/general-sql.js`:
- Centralizar cualquier futura escritura a través de `execWrite` (hoy no hay endpoints destructivos; se deja el guardrail listo). Las lecturas siguen igual.

## Detalles técnicos
- Persistencia Manual: `localStorage` + sync best-effort a backend (sin cambios de transporte).
- No se habilita ninguna escritura destructiva a GENERAL en este cambio; solo se construye el carril seguro (log + notificación + doble bandera) para que **ninguna** escritura futura ocurra sin registro.
- Audit Log y Notifications usan las rutas existentes (`audit-log.js`, `notifications.js`).

## Fuera de alcance
- Habilitar escrituras destructivas concretas a GENERAL (se haría en una iteración posterior, ya con el log/blindaje en su sitio).
- Cambios de esquema en GENERAL.

## Verificación
- Importar la matriz en Operaciones → aparece en Manual y en Vivo (con badge de origen).
- Editar un puesto en Operaciones → se refleja en Expediente; editar `notas/contrato` en Expediente → se conserva tras el sync.
- Intentar una escritura a GENERAL sin `confirm`/env → se rechaza; con permiso → queda en Audit Log + notificación.
