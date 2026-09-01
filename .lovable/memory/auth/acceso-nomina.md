---
name: Acceso a Nómina
description: Quién puede ver la nómina completa vs. sólo la propia o la de su departamento (filtro por Departamento en gSafeOne)
type: feature
---

Ser administrador de la intranet NO otorga acceso a todos los salarios.

- **Acceso total (nómina completa):** departamento Recursos Humanos + Aurelio Pérez (aperez@), Samuel Pérez (sperez@), Armando Noel (anoel@), Chrisnel Fabián (cfabian@) y tecnologia@safeone.com.do.
- **Líderes de departamento** (ej. Luis Ovalle, lovalles@safeone.com.do, Seguridad Electrónica): ven su propia información y la de su departamento.
- **Usuarios regulares:** sólo su propia información.

Implementación:
- Pantalla **Mi Nómina** en `/mi-nomina` (módulo `myPayroll`, visible para todos).
- Backend `backend/routes/my-payroll.js` resuelve el alcance en el servidor: localiza el registro `Empleado` por **cédula → código de empleado** y filtra por `Empleado.Departamento` (OID de la tabla `Departamento`; Seguridad Electrónica = 10) o por `Empleado.OID`.
- `/api/general-sql` (nómina completa) protegido con `payrollGuard`; `employees`/`employees-active` devuelven `salario: null` a quien no tiene acceso total.
- Frontend: `src/lib/payrollAccess.ts` (`canViewFullPayroll`) y módulo `generalNomina` en `permissions.ts`.
