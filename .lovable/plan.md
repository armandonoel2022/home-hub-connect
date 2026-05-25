# Plan de mejoras

Antes de implementar todo de golpe, te propongo este plan. Son 6 frentes y algunos son grandes — los voy a entregar en este orden para que puedas validar cada uno.

## 1. Puestos de trabajo como entidad central

Hoy las armas se asocian solo al vigilante. Voy a crear el concepto de **Puesto de Trabajo** (Post) con:

- Cliente, nombre del puesto, provincia, coordenadas, supervisor responsable.
- Lista de **armas asignadas al puesto** (no al agente). Cada arma queda en el puesto y rota entre turnos.
- Lista de **vigilantes asignados al puesto** (varios por puesto, con turno: diurno/nocturno/24h).
- Historial de quién portó cada arma por turno (log simple).

Cambios:
- Nuevo `src/lib/postsData.ts` (localStorage) con CRUD.
- Nueva pestaña **"Puestos de Trabajo"** dentro de `OperationsMaintenanceMatrix` o como página independiente `/operaciones/puestos`.
- En la matriz de levantamiento, el arma se enlaza a un `postId` además del vigilante.
- Vista del puesto: agentes asignados, supervisor, armas en custodia, link al mapa.

## 2. Supervisores → Gerencia de Operaciones

- Cada Puesto tiene `supervisorId`.
- Cada Supervisor reporta a un Gerente de Operaciones (campo en el usuario o tabla simple).
- Vista de árbol en `/operaciones`: Gerencia Operaciones → Supervisores → Puestos → Vigilantes.

## 3. Flujo de solicitudes con pantalla de respuesta

Ya existe `hrRequestService` con notificaciones. Voy a:

- Crear página **"Mis Solicitudes"** (`/rrhh/mis-solicitudes`) donde cada usuario ve el estado (Pendiente Supervisor / RRHH / Gerencia / Aprobada / Rechazada) de TODAS sus solicitudes (vacaciones, préstamos, permisos, etc.) con timeline visual.
- Reforzar el **HRNotificationOverlay** para que muestre respuestas (aprobaciones/rechazos) además de pendientes.
- Agregar overlay de respuesta al aprobar/rechazar préstamo: el solicitante ve un toast persistente "Tu préstamo fue aprobado por Aurelio Pérez".

## 4. Constancia auditable de horas extras / feriados

Los reportes ya se guardan en `opsReportsStorage` (localStorage). Voy a:

- Crear página **"Constancias RRHH"** (`/rrhh/constancias`) solo visible a RRHH + `tecnologia@safeone.com.do`.
- Lista cronológica de cada reporte (horas extras, feriado, día libre trabajado) con: agente, fecha, horas, supervisor que reportó, estado, fecha de procesamiento.
- Filtros por agente, fecha, tipo, estado.
- Botón exportar PDF/Excel para auditoría.
- En el perfil del empleado: mini-historial de sus reportes operativos.

## 5. Validar build (`npm run build`)

- Revisar que `BirthdayOverlay`, `HRBirthdays` y todos los nuevos componentes compilen sin errores.
- Verificar imports faltantes, rutas absolutas, dependencias de localStorage en SSR (no aplica, pero por si acaso `typeof window`).
- Ejecutar build localmente para detectar errores TS.

## 6. Agente virtual de cierre/apertura (Monitoreo)

Funcionalidad **off por defecto** con toggle:

- Nuevo módulo `src/lib/monitoringAgent.ts` que:
  - Lee la lista de clientes con horarios esperados (apertura/cierre).
  - Cada minuto (interval) compara hora actual vs ventana esperada.
  - Si pasa la ventana sin punch → genera alerta automática "Cliente X no ha hecho apertura" en el panel de Monitoreo.
  - Si hace cierre antes/después de tiempo → registra observación.
- Toggle ON/OFF persistente en `localStorage` accesible desde `MonitoringCenter` (solo monitoreo + admin).
- Log de acciones del agente para auditar (qué notificó, cuándo).
- Esta versión es **simulada en cliente** (no llama APIs externas). Si más adelante quieren backend real, lo migramos.

---

## Orden de entrega sugerido

Lo entrego en **dos tandas** para que puedas probar:

**Tanda A (esta respuesta):** 1, 2, 3, 4, 5 — son los más críticos y operativos.
**Tanda B (después de tu feedback):** 6 — el agente virtual, porque es más delicado y quiero que valides la lógica de horarios antes.

¿Te parece bien este orden, o prefieres que entregue todo de una vez (más riesgo de errores) o cambiar prioridades?
