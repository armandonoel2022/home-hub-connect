## Objetivo

Hacer el **Expediente de Clientes** más profesional/estético (vista 360° con filtros por botones en lugar de todo desplegado) y alimentarlo con **datos reales** de la base de datos gSafeOne, leyendo del **último Reporte Diario digitado (el de ayer)**.

## Hallazgo clave sobre el modelo de datos (del extracto)

- **Cliente**: `OID, Codigo, Nombre, Direccion, Telefono, Email, RNC, Cedula, Contacto, Inactivo`.
- **Puesto**: `OID, Codigo, Descripcion` → en gSafeOne es el **rol/ocupación** (Vigilante, Supervisor…), NO una localidad física.
- **ReporteDiario** (cabecera) → **ReporteDiarioD** (intermedia) → **ReportePuesto** (detalle: `Cliente, Puesto, Vigilante, Horas, Incentivo, Arma, Novedad, Comentario`).
- **Empleado** = vigilante asignado. **Armamento** = serial/arma (ya existe `/weapons`).
- **No existe tabla Localidad.** El "360°" por cliente se arma agrupando las líneas de `ReportePuesto` del último reporte por Cliente → Puesto(rol) → Vigilante/Arma.

Por eso la jerarquía visual será: **Cliente → Puestos cubiertos (del reporte de ayer) → Vigilante + Arma + Horas**, con la dirección del cliente como su localización. La capa manual "Localidad" se mantiene solo en el modo manual (localStorage) ya existente.

## Backend (`backend/routes/general-sql.js`)

Nuevos endpoints solo-lectura (mismo guard que GENERAL):

1. `GET /general-sql/expediente/status` → fecha y OID del último `ReporteDiario` (ayer/último cerrado).
2. `GET /general-sql/expediente` → 360° del último reporte:
   - Join `ReporteDiario → ReporteDiarioD → ReportePuesto → Cliente → Puesto → Empleado` y `Armamento` (por `Arma`).
   - Devuelve por cliente: datos del cliente (nombre, dirección, tel, email, RNC/Cédula, contacto) + lista de puestos cubiertos con `{ puesto, vigilante, horas, armaSerial/modelo, novedad, comentario }`.
   - Totales globales: clientes con cobertura, puestos cubiertos, vigilantes, armas en uso, puestos armados vs sin arma.

Se mapeará con `SELECT *` flexible donde los nombres puedan variar (como ya se hace con `Armamento`).

## Cliente API (`src/lib/api.ts`)

Agregar a `generalSqlApi`:
- `expedienteStatus()` y `expediente()` con sus tipos (`GeneralExpediente`, `GeneralExpedienteCliente`, `GeneralExpedientePuesto`).

## Frontend (`src/pages/ClientExpediente.tsx`)

Rediseño manteniendo la idea original:
- **Selector de fuente**: "Vivo (GENERAL)" (BD) vs "Manual" (localStorage actual, como respaldo/edición).
- **Barra 360° de KPIs** arriba (tarjetas): Clientes con cobertura, Puestos cubiertos, Vigilantes en servicio, Armas en uso, Puestos sin arma. Muestra la fecha del reporte (ayer).
- **Filtros por botones** (chips): `Todos` · `Con armas` · `Sin armas` · `Con novedad` + buscador por cliente.
- **Tarjetas colapsadas por defecto** (no todo desplegado): cada cliente muestra resumen (puestos, vigilantes, armas) y al expandir revela el detalle de puestos/vigilantes/armas del reporte de ayer, geolocalización y botón de imprimir expediente.
- Estados de carga/empty/erro y botón Recargar. Si GENERAL no está conectado, cae al modo Manual con aviso.
- Estética alineada al sistema (paleta oro/charcoal, encabezados, badges), sin colores hardcodeados.

## Respuesta a "¿cómo exporto un reporte con los keys de cada tabla?"

Incluiré un pequeño botón **"Exportar esquema"** (o lo entrego como nota): consulta `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` + `TABLE_CONSTRAINTS` para listar PKs/FKs por tabla y se exporta a Excel con `exportUtils`. (Confirmar si lo quieres dentro de la app o solo el query.)

## Orden de implementación

1. Endpoints backend `expediente` + registro.
2. `generalSqlApi.expediente*` + tipos en `api.ts`.
3. Rediseño de `ClientExpediente.tsx` (KPIs + filtros + colapso + modo Vivo/Manual).
4. Verificación de build y, si GENERAL responde, prueba en preview.

## Decisión que necesito confirmar

¿La capa **"Localidad"** la dejamos solo en el modo Manual (la BD no la tiene) y en el modo Vivo agrupamos directamente **Cliente → Puestos del reporte de ayer**? Es lo que propongo.