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

const DEFAULT: LoanSettings = {
  annualInterestRatePct: 0,
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
 * Calcula prestaciones acumuladas aproximadas + cuota máxima.
 * - Vacaciones acumuladas = (días laborados / 365) * salario mensual
 * - Salario 13 acumulado  = salario mensual * (mes actual / 12)
 * - Cuota máxima          = salario mensual * maxInstallmentFraction
 */
export function calcLoanCapacity(monthlySalary: number, hireDate?: string | null, fraction = 1 / 6) {
  const salary = Number(monthlySalary) || 0;
  let vacaciones = 0;
  let salario13 = 0;
  if (hireDate) {
    const hire = new Date(hireDate);
    const now = new Date();
    const days = Math.max(0, (now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));
    vacaciones = (days / 365) * salary;
    salario13 = salary * (now.getMonth() / 12); // mes 0-indexed -> proporcional al transcurrido
  }
  const maxAvailable = vacaciones + salario13;
  const maxInstallment = salary * fraction;
  return {
    monthlySalary: salary,
    vacaciones: Math.round(vacaciones),
    salario13: Math.round(salario13),
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
