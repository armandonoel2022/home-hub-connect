/**
 * Parser para reportes HTM exportados desde Kronos NET 3.x (Monitoring Console).
 * Detecta:
 *  - Tipo de filtro (Apertura | Cierre) desde el header "Filtro: ..."
 *  - Fecha del reporte (cabecera superior derecha)
 *  - Listado de cuentas con: No de cuenta, Nombre, Estado, Última señal
 *
 * Calcula días sin actividad y categoriza la criticidad:
 *   1 día        → "baja"
 *   2 días       → "media"
 *   3+ días      → "alta"
 *   Sin señal    → "alta" (nunca ha reportado o sin datos)
 */

export type KronosFilterType = "Apertura" | "Cierre" | "Desconocido";
export type CriticidadInactividad = "baja" | "media" | "alta";

export interface KronosAccountRow {
  accountCode: string;
  accountName: string;
  estado: string;            // "Abierto" | "Cerrado" | ""
  lastSignal: string | null; // ISO o null
  daysSince: number | null;  // días completos transcurridos
  criticidad: CriticidadInactividad | "ok";
}

export interface KronosParsedReport {
  filterType: KronosFilterType;
  reportDate: string | null; // ISO (cuando se generó el reporte)
  rows: KronosAccountRow[];
  generatedAt: string;       // ISO local cuando se procesó el archivo
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#8209;/g, "-")  // non-breaking hyphen
    .replace(/&#x2011;/gi, "-")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cellText(td: Element): string {
  return decodeHtmlEntities((td.textContent || "").replace(/\u00A0/g, " ").trim());
}

function parseDateTime(raw: string): string | null {
  if (!raw) return null;
  // formato típico: 2026-05-11 08:07:24
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})[\s\u00A0T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
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

export async function parseKronosHtmFile(file: File): Promise<KronosParsedReport> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "text/html");

  // Detectar filtro
  let filterType: KronosFilterType = "Desconocido";
  doc.querySelectorAll(".nagl2").forEach(el => {
    const t = (el.textContent || "").toLowerCase();
    if (t.includes("filtro")) {
      if (t.includes("apertura")) filterType = "Apertura";
      else if (t.includes("cierre")) filterType = "Cierre";
    }
  });

  // Fecha del reporte (esquina superior derecha)
  let reportDate: string | null = null;
  doc.querySelectorAll(".headr").forEach(el => {
    const iso = parseDateTime(cellText(el));
    if (iso && !reportDate) reportDate = iso;
  });

  const refDate = reportDate ? new Date(reportDate) : new Date();

  // Filas: buscamos tablas que tengan en su header la celda "No de cuenta"
  const rows: KronosAccountRow[] = [];
  doc.querySelectorAll("table").forEach(tbl => {
    const headers = Array.from(tbl.querySelectorAll("tr")).slice(0, 1)
      .flatMap(tr => Array.from(tr.querySelectorAll("td")).map(td => cellText(td).toLowerCase()));
    if (!headers.some(h => h.includes("no de cuenta")) || !headers.some(h => h.includes("ultima"))) return;

    Array.from(tbl.querySelectorAll("tr")).slice(1).forEach(tr => {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 4) return;
      const code = cellText(tds[0]);
      const name = cellText(tds[1]);
      const estado = cellText(tds[2]);
      const lastRaw = cellText(tds[3]);
      if (!code) return;
      const lastIso = parseDateTime(lastRaw);
      let daysSince: number | null = null;
      if (lastIso) {
        daysSince = Math.floor((refDate.getTime() - new Date(lastIso).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < 0) daysSince = 0;
      }
      rows.push({
        accountCode: code,
        accountName: name,
        estado,
        lastSignal: lastIso,
        daysSince,
        criticidad: classify(daysSince),
      });
    });
  });

  return {
    filterType,
    reportDate,
    rows,
    generatedAt: new Date().toISOString(),
  };
}
