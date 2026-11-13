import { describe, it, expect } from "vitest";
import {
  validateExpensePlaca, validateNewUnitPlaca, canonicalTaller, buildTallerCatalog,
  parseFecha, normalizeEntry, buildAnnualMatrix, monthlySeries,
} from "./fleetMaintenanceRules";
import type { FleetUnit, MaintenanceEntry } from "./fleetMaintenanceTypes";

const unit = (placa: string, tipo = "MOTOCICLETA"): FleetUnit => ({
  no: 1, tipo, marca: "LONCIN", modelo: "PRUSS", anio: 2024, color: "NEGRO", chasis: "X", placa, aseguradora: "",
});
const entry = (p: Partial<MaintenanceEntry>): MaintenanceEntry => ({
  kind: "motocicleta", unit: null, placa: "K2546292", mes: null, asignacion: null,
  fecha: "2026-01-03", tipoMant: "Mantenimiento", taller: "La Chercha, SRL", kilometraje: null, costo: 100, detalle: null, ...p,
});
const fleet = [unit("K2546292"), unit("L504477", "CAMIONETA")];

describe("placa en registro de gastos", () => {
  it("rechaza una placa que no está creada en la flotilla", () => {
    expect(validateExpensePlaca(fleet, "K9999999").ok).toBe(false);
  });
  it("acepta una placa creada aunque se digite en minúsculas o con guion", () => {
    const r = validateExpensePlaca(fleet, "k-2546292");
    expect(r.ok && r.placa).toBe("K2546292");
  });
  it("rechaza una placa vacía", () => {
    expect(validateExpensePlaca(fleet, "  ").ok).toBe(false);
  });
});

describe("placa al crear una unidad", () => {
  it("rechaza placas duplicadas", () => {
    expect(validateNewUnitPlaca(fleet, "l504477").ok).toBe(false);
  });
  it("rechaza formatos inválidos", () => {
    expect(validateNewUnitPlaca(fleet, "Pendiente").ok).toBe(false);
  });
  it("acepta una placa nueva con formato válido", () => {
    expect(validateNewUnitPlaca(fleet, "G601495").ok).toBe(true);
  });
});

describe("taller estandarizado", () => {
  it("unifica variantes de escritura del mismo taller", () => {
    expect(canonicalTaller("MotoServic Campe")).toBe("Moto Servic Campe");
    expect(canonicalTaller("la chercha srl")).toBe("La Chercha, SRL");
  });
  it("el catálogo no repite talleres escritos distinto", () => {
    const cat = buildTallerCatalog([], ["MotoServic Campe", "Moto Servic Campe", "Taller ambulante (caja Chica)"]);
    expect(cat.filter((t) => t.toLowerCase().includes("campe"))).toHaveLength(1);
    expect(cat.filter((t) => t.toLowerCase().includes("ambulante"))).toHaveLength(1);
  });
});

describe("fechas y meses", () => {
  it("interpreta fechas D-M-AA de la hoja original", () => {
    expect(parseFecha(" 8-11-25")).toBe("2025-11-08");
  });
  it("el mes se deriva siempre de la fecha", () => {
    expect(normalizeEntry(entry({ fecha: "2026-08-15", mes: "Enero" })).mes).toBe("Agosto");
  });
});

describe("costo anual calculado desde los registros", () => {
  const entries = [
    entry({ fecha: "2026-01-03", costo: 354 }),
    entry({ fecha: "2026-08-10", costo: 1000 }),
    entry({ fecha: "2026-08-20", costo: 500 }),
    entry({ fecha: "2025-11-08", costo: 999 }),
  ];
  it("incluye meses posteriores a abril (ej. agosto)", () => {
    const row = buildAnnualMatrix(entries, fleet, 2026).find((r) => r.placa === "K2546292")!;
    expect(row.monthly.agosto).toBe(1500);
    expect(row.monthly.enero).toBe(354);
    expect(row.total).toBe(1854);
  });
  it("no mezcla gastos de otro año", () => {
    const row = buildAnnualMatrix(entries, fleet, 2026).find((r) => r.placa === "K2546292")!;
    expect(row.monthly.noviembre).toBe(0);
  });
  it("muestra todas las unidades aunque no tengan gasto", () => {
    expect(buildAnnualMatrix(entries, fleet, 2026)).toHaveLength(2);
  });
  it("el gasto por mes separa noviembre 2025 de otros años y va en orden", () => {
    expect(monthlySeries(entries).map((m) => m.key)).toEqual(["2025-11", "2026-01", "2026-08"]);
  });
});
