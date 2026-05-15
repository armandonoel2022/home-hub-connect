/**
 * Parser para reportes HTM de "Resumen de señales" tipo Active Track (punches/rondas)
 * exportados desde Kronos NET 3.x.
 *
 * Tabla con 9 columnas:
 *   Tiempo de recepción | No de cuenta | Dispositivo | Descripción |
 *   No hardware | Nombre de cuenta | Código | Extensión 1 | Extensión 2
 *
 * Cada fila representa un punch (lectura de un punto físico). Agrupamos por
 * "Nombre de cuenta" y evaluamos si las rondas esperadas se cumplieron según
 * la configuración por cliente.
 *
 * Configuración Spirit Apparel (NAVE B6, NAVE A18, NAVE A3): rondas requeridas
 * a las 03:30 y 05:00 con tolerancia ±60 minutos. Para los demás clientes solo
 * resumimos los punches sin verificar horarios.
 */

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
  time: string;          // "HH:MM"
  toleranceMin: number;  // ±minutos para considerar la ronda cumplida
  matched: boolean;
  matchedAt?: string;    // ISO de un punch dentro de la ventana
  matchedPoint?: string;
}

export interface PunchClientSummary {
  accountName: string;
  accountCode: string;
  punches: PunchRow[];
  uniquePoints: string[];
  firstPunch: string | null;
  lastPunch: string | null;
  expectedRounds: ExpectedRound[];   // [] si no aplica para este cliente
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
    if (!iso) continue; // header u otra fila
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

// ──────────────────────────────────────────────────────────────
// Reglas por cliente — Spirit Apparel naves B6/A18/A3
// ──────────────────────────────────────────────────────────────
const SPIRIT_RE = /SPIRIT.*NAVE\s*(B6|A18|A3)\b/i;
const SPIRIT_ROUNDS = ["03:30", "05:00"];
const SPIRIT_TOLERANCE_MIN = 60; // ±60 minutos para considerar la ronda completada

export function getExpectedRoundsFor(accountName: string): { times: string[]; toleranceMin: number } | null {
  if (SPIRIT_RE.test(accountName)) return { times: SPIRIT_ROUNDS, toleranceMin: SPIRIT_TOLERANCE_MIN };
  return null;
}

function buildExpected(rounds: { times: string[]; toleranceMin: number }, punches: PunchRow[], reportDate: string | null): ExpectedRound[] {
  const ref = reportDate ? new Date(reportDate) : (punches[0]?.receivedAt ? new Date(punches[0].receivedAt) : new Date());
  // Buscar las rondas en el día más reciente de los punches
  const lastDay = punches.length ? new Date(punches[punches.length - 1].receivedAt!) : ref;
  return rounds.times.map(t => {
    const [h, m] = t.split(":").map(Number);
    const target = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), h, m, 0);
    const winMs = rounds.toleranceMin * 60 * 1000;
    const match = punches.find(p => {
      if (!p.receivedAt) return false;
      const diff = Math.abs(new Date(p.receivedAt).getTime() - target.getTime());
      return diff <= winMs;
    });
    return {
      time: t,
      toleranceMin: rounds.toleranceMin,
      matched: !!match,
      matchedAt: match?.receivedAt || undefined,
      matchedPoint: match?.pointDescription || undefined,
    };
  });
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

  // Agrupar por accountName (o accountCode si vacío)
  const groups = new Map<string, PunchRow[]>();
  rows.forEach(r => {
    const key = r.accountName || r.accountCode;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  const clients: PunchClientSummary[] = [];
  groups.forEach((punches, name) => {
    const rounds = getExpectedRoundsFor(name);
    const expected = rounds ? buildExpected(rounds, punches, reportDate) : [];
    let compliance: PunchClientSummary["compliance"];
    if (!rounds) compliance = "no-rules";
    else if (expected.every(r => r.matched)) compliance = "ok";
    else if (expected.some(r => r.matched)) compliance = "partial";
    else compliance = "missed";

    clients.push({
      accountName: name,
      accountCode: punches[0]?.accountCode || "",
      punches,
      uniquePoints: Array.from(new Set(punches.map(p => p.pointDescription))).filter(Boolean),
      firstPunch: punches[0]?.receivedAt || null,
      lastPunch: punches[punches.length - 1]?.receivedAt || null,
      expectedRounds: expected,
      compliance,
    });
  });

  // Ordenar: incumplimientos primero, luego parciales, luego ok, luego sin reglas
  const order: Record<PunchClientSummary["compliance"], number> = { missed: 0, partial: 1, ok: 2, "no-rules": 3 };
  clients.sort((a, b) => order[a.compliance] - order[b.compliance] || a.accountName.localeCompare(b.accountName));

  return {
    reportDate,
    reportPeriod,
    generatedAt: new Date().toISOString(),
    rawRowCount: rows.length,
    clients,
    fileName: file.name,
  };
}
