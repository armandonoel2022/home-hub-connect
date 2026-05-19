/**
 * Operadores del centro de monitoreo SafeOne y reglas de asignación por horario.
 *
 * Turnos:
 *  - Día (07:00–18:59): Brandon Díaz, César Pérez (atienden cuentas con cierre diurno)
 *  - Noche (19:00–06:59): Alejandro Alcántara, Bradelin Almonte (se turnan por noche
 *    pero comparten siempre el listado nocturno)
 *
 * La asignación sugerida por LX se calcula a partir de `expectedClose` (si existe,
 * fallback a `expectedOpen`). LX sin horarios definidos quedan en el pool "Sin asignar".
 *
 * Esta lista es estática (no requiere backend) para mantener simple la edición,
 * pero la asignación efectiva por LX se persiste en `monitoringAccountSettings.operatorId`.
 */
export type OperatorShift = "day" | "night" | "any";

export interface MonitoringOperator {
  id: string;
  name: string;
  email?: string;
  shift: OperatorShift;
  /** Etiqueta corta para chips */
  short: string;
  /** Color tailwind para badges */
  color: string;
}

export const MONITORING_OPERATORS: MonitoringOperator[] = [
  { id: "OP-BDIAZ", name: "Brandon Díaz", email: "bdiaz@safeone.com.do",
    shift: "day", short: "Brandon", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { id: "OP-CPEREZ", name: "César Pérez", email: "cperez@safeone.com.do",
    shift: "day", short: "César", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
  { id: "OP-AALCANTARA", name: "Alejandro Alcántara", email: "aalcantara@safeone.com.do",
    shift: "night", short: "Alejandro", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
  { id: "OP-BALMONTE", name: "Bradelin Almonte", email: "balmonte@safeone.com.do",
    shift: "night", short: "Bradelin", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
];

export const OPERATORS_BY_ID = new Map(MONITORING_OPERATORS.map(o => [o.id, o]));

export function getOperator(id?: string | null): MonitoringOperator | undefined {
  if (!id) return undefined;
  return OPERATORS_BY_ID.get(id);
}

/** Convierte "HH:MM" a minutos desde medianoche. Devuelve null si inválido. */
function timeToMin(t?: string | null): number | null {
  if (!t || typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Devuelve el turno sugerido a partir del horario de cierre (o apertura como fallback).
 *  - Cierre entre 07:00 y 18:59 → día
 *  - Cierre entre 19:00 y 06:59 → noche
 *  - Sin horario → null (queda sin asignar)
 */
export function suggestShift(expectedOpen?: string | null, expectedClose?: string | null): OperatorShift | null {
  const ref = timeToMin(expectedClose) ?? timeToMin(expectedOpen);
  if (ref === null) return null;
  if (ref >= 7 * 60 && ref < 19 * 60) return "day";
  return "night";
}

/**
 * Sugiere un operador concreto. Para día rota entre Brandon y César por hash
 * del accountCode (estable). Para noche devuelve un placeholder "shared-night"
 * que el UI puede interpretar como "ambos turnos nocturnos lo ven".
 */
export function suggestOperator(accountCode: string, expectedOpen?: string | null,
                                expectedClose?: string | null): string | null {
  const shift = suggestShift(expectedOpen, expectedClose);
  if (!shift) return null;
  if (shift === "night") return "OP-NIGHT-SHARED"; // listado compartido
  // distribuir entre Brandon y César de forma determinista
  const dayOps = MONITORING_OPERATORS.filter(o => o.shift === "day");
  if (dayOps.length === 0) return null;
  const hash = Array.from(accountCode).reduce((a, c) => a + c.charCodeAt(0), 0);
  return dayOps[hash % dayOps.length].id;
}

/** Devuelve true si la asignación corresponde al pool nocturno compartido. */
export function isSharedNight(operatorId?: string | null): boolean {
  return operatorId === "OP-NIGHT-SHARED";
}

export const NIGHT_SHARED_LABEL = "Turno Nocturno (compartido)";
export const NIGHT_OPERATORS = MONITORING_OPERATORS.filter(o => o.shift === "night");
export const DAY_OPERATORS = MONITORING_OPERATORS.filter(o => o.shift === "day");
