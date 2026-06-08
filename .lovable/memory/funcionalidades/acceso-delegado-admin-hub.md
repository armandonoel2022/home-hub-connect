---
name: Acceso Delegado Hub Administración
description: Chrisnel/admins otorgan acceso granular por módulo del Hub de Administración a cualquier usuario
type: feature
---
Chrisnel (fullName incluye "chrisnel"), administradores y el superusuario pueden delegar acceso individual a los módulos del Hub de Administración.

- Lógica en `src/lib/adminHubAccess.ts`: ACL en localStorage (`safeone_adminhub_acl_v1`), evento `safeone:adminhub-acl`.
- Módulos: purchaseOrders, pettyCash, keys, corporateCards, fleetMaintenance, deviceRegistrations, fixedAssets.
- `canManageAdminHubAccess` = super/admin/Chrisnel; tienen acceso total automático.
- UI: botón "Permisos de Acceso" (ShieldCheck) en el header del Hub → `AdminHubAccessManager` (matriz usuario × módulo con checkboxes, guardado automático).
- El usuario designado solo ve las tarjetas de acceso permitidas; las categorías/procesos del Hub se ocultan a no-administradores.
- `canView("adminHub")` en permissions.ts ahora permite entrar si el usuario tiene al menos un módulo delegado (`canAccessAnyAdminModule`).
