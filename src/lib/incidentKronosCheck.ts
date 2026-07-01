/**
 * Contraste de Incidencias con Actividad Kronos.
 *
 * Cruza una incidencia (por código de cuenta) contra la fila correspondiente del
 * último reporte Kronos para inferir si el problema sigue ocurriendo o si la
 * cuenta ya se recuperó (posiblemente resuelta). No cambia el estado de la
 * incidencia: solo sugiere al operador.
 */
import type { KronosAccountRow } from "./kronosHtmParser";

export type IncidentKronosVerdict = "persiste" | "posible-resuelta" | "sin-datos";

export interface IncidentKronosAssessment {
  verdict: IncidentKronosVerdict;
  label: string;
  detail: string;
  lastSignal: string | null;
  daysSince: number | null;
}

/**
 * @param incidentCreatedAt ISO de creación de la incidencia (para saber si la
 *        señal reciente es POSTERIOR a la incidencia).
 * @param row fila Kronos de la cuenta (o undefined si no aparece en el reporte).
 * @param reportDate ISO del reporte Kronos usado.
 */
export function assessIncidentVsKronos(
  incidentCreatedAt: string,
  row: KronosAccountRow | undefined,
  reportDate: string | null,
): IncidentKronosAssessment {
  if (!row) {
    return {
      verdict: "sin-datos",
      label: "Sin datos Kronos",
      detail: "La cuenta no aparece en el reporte Kronos cargado.",
      lastSignal: null,
      daysSince: null,
    };
  }

  const lastSignal = row.lastSignal;
  const daysSince = row.daysSince;

  // ¿La última señal es posterior (o del mismo día) a la creación de la incidencia?
  const created = new Date(incidentCreatedAt).getTime();
  const signalTime = lastSignal ? new Date(lastSignal).getTime() : null;
  const signalAfterIncident = signalTime !== null && signalTime >= created;

  // Recuperación: señal reciente (criticidad ok/baja) y posterior a la incidencia,
  // o ciclo apertura/cierre el día del reporte.
  const recentlyActive = row.criticidad === "ok" || row.criticidad === "baja";
  const recovered = (recentlyActive && signalAfterIncident) || (row.sameDayCycle && signalAfterIncident);

  if (recovered) {
    return {
      verdict: "posible-resuelta",
      label: "Posiblemente resuelta",
      detail: `La cuenta reportó señal el ${fmt(lastSignal)}, después de creada la incidencia.`,
      lastSignal,
      daysSince,
    };
  }

  const detail = lastSignal
    ? `Última señal ${fmt(lastSignal)} (${daysSince ?? "?"} día(s) sin actividad).`
    : "Sin señal registrada en el reporte.";
  return {
    verdict: "persiste",
    label: "Sigue ocurriendo",
    detail,
    lastSignal,
    daysSince,
  };
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
}
