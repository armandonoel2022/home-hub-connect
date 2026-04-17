---
name: Flotilla SafeOne — Reparación y Mantenimiento
description: Módulo en /admin/flotilla-mantenimiento que controla gastos de mantenimiento de la flotilla. Acceso restringido (Chrisnel/Gerencia/Admin IT).
type: feature
---
Módulo creado a partir del archivo "Control_gastos_reparacion_y_mant._Flotilla_de_Vehiculos.xlsx" (4 hojas).

**Ruta:** `/admin/flotilla-mantenimiento` (también accesible como botón "Flotilla — Mantenimiento" desde el Hub de Administración).

**Acceso restringido a:** Chrisnel Fabián (USR-101), Aurelio Pérez (USR-100), Admin IT (USR-001) y miembros de los departamentos `Administración`, `Gerencia General` o `Tecnología y Monitoreo`.

**Datos iniciales:** bundleados directamente en `src/data/fleetMaintenanceSeed.ts` (importado por `src/lib/fleetMaintenanceData.ts`). Esto garantiza que el deploy desde GitHub muestre la data inmediatamente sin tener que copiar JSON manualmente al servidor de producción. Adicionalmente se publica en `public/data/fleet_maintenance_seed.json` como respaldo.

**Estructura del seed (FleetSeed):**
- `fleet`: 25 unidades (motocicletas + vehículos) con tipo, marca, modelo, año, color, chasis, placa, aseguradora.
- `maintenance`: 75 entradas individuales (placa, fecha, mes, tipo de mantenimiento, taller, costo, detalle).
- `annualCost`: matriz mensual 2026 por unidad con total anual.

**Tabs del módulo:**
1. **Dashboard** — KPIs clickables (gasto total, motos, vehículos, promedio), top unidades por gasto, gasto por mes, talleres más utilizados. Todos los KPIs y barras filtran la pestaña Registro al hacer click.
2. **Registro de Gastos** — Tabla con filtros por categoría/placa/mes y búsqueda libre.
3. **Costo Anual** — Matriz mensual 2026 (12 meses + total).
4. **Flotilla** — Listado de las 25 unidades; al click navega al registro filtrado por esa placa.

**Modificaciones del usuario:** las nuevas entradas y eliminaciones se guardan en `localStorage` bajo `safeone_fleet_maintenance_v1` (sin tocar el seed bundleado).

**Responsable funcional:** Chrisnel Fabián (Administración).
