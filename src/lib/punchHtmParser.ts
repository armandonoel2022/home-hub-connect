/**
 * Parser para reportes HTM de "Resumen de señales" tipo Active Track (punches/rondas)
 * exportados desde Kronos NET 3.x.
 *
 * El parser NO conoce las reglas de cumplimiento. Devuelve los punches agrupados por
 * cliente. La evaluación de rondas (con tolerancia y precisión) se hace fuera con
 * `evaluatePunchReport(report, rules)`, donde `rules` viene del backend
 * (`/api/monitoring-punch-rules`). Así, al recargar reglas no hay que reprocesar el HTM.
 */
import type { PunchRule } from "./api";

export interface PunchRow {
  receivedAt: string | null; // ISO
  accountCode: string;
  device: string;
  pointDescription: string;
  hardware: string;
  accountName: string;
  code: string;
}

export interface ExpectedRound {
  time: string;             // "HH:MM"
  toleranceMin: number;
  precisionMin: number;
  matched: boolean;         // dentro de toleranceMin
  precise: boolean;         // dentro de precisionMin
  matchedAt?: string;       // ISO del punch elegido
  matchedPoint?: string;
  deviationMin?: number;    // signed: negativo = antes, positivo = después
}

export interface PunchClientSummary {
  accountName: string;
  accountCode: string;
  punches: PunchRow[];
  uniquePoints: string[];
  firstPunch: string | null;
  lastPunch: string | null;
  expectedRounds: ExpectedRound[];   // [] si no aplica para este cliente
  ruleLabel?: string;
  compliance: "ok" | "partial" | "missed" | "no-rules";
}

export interface PunchParsedReport {
  reportDate: string | null;
  reportPeriod: string | null;
  generatedAt: string;
  rawRowCount: number;
  clients: PunchClientSummary[];
  fileName?: string;
}

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})[\sT\u00A0]+(\d{1,2}):(\d{2})(?::(\d{2}))?/;

function clean(s: string): string {
  return (s || "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateTime(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(DATE_RE);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +(s || "0"));
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function decodeBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

function findOfficialTable(doc: Document): HTMLTableElement | null {
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const t of tables) {
    const headers = Array.from(t.querySelectorAll("th, td"))
      .slice(0, 30)
      .map(c => clean(c.textContent || "").toLowerCase());
    const joined = headers.join(" | ");
    if (joined.includes("tiempo de recepción")
      && joined.includes("no de cuenta")
      && joined.includes("descripción")
      && joined.includes("nombre de cuenta")) {
      return t as HTMLTableElement;
    }
  }
  return null;
}

function extractRows(table: HTMLTableElement): PunchRow[] {
  const out: PunchRow[] = [];
  const rows = Array.from(table.querySelectorAll("tr"));
  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length < 7) continue;
    const cells = tds.map(td => clean(td.textContent || ""));
    const iso = parseDateTime(cells[0]);
    if (!iso) continue;
    out.push({
      receivedAt: iso,
      accountCode: cells[1],
      device: cells[2],
      pointDescription: cells[3],
      hardware: cells[4],
      accountName: cells[5],
      code: cells[6],
    });
  }
  return out;
}

export async function parsePunchHtmFile(file: File): Promise<PunchParsedReport> {
  const text = decodeBuffer(await file.arrayBuffer());
  const doc = new DOMParser().parseFromString(text, "text/html");

  let reportDate: string | null = null;
  let reportPeriod: string | null = null;
  Array.from(doc.querySelectorAll("body *")).slice(0, 60).forEach(n => {
    const t = clean(n.textContent || "");
    if (!reportDate && DATE_RE.test(t) && /Monitoring|Kronos/i.test(t)) {
      reportDate = parseDateTime(t);
    }
    if (!reportPeriod && /^Periodo:/i.test(t)) reportPeriod = t;
  });

  const table = findOfficialTable(doc);
  const rows = table ? extractRows(table) : [];
  rows.sort((a, b) => (a.receivedAt || "").localeCompare(b.receivedAt || ""));

  const groups = new Map<string, PunchRow[]>();
  rows.forEach(r => {
    const key = r.accountName || r.accountCode;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  const clients: PunchClientSummary[] = [];
  groups.forEach((punches, name) => {
    clients.push({
      accountName: name,
      accountCode: punches[0]?.accountCode || "",
      punches,
      uniquePoints: Array.from(new Set(punches.map(p => p.pointDescription))).filter(Boolean),
      firstPunch: punches[0]?.receivedAt || null,
      lastPunch: punches[punches.length - 1]?.receivedAt || null,
      expectedRounds: [],
      compliance: "no-rules",
    });
  });

  return {
    reportDate,
    reportPeriod,
    generatedAt: new Date().toISOString(),
    rawRowCount: rows.length,
    clients,
    fileName: file.name,
  };
}

// ──────────────────────────────────────────────────────────────
// Evaluación de cumplimiento (puede correr cuando llegan las reglas)
// ──────────────────────────────────────────────────────────────

function findMatchingRule(accountName: string, rules: PunchRule[]): PunchRule | null {
  const name = accountName.toUpperCase();
  for (const r of rules) {
    if (!r.active) continue;
    const pattern = (r.clientPattern || "").toUpperCase().trim();
    if (!pattern) continue;
    if (name.includes(pattern)) return r;
  }
  return null;
}

function buildExpectedRounds(rule: PunchRule, punches: PunchRow[], reportDate: string | null): ExpectedRound[] {
  const ref = reportDate ? new Date(reportDate)
    : (punches.length ? new Date(punches[punches.length - 1].receivedAt!) : new Date());
  return rule.rounds.map(r => {
    const [h, m] = r.time.split(":").map(Number);
    const target = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), h, m, 0);
    const tolMs = r.toleranceMin * 60_000;

    // Punch más cercano al objetivo
    let best: PunchRow | null = null;
    let bestDiff = Infinity;
    for (const p of punches) {
      if (!p.receivedAt) continue;
      const diff = new Date(p.receivedAt).getTime() - target.getTime();
      if (Math.abs(diff) < Math.abs(bestDiff)) { best = p; bestDiff = diff; }
    }
    const within = best !== null && Math.abs(bestDiff) <= tolMs;
    const deviationMin = best ? Math.round(bestDiff / 60_000) : undefined;
    const precise = within && Math.abs(deviationMin!) <= r.precisionMin;

    return {
      time: r.time,
      toleranceMin: r.toleranceMin,
      precisionMin: r.precisionMin,
      matched: within,
      precise,
      matchedAt: within ? best!.receivedAt! : undefined,
      matchedPoint: within ? best!.pointDescription : undefined,
      deviationMin: within ? deviationMin : undefined,
    };
  });
}

/** Aplica un set de reglas y devuelve un nuevo report con expectedRounds + compliance recalculados. */
export function evaluatePunchReport(report: PunchParsedReport, rules: PunchRule[]): PunchParsedReport {
  const clients = report.clients.map(c => {
    const rule = findMatchingRule(c.accountName, rules);
    if (!rule) {
      return { ...c, expectedRounds: [], ruleLabel: undefined, compliance: "no-rules" as const };
    }
    const expected = buildExpectedRounds(rule, c.punches, report.reportDate);
    let compliance: PunchClientSummary["compliance"];
    if (expected.every(r => r.matched)) compliance = "ok";
    else if (expected.some(r => r.matched)) compliance = "partial";
    else compliance = "missed";
    return { ...c, expectedRounds: expected, ruleLabel: rule.label, compliance };
  });

  const order: Record<PunchClientSummary["compliance"], number> = { missed: 0, partial: 1, ok: 2, "no-rules": 3 };
  clients.sort((a, b) => order[a.compliance] - order[b.compliance] || a.accountName.localeCompare(b.accountName));
  return { ...report, clients };
}
