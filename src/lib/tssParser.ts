/**
 * Parser para archivos TSS (.xls que en realidad es HTML UTF-16 LE)
 * Soporta también XLSX nativo si en el futuro cambia el formato.
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
  period: string; // ej. "04-2026"
  rows: TssRow[];
}

function num(x: any): number {
  if (x === null || x === undefined || x === "") return 0;
  const n = Number(String(x).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Detecta el formato real (HTML disfrazado de XLS, o XLSX/XLS binario) */
async function fileToText(file: File): Promise<{ kind: "html"; text: string } | { kind: "binary"; buffer: ArrayBuffer }> {
  const buffer = await file.arrayBuffer();
  const view = new Uint8Array(buffer);
  // UTF-16 LE BOM
  if (view[0] === 0xff && view[1] === 0xfe) {
    const text = new TextDecoder("utf-16le").decode(buffer);
    if (text.toLowerCase().includes("<table")) return { kind: "html", text };
  }
  // UTF-8 HTML
  const head = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, 1000));
  if (head.toLowerCase().includes("<table") || head.toLowerCase().includes("<html")) {
    return { kind: "html", text: new TextDecoder("utf-8").decode(buffer) };
  }
  return { kind: "binary", buffer };
}

function parseHtml(text: string): TssParsed {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const rows = Array.from(doc.querySelectorAll("tr"));
  if (rows.length < 2) throw new Error("Archivo TSS sin filas");
  const header = Array.from(rows[0].querySelectorAll("td,th")).map(c => (c.textContent || "").trim());
  const idx = (name: string) => header.findIndex(h => h === name);
  const iCed = idx("NO_DOCUMENTO");
  const iNom = idx("NOMBRES");
  const iNss = idx("ID_NSS");
  const iSal = idx("SALARIO_SS");
  const iSalRep = idx("SALARIO_SS_REPORTADO");
  const iSfs = idx("APORTE_AFILIADOS_SFS");
  const iAfp = idx("APORTE_AFILIADOS_SVDS");
  const iTot = idx("TOTAL_GENERAL_DET_FACTURA");
  const iPer = idx("PERIODO_APLICACION");

  let period = "";
  const out: TssRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = Array.from(rows[r].querySelectorAll("td")).map(c => (c.textContent || "").trim());
    if (cells.length < 5) continue;
    if (!period && iPer >= 0) period = cells[iPer] || "";
    out.push({
      cedula: (cells[iCed] || "").replace(/\D/g, ""),
      nombre: cells[iNom] || "",
      idNss: cells[iNss] || "",
      salarioSS: num(cells[iSal]),
      salarioReportado: num(cells[iSalRep]),
      sfsAfiliado: num(cells[iSfs]),
      afpAfiliado: num(cells[iAfp]),
      total: num(cells[iTot]),
    });
  }
  return { period: period || "Sin período", rows: out };
}

function parseBinary(buffer: ArrayBuffer): TssParsed {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  if (!json.length) throw new Error("Archivo TSS sin filas");
  let period = "";
  const out: TssRow[] = json.map(r => {
    if (!period && r["PERIODO_APLICACION"]) period = String(r["PERIODO_APLICACION"]);
    return {
      cedula: String(r["NO_DOCUMENTO"] || "").replace(/\D/g, ""),
      nombre: String(r["NOMBRES"] || ""),
      idNss: String(r["ID_NSS"] || ""),
      salarioSS: num(r["SALARIO_SS"]),
      salarioReportado: num(r["SALARIO_SS_REPORTADO"]),
      sfsAfiliado: num(r["APORTE_AFILIADOS_SFS"]),
      afpAfiliado: num(r["APORTE_AFILIADOS_SVDS"]),
      total: num(r["TOTAL_GENERAL_DET_FACTURA"]),
    };
  });
  return { period: period || "Sin período", rows: out };
}

export async function parseTssFile(file: File): Promise<TssParsed> {
  const detected = await fileToText(file);
  if (detected.kind === "html") return parseHtml(detected.text);
  return parseBinary(detected.buffer);
}

/** Normaliza período "04-2026" → "2026-04" para ordenar */
export function periodToSortable(p: string): string {
  const m = p.match(/^(\d{2})-(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : p;
}
