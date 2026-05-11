/**
 * Parser para reportes HTM exportados desde Kronos NET 3.x (Monitoring Console).
 *
 * El reporte combina señales de Apertura y Cierre en un mismo archivo: cada cuenta
 * recibe la señal según el horario configurado por el cliente. Por eso ya NO se
 * separan dos archivos; en su lugar se procesa un único archivo y se obtiene
 * la última señal disponible por cuenta.
 *
 * Criticidad (días desde la última señal):
 *   < 1 día      → "ok"
 *   1 día        → "baja"
 *   2 días       → "media"
 *   3+ días      → "alta"
 *   sin señal    → "alta"
 */

export type CriticidadInactividad = "baja" | "media" | "alta";

export interface KronosAccountRow {
  accountCode: string;
  accountName: string;
  estado: string;            // "Abierto" | "Cerrado" | otro
  lastSignal: string | null; // ISO o null
  daysSince: number | null;
  criticidad: CriticidadInactividad | "ok";
}

export interface KronosParsedReport {
  reportDate: string | null; // ISO de generación del reporte (si se detecta)
  rows: KronosAccountRow[];
  generatedAt: string;
  rawRowCount: number;       // filas crudas detectadas (debug)
}

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})[\sT\u00A0]+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
// Código de cuenta: típicamente numérico de 3-6 dígitos, a veces alfanumérico corto.
const CODE_RE = /^[A-Z0-9]{3,8}$/i;
const ESTADO_RE = /\b(Abierto|Cerrado|Activo|Inactivo|Suspendido|Apagado)\b/i;

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
  const date = new Date(`${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:${s || "00"}`);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function classify(daysSince: number | null): KronosAccountRow["criticidad"] {
  if (daysSince === null) return "alta";
  if (daysSince < 1) return "ok";
  if (daysSince < 2) return "baja";
  if (daysSince < 3) return "media";
  return "alta";
}

/**
 * Estrategia de extracción:
 * 1. Recorre TODOS los <tr>. Para cada uno, junta el texto de cada <td>.
 * 2. Si la fila tiene >=3 celdas y la primera parece un código → estructura tabular.
 * 3. Si no, intenta extraer del texto plano: CODE NAME ESTADO YYYY-MM-DD HH:MM:SS
 *    aplicando regex sobre el texto completo (cubre reportes cuya tabla está
 *    aplanada en una sola celda).
 */
export async function parseKronosHtmFile(file: File): Promise<KronosParsedReport> {
  const buf = await file.arrayBuffer();
  // Detectar UTF-16 (Kronos a veces exporta así)
  let text: string;
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(buf);
  } else if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(buf);
  } else {
    text = new TextDecoder("utf-8").decode(buf);
  }

  const doc = new DOMParser().parseFromString(text, "text/html");

  // Fecha del reporte: primer datetime que aparezca en el header
  let reportDate: string | null = null;
  const headerScope = doc.querySelector(".headr, .nagl, .nagl2, header, h1, h2");
  if (headerScope) reportDate = parseDateTime(clean(headerScope.textContent || ""));
  if (!reportDate) {
    const all = clean(doc.body?.textContent || "");
    reportDate = parseDateTime(all);
  }

  const rowsMap = new Map<string, KronosAccountRow>(); // por código (mantiene la última señal)
  let rawRowCount = 0;

  const upsert = (code: string, name: string, estado: string, lastIso: string | null) => {
    code = code.trim();
    if (!code || !CODE_RE.test(code)) return;
    rawRowCount++;
    const refDate = reportDate ? new Date(reportDate) : new Date();
    let daysSince: number | null = null;
    if (lastIso) {
      daysSince = Math.floor((refDate.getTime() - new Date(lastIso).getTime()) / 86400000);
      if (daysSince < 0) daysSince = 0;
    }
    const cur = rowsMap.get(code);
    // Conservar la señal más reciente por cuenta
    if (cur && cur.lastSignal && lastIso && new Date(cur.lastSignal) >= new Date(lastIso)) return;
    rowsMap.set(code, {
      accountCode: code,
      accountName: name || cur?.accountName || "",
      estado: estado || cur?.estado || "",
      lastSignal: lastIso,
      daysSince,
      criticidad: classify(daysSince),
    });
  };

  // 1) Tabular
  doc.querySelectorAll("tr").forEach(tr => {
    const tds = Array.from(tr.querySelectorAll("td,th"));
    if (tds.length < 2) return;
    const cells = tds.map(td => clean(td.textContent || ""));
    // saltar headers
    if (cells.some(c => /no\.?\s*de\s*cuenta/i.test(c)) && cells.length <= 6 && !DATE_RE.test(cells.join(" "))) return;

    const code = cells[0];
    if (CODE_RE.test(code)) {
      // estructura: code | name | estado | last
      const name = cells[1] || "";
      const estado = cells.find(c => ESTADO_RE.test(c))?.match(ESTADO_RE)?.[1] || "";
      const lastIso = parseDateTime(cells.slice(1).join(" "));
      upsert(code, name, estado, lastIso);
      return;
    }

    // Fallback: la fila viene aplanada en una sola celda
    const flat = cells.join(" ");
    extractFromFlatText(flat, upsert);
  });

  // 2) Si seguimos sin filas, intentar sobre todo el body
  if (rowsMap.size === 0) {
    extractFromFlatText(clean(doc.body?.textContent || ""), upsert);
  }

  return {
    reportDate,
    rows: Array.from(rowsMap.values()),
    generatedAt: new Date().toISOString(),
    rawRowCount,
  };
}

/**
 * Extrae registros de un texto aplanado tipo:
 *   "8004 Little Caesars - LCPZ Dominican Republic, SRL Abierto 2026-05-11 07:51:22 4011 Mr tech 27 de febrero Abierto 2025-07-04 12:04:58 ..."
 * usando los datetimes como delimitadores y mirando hacia atrás para encontrar Estado, Nombre y Código.
 */
function extractFromFlatText(
  text: string,
  upsert: (code: string, name: string, estado: string, lastIso: string | null) => void,
) {
  const dtGlobal = /(\d{4}-\d{2}-\d{2}[\sT\u00A0]+\d{1,2}:\d{2}(?::\d{2})?)/g;
  const matches: { idx: number; dt: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = dtGlobal.exec(text)) !== null) {
    matches.push({ idx: m.index, dt: m[1] });
  }
  if (matches.length === 0) return;

  let prevEnd = 0;
  for (let i = 0; i < matches.length; i++) {
    const { idx, dt } = matches[i];
    // Segmento que precede al datetime: contiene CODE NAME ESTADO
    const segment = text.substring(prevEnd, idx).trim();
    prevEnd = idx + dt.length;

    // Estado al final del segmento
    const estadoMatch = segment.match(/(Abierto|Cerrado|Activo|Inactivo|Suspendido|Apagado)\s*$/i);
    const estado = estadoMatch?.[1] || "";
    const beforeEstado = estadoMatch
      ? segment.substring(0, segment.length - estadoMatch[0].length).trim()
      : segment;

    // Código al inicio del segmento
    const codeMatch = beforeEstado.match(/^([A-Z0-9]{3,8})\s+/i);
    if (!codeMatch) continue;
    const code = codeMatch[1];
    const name = beforeEstado.substring(codeMatch[0].length).trim();

    upsert(code, name, estado, parseDateTime(dt));
  }
}
