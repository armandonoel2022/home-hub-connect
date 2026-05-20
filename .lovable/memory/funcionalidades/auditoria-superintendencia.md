---
name: Auditoría Superintendencia
description: Módulo consolidado para auditoría externa de Personal Armado — fotos con trazabilidad, inventario de uniformes/linternas y reporte exportable
type: feature
---
Permite a Operaciones cumplir con auditorías de la Superintendencia consolidando agentes, armas, fotos, uniformes y linternas en una sola vista por agente.

## Componentes

- `src/pages/OperationsInventory.tsx` (ruta `/operaciones/inventario`): stock de uniformes (tipo+talla+cantidad), entregas a agentes (descuenta stock automáticamente al crear `UniformAssignment`), y CRUD de linternas con asignación por agente (`SSC-LIN-XXXX`). Acceso: Operaciones, Admin, Gerencia General.
- `src/pages/AuditConsolidated.tsx` (ruta `/operaciones/auditoria`): vista 360° por agente con filtros (cliente/buscar). Modal con datos, armas, galerías de fotos, uniformes y linternas. Exporta PDF/Excel para uno o todos los filtrados. Acceso: Operaciones, Admin, Gerencia General, Calidad.
- `src/pages/Operations.tsx` → componente `EvidenceGallery` en el modal de detalle: sube fotos adicionales con `PhotoRecord` (id, url, uploadedAt, uploadedBy, kind agent/weapon, metadata serial/tipo/notes). Se guardan en `agentPhotos[]` y `weaponPhotos[]`.
- `src/lib/auditReport.ts`: `exportAuditReportPDF` (jsPDF + autotable, incluye miniaturas + tablas + evidencias fotográficas con responsable) y `exportAuditReportExcel` (5 hojas: Agentes, Armas, Uniformes, Linternas, Evidencias Fotos).

## Backend

Tres endpoints CRUD nuevos siguiendo el patrón de `createCrudRoutes`:
- `/api/uniform-items` → `uniform-items.json` prefix `UNI`
- `/api/uniform-assignments` → `uniform-assignments.json` prefix `UA`
- `/api/flashlights` → `flashlights.json` prefix `LIN`

## Reglas

- Stock no puede quedar negativo: si `quantityInStock < quantity` solicitada, se bloquea la entrega.
- Anular una entrega restaura el stock automáticamente.
- Las fotos legacy (`photo`, `weaponPhoto`) siguen funcionando y se incluyen en exports como "principal" si no hay nuevos `PhotoRecord`.
- Los `PhotoRecord` se persisten dentro del JSON de `armed-personnel` como base64 (consistente con la implementación actual).
