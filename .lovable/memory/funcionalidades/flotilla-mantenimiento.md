---
name: Flotilla SafeOne — Reparación y Mantenimiento
description: Módulo CRUD en /admin/flotilla-mantenimiento, persistencia server-first, talleres normalizados y vinculación con Activo Fijo. Acceso restringido (Chrisnel/Gerencia/Admin IT).
type: feature
---
Módulo creado a partir del archivo "Control_gastos_reparacion_y_mant._Flotilla_de_Vehiculos.xlsx" (4 hojas).

**Ruta:** `/admin/flotilla-mantenimiento` (también accesible desde el Hub de Administración).

**Acceso restringido a:** Chrisnel Fabián (USR-101), Aurelio Pérez (USR-100), Admin IT (USR-001) y miembros de los departamentos `Administración`, `Gerencia General` o `Tecnología y Monitoreo`.

**Persistencia híbrida (server-first):**
- Backend Express en `backend/routes/fleet-maintenance.js` — guarda en `data/fleet-maintenance.json`. Auto-siembra desde `public/data/fleet_maintenance_seed.json` la primera vez.
- Si el servidor está disponible, todo CRUD pasa por API (`fleetMaintenanceApi` en `src/lib/api.ts`) y la data del servidor es la fuente de verdad (cacheada en `safeone_fleet_maintenance_cache_v1`).
- Si no hay servidor (preview Lovable), los cambios persisten en `safeone_fleet_maintenance_v2` (entradas/unidades custom + IDs de borrado).
- Indicador visual de estado: "Sincronizado con servidor" (Cloud) vs "Modo local" (CloudOff).

**CRUD completo:**
- Registro de gastos: crear / editar / eliminar (botones por fila + botón "Nuevo gasto"). Mes derivado automáticamente de la fecha.
- Flotilla: crear / editar / eliminar unidades. La placa es inmutable en edición (es la PK).
- Confirmación obligatoria con AlertDialog antes de eliminar.

**Normalización de talleres:** "Motoservic Campe" → "Moto Servic Campe" (alias unificados en `normalizeTaller()` tanto en backend como frontend). Endpoint `POST /api/fleet-maintenance/normalize-talleres` para re-normalizar el JSON existente.

**Vinculación Placa ↔ Activo Fijo:** todas las celdas de placa muestran un popover (icono Link2) que busca en `loadFixedAssets()` activos con `tipo: VEH | MOT` cuyo serial, descripción o notas contengan la placa. Helper en `src/lib/fleetAssetLink.ts` (`getAssetsByPlaca`). El popover muestra código SSC, descripción, marca/modelo, serial, estado y ubicación — Chrisnel ya no necesita abrir Activo Fijo para ver esa info.

**Tabs del módulo:**
1. Dashboard — KPIs clickables, top unidades, gasto por mes, talleres más utilizados.
2. Registro de Gastos — Tabla CRUD con filtros y placa clickable a Activo Fijo.
3. Costo Anual — Matriz mensual con totales generales (fila TOTAL GENERAL).
4. Flotilla — CRUD de unidades con vinculación a Activo Fijo y gasto acumulado.

**Responsable funcional:** Chrisnel Fabián (Administración).
