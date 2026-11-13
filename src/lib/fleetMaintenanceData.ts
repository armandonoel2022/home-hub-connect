// Fleet Maintenance data layer.
// Strategy:
//  1. Bundled seed (src/data/fleetMaintenanceSeed.ts) is the immediate display data
//     so deploys from GitHub show the dataset without manual JSON copy.
//  2. When the backend API is reachable, all CRUD goes through the server and
//     the server-side dataset (data/fleet-maintenance.json) is the source of truth.
//  3. When offline / no API, changes persist in this browser's localStorage only.
// Business rules (placa must exist, taller catalog, month from date) live in
// fleetMaintenanceRules.ts and are replicated by the backend route.

import { FLEET_SEED } from "@/data/fleetMaintenanceSeed";
import { fleetMaintenanceApi, isApiConfigured } from "@/lib/api";
import type {
  FleetSeed, FleetUnit, MaintenanceEntry, AnnualCostRow,
} from "./fleetMaintenanceTypes";
import {
  normalizeEntry, normalizePlaca, validateExpensePlaca, validateNewUnitPlaca,
  buildTallerCatalog, canonicalTaller, unitKind, unitDescription, monthlySeries, parseFecha,
} from "./fleetMaintenanceRules";

const STORAGE_KEY = "safeone_fleet_maintenance_v2";
const CACHE_KEY = "safeone_fleet_maintenance_cache_v1";

export type RegisteredUnit = FleetUnit & { fuente?: string };

interface PersistedShape {
  customEntries: MaintenanceEntry[];
  deletedEntryKeys: string[];
  customUnits: FleetUnit[];
  deletedUnitPlacas: string[];
  customTalleres: string[];
}

interface CachedShape {
  fleet: FleetUnit[];
  maintenance: MaintenanceEntry[];
  annualCost: AnnualCostRow[];
  talleres?: string[];
  registryUnits?: RegisteredUnit[];
  fetchedAt: string;
}

function loadPersisted(): PersistedShape {
  const empty = { customEntries: [], deletedEntryKeys: [], customUnits: [], deletedUnitPlacas: [], customTalleres: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const p = JSON.parse(raw);
    return {
      customEntries: p.customEntries || [],
      deletedEntryKeys: p.deletedEntryKeys || [],
      customUnits: p.customUnits || [],
      deletedUnitPlacas: p.deletedUnitPlacas || [],
      customTalleres: p.customTalleres || [],
    };
  } catch {
    return empty;
  }
}
function savePersisted(data: PersistedShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadCache(): CachedShape | null {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveCache(c: CachedShape) { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }

/** @deprecated use canonicalTaller from fleetMaintenanceRules */
export function normalizeTaller(name: string | null | undefined): string | null {
  return canonicalTaller(name, getTalleres());
}

const entryKey = (e: MaintenanceEntry) =>
  `${e.placa}|${e.fecha}|${e.costo}|${e.detalle ?? ""}`;

// ── Server sync ──
let serverMode = false;
let lastSync: string | null = null;
export function isServerMode() { return serverMode; }
export function getLastSync() { return lastSync; }

export async function refreshFromServer(): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    const data = await fleetMaintenanceApi.getAll();
    lastSync = new Date().toISOString();
    saveCache({
      fleet: data.fleet || [],
      maintenance: data.maintenance || [],
      annualCost: data.annualCost || [],
      talleres: data.talleres || [],
      registryUnits: data.registryUnits || [],
      fetchedAt: lastSync,
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
  if (cache) return cache.fleet;
  const p = loadPersisted();
  const deleted = new Set(p.deletedUnitPlacas.map(normalizePlaca));
  const seed = FLEET_SEED.fleet.filter(u => !deleted.has(normalizePlaca(u.placa)));
  return [...seed, ...p.customUnits];
}

/** Unidades válidas para registrar un gasto: Flotilla de este módulo + Flotilla Vehicular. */
export function getRegisteredUnits(): RegisteredUnit[] {
  const own: RegisteredUnit[] = getFleet().map(u => ({ ...u, fuente: "Flotilla" }));
  const extra = (serverMode ? loadCache()?.registryUnits : null) || [];
  const seen = new Set(own.map(u => normalizePlaca(u.placa)));
  return [...own, ...extra.filter(u => !seen.has(normalizePlaca(u.placa)))];
}

/** Hoja Excel original (referencia histórica para conciliar). */
export function getSheetAnnualCost(): AnnualCostRow[] {
  const cache = serverMode ? loadCache() : null;
  return cache?.annualCost?.length ? cache.annualCost : FLEET_SEED.annualCost;
}
/** @deprecated the annual table is now computed from entries (buildAnnualMatrix). */
export const getAnnualCost = getSheetAnnualCost;

export function getTalleres(): string[] {
  const cache = serverMode ? loadCache() : null;
  const stored = cache ? cache.talleres || [] : loadPersisted().customTalleres;
  const used = (cache ? cache.maintenance : FLEET_SEED.maintenance).map(e => e.taller);
  return buildTallerCatalog(stored, used);
}

export function getMaintenanceEntries(): MaintenanceEntry[] {
  const cache = serverMode ? loadCache() : null;
  let list: MaintenanceEntry[];
  if (cache) {
    list = cache.maintenance;
  } else {
    const persisted = loadPersisted();
    const deleted = new Set(persisted.deletedEntryKeys);
    const seed = FLEET_SEED.maintenance.filter(e => !deleted.has(entryKey(e)) && !deleted.has(entryKey(normalizeEntry(e))));
    list = [...seed, ...persisted.customEntries];
  }
  const catalog = buildTallerCatalog(cache?.talleres || [], []);
  return list
    .map(e => normalizeEntry(e, catalog))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

/** Gastos guardados solo en este navegador (no llegaron al servidor). */
export function getLocalOnlyEntries(): MaintenanceEntry[] {
  return loadPersisted().customEntries;
}

// ── Validation shared by create/update ──
function prepareEntry(e: MaintenanceEntry, previousPlaca?: string): MaintenanceEntry {
  const check = validateExpensePlaca(getRegisteredUnits(), e.placa);
  const keepsOld = previousPlaca && normalizePlaca(previousPlaca) === normalizePlaca(e.placa);
  if (!check.ok && !keepsOld) throw new Error(check.error);
  if (!parseFecha(e.fecha)) throw new Error("La fecha no es válida.");
  if (!(Number(e.costo) > 0)) throw new Error("El costo debe ser mayor que cero.");
  if (!String(e.taller || "").trim()) throw new Error("Debe seleccionar el taller.");
  const normalized = normalizeEntry(e, getTalleres());
  if (check.ok) {
    normalized.placa = check.placa;
    normalized.kind = unitKind(check.unit);
    normalized.unit = unitDescription(check.unit);
  }
  return normalized;
}

// ── Write API (CRUD) ──
export async function addMaintenanceEntry(e: MaintenanceEntry): Promise<MaintenanceEntry> {
  const normalized = prepareEntry(e);
  if (serverMode) {
    const created = await fleetMaintenanceApi.createEntry(normalized);
    await refreshFromServer();
    return created;
  }
  const p = loadPersisted();
  p.customEntries.unshift({ ...normalized, id: `LOCAL-${Date.now()}` } as MaintenanceEntry);
  savePersisted(p);
  return normalized;
}

export async function updateMaintenanceEntry(id: string, patch: MaintenanceEntry, previousPlaca?: string): Promise<void> {
  const data = prepareEntry(patch, previousPlaca);
  if (serverMode) {
    await fleetMaintenanceApi.updateEntry(id, data);
    await refreshFromServer();
    return;
  }
  const p = loadPersisted();
  const ci = p.customEntries.findIndex(e => (e as any).id === id);
  if (ci >= 0) {
    p.customEntries[ci] = { ...p.customEntries[ci], ...data } as MaintenanceEntry;
    savePersisted(p);
    return;
  }
  const seedEntry = FLEET_SEED.maintenance.find(e => (e as any).id === id || entryKey(e) === id || entryKey(normalizeEntry(e)) === id);
  if (seedEntry) {
    p.deletedEntryKeys.push(entryKey(seedEntry));
    p.customEntries.unshift({ ...seedEntry, ...data, id: `LOCAL-${Date.now()}` } as MaintenanceEntry);
    savePersisted(p);
  }
}

export async function deleteMaintenanceEntry(idOrEntry: string | MaintenanceEntry): Promise<void> {
  if (serverMode) {
    const id = typeof idOrEntry === "string" ? idOrEntry : (idOrEntry as any).id;
    if (id) {
      await fleetMaintenanceApi.deleteEntry(id);
      await refreshFromServer();
      return;
    }
  }
  const p = loadPersisted();
  if (typeof idOrEntry === "string") {
    const idx = p.customEntries.findIndex(e => (e as any).id === idOrEntry);
    if (idx >= 0) { p.customEntries.splice(idx, 1); savePersisted(p); return; }
    p.deletedEntryKeys.push(idOrEntry);
    savePersisted(p);
    return;
  }
  const key = entryKey(idOrEntry);
  const idx = p.customEntries.findIndex(x => entryKey(x) === key);
  if (idx >= 0) p.customEntries.splice(idx, 1);
  else p.deletedEntryKeys.push(key);
  savePersisted(p);
}

/** Sube al servidor los gastos que quedaron guardados solo en este navegador. */
export async function uploadLocalEntries(): Promise<{ uploaded: number; failed: { entry: MaintenanceEntry; error: string }[] }> {
  if (!serverMode) throw new Error("No hay conexión con el servidor.");
  const p = loadPersisted();
  const failed: { entry: MaintenanceEntry; error: string }[] = [];
  const remaining: MaintenanceEntry[] = [];
  let uploaded = 0;
  for (const e of p.customEntries) {
    try {
      const { id: _id, ...rest } = e as any;
      await fleetMaintenanceApi.createEntry(rest);
      uploaded++;
    } catch (err: any) {
      failed.push({ entry: e, error: err?.message || "Error" });
      remaining.push(e);
    }
  }
  p.customEntries = remaining;
  savePersisted(p);
  await refreshFromServer();
  return { uploaded, failed };
}

export async function addTaller(nombre: string): Promise<string> {
  const name = canonicalTaller(nombre, getTalleres());
  if (!name) throw new Error("El nombre del taller es obligatorio.");
  if (serverMode) {
    const r = await fleetMaintenanceApi.addTaller(name);
    await refreshFromServer();
    return r.nombre;
  }
  const p = loadPersisted();
  p.customTalleres = buildTallerCatalog(p.customTalleres, [name]);
  savePersisted(p);
  return name;
}

export async function addFleetUnit(u: Omit<FleetUnit, "no"> & { no?: number }): Promise<FleetUnit> {
  const check = validateNewUnitPlaca(getRegisteredUnits(), u.placa);
  if (!check.ok) throw new Error(check.error);
  const clean = { ...u, placa: check.placa };
  if (serverMode) {
    const created = await fleetMaintenanceApi.createUnit(clean);
    await refreshFromServer();
    return created;
  }
  const p = loadPersisted();
  const all = [...FLEET_SEED.fleet, ...p.customUnits];
  const nextNo = (all.reduce((m, x) => Math.max(m, Number(x.no) || 0), 0) || 0) + 1;
  const unit = { no: nextNo, ...clean } as FleetUnit;
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
  const ci = p.customUnits.findIndex(u => normalizePlaca(u.placa) === normalizePlaca(placa));
  if (ci >= 0) { p.customUnits[ci] = { ...p.customUnits[ci], ...patch, placa: p.customUnits[ci].placa }; savePersisted(p); return; }
  const seedU = FLEET_SEED.fleet.find(u => normalizePlaca(u.placa) === normalizePlaca(placa));
  if (seedU) {
    p.deletedUnitPlacas.push(normalizePlaca(placa));
    p.customUnits.push({ ...seedU, ...patch, placa: seedU.placa });
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
  const ci = p.customUnits.findIndex(u => normalizePlaca(u.placa) === normalizePlaca(placa));
  if (ci >= 0) p.customUnits.splice(ci, 1);
  else p.deletedUnitPlacas.push(normalizePlaca(placa));
  savePersisted(p);
}

// ── Aggregations ──
export function getTotals(entries: MaintenanceEntry[] = getMaintenanceEntries()) {
  const total = entries.reduce((s, e) => s + (e.costo || 0), 0);
  const byKind = { motocicleta: 0, vehiculo: 0 } as Record<string, number>;
  const byPlaca: Record<string, number> = {};
  const byTaller: Record<string, number> = {};
  for (const e of entries) {
    byKind[e.kind] = (byKind[e.kind] || 0) + e.costo;
    byPlaca[e.placa] = (byPlaca[e.placa] || 0) + e.costo;
    if (e.taller) byTaller[e.taller] = (byTaller[e.taller] || 0) + e.costo;
  }
  return { total, entriesCount: entries.length, byKind, byPlaca, byTaller, byMonth: monthlySeries(entries) };
}

export const formatRD = (n: number) =>
  `RD$ ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type { FleetSeed, FleetUnit, MaintenanceEntry, AnnualCostRow };
