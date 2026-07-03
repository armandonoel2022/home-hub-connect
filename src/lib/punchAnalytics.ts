/**
 * Análisis y comparación de reportes de Punches (Active Track / bastones).
 *
 * Dos utilidades:
 *   1. analyzePunchTiming(report): media de tiempos de las rondas — cuántos
 *      punches por cuenta, intervalo medio entre punches, hora media del día y
 *      duración de la cobertura. Sirve para entender el ritmo con el que los
 *      bastones (Active Track) hacen las rondas.
 *   2. diffPunchReports(prev, curr): compara el reporte actual contra el
 *      anterior por cuenta (más/menos punches, cumplimiento mejor/peor, nuevas
 *      o desaparecidas). Alimenta la comparación "vs. reporte anterior".
 */
import type { PunchParsedReport, PunchClientSummary, PunchRow } from "./punchHtmParser";

// ──────────────────────────────────────────────────────────────
// 1. Media de tiempos de punches
// ──────────────────────────────────────────────────────────────

export interface PunchTiming {
  accountCode: string;
  accountName: string;
  punchCount: number;
  uniquePoints: number;
  first: string | null;
  last: string | null;
  /** Media (min) entre punches consecutivos. null si hay <2 punches. */
  avgIntervalMin: number | null;
  /** Mediana (min) entre punches consecutivos. */
  medianIntervalMin: number | null;
  /** Duración total cubierta (min) entre el primer y el último punch. */
  spanMin: number | null;
  /** Hora media del día de los punches → "HH:MM". */
  avgTimeOfDay: string | null;
  source?: PunchClientSummary["source"];
}

export interface PunchTimingSummary {
  perClient: PunchTiming[];
  totalPunches: number;
  totalClients: number;
  avgPunchesPerClient: number;
  /** Intervalo medio global entre punches (min), promediando cuentas con ≥2 punches. */
  avgIntervalMin: number | null;
  /** Hora media global del día de todos los punches → "HH:MM". */
  avgTimeOfDay: string | null;
}

function intervalsMin(punches: PunchRow[]): number[] {
  const times = punches
    .map(p => (p.receivedAt ? new Date(p.receivedAt).getTime() : NaN))
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < times.length; i++) out.push((times[i] - times[i - 1]) / 60_000);
  return out;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function avgTimeOfDay(punches: PunchRow[]): string | null {
  const mins = punches
    .map(p => (p.receivedAt ? new Date(p.receivedAt) : null))
    .filter((d): d is Date => !!d && !isNaN(d.getTime()))
    .map(d => d.getHours() * 60 + d.getMinutes());
  if (mins.length === 0) return null;
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  const h = Math.floor(avg / 60) % 24;
  const m = avg % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function analyzePunchTiming(report: PunchParsedReport | null): PunchTimingSummary {
  const empty: PunchTimingSummary = {
    perClient: [], totalPunches: 0, totalClients: 0,
    avgPunchesPerClient: 0, avgIntervalMin: null, avgTimeOfDay: null,
  };
  if (!report) return empty;

  const perClient: PunchTiming[] = report.clients
    .filter(c => c.punches.length > 0)
    .map(c => {
      const iv = intervalsMin(c.punches);
      const avgInterval = iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : null;
      const first = c.firstPunch;
      const last = c.lastPunch;
      const spanMin = first && last
        ? (new Date(last).getTime() - new Date(first).getTime()) / 60_000
        : null;
      return {
        accountCode: c.accountCode,
        accountName: c.accountName,
        punchCount: c.punches.length,
        uniquePoints: c.uniquePoints.length,
        first, last,
        avgIntervalMin: avgInterval !== null ? Math.round(avgInterval) : null,
        medianIntervalMin: iv.length ? Math.round(median(iv)!) : null,
        spanMin: spanMin !== null ? Math.round(spanMin) : null,
        avgTimeOfDay: avgTimeOfDay(c.punches),
        source: c.source,
      };
    })
    .sort((a, b) => b.punchCount - a.punchCount);

  const totalPunches = perClient.reduce((a, c) => a + c.punchCount, 0);
  const withIv = perClient.filter(c => c.avgIntervalMin !== null);
  const avgIntervalMin = withIv.length
    ? Math.round(withIv.reduce((a, c) => a + (c.avgIntervalMin || 0), 0) / withIv.length)
    : null;
  const allPunches = report.clients.flatMap(c => c.punches);

  return {
    perClient,
    totalPunches,
    totalClients: perClient.length,
    avgPunchesPerClient: perClient.length ? Math.round((totalPunches / perClient.length) * 10) / 10 : 0,
    avgIntervalMin,
    avgTimeOfDay: avgTimeOfDay(allPunches),
  };
}

/** Formatea minutos como "1h 20m" / "45m". */
export function fmtMinutes(min: number | null): string {
  if (min === null || isNaN(min)) return "—";
  const abs = Math.abs(Math.round(min));
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ──────────────────────────────────────────────────────────────
// 2. Comparación entre dos reportes de punches
// ──────────────────────────────────────────────────────────────

type Compliance = PunchClientSummary["compliance"];
const COMPLIANCE_RANK: Record<Compliance, number> = {
  ok: 3, partial: 2, missed: 1, "no-rules": 0,
};

export type PunchChangeDirection = "worse" | "better" | "same" | "new" | "gone";

export interface PunchChange {
  accountCode: string;
  accountName: string;
  prevCount: number | null;
  currCount: number | null;
  deltaCount: number | null;
  prevCompliance: Compliance | null;
  currCompliance: Compliance | null;
  direction: PunchChangeDirection;
}

export interface PunchDiff {
  byCode: Map<string, PunchChange>;
  better: PunchChange[];
  worse: PunchChange[];
  added: PunchChange[];
  gone: PunchChange[];
  hasPrev: boolean;
}

function keyOf(c: PunchClientSummary): string {
  return (c.accountCode || c.accountName).trim();
}

export function diffPunchReports(
  prev: PunchParsedReport | null | undefined,
  curr: PunchParsedReport | null | undefined,
): PunchDiff {
  const byCode = new Map<string, PunchChange>();
  const empty: PunchDiff = { byCode, better: [], worse: [], added: [], gone: [], hasPrev: false };
  if (!curr) return empty;

  const prevMap = new Map<string, PunchClientSummary>();
  (prev?.clients || []).forEach(c => prevMap.set(keyOf(c), c));
  const currMap = new Map<string, PunchClientSummary>();
  curr.clients.forEach(c => currMap.set(keyOf(c), c));
  const hasPrev = !!prev && prevMap.size > 0;

  curr.clients.forEach(c => {
    const k = keyOf(c);
    const p = prevMap.get(k);
    const currCount = c.punches.length;
    const prevCount = p ? p.punches.length : null;

    let direction: PunchChangeDirection;
    if (!p) direction = hasPrev ? "new" : "same";
    else {
      const rc = COMPLIANCE_RANK[c.compliance];
      const rp = COMPLIANCE_RANK[p.compliance];
      if (rc > rp) direction = "better";
      else if (rc < rp) direction = "worse";
      else if (currCount > (prevCount || 0)) direction = "better";
      else if (currCount < (prevCount || 0)) direction = "worse";
      else direction = "same";
    }

    byCode.set(k, {
      accountCode: c.accountCode,
      accountName: c.accountName,
      prevCount, currCount,
      deltaCount: prevCount !== null ? currCount - prevCount : null,
      prevCompliance: p?.compliance ?? null,
      currCompliance: c.compliance,
      direction,
    });
  });

  if (hasPrev) {
    prevMap.forEach((p, k) => {
      if (currMap.has(k)) return;
      byCode.set(k, {
        accountCode: p.accountCode,
        accountName: p.accountName,
        prevCount: p.punches.length, currCount: null, deltaCount: null,
        prevCompliance: p.compliance, currCompliance: null,
        direction: "gone",
      });
    });
  }

  const all = Array.from(byCode.values());
  return {
    byCode,
    better: all.filter(c => c.direction === "better"),
    worse: all.filter(c => c.direction === "worse"),
    added: all.filter(c => c.direction === "new"),
    gone: all.filter(c => c.direction === "gone"),
    hasPrev,
  };
}
