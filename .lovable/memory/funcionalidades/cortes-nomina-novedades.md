---
name: Cortes de Nómina y Novedades
description: Cortes quincenales, fechas de pago, e incentivos/horas extras/feriados reportados por líderes a Dilia
type: feature
---
# Cortes de nómina

- **Corte 1:** del 01 al 15 de cada mes → se paga el **22** del mismo mes.
- **Corte 2:** del 16 al último día del mes → se paga el **7** del mes siguiente.
- Las horas extras, días feriados e incentivos se pagan **7 días después del corte**.
- Helper: `src/lib/payrollPeriods.ts` (`getCutoffForDate`).

# Novedades de nómina (PayrollExtras)

- Los líderes de área reportan para su equipo: horas extras, nocturnas, **días feriados**, **incentivos/bonos**, almuerzos (descuento) y horas tardías (descuento).
- Tipo `incentive`: monto fijo que se **suma al devengado**.
- Día feriado trabajado = **doble pago** del día (pago del día + 100% adicional). Recargos: extras 35%, nocturnas 15%.
- Al registrar una novedad, se envía notificación/overlay a **Dilia Aguasvivas** (encargada de cargar la nómina; fallback: RRHH) con el corte y la fecha de pago.
- Dilia/RRHH pueden **exportar a Excel** las novedades del período (botón en PayrollExtras y en HRPayrollReport).
- Las novedades se reflejan en el volante de pago (`payslipPdf.ts`) y en la generación de nómina (`backend/routes/payroll.js`).
