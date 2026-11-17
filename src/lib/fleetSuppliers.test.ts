import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { filterByPeriod, topUnitsBySpend } from "./fleetMaintenanceRules";
import { vehicleAssignee, vehicleDrivers } from "./fleetVehicleLink";
import type { MaintenanceEntry } from "./fleetMaintenanceTypes";
import type { Vehiculo } from "./vehicleTypes";

const require = createRequire(import.meta.url);
// Reglas reales del servidor (CommonJS).
const sup = require("../../backend/lib/fleetSuppliers.js");
const sync = require("../../backend/lib/fleetDbSync.js");

const SUPLIDORES = [
  { oid: 38048, nombre: "MOTO REPUESTOS LA CHERCHA SRL" },
  { oid: 2003, nombre: "GASTOS MENORES" },
  { oid: 5, nombre: "MOTORES DEL SUR SRL" },
];

describe("talleres con nombres parecidos se vinculan al suplidor de Adonis", () => {
  it("«La Chercha», «La Chercha, SRL» y «la chercha s.r.l.» son MOTO REPUESTOS LA CHERCHA SRL", () => {
    for (const n of ["La Chercha", "La Chercha, SRL", "la chercha s.r.l."]) {
      expect(sup.matchSupplier(n, SUPLIDORES)?.oid).toBe(38048);
    }
  });
  it("una palabra común como «Moto Repuestos» no basta para elegir un suplidor", () => {
    expect(sup.matchSupplier("Moto Repuestos", SUPLIDORES)).toBeNull();
  });
  it("las variantes se agrupan en una sola fila con sus gastos y monto", () => {
    const entries = [
      { taller: "La Chercha", costo: 1000 },
      { taller: "La Chercha, SRL", costo: 416 },
      { taller: "La Chercha", costo: 999, anulado: true },
    ];
    const [g] = sup.groupTalleres(entries, SUPLIDORES, {});
    expect(g.cantidad).toBe(2);
    expect(g.monto).toBe(1416);
    expect(g.sugerencia.oid).toBe(38048);
  });
});

describe("comparación con Adonis usando el suplidor del taller", () => {
  const invoice = (over: Record<string, unknown>) => ({
    OID: 1, Suplidor: 38048, SuplidorNombre: "MOTO REPUESTOS LA CHERCHA SRL", Fecha: "2026-11-13",
    Valor: 1200, Itbis: 216, Notas: "Reparación", ClasificacionCyG: "02", CajaChica: 0, ...over,
  });
  const gasto = { id: "FM-1", placa: "K2528728", fecha: "2026-11-12", costo: 1416, tallerOid: 38048 };

  it("vincula una factura sin placa en notas si es del mismo suplidor, monto y fecha", () => {
    const r = sync.compareWithAdonis([gasto], [invoice({})], ["K2528728"]);
    expect(r.items[0].estado).toBe("vinculado");
  });
  it("no vincula la factura del mismo suplidor si menciona otra placa", () => {
    const r = sync.compareWithAdonis([gasto], [invoice({ Notas: "Reparación placa K9999999" })], ["K2528728"]);
    expect(r.items.find((x: any) => x.intranet?.id === "FM-1").estado).toBe("solo_intranet");
  });
});

describe("filtros por año y mes", () => {
  const e = (placa: string, fecha: string, costo: number) => ({ placa, fecha, costo } as MaintenanceEntry);
  const list = [e("K1", "2025-03-10", 500), e("K1", "2026-03-02", 1000), e("K2", "2026-03-20", 3000), e("K1", "2026-04-01", 200)];

  it("año y mes filtran juntos", () => {
    expect(filterByPeriod(list, 2026, 3).map((x) => x.costo)).toEqual([1000, 3000]);
  });
  it("solo el mes trae ese mes de todos los años", () => {
    expect(filterByPeriod(list, null, 3)).toHaveLength(3);
  });
  it("el top de unidades respeta el período", () => {
    expect(topUnitsBySpend(list, 2026, 4)).toEqual([{ placa: "K1", total: 200, count: 1 }]);
    expect(topUnitsBySpend(list, null, null)[0]).toEqual({ placa: "K2", total: 3000, count: 1 });
  });
});

describe("vehículo con varios empleados por turnos", () => {
  it("muestra todos los empleados con su turno", () => {
    const v = { asignacion: { tipo: "Empleado", empleadoNombre: "Ana", empleados: [{ nombre: "Ana", turno: "Día" }, { nombre: "Luis", turno: "Noche" }] } } as unknown as Vehiculo;
    expect(vehicleDrivers(v)).toHaveLength(2);
    expect(vehicleAssignee(v)).toBe("Ana (Día) · Luis (Noche)");
  });
  it("las fichas antiguas con un solo empleado siguen funcionando", () => {
    const v = { asignacion: { tipo: "Empleado", empleadoNombre: "Pedro" } } as unknown as Vehiculo;
    expect(vehicleAssignee(v)).toBe("Pedro");
  });
});
