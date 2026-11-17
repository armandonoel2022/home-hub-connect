import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Reglas reales del servidor (CommonJS).
const rules = require("../../backend/lib/fleetDbSync.js");

const chrisnel = { email: "cfabian@safeone.com.do" };
const designada = { email: "lmartinez@safeone.com.do" };
const otro = { email: "anoel@safeone.com.do" };

describe("quién puede comparar gastos de flotilla con Adonis", () => {
  it("Chrisnel siempre puede", () => {
    expect(rules.canSync(chrisnel, { delegates: [] })).toBe(true);
  });
  it("la persona designada por Chrisnel puede", () => {
    expect(rules.canSync(designada, { delegates: ["LMartinez@safeone.com.do"] })).toBe(true);
  });
  it("nadie más puede, aunque sea administrador", () => {
    expect(rules.canSync({ ...otro, isAdmin: true }, { delegates: ["lmartinez@safeone.com.do"] })).toBe(false);
  });
  it("al quitar a la persona designada pierde el acceso", () => {
    expect(rules.canSync(designada, { delegates: [] })).toBe(false);
  });
  it("solo Chrisnel puede designar", () => {
    expect(rules.isOwner(chrisnel)).toBe(true);
    expect(rules.isOwner(designada)).toBe(false);
  });
});

// Factura real de Adonis (OID 243366): Moto Repuestos La Chercha, RD$1,200 + ITBIS 216.
const factura = (p: Record<string, unknown> = {}) => ({
  OID: 243366, Suplidor: 38048, SuplidorNombre: "MOTO REPUESTOS LA CHERCHA SRL",
  Fecha: new Date("2026-11-13T09:06:07Z"), FechaFactura: new Date("2026-11-13T09:06:07Z"),
  Referencia: "5139", NCF: "B0100005139", Valor: 1200, Itbis: 216,
  Notas: "Reparacion de motocicleta placa k2528728", ClasificacionCyG: "02", CajaChica: false, ...p,
});
const gasto = (p: Record<string, unknown> = {}) => ({
  id: "FM-0100", placa: "K2528728", fecha: "2026-11-12", costo: 1416, taller: "La Chercha, SRL", tipoMant: "Reparación", ...p,
});

describe("cruce intranet ↔ Adonis", () => {
  it("lee la placa escrita en las notas de la factura", () => {
    expect(rules.extractPlates("Reparacion de motocicleta placa k2528728", [])).toEqual(["K2528728"]);
  });
  it("vincula solo el gasto con misma placa, monto total y fecha cercana", () => {
    const { items } = rules.compareWithAdonis([gasto()], [factura()], []);
    expect(items[0]).toMatchObject({ estado: "vinculado", modo: "automatico" });
    expect(items[0].adonis.oid).toBe(243366);
  });
  it("también vincula si la intranet guardó el monto sin ITBIS", () => {
    const { items } = rules.compareWithAdonis([gasto({ costo: 1200 })], [factura()], []);
    expect(items[0].estado).toBe("vinculado");
  });
  it("no vincula solo si el monto es distinto; la deja como sugerencia", () => {
    const { items } = rules.compareWithAdonis([gasto({ costo: 900 })], [factura()], []);
    expect(items[0].estado).toBe("solo_intranet");
    expect(items[0].sugerencias.map((s: { oid: number }) => s.oid)).toEqual([243366]);
  });
  it("no vincula una factura de hace más de 20 días", () => {
    const { items } = rules.compareWithAdonis([gasto({ fecha: "2026-10-01" })], [factura()], []);
    expect(items[0].estado).toBe("solo_intranet");
  });
  it("una factura nunca se vincula a dos gastos", () => {
    const { items } = rules.compareWithAdonis([gasto(), gasto({ id: "FM-0101" })], [factura()], []);
    expect(items.filter((i: { estado: string }) => i.estado === "vinculado")).toHaveLength(1);
  });
  it("factura con placa de la flotilla sin gasto en la intranet queda como solo Adonis", () => {
    const { items } = rules.compareWithAdonis([], [factura()], ["K2528728"]);
    expect(items[0].estado).toBe("solo_adonis");
  });
  it("el vínculo confirmado a mano manda sobre el automático", () => {
    const { items } = rules.compareWithAdonis([gasto({ costo: 5, adonisOid: 243366 })], [factura()], []);
    expect(items[0]).toMatchObject({ estado: "vinculado", modo: "confirmado" });
  });
});
