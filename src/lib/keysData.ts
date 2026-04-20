// ── Control de Llaves — Data Layer ──
// Estrategia server-first con fallback a localStorage.

import apiFetch, { isApiConfigured } from "./api";

export type KeyEstado = "asignada" | "disponible" | "extraviada" | "retirada";
export type KeyHistorialAccion = "entrega" | "devolucion" | "revision" | "copia";

export interface KeyHistorial {
  id: string;
  fecha: string; // ISO
  accion: KeyHistorialAccion;
  persona: string;
  motivo?: string;
  registradoPor?: string;
}

export interface KeyRecord {
  id: string;
  code: string;
  descripcion: string;
  tipoCerradura: string; // "Yale", "Multilock", "Candado", "Electrónica", etc.
  ubicacion: string;
  departamento: string;
  perteneceA: string; // mueble / dispositivo / área
  linkedAssetId: string; // SSC-XXX o placa
  linkedAssetType: "asset" | "vehicle" | "";
  responsable: string;
  responsableId: string;
  fechaEntrega: string; // YYYY-MM-DD
  tieneCopia: boolean;
  cantidadCopias: number;
  ubicacionCopia: string;
  estado: KeyEstado;
  ultimaRevision: string; // YYYY-MM-DD
  proximaRevision: string;
  frecuenciaDias: number;
  notas: string;
  // Inventario físico (formato F-G-08 / Inventario SafeOne)
  cantidadEnCaja?: number;
  cantidadAsignadas?: number;
  colorIdentificador?: string; // Azul, Amarillo, Rojo, Verde, etc.
  historial: KeyHistorial[];
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = "safeone_keys_v1";

function loadLocal(): KeyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveLocal(list: KeyRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const TIPOS_CERRADURA = [
  "Yale", "Multilock", "Candado", "Electrónica", "Tarjeta", "Biométrica", "Combinación", "Otro",
];

export const ESTADOS_LLAVE: { value: KeyEstado; label: string; color: string }[] = [
  { value: "asignada", label: "Asignada", color: "hsl(220 70% 50%)" },
  { value: "disponible", label: "Disponible", color: "hsl(142 70% 45%)" },
  { value: "extraviada", label: "Extraviada", color: "hsl(0 70% 50%)" },
  { value: "retirada", label: "Retirada", color: "hsl(0 0% 50%)" },
];

export const ACCIONES_HISTORIAL: { value: KeyHistorialAccion; label: string }[] = [
  { value: "entrega", label: "Entrega" },
  { value: "devolucion", label: "Devolución" },
  { value: "revision", label: "Revisión" },
  { value: "copia", label: "Copia generada" },
];

// ── Server flag ──
let serverAvailable: boolean | null = null;
async function checkServer(): Promise<boolean> {
  if (!isApiConfigured()) return false;
  if (serverAvailable !== null) return serverAvailable;
  try {
    await apiFetch("/keys");
    serverAvailable = true;
  } catch {
    serverAvailable = false;
  }
  return serverAvailable;
}

// ── Seed (inventario oficial SafeOne) ──
const SEED_FLAG = "safeone_keys_seed_v1_loaded";
async function fetchSeed(): Promise<KeyRecord[]> {
  try {
    const r = await fetch("/data/keys_seed.json");
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

// ── API ──
export async function loadKeys(): Promise<KeyRecord[]> {
  if (await checkServer()) {
    try {
      let data = await apiFetch<KeyRecord[]>("/keys");
      // Auto-seed servidor vacío
      if ((!data || data.length === 0) && !localStorage.getItem(SEED_FLAG)) {
        const seed = await fetchSeed();
        for (const s of seed) {
          try { await apiFetch<KeyRecord>("/keys", { method: "POST", body: JSON.stringify(s) }); } catch {}
        }
        localStorage.setItem(SEED_FLAG, "1");
        data = await apiFetch<KeyRecord[]>("/keys");
      }
      saveLocal(data);
      return data;
    } catch {
      return loadLocal();
    }
  }
  // Local fallback
  let local = loadLocal();
  if (local.length === 0 && !localStorage.getItem(SEED_FLAG)) {
    const seed = await fetchSeed();
    if (seed.length) {
      saveLocal(seed);
      localStorage.setItem(SEED_FLAG, "1");
      local = seed;
    }
  }
  return local;
}

export async function createKey(input: Partial<KeyRecord>): Promise<KeyRecord> {
  if (await checkServer()) {
    return apiFetch<KeyRecord>("/keys", { method: "POST", body: JSON.stringify(input) });
  }
  const list = loadLocal();
  const id = `LLV-${String(list.length + 1).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const rec: KeyRecord = {
    id,
    code: input.code || id,
    descripcion: input.descripcion || "",
    tipoCerradura: input.tipoCerradura || "",
    ubicacion: input.ubicacion || "",
    departamento: input.departamento || "",
    perteneceA: input.perteneceA || "",
    linkedAssetId: input.linkedAssetId || "",
    linkedAssetType: input.linkedAssetType || "",
    responsable: input.responsable || "",
    responsableId: input.responsableId || "",
    fechaEntrega: input.fechaEntrega || "",
    tieneCopia: !!input.tieneCopia,
    cantidadCopias: input.cantidadCopias || 0,
    ubicacionCopia: input.ubicacionCopia || "",
    estado: input.estado || "asignada",
    ultimaRevision: input.ultimaRevision || "",
    proximaRevision: input.proximaRevision || "",
    frecuenciaDias: input.frecuenciaDias || 90,
    notas: input.notas || "",
    historial: [],
    createdAt: now,
    updatedAt: now,
  };
  saveLocal([rec, ...list]);
  return rec;
}

export async function updateKey(id: string, patch: Partial<KeyRecord>): Promise<KeyRecord> {
  if (await checkServer()) {
    return apiFetch<KeyRecord>(`/keys/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  }
  const list = loadLocal();
  const idx = list.findIndex(k => k.id === id);
  if (idx === -1) throw new Error("No encontrada");
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  saveLocal(list);
  return list[idx];
}

export async function deleteKey(id: string): Promise<void> {
  if (await checkServer()) {
    await apiFetch(`/keys/${id}`, { method: "DELETE" });
    return;
  }
  saveLocal(loadLocal().filter(k => k.id !== id));
}

export async function addHistory(id: string, entry: Omit<KeyHistorial, "id">): Promise<KeyRecord> {
  if (await checkServer()) {
    return apiFetch<KeyRecord>(`/keys/${id}/history`, { method: "POST", body: JSON.stringify(entry) });
  }
  const list = loadLocal();
  const idx = list.findIndex(k => k.id === id);
  if (idx === -1) throw new Error("No encontrada");
  const h: KeyHistorial = { ...entry, id: `H-${Date.now()}` };
  list[idx].historial = [h, ...(list[idx].historial || [])];
  if (h.accion === "revision") list[idx].ultimaRevision = h.fecha.slice(0, 10);
  list[idx].updatedAt = new Date().toISOString();
  saveLocal(list);
  return list[idx];
}

// ── KPIs ──
export interface KeysKPIs {
  total: number;
  vigentes: number;     // revisión no vencida (basada en frecuencia)
  asignadas: number;    // estado=asignada y responsable presente
  conCopia: number;     // tieneCopia=true
  pctVigentes: number;
  pctAsignadas: number;
  pctConCopia: number;
}

export function computeKPIs(keys: KeyRecord[]): KeysKPIs {
  const total = keys.length;
  const today = new Date();
  let vigentes = 0;
  let asignadas = 0;
  let conCopia = 0;
  for (const k of keys) {
    if (k.estado === "retirada") continue;
    if (isRevisionVigente(k, today)) vigentes++;
    if (k.estado === "asignada" && k.responsable.trim()) asignadas++;
    if (k.tieneCopia) conCopia++;
  }
  const denom = Math.max(1, total);
  return {
    total,
    vigentes,
    asignadas,
    conCopia,
    pctVigentes: Math.round((vigentes / denom) * 100),
    pctAsignadas: Math.round((asignadas / denom) * 100),
    pctConCopia: Math.round((conCopia / denom) * 100),
  };
}

export function isRevisionVigente(k: KeyRecord, today = new Date()): boolean {
  if (!k.ultimaRevision) return false;
  const last = new Date(k.ultimaRevision);
  const days = (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return days <= (k.frecuenciaDias || 90);
}

export function nextRevisionDate(k: KeyRecord): string {
  if (!k.ultimaRevision) return "";
  const d = new Date(k.ultimaRevision);
  d.setDate(d.getDate() + (k.frecuenciaDias || 90));
  return d.toISOString().slice(0, 10);
}
