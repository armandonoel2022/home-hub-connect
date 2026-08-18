---
name: Flotilla Vehicular (registro de vehículos)
description: Módulo /flotilla reconstruido — sin data mock, CRUD server-first en backend/routes/fleet-vehicles.js, documentos en base64, asignaciones e historial.
type: feature
---
**Ruta:** `/flotilla` (`src/pages/Fleet.tsx`). Ya NO usa `mockVehicles` ni `useVehicles`; la data de ejemplo hardcoded fue eliminada.

**Modelo:** `src/lib/vehicleTypes.ts` — tipo (SUV/Automovil/Motocicleta/Camioneta/Furgon/Otro), VIN, matrícula, placa, color, kilometraje, capacidad, combustible, estado (Activo/En Mantenimiento/Inactivo/Descargado), marbete con vencimiento y estado calculado, seguro, mantenimientos, asignación (Empleado o Departamento), activo fijo vinculado, 7 documentos fotográficos e historial de movimientos.

**Persistencia:** `src/lib/vehicleFleetData.ts` server-first → `backend/routes/fleet-vehicles.js` (`data/fleet-vehicles.json`, soft delete con campo `activo`, validación de VIN/placa/matrícula únicos, endpoint `/asignaciones`). Sin servidor cae a localStorage `safeone_fleet_vehicles_v1`.

**UI:** dashboard con KPIs clickables + pie chart por tipo (recharts), filtros (tipo/estado/asignación/marbete), tabla clickable, `VehicleFormDialog`, `VehicleDetailDialog` (galería de documentos + línea de tiempo), `VehicleAvatar` con ícono según tipo. Imágenes comprimidas a JPEG dataURL (máx 1200px).

**Eliminar = descargar** (soft delete, se conserva historial).
