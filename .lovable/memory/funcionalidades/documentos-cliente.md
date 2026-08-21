---
name: Documentos digitales por cliente
description: Carga de evidencias (pdf/doc/xls/imágenes) por cliente en Servicio al Cliente, guardadas en backend/data/uploads/clientes/<clienteId>
type: feature
---
Botón **Subir** en cada fila de "Documentación requerida al asociado" y en cada formulario F-ADM dentro del Expediente de Asociado (`BusinessPartnerDossier`, ruta `/servicio-al-cliente/registro-mercantil`).

- Backend: `backend/routes/client-documents.js` (`/api/client-documents`). Archivos en `<DATA_DIR>/uploads/clientes/<clienteId>/`, índice en `client-documents.json`, servidos en `/uploads/clientes/...`.
- Formatos: pdf, doc(x), xls(x), csv, txt, ppt(x), imágenes, zip/rar. Máx 25 MB.
- Eliminación lógica con justificación obligatoria + registro en `audit-log.json`.
- Frontend: `src/components/clients/ClientDocUploader.tsx` (`useClientDocs`, `DocUploadCell`) y `clientDocumentsApi` en `src/lib/api.ts`.
