/**
 * Loan policy parameters. Editable only by Aurelio Pérez (Gerencia General).
 * Persisted in localStorage so cualquier instancia de la intranet local refresca.
 */
const KEY = "safeone_loan_settings_v1";

export interface LoanSettings {
  annualInterestRatePct: number; // ej: 12 = 12% anual
  minTenureMonths: number;       // antigüedad mínima requerida
  maxInstallmentFraction: number; // ej: 1/6 = 0.1667 — fracción máxima del salario mensual
  updatedAt?: string;
  updatedBy?: string;
}

export type LoanFrequency = "mensual" | "quincenal";

const DEFAULT: LoanSettings = {
  annualInterestRatePct: 30,
  minTenureMonths: 6,
  maxInstallmentFraction: 1 / 6,
};

export function getLoanSettings(): LoanSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveLoanSettings(s: Partial<LoanSettings>, updatedBy: string): LoanSettings {
  const merged: LoanSettings = {
    ...getLoanSettings(),
    ...s,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  localStorage.setItem(KEY, JSON.stringify(merged));
  try { window.dispatchEvent(new CustomEvent("safeone:loan-settings")); } catch {}
  return merged;
}

/**
 * Calcula prestaciones acumuladas según Código de Trabajo de la R.D.
 * (usadas como garantía de pago en caso de salida del empleado).
 *
 * - Vacaciones (Art. 177 C.T.):
 *     • 1 a 4 años de antigüedad → 14 días laborables / año.
 *     • 5+ años → 18 días laborables / año.
 *     • Proporcional al tiempo transcurrido desde el último aniversario laboral.
 *     • Conversión a RD$: (días × salario_mensual / 23.83) — 23.83 = promedio
 *       de días laborables por mes utilizado por el Ministerio de Trabajo.
 *
 * - Salario de Navidad / Regalía Pascual (Art. 219 C.T.):
 *     • Doceava parte del salario ordinario devengado en el año calendario.
 *     • Acumulado = salario_mensual × meses_trabajados_en_el_año / 12.
 *
 * - Cuota máxima (política interna SafeOne): 1/6 del salario mensual,
 *   en línea con la práctica de no comprometer más de ~16% del ingreso.
 */
export function calcLoanCapacity(monthlySalary: number, hireDate?: string | null, fraction = 1 / 6) {
  const salary = Number(monthlySalary) || 0;
  let vacaciones = 0;
  let salario13 = 0;
  let vacacionesDias = 0;
  let mesesEnAnio = 0;
  let anios = 0;
  if (hireDate && salary > 0) {
    const hire = new Date(hireDate);
    const now = new Date();
    // Años completos de antigüedad
    anios = now.getFullYear() - hire.getFullYear() - (now < new Date(now.getFullYear(), hire.getMonth(), hire.getDate()) ? 1 : 0);
    const diasPorAnio = anios >= 5 ? 18 : 14;
    // Último aniversario laboral
    const ultimoAniv = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
    if (ultimoAniv > now) ultimoAniv.setFullYear(ultimoAniv.getFullYear() - 1);
    const diasDesdeAniv = Math.max(0, (now.getTime() - ultimoAniv.getTime()) / (1000 * 60 * 60 * 24));
    vacacionesDias = Math.min(diasPorAnio, (diasDesdeAniv / 365) * diasPorAnio);
    vacaciones = (vacacionesDias * salary) / 23.83;
    // Salario 13 — meses transcurridos en el año calendario actual
    mesesEnAnio = now.getMonth() + now.getDate() / 30; // proporcional al día del mes
    if (hire.getFullYear() === now.getFullYear()) {
      // si fue contratado este año, contar solo desde su ingreso
      const desdeIngreso = (now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 30);
      mesesEnAnio = Math.max(0, desdeIngreso);
    }
    salario13 = (salary * mesesEnAnio) / 12;
  }
  const maxAvailable = vacaciones + salario13;
  const maxInstallment = salary * fraction;
  return {
    monthlySalary: salary,
    vacaciones: Math.round(vacaciones),
    salario13: Math.round(salario13),
    vacacionesDias: Math.round(vacacionesDias * 10) / 10,
    mesesEnAnio: Math.round(mesesEnAnio * 10) / 10,
    anios,
    maxAvailable: Math.round(maxAvailable),
    maxInstallment: Math.round(maxInstallment),
  };
}

/**
 * Calcula cuota mensual usando interés simple anual prorrateado.
 * cuota = (capital + capital*tasa*plazoMeses/12) / plazoMeses
 */
export function calcMonthlyInstallment(amount: number, termMonths: number, annualRatePct: number): number {
  const a = Number(amount) || 0;
  const n = Math.max(1, Number(termMonths) || 1);
  const r = (Number(annualRatePct) || 0) / 100;
  const total = a + (a * r * n) / 12;
  return Math.round(total / n);
}
