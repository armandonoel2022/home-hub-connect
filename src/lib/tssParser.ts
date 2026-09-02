/**
 * Parser para archivos TSS descargados del portal de la Tesorería (SUIR).
 *
 * Formatos soportados:
 *  - .htm / .html exportado por Excel (UTF-16 LE o UTF-8) con la tabla de datos.
 *  - .xls / .xlsx binario nativo.
 *  - Exportación "Excel Workbook Frameset" (multi-archivo): el .htm principal NO
 *    contiene datos, sólo apunta a `<nombre>_files/sheet001.htm`. En ese caso se
 *    lanza un error explicativo para que el usuario cargue la hoja correcta.
 */
import * as XLSX from "xlsx";

export interface TssRow {
  cedula: string;
  nombre: string;
  idNss: string;
  salarioSS: number;
  salarioReportado: number;
  sfsAfiliado: number;
  afpAfiliado: number;
  total: number;
}

export interface TssParsed {
  period: string; // ej. "08-2026"
  rows: TssRow[];
}

export class TssFramesetError extends Error {
  sheetHref: string | null;
  constructor(sheetHref: string | null) {
    super(
      "El archivo cargado es sólo el índice del libro de Excel y no contiene los datos. " +
      "Abre la carpeta que se descargó junto al .htm (termina en \"_files\") y carga el archivo " +
      (sheetHref ? `"${sheetHref.split("/").pop()}"` : '"sheet001.htm"') +
      ", o abre el archivo en Excel y guárdalo como .xlsx antes de validarlo."
    );
    this.name = "TssFramesetError";
    this.sheetHref = sheetHref;
  }
}

function num(x: any): number {
  if (x === null || x === undefined || x === "") return 0;
  const n = Number(String(x).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normHeader(s: string): string {
  return (s || "")
    .replace(/\u00A0/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Sinónimos aceptados por campo (ya normalizados). */
const FIELD_ALIASES: Record<keyof TssRow | "periodo", string[]> = {
  cedula: ["NO_DOCUMENTO", "DOCUMENTO", "CEDULA", "NUM_DOCUMENTO", "NO_DOCUMENTO_AFILIADO", "IDENTIFICACION"],
  nombre: ["NOMBRES", "NOMBRE", "NOMBRE_AFILIADO", "NOMBRES_APELLIDOS", "NOMBRE_COMPLETO"],
  idNss: ["ID_NSS", "NSS", "ID_SS"],
  salarioSS: ["SALARIO_SS", "SALARIO", "SALARIO_COTIZABLE"],
  salarioReportado: ["SALARIO_SS_REPORTADO", "SALARIO_REPORTADO", "SALARIO_SS"],
  sfsAfiliado: ["APORTE_AFILIADOS_SFS", "SFS_AFILIADO", "APORTE_SFS", "SFS"],
  afpAfiliado: ["APORTE_AFILIADOS_SVDS", "AFP_AFILIADO", "APORTE_SVDS", "SVDS", "AFP"],
  total: ["TOTAL_GENERAL_DET_FACTURA", "TOTAL_GENERAL", "TOTAL"],
  periodo: ["PERIODO_APLICACION", "PERIODO", "PERIODO_FACTURA"],
};

function indexOfField(headers: string[], field: keyof typeof FIELD_ALIASES): number {
  for (const alias of FIELD_ALIASES[field]) {
    const i = headers.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

/** ¿Esta fila de encabezados es válida? (al menos documento + nombre) */
function looksLikeHeader(headers: string[]): boolean {
  return indexOfField(headers, "cedula") >= 0 && indexOfField(headers, "nombre") >= 0;
}

function rowsFromMatrix(matrix: string[][]): TssParsed {
  // Buscar la fila de encabezados (el portal a veces antepone títulos)
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const h = matrix[i].map(normHeader);
    if (looksLikeHeader(h)) { headerIdx = i; headers = h; break; }
  }
  if (headerIdx < 0) {
    throw new Error("No se encontró la tabla de afiliados (columnas NO_DOCUMENTO / NOMBRES) en el archivo.");
  }

  const iCed = indexOfField(headers, "cedula");
  const iNom = indexOfField(headers, "nombre");
  const iNss = indexOfField(headers, "idNss");
  const iSal = indexOfField(headers, "salarioSS");
  const iSalRep = indexOfField(headers, "salarioReportado");
  const iSfs = indexOfField(headers, "sfsAfiliado");
  const iAfp = indexOfField(headers, "afpAfiliado");
  const iTot = indexOfField(headers, "total");
  const iPer = indexOfField(headers, "periodo");

  const at = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "") : "");

  let period = "";
  const out: TssRow[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r];
    if (!cells || cells.length < 2) continue;
    const cedula = normalizeCedulaKey(at(cells, iCed));
    const nombre = String(at(cells, iNom)).trim();
    if (!cedula && !nombre) continue;
    if (normHeader(nombre) === "NOMBRES") continue; // encabezado repetido
    if (!period && iPer >= 0) period = String(at(cells, iPer)).trim();
    const salarioSS = num(at(cells, iSal));
    out.push({
      cedula,
      nombre,
      idNss: String(at(cells, iNss)).trim(),
      salarioSS,
      salarioReportado: iSalRep >= 0 ? num(at(cells, iSalRep)) : salarioSS,
      sfsAfiliado: num(at(cells, iSfs)),
      afpAfiliado: num(at(cells, iAfp)),
      total: num(at(cells, iTot)),
    });
  }
  if (!out.length) throw new Error("El archivo TSS no contiene filas de afiliados.");
  return { period: period || "Sin período", rows: out };
}

/**
 * Muchas descargas/recortes de la TSS vienen SIN encabezados: sólo dos columnas
 * (nombre y cédula, en cualquier orden). Aquí se detecta ese caso.
 */
function rowsFromHeaderlessMatrix(matrix: string[][]): TssParsed | null {
  const rows = matrix.filter(r => r && r.filter(c => String(c).trim()).length >= 2);
  if (rows.length < 5) return null;

  const isDigits = (v: string) => /^[\d\s.\-]{7,}$/.test(String(v).trim()) && String(v).replace(/\D/g, "").length >= 7;
  const isText = (v: string) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(String(v));

  const sample = rows.slice(0, Math.min(rows.length, 40));
  const col0Ced = sample.filter(r => isDigits(r[0])).length / sample.length;
  const col1Ced = sample.filter(r => isDigits(r[1])).length / sample.length;
  const col0Txt = sample.filter(r => isText(r[0])).length / sample.length;
  const col1Txt = sample.filter(r => isText(r[1])).length / sample.length;

  let iNom = -1, iCed = -1;
  if (col1Ced > 0.8 && col0Txt > 0.8) { iNom = 0; iCed = 1; }
  else if (col0Ced > 0.8 && col1Txt > 0.8) { iNom = 1; iCed = 0; }
  else return null;

  const out: TssRow[] = [];
  for (const r of rows) {
    const cedula = normalizeCedulaKey(r[iCed]);
    const nombre = String(r[iNom] ?? "").trim();
    if (!cedula && !nombre) continue;
    if (/^(nombre|nombres|cedula|documento)$/i.test(nombre)) continue;
    out.push({ cedula, nombre, idNss: "", salarioSS: 0, salarioReportado: 0, sfsAfiliado: 0, afpAfiliado: 0, total: 0 });
  }
  return out.length ? { period: "Sin período", rows: out } : null;
}


function decode(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  if (view[0] === 0xff && view[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  if (view[0] === 0xfe && view[1] === 0xff) return new TextDecoder("utf-16be").decode(buffer);
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

/** Detecta el formato real (HTML disfrazado de XLS, o XLSX/XLS binario) */
async function fileToText(file: File): Promise<{ kind: "html"; text: string } | { kind: "binary"; buffer: ArrayBuffer }> {
  const buffer = await file.arrayBuffer();
  const text = decode(buffer);
  const low = text.slice(0, 4000).toLowerCase();
  if (low.includes("<table") || low.includes("<html") || low.includes("<tr")) {
    return { kind: "html", text };
  }
  return { kind: "binary", buffer };
}

function parseHtml(text: string): TssParsed {
  const doc = new DOMParser().parseFromString(text, "text/html");

  const tables = Array.from(doc.querySelectorAll("table"));
  const matrices: string[][][] = tables.map(t =>
    Array.from(t.querySelectorAll("tr")).map(tr =>
      Array.from(tr.querySelectorAll("td,th")).map(c => (c.textContent || "").replace(/\u00A0/g, " ").trim())
    )
  );

  // Escoger la primera tabla que tenga encabezados válidos
  for (const m of matrices) {
    try {
      if (m.some(r => looksLikeHeader(r.map(normHeader)))) return rowsFromMatrix(m);
    } catch { /* intentar con la siguiente */ }
  }

  // ¿Es la exportación multi-archivo de Excel? (frameset sin datos)
  const isFrameset =
    /Excel Workbook Frameset/i.test(text) ||
    (/id=["']?shLink/i.test(text) && !matrices.some(m => m.length > 2));
  if (isFrameset) {
    const href = text.match(/id=["']?shLink["']?\s+href=["']([^"']+)["']/i)?.[1] || null;
    throw new TssFramesetError(href ? decodeURIComponent(href) : null);
  }

  throw new Error("No se encontró la tabla de afiliados (columnas NO_DOCUMENTO / NOMBRES) en el archivo.");
}

function parseBinary(buffer: ArrayBuffer): TssParsed {
  const wb = XLSX.read(buffer, { type: "array" });
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false })
      .map(r => (r as any[]).map(c => String(c ?? "")));
    if (matrix.some(r => looksLikeHeader(r.map(normHeader)))) return rowsFromMatrix(matrix);
  }
  throw new Error("El archivo Excel no contiene la hoja de afiliados TSS.");
}

export async function parseTssFile(file: File): Promise<TssParsed> {
  const detected = await fileToText(file);
  if (detected.kind === "html") return parseHtml(detected.text);
  return parseBinary(detected.buffer);
}

/** Parsea uno o varios archivos (útil cuando la descarga viene partida en hojas). */
export async function parseTssFiles(files: File[]): Promise<TssParsed> {
  const errors: Error[] = [];
  const merged = new Map<string, TssRow>();
  let period = "";
  for (const f of files) {
    try {
      const p = await parseTssFile(f);
      if (!period || period === "Sin período") period = p.period;
      p.rows.forEach(r => merged.set(r.cedula || r.nombre, r));
    } catch (e: any) { errors.push(e); }
  }
  if (!merged.size) throw errors[0] || new Error("No se pudo leer ningún archivo TSS.");
  return { period: period || "Sin período", rows: Array.from(merged.values()) };
}

/** Normaliza período "04-2026" → "2026-04" para ordenar */
export function periodToSortable(p: string): string {
  const m = p.match(/^(\d{2})-(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : p;
}
