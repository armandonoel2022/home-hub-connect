# Expediente de Clientes: Horarios por día, Feriados RD y Dashboard

Construiremos sobre lo existente (Vivo / Bóveda / Manual) sin romper la lectura de gSafeOne. Cuatro bloques: (1) feriados RD automáticos, (2) horario semanal por puesto con clasificación Feriado + comparación con lo real, (3) cálculo de pago de feriado en el volante de RRHH, (4) nueva pestaña **Dashboard** dentro del Expediente.

## 1. Feriados de República Dominicana (automático, fuente externa)
- Nueva ruta backend `backend/routes/holidays.js` que consulta una fuente pública (Nager.Date: `https://date.nager.at/api/v3/PublicHolidays/{año}/DO`, sin API key) y **cachea el resultado en JSON local** (`holidays-do.json`) para que siga funcionando sin internet. Soporta ajuste manual (agregar/editar/eliminar feriados locales que el calendario oficial no traiga).
- Endpoints: `GET /api/holidays?year=YYYY` (devuelve lista con cache + refresco best-effort), `POST /api/holidays/refresh`, `POST/DELETE` para ajustes manuales (gateado a admin/RRHH).
- Cliente: `holidaysApi` en `src/lib/api.ts` + helper `src/lib/holidays.ts` con `isHoliday(dateISO)`, `getHolidayName(dateISO)`.

## 2. Horario semanal por puesto (plantilla) + comparación con lo real
- Plantilla esperada por puesto: para cada **día (Lun–Dom) + Feriado**, qué tanda(s)/turno(s) aplican, vigilante(s) esperado(s) y arma esperada. Se guarda en overlay JSON local enlazado al puesto (no se escribe a gSafeOne).
  - Backend: extender `expediente-overlay.js` (o ruta nueva `post-schedule`) con `GET/PUT /schedule/:postKey`.
  - Estructura: `{ semana: { lunes:[...], ..., domingo:[...], feriado:[...] }, requiereArma }`.
- En la vista Vivo, cada puesto mostrará un editor de **Horario semanal** (solo editores) con las 7 columnas + Feriado.
- **Comparación real vs plantilla**: para la fecha seleccionada, se determina el día de semana (o Feriado si la fecha es feriado RD) y se contrasta la plantilla con lo que reportó gSafeOne ese día → badges de coincidencia / ausencia / cambio de turno.

## 3. Pago de feriado en el volante de RRHH (sueldo/26, doble)
- Regla confirmada: salario diario de feriado = **sueldo mensual / 26**; un feriado trabajado se paga al **200%** (normal + 100% adicional). El divisor normal sigue siendo 23.83 para días ordinarios.
- Helper `src/lib/payrollCalc.ts`: añadir `dailyHolidayRate(monthlySalary) = monthly/26` y `holidayPay(monthlySalary, días) = (monthly/26) * días * 2`.
- Integración con extras de nómina (`payroll-extras`, type `holiday`): cuando se registre un feriado trabajado, el monto se autocalcula con la nueva fórmula a partir del sueldo del empleado.
- El volante de pago (`src/lib/payslipPdf.ts`) mostrará una línea separada **"Feriado (sueldo/26 ×2)"** con días y monto, sumada al bruto.

## 4. Nueva pestaña Dashboard en Expediente de Clientes
- En `ClientExpediente.tsx`, agregar un cuarto modo **"Dashboard"** junto a Vivo / Bóveda / Manual.
- Nuevo componente `src/components/operations/ExpedienteDashboard.tsx` que lee gSafeOne (`generalSqlApi.expediente`) más la plantilla/feriados y muestra:
  - KPIs: puestos totales, puestos con arma, vigilantes activos, puestos sin cobertura hoy, feriado del día (si aplica).
  - **Cambios de turno por día**: comparación plantilla vs real, resaltando puestos donde el vigilante o la tanda cambió respecto a lo esperado.
  - **Asignación de armas**: armas por puesto, armas sin asignar / sin reporte, duplicados.
  - **Vigilantes por puesto**: distribución, puestos con sobre/sub cobertura.
  - Selector de fecha (reusa fechas de `generalSqlApi.expedienteDates`) y filtros por cliente/localidad. Exportación a Excel.

## Notas técnicas
- gSafeOne sigue **solo lectura**; toda plantilla/feriado/ajuste vive en JSON local (visible para todos), igual que el overlay actual.
- "Menos que letal" ya está unificado; se mantiene.
- Permisos de edición reusan `canEditExpediente` / `EDITOR_EMAILS`.

¿Te parece bien este alcance? Al aprobar, implemento empezando por feriados + cálculo de nómina, luego la plantilla semanal y por último el Dashboard.