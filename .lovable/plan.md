## Mejoras al módulo de Préstamos (RRHH)

Hoy el préstamo ya pasa por Dilia (RRHH) → Aurelio (Gerencia) → aplicación RRHH, pero hay reglas de negocio incompletas. Estos son los cambios.

### 1. Política de antigüedad (6 meses)
- El **propio empleado** no puede enviar la solicitud si tiene menos de 6 meses (ya se bloquea — se mantiene).
- **RRHH puede solicitar a nombre de otro** aunque no cumpla los 6 meses: cuando quien envía es de Recursos Humanos y selecciona a un beneficiario, se omite el bloqueo de antigüedad y se marca la solicitud como "Excepción de antigüedad autorizada por RRHH" (validada contra el nombre leído de la tabla de empleados que ya aparece arriba en el formulario).

### 2. Tasa de interés y frecuencia (quincenal vs mensual)
- Cambiar la tasa anual por defecto de **0% a 30%** (`loanSettings`).
- Agregar al formulario un selector **Frecuencia de descuento: Quincenal / Mensual**.
- Calcular la cuota según la frecuencia:
  - Mensual: cuota = capital + interés, dividido entre los meses de plazo.
  - Quincenal: el plazo se expresa en quincenas (meses × 2); la cuota quincenal usa la tasa prorrateada por quincena.
- La **cuota no puede superar 1/6 del ingreso del período** (1/6 del salario mensual para mensual; 1/12 del salario mensual ≈ 1/6 del ingreso quincenal). Si excede, se bloquea con mensaje claro.

### 3. Flujo de aprobación con overlay
- La solicitud llega **primero a Dilia Aguasvivas (o la persona que ella designe)** mediante un overlay accionable: el overlay de notificaciones de RRHH permitirá **Aprobar / Rechazar** el préstamo directamente (además del botón "Ver solicitudes").
- Tras la aprobación de Dilia, pasa a **Crisóstomo Aurelio (Don Aurelio)** con su propio overlay accionable.
- Se mantiene el paso final de "Aplicación RRHH" (registro de fecha de inicio de descuento).

### 4. Pantalla de Control de Préstamos
Nueva ruta `/rrhh/prestamos-control` (visible para RRHH y Gerencia):
- Lista de todos los préstamos **aprobados** con: empleado, monto prestado, tasa, frecuencia, cuota, plazo, fecha de aplicación.
- Seguimiento de cobranza: total prestado, total ya descontado (cuotas registradas), saldo pendiente, próxima cuota.
- Permitir registrar/abonar cuotas cobradas para llevar el control de "lo que se cobra vs. lo que se ha prestado".
- Totales globales (cartera prestada, cobrada, por cobrar).

### 5. Volante de nómina (TSS) refleja extras y préstamos
- En el volante de pago (`payslipPdf`), agregar líneas de descuento por **cuota de préstamo aprobada** del período y asegurar que las **horas extra aprobadas** aparezcan como devengado.
- El armado del volante (Payroll) incluirá las cuotas de préstamo activas y extras aprobados del período en `totalDeductions`/devengado.

### Detalles técnicos
- `src/lib/loanSettings.ts`: default `annualInterestRatePct: 30`; nuevas funciones para cuota quincenal/mensual y tope por frecuencia.
- `src/lib/hrRequestTypes.ts`: `LoanDetails` gana `frequency: 'quincenal'|'mensual'`, `installmentsTotal`, y registro de cobros `payments: [{date, amount, by}]`.
- `src/pages/HRForms.tsx`: selector de frecuencia, excepción de antigüedad para RRHH-on-behalf, cálculo de cuota por frecuencia.
- `src/lib/hrRequestService.ts`: helper para registrar abonos de cuota; getters para préstamos aprobados/activos.
- `src/components/HRNotificationOverlay.tsx`: acciones Aprobar/Rechazar para préstamos según el rol del usuario (Dilia / Aurelio).
- Nueva `src/pages/LoanControl.tsx` + ruta en `App.tsx` + enlace en el menú de RRHH.
- `src/lib/payslipPdf.ts` y `src/pages/Payroll.tsx`: incorporar cuota de préstamo y extras aprobados al volante.

### Preguntas abiertas
- ¿"La persona que Dilia designe" debe ser configurable (un selector en RRHH) o por ahora fija en Dilia? Asumiré **configurable**: un ajuste donde Dilia elige un delegado que también recibe el overlay.
- Los abonos de cuota se registrarán manualmente en la pantalla de control (no hay integración bancaria automática).
