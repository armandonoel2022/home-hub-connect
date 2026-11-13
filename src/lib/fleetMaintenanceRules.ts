// Reglas de negocio del módulo Flotilla — Reparación y Mantenimiento.
// Funciones puras (sin almacenamiento) para poder probarlas y reutilizarlas.
// El backend (backend/routes/fleet-maintenance.js) replica estas mismas reglas.
import type { AnnualCostRow, FleetUnit, MaintenanceEntry } from "./fleetMaintenanceTypes";

export const MONTH_KEYS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];
export const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ── Placas ──
/** Mayúsculas, sin espacios, guiones ni puntos. */
export function normalizePlaca(p: unknown): string {
  return String(p ?? "").toUpperCase().replace(/[\s\-.]/g, "");
}
/** Placa dominicana: 1-3 letras + 5-7 dígitos (K2546292, L504477, PP524146). */
export const PLACA_REGEX = /^[A-Z]{1,3}\d{5,7}$/;
export function isValidPlacaFormat(p: unknown): boolean {
  return PLACA_REGEX.test(normalizePlaca(p));
}

export function findUnitByPlaca<T extends { placa: unknown }>(units: T[], placa: unknown): T | undefined {
  const key = normalizePlaca(placa);
  if (!key) return undefined;
  return units.find((u) => normalizePlaca(u.placa) === key);
}

export type PlacaCheck<T> =
  | { ok: true; placa: string; unit: T; error?: undefined }
  | { ok: false; error: string; placa?: undefined; unit?: undefined };

/** Un gasto solo se acepta si la placa existe en la flotilla registrada. */
export function validateExpensePlaca<T extends { placa: unknown }>(units: T[], placa: unknown): PlacaCheck<T> {
  const key = normalizePlaca(placa);
  if (!key) return { ok: false, error: "Debe seleccionar la placa de una unidad registrada." };
  const unit = findUnitByPlaca(units, key);
  if (!unit) {
    return {
      ok: false,
      error: `La placa ${key} no está registrada en la Flotilla. Regístrela primero en la pestaña Flotilla.`,
    };
  }
  return { ok: true, placa: normalizePlaca(unit.placa), unit };
}

/** Al crear una unidad: formato válido y sin duplicados. */
export function validateNewUnitPlaca<T extends { placa: unknown }>(units: T[], placa: unknown): PlacaCheck<null> {
  const key = normalizePlaca(placa);
  if (!key) return { ok: false, error: "La placa es obligatoria." };
  if (!PLACA_REGEX.test(key)) {
    return { ok: false, error: `La placa ${key} no tiene un formato válido (ej. K2546292, L504477, G601495).` };
  }
  if (findUnitByPlaca(units, key)) return { ok: false, error: `Ya existe una unidad con la placa ${key}.` };
  return { ok: true, placa: key, unit: null };
}

export function unitKind(u: Pick<FleetUnit, "tipo">): "motocicleta" | "vehiculo" {
  return String(u.tipo || "").toUpperCase().includes("MOTO") ? "motocicleta" : "vehiculo";
}
export function unitDescription(u: FleetUnit): string {
  const parts = [u.tipo, u.marca, u.modelo].map((s) => String(s ?? "").trim()).filter(Boolean);
  let d = parts.join(" ");
  if (u.color) d += `, color ${String(u.color).trim().toLowerCase()}`;
  if (u.anio) d += `, año ${u.anio}`;
  if (u.chasis) d += `. Chasis ${String(u.chasis).trim()}`;
  return d;
}

// ── Talleres ──
export const DEFAULT_TALLERES = [
  "La Chercha, SRL",
  "Moto Servic Campe",
  "Motocentro La Friusa, SRL",
  "Motores del Sur",
  "Grupo Cometa",
  "Movilidad Inteligente Marti",
  "Taller ambulante (caja chica)",
];

/** Clave de comparación: sin acentos, mayúsculas, espacios, puntuación ni "SRL". */
export function tallerKey(name: unknown): string {
  return String(name ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bs\.?\s*r\.?\s*l\.?\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Devuelve el nombre oficial del catálogo si coincide; si no, el nombre limpio. */
export function canonicalTaller(name: unknown, catalog: string[] = DEFAULT_TALLERES): string | null {
  const clean = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const key = tallerKey(clean);
  const match = [...catalog, ...DEFAULT_TALLERES].find((t) => tallerKey(t) === key);
  return match || clean;
}

/** Catálogo único (sin variantes) a partir de los valores por defecto, los guardados y los usados. */
export function buildTallerCatalog(stored: string[] = [], used: (string | null | undefined)[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...DEFAULT_TALLERES, ...stored, ...used]) {
    const name = canonicalTaller(raw, out);
    const key = tallerKey(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, "es"));
}

// ── Tipo de mantenimiento ──
export const TIPOS_MANT = ["Mantenimiento", "Reparación", "Compra de piezas", "Otros"];
export function normalizeTipoMant(t: unknown): string | null {
  const clean = String(t ?? "").trim();
  if (!clean) return null;
  const k = tallerKey(clean);
  if (k.startsWith("mant")) return "Mantenimiento";
  if (k.startsWith("repar")) return "Reparación";
  if (k.includes("pieza")) return "Compra de piezas";
  return clean;
}

// ── Fechas ──
/** Correcciones puntuales de digitación detectadas en la hoja original. */
export const DATE_FIXES: { placa: string; from: string; to: string }[] = [
  { placa: "K2546252", from: "2016-03-30", to: "2026-03-30" },
];

/** Acepta YYYY-MM-DD o D-M-AA / D/M/AAAA. Devuelve YYYY-MM-DD o null. */
export function parseFecha(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}
export function monthNameOf(fecha: string | null): MonthKey | null {
  if (!fecha) return null;
  const idx = Number(fecha.slice(5, 7)) - 1;
  return MONTH_KEYS[idx] ?? null;
}

/** Limpia un registro: placa, fecha, mes derivado de la fecha, taller y tipo estándar. */
export function normalizeEntry<T extends MaintenanceEntry>(e: T, tallerCatalog: string[] = DEFAULT_TALLERES): T {
  const placa = normalizePlaca(e.placa);
  let fecha = parseFecha(e.fecha) || String(e.fecha ?? "").trim();
  const fix = DATE_FIXES.find((f) => f.placa === placa && f.from === fecha);
  if (fix) fecha = fix.to;
  const mes = monthNameOf(parseFecha(fecha));
  return {
    ...e,
    placa,
    fecha,
    mes: mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : e.mes ?? null,
    taller: canonicalTaller(e.taller, tallerCatalog),
    tipoMant: normalizeTipoMant(e.tipoMant),
    costo: Number(e.costo) || 0,
  };
}

// ── Agregados ──
export function monthKeyOf(fecha: string | null | undefined): string | null {
  const f = parseFecha(fecha);
  return f ? f.slice(0, 7) : null;
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_SHORT[Number(m) - 1] ?? m} ${y}`;
}

/** Gasto por mes en orden cronológico (YYYY-MM). */
export function monthlySeries(entries: MaintenanceEntry[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const k = monthKeyOf(e.fecha);
    if (!k) continue;
    const cur = map.get(k) || { total: 0, count: 0 };
    cur.total += Number(e.costo) || 0;
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({ key, label: monthLabel(key), ...v }));
}

export function availableYears(entries: MaintenanceEntry[], currentYear: number): number[] {
  const ys = new Set<number>([currentYear]);
  for (const e of entries) {
    const k = monthKeyOf(e.fecha);
    if (k) ys.add(Number(k.slice(0, 4)));
  }
  return [...ys].sort((a, b) => b - a);
}

export interface AnnualRow extends AnnualCostRow {
  registered: boolean;
  count: number;
}
const emptyMonthly = () =>
  Object.fromEntries(MONTH_KEYS.map((m) => [m, 0])) as AnnualCostRow["monthly"];

/** Costo anual calculado a partir de los registros de gasto (no de una hoja fija). */
export function buildAnnualMatrix(entries: MaintenanceEntry[], fleet: FleetUnit[], year: number): AnnualRow[] {
  const rows = new Map<string, AnnualRow>();
  for (const u of fleet) {
    const key = normalizePlaca(u.placa);
    if (!key || rows.has(key)) continue;
    rows.set(key, { descripcion: unitDescription(u), placa: key, monthly: emptyMonthly(), total: 0, registered: true, count: 0 });
  }
  for (const e of entries) {
    const k = monthKeyOf(e.fecha);
    if (!k || Number(k.slice(0, 4)) !== year) continue;
    const key = normalizePlaca(e.placa) || "SIN PLACA";
    let row = rows.get(key);
    if (!row) {
      row = { descripcion: e.unit || "Unidad no registrada en Flotilla", placa: key, monthly: emptyMonthly(), total: 0, registered: false, count: 0 };
      rows.set(key, row);
    }
    const month = MONTH_KEYS[Number(k.slice(5, 7)) - 1];
    const c = Number(e.costo) || 0;
    row.monthly[month] += c;
    row.total += c;
    row.count += 1;
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.descripcion.localeCompare(b.descripcion, "es"));
}

/** Diferencias entre la hoja Excel original y lo que está registrado, por placa y mes. */
export function reconcileWithSheet(sheet: AnnualCostRow[], computed: AnnualRow[]) {
  const byPlaca = new Map(computed.map((r) => [normalizePlaca(r.placa), r]));
  const out: { placa: string; descripcion: string; mes: MonthKey; hoja: number; registros: number; diferencia: number }[] = [];
  for (const s of sheet) {
    const key = normalizePlaca(s.placa);
    const c = byPlaca.get(key);
    for (const m of MONTH_KEYS) {
      const hoja = Number(s.monthly[m]) || 0;
      const registros = c ? c.monthly[m] : 0;
      if (Math.abs(hoja - registros) > 1) {
        out.push({ placa: key || "—", descripcion: s.descripcion, mes: m, hoja, registros, diferencia: hoja - registros });
      }
    }
  }
  return out;
}
