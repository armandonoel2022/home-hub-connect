/**
 * Derecho de vacaciones proyectado (Art. 177 CT + política SafeOne).
 *
 * Regla: los días se acreditan según la antigüedad que el colaborador tendrá
 * AL INICIAR el período solicitado, no según la antigüedad de hoy. Es decir,
 * puede solicitar por adelantado vacaciones cuyo inicio sea posterior a la
 * fecha en la que cumple la antigüedad requerida, pero no puede disfrutarlas
 * antes de ese momento.
 *
 *   < 6 meses  → 0 días
 *   6–11 meses → proporcional (6 meses = 7 días)
 *   1–4 años   → 14 días
 *   >= 5 años  → 18 días
 */

export interface VacationPolicyLike {
  under5Days: number;
  from5Days: number;
  tenureThresholdYears: number;
}

export const DEFAULT_VACATION_POLICY: VacationPolicyLike = {
  under5Days: 14,
  from5Days: 18,
  tenureThresholdYears: 5,
};

export interface ServiceTime { years: number; months: number; days: number; totalMonths: number }

/** Tiempo de servicio a una fecha dada (por defecto hoy). */
export function serviceTimeAt(hireDate?: string | null, at?: Date | string | null): ServiceTime | null {
  if (!hireDate) return null;
  const d = new Date(hireDate);
  if (isNaN(d.getTime())) return null;
  const now = at ? new Date(at) : new Date();
  if (isNaN(now.getTime())) return null;
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  let days = now.getDate() - d.getDate();
  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months, days, totalMonths: years * 12 + months };
}

/** Suma meses a una fecha y devuelve ISO yyyy-mm-dd. */
export function addMonthsISO(hireDate?: string | null, months = 0): string | null {
  if (!hireDate) return null;
  const d = new Date(hireDate);
  if (isNaN(d.getTime())) return null;
  const day = d.getDate();
  const out = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${out.getFullYear()}-${pad(out.getMonth() + 1)}-${pad(out.getDate())}`;
}

/** Días de vacaciones acreditados a una fecha determinada. */
export function entitledDaysAt(
  hireDate?: string | null,
  at?: Date | string | null,
  policy: VacationPolicyLike = DEFAULT_VACATION_POLICY,
): number | null {
  const s = serviceTimeAt(hireDate, at);
  if (!s) return null;
  if (s.years >= policy.tenureThresholdYears) return policy.from5Days;
  if (s.years >= 1) return policy.under5Days;
  if (s.totalMonths < 6) return 0;
  return Math.floor((policy.under5Days * s.totalMonths) / 12);
}

/** Fecha (ISO) a partir de la cual el colaborador puede disfrutar vacaciones. */
export function eligibleFrom(hireDate?: string | null): string | null {
  return addMonthsISO(hireDate, 6);
}

/** Hitos de antigüedad relevantes. */
export function tenureMilestones(hireDate?: string | null, policy: VacationPolicyLike = DEFAULT_VACATION_POLICY) {
  return {
    seisMeses: addMonthsISO(hireDate, 6),
    unAnio: addMonthsISO(hireDate, 12),
    cincoAnios: addMonthsISO(hireDate, 12 * (policy.tenureThresholdYears || 5)),
  };
}

/** Próximo hito con más días que los acreditados a `at`. */
export function nextMilestone(
  hireDate?: string | null,
  at?: Date | string | null,
  policy: VacationPolicyLike = DEFAULT_VACATION_POLICY,
): { date: string; days: number } | null {
  const current = entitledDaysAt(hireDate, at, policy);
  if (current == null) return null;
  const m = tenureMilestones(hireDate, policy);
  const ladder: Array<{ date: string | null; days: number }> = [
    { date: m.seisMeses, days: Math.floor(policy.under5Days / 2) },
    { date: m.unAnio, days: policy.under5Days },
    { date: m.cincoAnios, days: policy.from5Days },
  ];
  const found = ladder.find((x) => !!x.date && x.days > current);
  return found && found.date ? { date: found.date, days: found.days } : null;
}
