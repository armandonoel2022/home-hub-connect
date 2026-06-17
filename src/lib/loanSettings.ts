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
 * Tasa periódica usada por el software GENERAL ("Prestamo Con Interes").
 * Se aplica la tasa MENSUAL (anual / 12) por cada cuota, tanto para préstamos
 * mensuales como quincenales. Ejemplo: 30% anual → 2.5% por cuota.
 * Esto replica exactamente la hoja de amortización impresa por GENERAL.
 */
export function periodRatePct(annualRatePct: number): number {
  return (Number(annualRatePct) || 0) / 12;
}

export interface AmortizationRow {
  n: number;
  date: string;          // ISO yyyy-mm-dd
  interest: number;
  capital: number;
  balanceCapital: number; // saldo de capital tras el pago
  balanceTotal: number;   // saldo total (suma de cuotas restantes) tras el pago
  installment: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Genera fechas de cuota: quincenal → días 1 y 16; mensual → mismo día cada mes. */
function installmentDates(startDate: string, count: number, frequency: LoanFrequency): string[] {
  const out: string[] = [];
  const base = startDate ? new Date(startDate + "T00:00:00") : new Date();
  if (frequency === "quincenal") {
    let y = base.getFullYear();
    let m = base.getMonth();
    let day = base.getDate() <= 15 ? 1 : 16;
    for (let i = 0; i < count; i++) {
      out.push(new Date(y, m, day).toISOString().slice(0, 10));
      if (day === 1) { day = 16; }
      else { day = 1; m += 1; if (m > 11) { m = 0; y += 1; } }
    }
  } else {
    const day = base.getDate();
    for (let i = 0; i < count; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, day);
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

/**
 * Hoja de amortización francesa (cuota fija) idéntica a la de GENERAL.
 * cuota = P · i / (1 − (1+i)^−n), con i = tasa mensual y n = número de cuotas.
 */
export function generateAmortizationSchedule(
  amount: number,
  installments: number,
  annualRatePct: number,
  startDate: string,
  frequency: LoanFrequency,
): { rows: AmortizationRow[]; installment: number; totalInterest: number; totalToPay: number } {
  const P = Number(amount) || 0;
  const n = Math.max(1, Math.round(Number(installments) || 1));
  const i = periodRatePct(annualRatePct) / 100;
  const cuota = i > 0 ? (P * i) / (1 - Math.pow(1 + i, -n)) : P / n;
  const installment = round2(cuota);
  const dates = installmentDates(startDate, n, frequency);

  // Primera pasada: calcular pagos de cada cuota (la última cierra el saldo).
  const pays: number[] = [];
  let bal = P;
  for (let k = 0; k < n; k++) {
    const interest = round2(bal * i);
    let capital = round2(installment - interest);
    let pay = installment;
    if (k === n - 1) { capital = round2(bal); pay = round2(capital + interest); }
    bal = round2(bal - capital);
    pays.push(pay);
  }

  const rows: AmortizationRow[] = [];
  let balance = P;
  let totalInterest = 0;
  for (let k = 0; k < n; k++) {
    const interest = round2(balance * i);
    let capital = round2(installment - interest);
    if (k === n - 1) { capital = round2(balance); }
    balance = round2(balance - capital);
    totalInterest = round2(totalInterest + interest);
    // Saldo total tras este pago = suma de las cuotas que aún faltan.
    const balanceTotal = round2(pays.slice(k + 1).reduce((s, p) => s + p, 0));
    rows.push({
      n: k + 1,
      date: dates[k],
      interest,
      capital,
      balanceCapital: Math.max(0, balance),
      balanceTotal,
      installment: pays[k],
    });
  }
  return { rows, installment, totalInterest, totalToPay: round2(P + totalInterest) };
}


/**
 * Calcula cuota mensual (amortización francesa, tasa mensual).
 */
export function calcMonthlyInstallment(amount: number, termMonths: number, annualRatePct: number): number {
  const n = Math.max(1, Number(termMonths) || 1);
  const plan = generateAmortizationSchedule(amount, n, annualRatePct, "", "mensual");
  return Math.round(plan.installment);
}

/**
 * Cálculo de cuota según frecuencia de descuento, usando amortización francesa
 * con tasa mensual (igual que el software GENERAL).
 *  - mensual:   n = plazoMeses
 *  - quincenal: n = plazoMeses × 2 (dos cuotas por mes)
 */
export function calcLoanPlan(
  amount: number,
  termMonths: number,
  annualRatePct: number,
  frequency: LoanFrequency,
  startDate?: string,
) {
  const months = Math.max(1, Number(termMonths) || 1);
  const installments = frequency === "quincenal" ? months * 2 : months;
  const sched = generateAmortizationSchedule(amount, installments, annualRatePct, startDate || "", frequency);
  return {
    frequency,
    months,
    installments,
    installment: Math.round(sched.installment),
    installmentExact: sched.installment,
    totalInterest: Math.round(sched.totalInterest),
    totalToPay: Math.round(sched.totalToPay),
    schedule: sched.rows,
  };
}

/**
 * Cuota máxima permitida por período según la frecuencia.
 * La política interna limita el descuento a 1/6 del INGRESO del período:
 *  - mensual:   salario_mensual × fracción (1/6)
 *  - quincenal: (salario_mensual / 2) × fracción  → mitad del tope mensual
 */
export function maxInstallmentByFrequency(
  monthlySalary: number,
  frequency: LoanFrequency,
  fraction = 1 / 6,
): number {
  const salary = Number(monthlySalary) || 0;
  const periodIncome = frequency === "quincenal" ? salary / 2 : salary;
  return Math.round(periodIncome * fraction);
}
