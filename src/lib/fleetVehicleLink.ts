// Vínculo entre Flotilla — Mantenimiento y Flotilla Vehicular.
// La identidad del vehículo (foto, asignación, documentos, historial) vive en
// Flotilla Vehicular; Mantenimiento la enlaza por placa normalizada (VIN/chasis como respaldo).
import type { FleetUnit, MaintenanceEntry } from "./fleetMaintenanceTypes";
import type { Vehiculo, VehicleType } from "./vehicleTypes";
import { emptyVehicle } from "./vehicleTypes";
import { normalizePlaca, parseFecha } from "./fleetMaintenanceRules";

const normVin = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export interface VehicleIndex {
  byPlaca: Map<string, Vehiculo>;
  byVin: Map<string, Vehiculo>;
}

export type VehicleMatch = { vehicle: Vehiculo; matchedBy: "placa" | "vin" };

export function buildVehicleIndex(vehicles: Vehiculo[]): VehicleIndex {
  const byPlaca = new Map<string, Vehiculo>();
  const byVin = new Map<string, Vehiculo>();
  for (const v of vehicles) {
    if (v.activo === false) continue;
    const p = normalizePlaca(v.placa);
    const vin = normVin(v.vin);
    if (p && !byPlaca.has(p)) byPlaca.set(p, v);
    if (vin.length >= 6 && !byVin.has(vin)) byVin.set(vin, v);
  }
  return { byPlaca, byVin };
}

/** Busca el vehículo de Flotilla Vehicular que corresponde a una placa (y chasis opcional). */
export function matchVehicle(index: VehicleIndex, placa: unknown, chasis?: unknown): VehicleMatch | null {
  const p = normalizePlaca(placa);
  const byP = p ? index.byPlaca.get(p) : undefined;
  if (byP) return { vehicle: byP, matchedBy: "placa" };
  const vin = normVin(chasis);
  const byV = vin.length >= 6 ? index.byVin.get(vin) : undefined;
  return byV ? { vehicle: byV, matchedBy: "vin" } : null;
}

/** Tipo de la hoja de mantenimiento (JEEP, MOTOCICLETA…) → tipo de Flotilla Vehicular. */
export function toVehicleType(tipo: unknown): VehicleType {
  const t = String(tipo ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (t.includes("MOTO")) return "Motocicleta";
  if (t.includes("JEEP") || t.includes("SUV")) return "SUV";
  if (t.includes("CAMIONETA") || t.includes("PICK")) return "Camioneta";
  if (t.includes("FURGON") || t.includes("CARGA") || t.includes("VAN")) return "Furgon";
  if (t.includes("AUTO") || t.includes("CARRO") || t.includes("VEHICULO") || t.includes("SEDAN")) return "Automovil";
  return "Otro";
}

/** Ficha nueva de Flotilla Vehicular a partir de una unidad de Mantenimiento. */
export function unitToVehicleDraft(u: FleetUnit) {
  const base = emptyVehicle();
  const anio = Number(u.anio);
  return {
    ...base,
    tipo: toVehicleType(u.tipo),
    marca: String(u.marca ?? "").trim(),
    modelo: String(u.modelo ?? "").trim(),
    anio: Number.isFinite(anio) && anio > 1900 ? anio : base.anio,
    vin: String(u.chasis ?? "").trim(),
    placa: normalizePlaca(u.placa),
    color: String(u.color ?? "").trim(),
    capacidad: toVehicleType(u.tipo) === "Motocicleta" ? 2 : base.capacidad,
    seguro: u.aseguradora ? { compania: String(u.aseguradora).trim() } : {},
    observaciones: "Registrado desde Flotilla — Mantenimiento.",
  };
}

export interface MaintenanceSummary {
  count: number;
  total: number;
  lastFecha: string | null;
  lastKm: number | null;
  lastTaller: string | null;
}

/** Totales de mantenimiento de una placa. */
export function maintenanceSummary(entries: MaintenanceEntry[], placa: unknown): MaintenanceSummary {
  const key = normalizePlaca(placa);
  const list = entries
    .filter((e) => normalizePlaca(e.placa) === key)
    .sort((a, b) => (String(parseFecha(a.fecha)) < String(parseFecha(b.fecha)) ? 1 : -1));
  const withKm = list.find((e) => Number(e.kilometraje) > 0);
  return {
    count: list.length,
    total: list.reduce((s, e) => s + (Number(e.costo) || 0), 0),
    lastFecha: list[0] ? parseFecha(list[0].fecha) : null,
    lastKm: withKm ? Number(withKm.kilometraje) : null,
    lastTaller: list[0]?.taller ?? null,
  };
}

/** Responsable actual del vehículo según Flotilla Vehicular. */
export function vehicleAssignee(v: Vehiculo | undefined | null): string | null {
  return v?.asignacion?.empleadoNombre || v?.asignacion?.departamento || null;
}

export interface LinkageStats {
  total: number;
  linked: number;
  withPhoto: number;
  unlinked: FleetUnit[];
}

export function linkageStats(units: FleetUnit[], index: VehicleIndex): LinkageStats {
  let linked = 0;
  let withPhoto = 0;
  const unlinked: FleetUnit[] = [];
  for (const u of units) {
    const m = matchVehicle(index, u.placa, u.chasis);
    if (!m) { unlinked.push(u); continue; }
    linked++;
    if (m.vehicle.documentos?.fotoVehiculo) withPhoto++;
  }
  return { total: units.length, linked, withPhoto, unlinked };
}
