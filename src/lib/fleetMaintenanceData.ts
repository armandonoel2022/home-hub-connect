// Fleet Maintenance data layer.
// Strategy:
//  1. Bundled seed (src/data/fleetMaintenanceSeed.ts) is the immediate display data
//     so deploys from GitHub show the dataset without manual JSON copy.
//  2. When the backend API is reachable, all CRUD goes through the server and
//     the server-side dataset becomes the source of truth (cached locally).
//  3. When offline / no API, changes persist in localStorage as before.

import { FLEET_SEED } from "@/data/fleetMaintenanceSeed";
import { fleetMaintenanceApi } from "@/lib/api";
import { isApiConfigured } from "@/lib/api";
import type {
  FleetSeed, FleetUnit, MaintenanceEntry, AnnualCostRow,
} from "./fleetMaintenanceTypes";

const STORAGE_KEY = "safeone_fleet_maintenance_v2";
const CACHE_KEY = "safeone_fleet_maintenance_cache_v1";

interface PersistedShape {
  customEntries: MaintenanceEntry[];
  deletedEntryKeys: string[];
  customUnits: FleetUnit[];
  deletedUnitPlacas: string[];
}

interface CachedShape {
  fleet: FleetUnit[];
  maintenance: MaintenanceEntry[];
  annualCost: AnnualCostRow[];
  fetchedAt: string;
}

function loadPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { customEntries: [], deletedEntryKeys: [], customUnits: [], deletedUnitPlacas: [] };
    const p = JSON.parse(raw);
    return {
      customEntries: p.customEntries || [],
      deletedEntryKeys: p.deletedEntryKeys || [],
      customUnits: p.customUnits || [],
      deletedUnitPlacas: p.deletedUnitPlacas || [],
    };
  } catch {
    return { customEntries: [], deletedEntryKeys: [], customUnits: [], deletedUnitPlacas: [] };
  }
}
function savePersisted(data: PersistedShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadCache(): CachedShape | null {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveCache(c: CachedShape) { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }

const TALLER_ALIASES: Record<string, string> = {
  "motoservic campe": "Moto Servic Campe",
};
export function normalizeTaller(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  const k = name.trim().toLowerCase();
  return TALLER_ALIASES[k] || name.trim();
}

const entryKey = (e: MaintenanceEntry) =>
  `${e.placa}|${e.fecha}|${e.costo}|${e.detalle ?? ""}`;

// ── Server sync ──
let serverMode = false;
export function isServerMode() { return serverMode; }

export async function refreshFromServer(): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    const data = await fleetMaintenanceApi.getAll();
    saveCache({
      fleet: data.fleet || [],
      maintenance: (data.maintenance || []).map((e: MaintenanceEntry) => ({ ...e, taller: normalizeTaller(e.taller) })),
      annualCost: data.annualCost || [],
      fetchedAt: new Date().toISOString(),
    });
    serverMode = true;
    return true;
  } catch {
    serverMode = false;
    return false;
  }
}

// ── Read API ──
export function getFleet(): FleetUnit[] {
  const cache = serverMode ? loadCache() : null;
  if (cache) {
    const p = loadPersisted();
    const deleted = new Set(p.deletedUnitPlacas);
    return cache.fleet.filter(u => !deleted.has(String(u.placa)));
  }
  const p = loadPersisted();
  const deleted = new Set(p.deletedUnitPlacas);
  const seed = FLEET_SEED.fleet.filter(u => !deleted.has(String(u.placa)));
  return [...seed, ...p.customUnits];
}

export function getAnnualCost(): AnnualCostRow[] {
  const cache = serverMode ? loadCache() : null;
  return cache?.annualCost || FLEET_SEED.annualCost;
}

export function getMaintenanceEntries(): MaintenanceEntry[] {
  const cache = serverMode ? loadCache() : null;
  if (cache) {
    return [...cache.maintenance].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }
  const persisted = loadPersisted();
  const deleted = new Set(persisted.deletedEntryKeys);
  const seed = FLEET_SEED.maintenance
    .filter(e => !deleted.has(entryKey(e)))
    .map(e => ({ ...e, taller: normalizeTaller(e.taller) }));
  return [...seed, ...persisted.customEntries].sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1
  );
}

// ── Write API (CRUD) ──
export async function addMaintenanceEntry(e: MaintenanceEntry): Promise<MaintenanceEntry> {
  const normalized = { ...e, taller: normalizeTaller(e.taller) };
  if (serverMode) {
    const created = await fleetMaintenanceApi.createEntry(normalized);
    await refreshFromServer();
    return created;
  }
  const p = loadPersisted();
  p.customEntries.unshift(normalized);
  savePersisted(p);
  return normalized;
}

export async function updateMaintenanceEntry(id: string, patch: Partial<MaintenanceEntry>): Promise<void> {
  const data = patch.taller !== undefined ? { ...patch, taller: normalizeTaller(patch.taller) } : patch;
  if (serverMode) {
    await fleetMaintenanceApi.updateEntry(id, data);
    await refreshFromServer();
    return;
  }
  // localStorage path: update by id in custom or convert seed to custom
  const p = loadPersisted();
  const ci = p.customEntries.findIndex(e => (e as any).id === id);
  if (ci >= 0) {
    p.customEntries[ci] = { ...p.customEntries[ci], ...data } as MaintenanceEntry;
    savePersisted(p);
    return;
  }
  // Editing a seed entry: mark deleted + add modified copy as custom
  const seedEntry = FLEET_SEED.maintenance.find(e => (e as any).id === id || entryKey(e) === id);
  if (seedEntry) {
    p.deletedEntryKeys.push(entryKey(seedEntry));
    p.customEntries.unshift({ ...seedEntry, ...data, taller: normalizeTaller((data as any).taller ?? seedEntry.taller) } as MaintenanceEntry);
    savePersisted(p);
  }
}

export async function deleteMaintenanceEntry(idOrEntry: string | MaintenanceEntry): Promise<void> {
  if (serverMode && typeof idOrEntry === "string") {
    await fleetMaintenanceApi.deleteEntry(idOrEntry);
    await refreshFromServer();
    return;
  }
  if (serverMode && typeof idOrEntry !== "string" && (idOrEntry as any).id) {
    await fleetMaintenanceApi.deleteEntry((idOrEntry as any).id);
    await refreshFromServer();
    return;
  }
  const p = loadPersisted();
  if (typeof idOrEntry === "string") {
    const idx = p.customEntries.findIndex(e => (e as any).id === idOrEntry);
    if (idx >= 0) { p.customEntries.splice(idx, 1); savePersisted(p); return; }
    return;
  }
  const e = idOrEntry;
  const key = entryKey(e);
  const idx = p.customEntries.findIndex(x => entryKey(x) === key);
  if (idx >= 0) p.customEntries.splice(idx, 1);
  else p.deletedEntryKeys.push(key);
  savePersisted(p);
}

export async function addFleetUnit(u: Omit<FleetUnit, "no"> & { no?: number }): Promise<FleetUnit> {
  if (serverMode) {
    const created = await fleetMaintenanceApi.createUnit(u);
    await refreshFromServer();
    return created;
  }
  const p = loadPersisted();
  const all = [...FLEET_SEED.fleet, ...p.customUnits];
  const nextNo = (all.reduce((m, x) => Math.max(m, Number(x.no) || 0), 0) || 0) + 1;
  const unit = { no: nextNo, ...u } as FleetUnit;
  p.customUnits.push(unit);
  savePersisted(p);
  return unit;
}

export async function updateFleetUnit(placa: string, patch: Partial<FleetUnit>): Promise<void> {
  if (serverMode) {
    await fleetMaintenanceApi.updateUnit(placa, patch);
    await refreshFromServer();
    return;
  }
  const p = loadPersisted();
  const ci = p.customUnits.findIndex(u => String(u.placa) === placa);
  if (ci >= 0) { p.customUnits[ci] = { ...p.customUnits[ci], ...patch }; savePersisted(p); return; }
  const seedU = FLEET_SEED.fleet.find(u => String(u.placa) === placa);
  if (seedU) {
    p.deletedUnitPlacas.push(placa);
    p.customUnits.push({ ...seedU, ...patch });
    savePersisted(p);
  }
}

export async function deleteFleetUnit(placa: string): Promise<void> {
  if (serverMode) {
    await fleetMaintenanceApi.deleteUnit(placa);
    await refreshFromServer();
    return;
  }
  const p = loadPersisted();
  const ci = p.customUnits.findIndex(u => String(u.placa) === placa);
  if (ci >= 0) p.customUnits.splice(ci, 1);
  else p.deletedUnitPlacas.push(placa);
  savePersisted(p);
}

// ── Aggregations ──
export function getTotals() {
  const entries = getMaintenanceEntries();
  const total = entries.reduce((s, e) => s + (e.costo || 0), 0);
  const byKind = { motocicleta: 0, vehiculo: 0 } as Record<string, number>;
  const byPlaca: Record<string, number> = {};
  const byMes: Record<string, number> = {};
  const byTaller: Record<string, number> = {};
  for (const e of entries) {
    byKind[e.kind] = (byKind[e.kind] || 0) + e.costo;
    byPlaca[e.placa] = (byPlaca[e.placa] || 0) + e.costo;
    if (e.mes) byMes[e.mes] = (byMes[e.mes] || 0) + e.costo;
    const taller = normalizeTaller(e.taller);
    if (taller) byTaller[taller] = (byTaller[taller] || 0) + e.costo;
  }
  return { total, entriesCount: entries.length, byKind, byPlaca, byMes, byTaller };
}

export const formatRD = (n: number) =>
  `RD$ ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type { FleetSeed, FleetUnit, MaintenanceEntry, AnnualCostRow };
