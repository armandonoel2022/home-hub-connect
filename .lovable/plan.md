# Módulo Auditoría Superintendencia — Personal Armado

Extender el módulo de Personal Armado con capacidades de auditoría completas (fotos con trazabilidad, inventario de uniformes/linternas y reporte consolidado por agente).

## A) Carga de fotos con metadatos y trazabilidad

Hoy ya guardamos `photo` (agente) y `weaponPhoto` (arma) como strings base64 sueltos. Los migramos a estructuras con auditoría sin romper compatibilidad.

**`src/lib/types.ts`** — agregar:
```ts
export interface PhotoRecord {
  id: string;
  url: string;            // base64 o ruta
  uploadedAt: string;     // ISO
  uploadedBy: string;     // nombre usuario
  uploadedById?: string;
  kind: "agent" | "weapon";
  metadata?: {
    weaponType?: string;
    weaponSerial?: string;
    notes?: string;
  };
}
```
Añadir a `ArmedPersonnel`: `agentPhotos?: PhotoRecord[]`, `weaponPhotos?: PhotoRecord[]`. Los campos `photo`/`weaponPhoto` quedan como "principal" (primera de cada lista) por retro-compatibilidad.

**`src/pages/Operations.tsx`** — en el modal de edición/detalle:
- Nueva pestaña "Galería de evidencias" con dos secciones (Agente / Arma)
- Cada foto se muestra con: miniatura, fecha (`toLocaleString('es-DO')`), usuario que la subió, metadatos
- Botón "Marcar como principal", "Eliminar" (con confirmación que pida razón → guardar en audit log)
- Al subir nueva foto se inyecta `PhotoRecord` con `uploadedBy = currentUser.fullName`, fecha actual, metadata heredada del registro (serial/tipo)

## B) Inventario de Uniformes y Linternas

Dos módulos nuevos siguiendo el patrón de `armed-personnel.json` (file storage local).

**Tipos nuevos en `src/lib/types.ts`:**
```ts
export type UniformSize = "XS"|"S"|"M"|"L"|"XL"|"XXL"|"XXXL";
export type UniformType = "Camisa"|"Pantalón"|"Gorra"|"Chaleco"|"Bota"|"Cinturón"|"Otro";
export interface UniformItem {
  id: string;
  type: UniformType;
  size: UniformSize;
  quantityInStock: number;
  unitCost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
export interface UniformAssignment {
  id: string;
  uniformItemId: string;
  uniformType: UniformType;
  uniformSize: UniformSize;
  employeeCode: string;
  employeeName: string;
  quantity: number;
  deliveredAt: string;
  deliveredBy: string;
  condition: "Nuevo"|"Bueno"|"Regular"|"Reemplazar";
  signatureUrl?: string;
  notes?: string;
}
export interface FlashlightItem {
  id: string;
  code: string;            // SSC-LIN-XXXX
  brand: string;
  model: string;
  serial?: string;
  status: "Disponible"|"Asignada"|"En reparación"|"Dada de baja";
  assignedToCode?: string;
  assignedToName?: string;
  assignedAt?: string;
  assignedBy?: string;
  condition: "Nueva"|"Buena"|"Regular"|"Reemplazar";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Backend (`backend/routes/`):** tres archivos nuevos siguiendo `createCrudRoutes`:
- `uniform-items.js` → `uniform-items.json` prefix `UNI`
- `uniform-assignments.js` → `uniform-assignments.json` prefix `UA`
- `flashlights.js` → `flashlights.json` prefix `LIN`

Registrar las rutas en `backend/server.js`.

**Frontend:**
- `src/lib/api.ts`: añadir `uniformItemsApi`, `uniformAssignmentsApi`, `flashlightsApi` con el helper estándar y fallback a `localStorage` cuando `!isApiConfigured()`.
- `src/pages/OperationsInventory.tsx` (nueva página) con tabs:
  1. **Uniformes — Stock**: tabla por tipo+talla con cantidad disponible, alta/edición
  2. **Uniformes — Entregas**: registro de entrega a agente (autocomplete desde directorio activo), descuenta stock automáticamente
  3. **Linternas**: tabla con estado, modal para asignar/devolver/cambiar estado
- Ruta `/operations-inventory` con guard: Operaciones, Admin, Gerencia General. Añadir entrada en `AppSidebar` bajo Operaciones.

## C) Vista consolidada por agente (Auditoría)

Nueva página `src/pages/AuditConsolidated.tsx` (`/audit-superintendencia`):
- Lista de todos los agentes activos (cruza `IntranetUser` + `ArmedPersonnel`)
- Filtros: por cliente, ubicación, provincia, supervisor, con/sin arma, con uniformes incompletos
- Al hacer click en un agente abre dialog con vista 360°:
  - **Datos del agente**: código, nombre, cédula, posición, ubicación, supervisor, teléfonos
  - **Foto principal del agente** + galería completa
  - **Armas asignadas**: serial, tipo, calibre, condición, licencia, vencimiento + galería de fotos del arma
  - **Activo fijo vinculado** (reusa `findLinkedAsset`)
  - **Uniformes entregados**: tabla de `UniformAssignment` filtrada por `employeeCode`, totales por tipo/talla
  - **Linternas asignadas**: filtrar `flashlights` por `assignedToCode`
- Botón "Exportar reporte" (D).

Acceso: Operaciones, Admin, Gerencia General, Calidad (auditoría).

## D) Reporte de auditoría exportable

`src/lib/auditReport.ts`:
- `exportAuditReportPDF(agentes[], opciones)` usando `jsPDF` + `jspdf-autotable` (ya en el stack)
  - Portada con logo SafeOne, fecha, rango, usuario que genera
  - Por cada agente: bloque con datos, miniaturas de fotos (max 2 agente + 2 arma), tabla de uniformes, tabla de linternas
  - Sección final "Evidencias fotográficas" con grid completo (fecha, responsable, tipo, serial)
- `exportAuditReportExcel(agentes[])` usando `xlsx`:
  - Hoja "Agentes" (resumen)
  - Hoja "Armas"
  - Hoja "Uniformes"
  - Hoja "Linternas"
  - Hoja "Evidencias Fotos" (sin imágenes, solo metadatos: agente, tipo foto, fecha, responsable, serial)

Dos botones en `AuditConsolidated`: "Exportar PDF" / "Exportar Excel". Soportan exportar 1 agente (desde el dialog) o todos los filtrados.

## Memoria del proyecto

Crear `mem://funcionalidades/auditoria-superintendencia.md` documentando el flujo, ubicación de archivos JSON locales (C: drive), accesos por rol, y referencia cruzada con Personal Armado / Activo Fijo.

## Archivos nuevos
- `backend/routes/uniform-items.js`, `uniform-assignments.js`, `flashlights.js`
- `src/pages/OperationsInventory.tsx`
- `src/pages/AuditConsolidated.tsx`
- `src/lib/auditReport.ts`
- `mem://funcionalidades/auditoria-superintendencia.md`

## Archivos modificados
- `src/lib/types.ts` (PhotoRecord + tipos inventario)
- `src/lib/api.ts` (3 nuevos APIs)
- `src/pages/Operations.tsx` (galería de evidencias con metadatos)
- `src/components/AppSidebar.tsx` (2 entradas nuevas)
- `src/App.tsx` (2 rutas nuevas)
- `backend/server.js` (registrar rutas)

## Notas
- Compatibilidad: los campos `photo`/`weaponPhoto` actuales siguen funcionando; al subir una nueva foto se duplica como primer `PhotoRecord` y se mantiene `photo` apuntando al mismo string.
- Las imágenes se siguen almacenando como base64 dentro del JSON (consistente con la implementación actual). Si el peso crece, en una iteración futura migramos a `/uploads/armed-personnel/`.
- Stock de uniformes: descuento atómico — al crear `UniformAssignment` se decrementa `quantityInStock` en el `UniformItem` correspondiente. Si stock=0 se bloquea con toast.
