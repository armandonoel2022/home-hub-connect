/**
 * Helper de feriados de República Dominicana.
 * Carga la lista del backend (Nager.Date + cache local + ajustes manuales) y
 * expone utilidades para saber si una fecha es feriado y el día de semana lógico.
 */
import { holidaysApi, type Holiday, type DiaSemana } from "@/lib/api";

let cache: Record<number, Holiday[]> = {};

export async function loadHolidays(year: number): Promise<Holiday[]> {
  if (cache[year]) return cache[year];
  try {
    const res = await holidaysApi.list(year);
    cache[year] = res.items || [];
  } catch {
    cache[year] = [];
  }
  return cache[year];
}

export function clearHolidayCache() {
  cache = {};
}

export function isHoliday(dateISO: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === dateISO);
}

export function getHolidayName(dateISO: string, holidays: Holiday[]): string | null {
  return holidays.find((h) => h.date === dateISO)?.name || null;
}

const DOW: DiaSemana[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/** Día de semana en español (sin tilde, llave de la plantilla). */
export function weekdayKey(dateISO: string): DiaSemana {
  // Parse seguro evitando desfases de zona horaria.
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return DOW[dt.getDay()];
}

/** Clasificación del día: 'feriado' si la fecha es feriado RD, si no el día de semana. */
export function dayClassification(dateISO: string, holidays: Holiday[]): DiaSemana {
  if (isHoliday(dateISO, holidays)) return "feriado";
  return weekdayKey(dateISO);
}

export const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
  feriado: "Feriado",
};

export const DIAS_ORDEN: DiaSemana[] = [
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo", "feriado",
];
