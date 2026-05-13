import * as XLSX from "xlsx";
import type { ArmedPersonnel } from "./types";

export interface ImportRow extends Omit<ArmedPersonnel, "id"> {
  _rowIndex: number;
}

const HEADER_ALIASES: Record<string, string> = {
  cliente: "client",
  puesto: "location",
  ubicacion: "location",
  provincia: "province",
  arma: "weaponType",
  "tipo de arma": "weaponType",
  marca: "weaponBrand",
  serial: "weaponSerial",
  tipo: "weaponCaliber", // Letal / No letal
  capsulas: "ammunitionCount",
  "cápsulas": "ammunitionCount",
  estatus: "weaponCondition",
  "estado del arma": "weaponCondition",
  vigilante: "name",
  nombre: "name",
  coordenada: "coordinates",
  coordenadas: "coordinates",
};

function normalizeKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Parse the Matriz_de_Levantamiento xlsx into ArmedPersonnel rows.
 * The file has a blank first column and a header row that may not be at row 0.
 */
export async function parseArmedPersonnelXlsx(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

  // Find header row (contains "Cliente" and "Puesto")
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].map((c: any) => normalizeKey(c)).join("|");
    if (joined.includes("cliente") && joined.includes("puesto")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) throw new Error("No se encontró la fila de encabezados (debe contener Cliente y Puesto).");

  const headers: string[] = rows[headerRowIdx].map((h: any) => HEADER_ALIASES[normalizeKey(h)] || "");

  const out: ImportRow[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c: any) => !String(c ?? "").trim())) continue;

    const rec: any = {
      employeeCode: "",
      name: "",
      photo: "",
      client: "",
      location: "",
      province: "",
      position: "Oficial de Seguridad",
      supervisor: "",
      fleetPhone: "",
      personalPhone: "",
      address: "",
      weaponType: "",
      weaponSerial: "",
      weaponBrand: "",
      weaponCaliber: "",
      ammunitionCount: 0,
      coordinates: "",
      weaponCondition: "",
      licenseNumber: "",
      licenseExpiry: "",
      assignedDate: new Date().toISOString().split("T")[0],
      status: "Activo",
      transferHistory: [],
    };

    headers.forEach((key, idx) => {
      if (!key) return;
      const val = String(row[idx] ?? "").trim();
      if (!val) return;
      if (key === "ammunitionCount") rec[key] = Number(val) || 0;
      else rec[key] = val;
    });

    if (!rec.client && !rec.location && !rec.name) continue;
    out.push({ ...rec, _rowIndex: r + 1 });
  }
  return out;
}
