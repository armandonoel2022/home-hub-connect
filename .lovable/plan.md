## Plan: Permisos granulares, jerarquía organizacional y comunicados como overlay

Trabajo amplio que toca permisos en todo el sidebar, jerarquía de reportes, carpetas departamentales con superusuario, y comunicados como overlay global. Lo organizo en 5 tandas para entregar y validar por partes.

### Roles centrales

- **Superusuario** (`tecnologia@safeone.com.do`): ve y administra TODO, incluso configura quién ve qué carpetas departamentales.
- **Co-admin TI** (`anoel@safeone.com.do`): mismos privilegios que admin para los módulos TI/usuarios/fotos.
- **Admin** (`isAdmin: true`): ve todo el contenido pero no necesariamente configura ACL de carpetas.
- **Líder de departamento** (`isDepartmentLeader: true`): ve su área y aprueba en flujos.
- **Usuario regular**: solo lo que su departamento/rol permita.

Centralizo todo en un único helper `src/lib/permissions.ts` con funciones tipo `canView('inventory', user)`, `canEdit('fleet', user)`, `isSuperUser(user)`, `isCoAdminIT(user)`. El sidebar, el router (guard) y cada página consultan el mismo helper.

### Tanda A — Permisos del sidebar y guards de ruta

Mapa de acceso (resumen, todo configurable en `permissions.ts`):

| Módulo | Ver | Editar |
|---|---|---|
| Dashboard, Directorio, Calendario, Procedimientos, Wiki, Archivos | Todos | — |
| KPIs | Calidad + asignados | Calidad |
| Tareas | Todos (sus tareas) | jefe directo ve quién asigna |
| Tickets IT | Creador + asignado | TI |
| Inventario IT, Flota Celular, Registro Tareas IT, Sincronizar fotos, Gestión usuarios | TI + super + anoel | mismo |
| Flota Vehicular | Todos | Admin, TI, Monitoreo |
| Personal Armado / Puestos / Matriz Mant. / Uniformes / Auditoría Superint. | Operaciones, Admin, Gerencia Gral, Dirección Comercial | Operaciones |
| Mis Solicitudes RRHH | Cada quien las suyas | — |
| Constancias RRHH (Auditoría) | solo `tecnologia@safeone.com.do` | — |
| Solicitudes Compra | Admin, Contabilidad, CxC; creador ve las suyas | — |
| Solicitudes Personal | Líderes + RRHH (con flag "hacer pública") | RRHH + líder |
| BASC | Calidad + todos los líderes (lectura) | Calidad |
| Capacitaciones | Todos | RRHH + super |
| Encuestas | Todos | RRHH |
| Gastos Menores | CxC, Contabilidad, Admin | mismo |
| Seguimiento Clientes Monitoreo | Monitoreo, TI, Dir. Comercial, Admin, CxC, Gerencia Gral, super, anoel | mismo |
| Auditoría (módulo) | super | super |

- Renombrar "Gerencia Comercial" → "Dirección Comercial" donde aparezca.
- `AppSidebar.tsx` oculta cada item con `canView(...)`.
- Crear `RouteGuard` en `App.tsx` que redirige al `/` con toast si el usuario entra por URL directa a algo sin permiso.

### Tanda B — Jerarquía "reporta a" y Equipo de trabajo

- Añadir campo `reportsTo` (userId) a `users.json` (backend `users.js` ya permite passthrough). 
- En `UserManagement.tsx`: nuevo selector "Reporta a" (lista de usuarios con `isDepartmentLeader` o cualquier usuario).
- En Dashboard, sección **Equipo de trabajo**: para cada líder mostrar lista de subordinados (`users.filter(u => u.reportsTo === leader.id)`).
- En **Tareas**: al asignar, guardar `assignedBy`. El jefe directo del asignado ve un badge "asignada por X".

### Tanda C — Carpetas departamentales con ACL configurable por superusuario

Hoy `backend/routes/department-folders.js` ya restringe por `user.department === department` y admin. Cambios:

1. Nuevo archivo `folder-acl.json` administrado solo por `tecnologia@safeone.com.do`:
   ```json
   { "Administración": { "viewers": ["user-1","user-2"], "editors": ["user-1"] } }
   ```
2. Reemplazar `isMemberOfDept()` por `canViewFolder(user, dept)` y `canEditFolder(user, dept)`:
   - super → siempre true
   - admin → ver siempre, editar siempre
   - si ACL existe → respeta listas
   - si no hay ACL → fallback al comportamiento actual (mismo departamento)
3. Endpoints POST/DELETE/upload usan `canEditFolder`.
4. Nueva página `src/pages/AdminFolderPermissions.tsx` (solo super): tabla departamento × usuarios con checkboxes ver/editar. Ruta `/admin/permisos-carpetas`.
5. En `DepartmentGrid.tsx` mostrar el módulo solo si `canViewFolder`.

### Tanda D — Comunicados como overlay global + evento en calendario

- Hoy `Announcements.tsx` existe. Añadir:
  - Al crear un comunicado, marcar `showAsOverlay: true` por defecto y opcionalmente `eventDate`.
  - Persistir en `announcements.json` (ya existe vía backend, si no, agregar ruta análoga a notifications).
- Nuevo componente `src/components/AnnouncementOverlay.tsx` (estilo idéntico a `BirthdayOverlay`): polling cada 60s a `/api/announcements/active`, muestra modal con título/cuerpo/imagen, botón "Entendido" que lo marca como leído por usuario (lista `readBy[]`).
- Montar `<AnnouncementOverlay />` en `App.tsx` junto a `BirthdayOverlay`.
- Si el comunicado trae `eventDate`, al guardarlo el backend crea automáticamente un evento en `calendar-events.json` con tipo "Comunicado".

### Tanda E — Detalles finales

- Tareas: campo `assignedBy` ya o agregar. UI en `TaskInbox.tsx`: el líder del asignado ve "asignada por …".
- Solicitudes de Personal: flag `isPublic` (toggle por líder + RRHH); cuando es true aparece en un listado público nuevo.
- Renombrar "Gerencia Comercial" → "Dirección Comercial" en sidebar, seed de departamentos, dashboards y constantes.
- Validar `npm run build`.

### Orden de entrega

1. Tanda A (permisos sidebar + guard) — base de todo.
2. Tanda B (reportsTo + equipo).
3. Tanda C (carpetas + ACL).
4. Tanda D (comunicados overlay).
5. Tanda E (cierre + rebrand Dirección Comercial + build).

Confirmas que arranque por **Tanda A** o quieres que cambie prioridades / agrupe distinto?
