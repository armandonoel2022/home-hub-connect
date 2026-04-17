// Fleet Maintenance data layer.
// Default data is bundled in src/data/fleetMaintenanceSeed.ts so a fresh
// production deploy from GitHub already shows the full dataset (no manual JSON copy).
// Local overrides (manual entries added through the UI) are stored in localStorage.

import { FLEET_SEED } from "@/data/fleetMaintenanceSeed";
import type {
  FleetSeed, FleetUnit, MaintenanceEntry, AnnualCostRow,
} from "./fleetMaintenanceTypes";

const STORAGE_KEY = "safeone_fleet_maintenance_v1";

interface PersistedShape {
  customEntries: MaintenanceEntry[];   // user-added entries on top of seed
  deletedEntryKeys: string[];           // composite keys of seed entries to hide
}

function loadPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { customEntries: [], deletedEntryKeys: [] };
    return JSON.parse(raw);
  } catch {
    return { customEntries: [], deletedEntryKeys: [] };
  }
}

function savePersisted(data: PersistedShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const entryKey = (e: MaintenanceEntry) =>
  `${e.placa}|${e.fecha}|${e.costo}|${e.detalle ?? ""}`;

export function getFleet(): FleetUnit[] {
  return FLEET_SEED.fleet;
}

export function getAnnualCost(): AnnualCostRow[] {
  return FLEET_SEED.annualCost;
}

export function getMaintenanceEntries(): MaintenanceEntry[] {
  const persisted = loadPersisted();
  const deleted = new Set(persisted.deletedEntryKeys);
  const seed = FLEET_SEED.maintenance.filter((e) => !deleted.has(entryKey(e)));
  return [...seed, ...persisted.customEntries].sort((a, b) =>
    a.fecha < b.fecha ? 1 : -1
  );
}

export function addMaintenanceEntry(e: MaintenanceEntry) {
  const p = loadPersisted();
  p.customEntries.unshift(e);
  savePersisted(p);
}

export function deleteMaintenanceEntry(e: MaintenanceEntry) {
  const p = loadPersisted();
  const key = entryKey(e);
  // try removing from custom first
  const idx = p.customEntries.findIndex((x) => entryKey(x) === key);
  if (idx >= 0) {
    p.customEntries.splice(idx, 1);
  } else {
    p.deletedEntryKeys.push(key);
  }
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
    if (e.taller) byTaller[e.taller] = (byTaller[e.taller] || 0) + e.costo;
  }
  return {
    total,
    entriesCount: entries.length,
    byKind,
    byPlaca,
    byMes,
    byTaller,
  };
}

export const formatRD = (n: number) =>
  `RD$ ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type { FleetSeed, FleetUnit, MaintenanceEntry, AnnualCostRow };
