# Digitalización del Procedimiento de Asignación de Equipos (PRO-IT-05)

Basado en PRO-IT-05 y el formulario F-IT-13, voy a convertir la asignación de equipos en un flujo digital completo dentro de la intranet, separando correctamente **Flota Celular** (celulares/tablets) de **Inventario IT** (laptops, workstations, monitores, impresoras, pantallas, proyectores, teléfonos IP), con hoja firmable, evidencias, overlay a Chrisnel y vínculo permanente con el empleado.

## 1. Registro mejorado de dispositivos móviles (Flota Celular)
Ampliar el registro de celulares y tablets con todos los campos solicitados:
- **Tipo** (Celular / Tablet), Marca, Modelo, IMEI, Serie, Color, Almacenamiento, RAM, Fecha de adquisición.
- **Estado**: En Stock, Asignado, Dañado, En Reparación, Prestado, Dado de Baja.
- **Asignado a** (empleado) y **Departamento** (ej. vigilantes/supervisores → Operaciones).
- Carga masiva de data existente (importación) relacionando con el usuario o marcándolos In Stock/Damaged/Reparación/Prestado.

## 2. Inventario IT (equipos no móviles)
En el registro de Inventario IT se manejarán laptops, workstations, monitores, impresoras, pantallas/TV, proyectores, teléfonos IP y otros, con asignación a empleado + departamento y estados equivalentes.

## 3. Hoja de Asignación firmable (F-IT-13 digital)
- Al asignar un dispositivo (de Flota Celular o Inventario IT) a un empleado, se podrá **generar una Hoja de Asignación en PDF** con membrete SafeOne, datos del empleado, datos completos del equipo, cláusulas de custodia (tomadas de PRO-IT-05) y espacio de firma.
- El empleado firma físicamente; luego se podrá **subir la constancia firmada** (PDF/JPG/PNG) a la intranet, quedando adjunta al registro del dispositivo y al perfil del empleado.

## 4. Overlay a Chrisnel Fabián + Hub de Administración
- Al registrar un dispositivo nuevo, se dispara un **overlay para Chrisnel Fabián** notificando el alta para fines de inventario.
- Al cerrar el overlay, el registro queda en su **Hub de Administración** en una sección "Registros de Dispositivos", con acceso a las evidencias (hoja firmada / fotos).

## 5. Perfil 360° del empleado (RRHH)
Al hacer clic sobre un empleado en RRHH se mostrará una ficha ampliada con:
- Datos generales + foto.
- **Dispositivos asignados** (Flota Celular e Inventario IT), **armas**, **uniforme**, **linterna**, **macana**, **puesto de trabajo**.
- Campos **editables** para mejorar la confiabilidad de los datos a medida que se revisan.
- Las ediciones de dispositivos redirigen al registro correcto: celular/tablet → Flota Celular; laptop/workstation/monitor/impresora/pantalla/proyector → Inventario IT.

## 6. Baja de empleado → ticket automático de retiro
- Al dar de baja (despido o renuncia), se genera automáticamente un **ticket a Tecnología** listando todos los dispositivos atados al perfil para su retiro (reutilizando la lógica de vinculación de activos existente y el flujo PRO-IT-05 de devolución).

---

## Detalles técnicos
- **Tipos** (`src/lib/types.ts`): extender `PhoneDevice` (type Celular/Tablet, color, storage, ram) y nuevos estados; extender `Equipment`/estados para Inventario IT; añadir tipo de "constancia de asignación".
- **Flota Celular** (`PhoneFleet.tsx`): nuevos campos en formulario, importación masiva, botón "Generar hoja" y "Subir constancia firmada".
- **Inventario IT** (`Inventory.tsx`): tipos ampliados (Workstation, Pantalla/TV, Proyector, Teléfono IP), asignación a empleado/departamento, hoja firmable + evidencias.
- **PDF**: nuevo `src/lib/assignmentSheetPdf.ts` con membrete `safeone-letterhead.png` y cláusulas de PRO-IT-05.
- **Overlay**: nuevo `DeviceRegisterOverlay` dirigido a Chrisnel + sección en `AdminHub.tsx`.
- **Perfil empleado** (`EmployeeDirectory.tsx`): ampliar el diálogo de detalle usando `getUserAssignedAssets` (ya existente) + uniformes/linternas + edición inline.
- **Baja**: enganchar `generateOffboardingTicketDescription` (ya existe) al flujo de offboarding para crear el ticket automáticamente.
- **Backend**: endpoints para subir constancias (patrón de `department-folders.js`/comprobantes) e importación de flota; persistencia en JSON local.

Es un alcance amplio; lo implementaré por fases en este orden: (1) tipos + Flota Celular mejorada, (2) Inventario IT, (3) hoja PDF + carga de constancia, (4) overlay Chrisnel + Hub, (5) perfil 360° editable, (6) ticket automático de baja.
