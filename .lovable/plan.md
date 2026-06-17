# Operaciones — Expediente Digital del Cliente

Reestructuración de "Personal y Puestos" para modelar el expediente completo de cada cliente: localidades, puestos, turnos, armas, personal (alimentado por el reporte diario de ayer), bóveda de armas y ficha imprimible.

## Modelo de datos (nuevo)

Hoy un "puesto" es solo el texto `location` en cada registro de Personal Armado. Se introduce una jerarquía persistida en backend (archivos JSON locales, patrón `createCrudRoutes`, con respaldo en `localStorage`):

```text
Cliente (OpsClient)
  └─ Localidad (OpsLocation)        [geolocalización propia + dirección + contrato]
       └─ Puesto (OpsPost)          [requiereArma sí/no, geolocalización, turnos]
            └─ Turno (embebido)     [nombre + horario]
                 └─ Personal + Arma → viene del REPORTE DIARIO (el de ayer)
```

Entidades:
- **OpsClient**: `{ id, nombre, contrato: { numero, inicio, fin }, coordinates, notas }`
- **OpsLocation**: `{ id, clientId, nombre, direccion, coordinates, mapsUrl, notas }`
- **OpsPost**: `{ id, locationId, nombre, requiereArma: boolean, turnos: [{ id, nombre, horario }], coordinates, notas }`
- **DailyReport (reporte diario)**: `{ id, fecha (YYYY-MM-DD), postId, turnoId, personnelId, personnelName, presente, armaSerial, armaTipo, novedades, createdBy, createdAt }` — una fila por puesto/turno/agente. El expediente lee **el reporte de ayer** (fecha = ayer, o el último digitado por puesto).
- **VaultMovement (bóveda)**: `{ id, fecha, armaSerial, armaTipo, tipo: "salida"|"entrada", from, to, personnel (quién recibe/entrega), authorizedBy (quién autoriza), notas, createdBy, createdAt }` — registro FROM→TO de cada arma.

## Backend

Nuevas rutas JSON locales (igual patrón que `armed-personnel.js`):
- `backend/routes/ops-clients.js` → `ops_clients.json`
- `backend/routes/ops-locations.js` → `ops_locations.json`
- `backend/routes/ops-posts.js` → `ops_posts.json`
- `backend/routes/ops-daily-reports.js` → `ops_daily_reports.json` (filtro por `?fecha=` y `?postId=`)
- `backend/routes/vault-movements.js` → `vault_movements.json` (filtro por `?armaSerial=`)
- Registrar todas en `backend/server.js`.

## Frontend

### Capa de datos
- `src/lib/opsExpediente.ts`: tipos + CRUD (clientes, localidades, puestos, reportes, bóveda) con sync al backend y respaldo `localStorage`. Helper `getYesterdayReport(postId)` que resuelve el último reporte digitado (preferentemente el de ayer) y arma la "foto viva" de personal + arma por puesto/turno.
- Seed inicial: derivar clientes/localidades/puestos desde `ArmedPersonnel` (agrupando `client` → `location`) para no empezar vacío.

### Pantallas
1. **Expediente del Cliente** (`src/pages/ClientExpediente.tsx`, ruta `/operaciones/expediente`):
   - Árbol Cliente → Localidad → Puesto → Turno.
   - Cada puesto muestra: badge "requiere arma", personal y arma del **reporte de ayer** (en tiempo real), licencia/serial, y enlaces de geolocalización (cliente y puesto).
   - Botón **Imprimir expediente** (PDF tipo ficha con membrete SafeOne) por cliente.
   - Editores para crear/editar localidades, puestos y turnos.
2. **Reporte Diario** (`src/components/operations/DailyReportForm.tsx`, integrado en el expediente o `/operaciones/reporte-diario`):
   - Selección de fecha + localidad/puesto/turno; por cada puesto se digita personal presente, arma usada (serial) y novedades. Es la fuente que alimenta el expediente.
3. **Bóveda de Armas** (`src/pages/WeaponVault.tsx`, ruta `/operaciones/boveda`):
   - Registro de salida/entrada con FROM→TO, quién, cuándo, cuál (serial), autorizado por.
   - Estado actual de cada arma (en bóveda vs. en puesto X) e historial por arma.

### Navegación / accesos
- Agregar entradas en `src/components/AppSidebar.tsx` (Operaciones) y rutas en `src/App.tsx`.
- Permisos vía `src/lib/permissions.ts` (Operaciones / Admin / Gerencia).

## Impresión
- `src/lib/expedientePdf.ts`: genera el expediente del cliente con `jspdf`/`jspdf-autotable` y membrete `safeone-letterhead.png` (A4), incluyendo localidades, puestos, turnos, armas, personal y coordenadas.

## Notas
- Reutiliza `geoResolver.ts` para coordenadas/Google Maps y `weaponAssetLinking.ts` para validar seriales contra activos fijos (tipo ARM).
- No todos los puestos requieren arma (`requiereArma`); la UI oculta secciones de arma cuando es `false`.
- Se conserva el módulo actual de Puestos; el expediente es la nueva vista jerárquica que lo amplía.

## Orden de implementación
1. Backend (5 rutas + registro en server.js).
2. `opsExpediente.ts` + seed desde Personal Armado.
3. Pantalla Expediente + editores de localidad/puesto/turno.
4. Formulario de Reporte Diario.
5. Bóveda de Armas (FROM→TO + historial).
6. PDF del expediente.
7. Sidebar, rutas y permisos.