/**
 * Parser estricto para reportes HTM exportados desde Kronos NET 3.x
 * (Monitoring Console → "Resumen de estados de grupos de señales").
 *
 * El reporte tiene una tabla con 4 columnas:
 *   No de cuenta | Nombre de cuenta | Estado | Ultima señal
 *
 * Cada cuenta puede aparecer hasta 2 veces en el día (una con Estado=Abierto
 * para la apertura y otra con Estado=Cerrado para el cierre). Aquí
 * consolidamos por cuenta llevando registro de:
 *   - última apertura (lastOpen)
 *   - último cierre  (lastClose)
 *   - última señal de cualquier tipo (lastSignal)
 *   - si hubo apertura y cierre el MISMO día del reporte (sameDayCycle)
 *
 * La criticidad se calcula sobre `lastSignal` (la más reciente de las dos):
 *   < 1 día      → "ok"
 *   1 día        → "baja"
 *   2 días       → "media"
 *   3+ días o nada → "alta"
 *
 * IMPORTANTE: solo se procesan filas de la tabla oficial (header detectado).
 * Cualquier texto suelto fuera de la tabla se ignora para evitar contaminar
 * el resultado con basura del pie del reporte.
 */

export type CriticidadInactividad = "baja" | "media" | "alta";

export interface KronosAccountRow {
  accountCode: string;
  accountName: string;
  estado: string;            // último estado conocido (Abierto/Cerrado)
  lastSignal: string | null; // ISO de la señal más reciente
  lastOpen: string | null;   // ISO de la última apertura
  lastClose: string | null;  // ISO del último cierre
  sameDayCycle: boolean;     // hubo apertura Y cierre el día del reporte
  daysSince: number | null;
  criticidad: CriticidadInactividad | "ok";
}

export interface KronosParsedReport {
  reportDate: string | null;
  rows: KronosAccountRow[];
  generatedAt: string;
  rawRowCount: number;
}

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})[\sT\u00A0]+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
const CODE_RE = /^[A-Z0-9]{3,10}$/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#8209;/g, "-")
    .replace(/&#x2011;/gi, "-")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function clean(s: string): string {
  return decodeEntities((s || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim());
}

function parseDateTime(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(DATE_RE);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    parseInt(y), parseInt(mo) - 1, parseInt(d),
    parseInt(h), parseInt(mi), parseInt(s || "0"),
  );
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function classify(daysSince: number | null): KronosAccountRow["criticidad"] {
  if (daysSince === null) return "alta";
  if (daysSince < 1) return "ok";
  if (daysSince < 2) return "baja";
  if (daysSince < 3) return "media";
  return "alta";
}

function sameDay(aIso: string | null, bIso: string | null): boolean {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso), b = new Date(bIso);
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function decodeBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

interface RawSignal {
  code: string;
  name: string;
  estado: string;
  iso: string | null;
}

/** Localiza la tabla oficial buscando los headers exactos. */
function findOfficialTable(doc: Document): HTMLTableElement | null {
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const t of tables) {
    const headers = Array.from(t.querySelectorAll("th, td"))
      .slice(0, 20)
      .map(c => clean(c.textContent || "").toLowerCase());
    const joined = headers.join(" | ");
    if (joined.includes("no de cuenta")
        && joined.includes("nombre de cuenta")
        && joined.includes("estado")
        && joined.includes("ultima señal")) {
      return t as HTMLTableElement;
    }
  }
  return null;
}

function extractTableSignals(table: HTMLTableElement): RawSignal[] {
  const signals: RawSignal[] = [];
  const rows = Array.from(table.querySelectorAll("tr"));
  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length < 4) continue; // headers (th) o filas de pie
    const cells = tds.map(td => clean(td.textContent || ""));
    const code = cells[0];
    if (!CODE_RE.test(code)) continue;
    signals.push({
      code,
      name: cells[1] || "",
      estado: cells[2] || "",
      iso: parseDateTime(cells[3] || ""),
    });
  }
  return signals;
}

export async function parseKronosHtmFile(file: File): Promise<KronosParsedReport> {
  const text = decodeBuffer(await file.arrayBuffer());
  const doc = new DOMParser().parseFromString(text, "text/html");

  // Fecha del reporte: encabezado "Monitoring Console - Kronos NET ... YYYY-MM-DD HH:MM"
  let reportDate: string | null = null;
  const headerNodes = Array.from(doc.querySelectorAll("body *")).slice(0, 30);
  for (const n of headerNodes) {
    const t = clean(n.textContent || "");
    if (DATE_RE.test(t)) { reportDate = parseDateTime(t); if (reportDate) break; }
  }

  const table = findOfficialTable(doc);
  const signals = table ? extractTableSignals(table) : [];

  // Consolidar por cuenta
  const map = new Map<string, KronosAccountRow>();
  signals.forEach(sig => {
    const cur = map.get(sig.code) || {
      accountCode: sig.code,
      accountName: sig.name,
      estado: sig.estado,
      lastSignal: null,
      lastOpen: null,
      lastClose: null,
      sameDayCycle: false,
      daysSince: null,
      criticidad: "alta" as const,
    };
    if (sig.name && !cur.accountName) cur.accountName = sig.name;

    const isOpen = /abierto/i.test(sig.estado);
    const isClose = /cerrado/i.test(sig.estado);
    if (sig.iso) {
      if (isOpen && (!cur.lastOpen || sig.iso > cur.lastOpen)) cur.lastOpen = sig.iso;
      if (isClose && (!cur.lastClose || sig.iso > cur.lastClose)) cur.lastClose = sig.iso;
      if (!cur.lastSignal || sig.iso > cur.lastSignal) {
        cur.lastSignal = sig.iso;
        cur.estado = sig.estado;
      }
    }
    map.set(sig.code, cur);
  });

  const refDate = reportDate ? new Date(reportDate) : new Date();
  map.forEach(r => {
    if (r.lastSignal) {
      const diff = (refDate.getTime() - new Date(r.lastSignal).getTime()) / 86400000;
      r.daysSince = Math.max(0, Math.floor(diff));
    }
    r.criticidad = classify(r.daysSince);
    r.sameDayCycle = sameDay(r.lastOpen, reportDate) && sameDay(r.lastClose, reportDate);
  });

  return {
    reportDate,
    rows: Array.from(map.values()),
    generatedAt: new Date().toISOString(),
    rawRowCount: signals.length,
  };
}
