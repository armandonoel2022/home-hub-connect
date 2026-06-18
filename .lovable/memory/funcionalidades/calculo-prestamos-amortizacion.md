---
name: Cálculo de Préstamos (amortización GENERAL)
description: Fórmula de amortización de préstamos idéntica al software GENERAL, deducción en nómina y hoja de amortización PDF
type: feature
---
# Préstamos — cálculo y flujo

- **Amortización francesa (cuota fija)**, idéntica a GENERAL ("Prestamo Con Interes").
- **Tasa por cuota = tasa anual / 12** (ej: 30% anual → 2.5% por cuota), aplicada igual para mensual y quincenal. NO usar /24 para quincenal.
- Fórmula: `cuota = P·i / (1 − (1+i)^−n)`, n = número de cuotas.
- Quincenal: n = meses × 2; fechas días 1 y 16.
- Tasa interés anual por defecto 30%, editable por Aurelio (`loanSettings.ts`).
- Helpers en `src/lib/loanSettings.ts`: `generateAmortizationSchedule`, `calcLoanPlan`, `periodRatePct`.
- **Hoja de amortización PDF**: `src/lib/loanAmortizationPdf.ts` (membretado SafeOne, columnas No./Fecha/Interés/Capital/Bce.Capital/Bce.Total/Pagado). Bce.Total = suma de cuotas restantes.
- **Deducción en nómina**: la cuota del préstamo aprobado (match por nombre + frecuencia, con saldo > 0) aparece en el comprobante de pago (`Payroll.tsx` liveCalc) y en el volante PDF (`payslipPdf.ts`).
- **Seguimiento**: `LoanControl.tsx` muestra todas las solicitudes (en proceso, aprobadas, rechazadas) para que Aurelio/RRHH den seguimiento, con descarga de amortización PDF. `getAllLoanRequests()` en `hrRequestService.ts`.
- **Flujo de aprobación**: la solicitud llega a **Dilia Aguasvivas Y Alexandra Lira** (aprobación indistinta — quien apruebe primero avanza el flujo, ya no se requiere la otra). Luego va a **Gerencia General (Aurelio Pérez)** y regresa a RRHH (Dilia y/o Alexandra) para registrar la fecha de aplicación. Cualquier miembro de RRHH (`isRRHH`) puede actuar en los pasos de RRHH.
- **Previsualización de amortización**: botón "Previsualizar amortización" disponible para el solicitante (`MyHRRequests.tsx`), para Dilia/Alexandra y Aurelio (`HRForms.tsx` tarjetas de aprobación) — abre el PDF de `generateAmortizationPDF(amortizationInputFromRequest(req), { open: true })`. Detalles del préstamo persistentes vía `hrRequestService` + backend para todas las partes.
