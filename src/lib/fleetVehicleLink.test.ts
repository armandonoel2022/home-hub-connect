import { describe, it, expect } from "vitest";
import { buildVehicleIndex, matchVehicle, toVehicleType, unitToVehicleDraft, maintenanceSummary, linkageStats } from "./fleetVehicleLink";
import type { Vehiculo } from "./vehicleTypes";
import type { FleetUnit, MaintenanceEntry } from "./fleetMaintenanceTypes";

const veh = (p: Partial<Vehiculo>): Vehiculo => ({
  id: "VEH-0001", tipo: "Motocicleta", marca: "LONCIN", modelo: "PRUSS", anio: 2024, vin: "LLCLPP1A0PA100001",
  matricula: "", placa: "K2546292", color: "NEGRO", kilometraje: 0, capacidad: 2, combustible: "Gasolina",
  estado: "Activo", marbete: { fechaVencimiento: null, estado: "Pendiente" }, asignacion: { tipo: null },
  documentos: {}, historial: [], activo: true, creadoEn: "", actualizadoEn: "", creadoPor: "", ...p,
});
const unit = (p: Partial<FleetUnit>): FleetUnit => ({
  no: 1, tipo: "MOTOCICLETA", marca: "LONCIN", modelo: "PRUSS", anio: 2024, color: "NEGRO", chasis: "", placa: "K2546292", aseguradora: "", ...p,
});
const entry = (p: Partial<MaintenanceEntry>): MaintenanceEntry => ({
  kind: "motocicleta", unit: null, placa: "K2546292", mes: null, asignacion: null, fecha: "2026-01-03",
  tipoMant: "Mantenimiento", taller: "La Chercha, SRL", kilometraje: null, costo: 100, detalle: null, ...p,
});

describe("vínculo Mantenimiento ↔ Flotilla Vehicular", () => {
  it("encuentra el vehículo por placa aunque se escriba con guion o minúsculas", () => {
    const idx = buildVehicleIndex([veh({})]);
    expect(matchVehicle(idx, "k-2546292")?.vehicle.id).toBe("VEH-0001");
  });
  it("usa el chasis/VIN cuando la placa no coincide", () => {
    const idx = buildVehicleIndex([veh({ placa: "K0000001" })]);
    expect(matchVehicle(idx, "K2546292", "LLCLPP1A0PA100001")?.matchedBy).toBe("vin");
  });
  it("ignora vehículos descargados", () => {
    const idx = buildVehicleIndex([veh({ activo: false })]);
    expect(matchVehicle(idx, "K2546292")).toBeNull();
  });
  it("cuenta unidades vinculadas y con foto", () => {
    const idx = buildVehicleIndex([veh({ documentos: { fotoVehiculo: "data:x" } })]);
    const s = linkageStats([unit({}), unit({ placa: "L504477", chasis: "" })], idx);
    expect([s.linked, s.withPhoto, s.unlinked.length]).toEqual([1, 1, 1]);
  });
});

describe("registrar unidad en Flotilla Vehicular", () => {
  it("convierte JEEP en SUV y MOTOCICLETA en Motocicleta", () => {
    expect(toVehicleType("JEEP")).toBe("SUV");
    expect(toVehicleType("MOTOCICLETA ")).toBe("Motocicleta");
  });
  it("usa el chasis como VIN y normaliza la placa", () => {
    const d = unitToVehicleDraft(unit({ chasis: "MF3PB812ESJ149908", placa: "g-601495" }));
    expect([d.vin, d.placa]).toEqual(["MF3PB812ESJ149908", "G601495"]);
  });
});

describe("resumen de mantenimiento por placa", () => {
  it("suma costos y toma la fecha y kilometraje más recientes", () => {
    const s = maintenanceSummary([
      entry({ fecha: "2026-01-03", costo: 100, kilometraje: 1000 }),
      entry({ fecha: "2026-03-10", costo: 250, kilometraje: 2500 }),
      entry({ placa: "L504477", costo: 999 }),
    ], "K2546292");
    expect([s.count, s.total, s.lastFecha, s.lastKm]).toEqual([2, 350, "2026-03-10", 2500]);
  });
});
