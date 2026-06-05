/**
 * Cortes de nómina SafeOne:
 *  - Corte 1: del 01 al 15 de cada mes  → pago el día 22 del mismo mes
 *  - Corte 2: del 16 al último día      → pago el día 7 del mes siguiente
 *
 * Las horas extras, días feriados e incentivos se pagan 7 días después del corte.
 */

export interface PayrollCutoff {
  /** Identificador del corte, ej. "2026-06-Q1" */
  id: string;
  /** Etiqueta legible, ej. "01–15 jun 2026" */
  label: string;
  /** Fecha de inicio del corte (yyyy-MM-dd) */
  start: string;
  /** Fecha de fin del corte (yyyy-MM-dd) */
  end: string;
  /** Fecha de pago (yyyy-MM-dd) */
  payDate: string;
  /** Etiqueta de la fecha de pago, ej. "22 jun 2026" */
  payLabel: string;
}

const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmt(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

/** Devuelve el corte de nómina al que pertenece una fecha (yyyy-MM-dd). */
export function getCutoffForDate(dateStr: string): PayrollCutoff {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const m = (mo || 1) - 1; // 0-indexed
  const day = d || 1;

  if (day <= 15) {
    // Corte 1: 01–15, pago el 22 del mismo mes
    return {
      id: `${y}-${pad(m + 1)}-Q1`,
      label: `01–15 ${MONTHS[m]} ${y}`,
      start: fmt(y, m, 1),
      end: fmt(y, m, 15),
      payDate: fmt(y, m, 22),
      payLabel: `22 ${MONTHS[m]} ${y}`,
    };
  }

  // Corte 2: 16–fin de mes, pago el 7 del mes siguiente
  const last = lastDayOfMonth(y, m);
  const nextM = m === 11 ? 0 : m + 1;
  const nextY = m === 11 ? y + 1 : y;
  return {
    id: `${y}-${pad(m + 1)}-Q2`,
    label: `16–${last} ${MONTHS[m]} ${y}`,
    start: fmt(y, m, 16),
    end: fmt(y, m, last),
    payDate: fmt(nextY, nextM, 7),
    payLabel: `7 ${MONTHS[nextM]} ${nextY}`,
  };
}
