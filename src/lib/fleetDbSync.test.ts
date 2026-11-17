import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Reglas reales del servidor (CommonJS).
const rules = require("../../backend/lib/fleetDbSync.js");

const chrisnel = { email: "cfabian@safeone.com.do" };
const designada = { email: "lmartinez@safeone.com.do" };
const otro = { email: "anoel@safeone.com.do" };

describe("quién puede llevar gastos de flotilla a la base de datos", () => {
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

const gasto = (p: Record<string, unknown> = {}) => ({
  id: "FM-0001", placa: "K2546292", fecha: "2026-01-03", costo: 354, taller: "La Chercha, SRL",
  tipoMant: "Mantenimiento", kilometraje: null, detalle: "Cambio Cloche", ...p,
});
const fila = (p: Record<string, unknown> = {}) => ({
  OID: 7, IntranetId: "FM-0001", Placa: "K2546292", Fecha: new Date("2026-01-03T00:00:00Z"), Costo: 354,
  Taller: "La Chercha, SRL", TipoMantenimiento: "Mantenimiento", Kilometraje: null, Detalle: "Cambio Cloche", Anulado: false, ...p,
});

describe("comparación intranet vs base de datos", () => {
  it("un gasto que no está en la base queda pendiente", () => {
    const { items } = rules.compareRecords([gasto()], []);
    expect(items[0].estado).toBe("pendiente");
  });
  it("un gasto ya registrado igual queda sincronizado (no se registra dos veces)", () => {
    const { items } = rules.compareRecords([gasto()], [fila()]);
    expect(items[0].estado).toBe("sincronizado");
  });
  it("si el costo cambió en la intranet aparece como diferencia", () => {
    const { items } = rules.compareRecords([gasto({ costo: 500 })], [fila()]);
    expect(items[0].estado).toBe("diferente");
    expect(items[0].diferencias).toEqual([{ campo: "costo", etiqueta: "Costo", intranet: 500, baseDatos: 354 }]);
  });
  it("un gasto borrado en la intranet queda solo en la base para anularlo", () => {
    const { items } = rules.compareRecords([], [fila()]);
    expect(items[0].estado).toBe("solo_bd");
  });
  it("marca como posible duplicado el mismo gasto digitado dos veces", () => {
    const { items } = rules.compareRecords([gasto(), gasto({ id: "FM-0002" })], []);
    expect(items.every((i: { posibleDuplicado: boolean }) => i.posibleDuplicado)).toBe(true);
  });
  it("vincula el taller con el suplidor oficial aunque cambien acentos o SRL", () => {
    const match = rules.makeSuplidorMatcher([{ OID: 65156, Nombre: "LA CHERCHA SRL" }]);
    expect(match("La Chercha, S.R.L.")).toEqual({ oid: 65156, nombre: "LA CHERCHA SRL" });
  });
});
