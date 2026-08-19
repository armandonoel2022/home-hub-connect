// Bóveda de Armas — inventario de municiones (editable, persistido en localStorage).

export interface AmmoRow {
  id: string;
  calibre: string;
  cantidad: number;
  tipo: string;
}

export interface DamagedAmmoRow {
  id: string;
  descripcion: string;
  cantidad: number;
  calibre: string;
}

const K_AMMO = "safeone:vault-ammo";
const K_DAMAGED = "safeone:vault-ammo-damaged";

export const AMMO_EVENT = "safeone:vault-ammo-updated";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_AMMO: AmmoRow[] = [
  { id: "a1", calibre: "38", cantidad: 32, tipo: "letal" },
  { id: "a2", calibre: "9 mm", cantidad: 35, tipo: "letal" },
  { id: "a3", calibre: "12", cantidad: 6, tipo: "letal" },
  { id: "a4", calibre: "12", cantidad: 339, tipo: "menos letal" },
  { id: "a5", calibre: "9 mm", cantidad: 571, tipo: "menos letal" },
];

export const DEFAULT_DAMAGED: DamagedAmmoRow[] = [
  { id: "d1", descripcion: "Cartuchos menos letal", cantidad: 17, calibre: "12" },
  { id: "d2", descripcion: "Cartuchos letal", cantidad: 4, calibre: "12" },
  { id: "d3", descripcion: "Cápsulas letal", cantidad: 22, calibre: "38" },
  { id: "d4", descripcion: "Cápsulas letal", cantidad: 9, calibre: "9 mm" },
];

function read<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, rows: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(AMMO_EVENT));
  } catch {
    /* cuota llena: se mantiene en memoria */
  }
}

export const getAmmo = () => read<AmmoRow>(K_AMMO, DEFAULT_AMMO);
export const saveAmmo = (rows: AmmoRow[]) => write(K_AMMO, rows);
export const getDamagedAmmo = () => read<DamagedAmmoRow>(K_DAMAGED, DEFAULT_DAMAGED);
export const saveDamagedAmmo = (rows: DamagedAmmoRow[]) => write(K_DAMAGED, rows);

export const newAmmoRow = (): AmmoRow => ({ id: uid(), calibre: "", cantidad: 0, tipo: "letal" });
export const newDamagedRow = (): DamagedAmmoRow => ({ id: uid(), descripcion: "", cantidad: 0, calibre: "" });

export const totalAmmo = (rows: { cantidad: number }[]) =>
  rows.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);

/** Totales por tipo (letal / menos letal). */
export function ammoByTipo(rows: AmmoRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    const k = (r.tipo || "sin tipo").trim().toLowerCase();
    out[k] = (out[k] || 0) + (Number(r.cantidad) || 0);
  });
  return out;
}
