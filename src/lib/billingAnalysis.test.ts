import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Reglas reales del servidor (CommonJS).
const b = require("../../backend/lib/billingAnalysis.js");

const fac = (numero: string, fecha: string, bruto: number, cliente: number, comentario = "Monitoreo de alarma") =>
  ({ oid: numero, numero, fecha, bruto, itbis: bruto * 0.18, neto: bruto * 1.18, cliente, comentario });

describe("frecuencia de facturación por meses, no por cantidad de facturas", () => {
  it("varias facturas en un solo mes es facturación aislada", () => {
    expect(b.frequencyOf(["2026-03", "2026-03", "2026-03"])).toBe("aislada");
  });
  it("facturas en enero, febrero y marzo es recurrente", () => {
    expect(b.frequencyOf(["2026-01", "2026-02", "2026-03"])).toBe("recurrente");
  });
  it("facturas en enero y octubre es ocasional", () => {
    expect(b.frequencyOf(["2026-01", "2026-10"])).toBe("ocasional");
  });
});

describe("tarifa recurrente estimada", () => {
  it("RD$1,500 repetido en 3 meses se sugiere como tarifa pendiente de validación", () => {
    const r = b.analyze({
      facturas: [fac("1", "2026-01-05", 1500, 7), fac("2", "2026-02-05", 1500, 7), fac("3", "2026-03-05", 1510, 7)],
      clientes: [{ oid: 7, nombre: "Cliente A" }],
    });
    const t = r.porCliente[0].tarifas[0];
    expect(t.importe).toBe(1500);
    expect(t.meses).toBe(3);
    expect(t.estado).toBe("Estimada – pendiente de validación");
  });
  it("un importe que aparece solo en 2 meses no se sugiere como tarifa", () => {
    const r = b.analyze({
      facturas: [fac("1", "2026-01-05", 1500, 7), fac("2", "2026-02-05", 1500, 7)],
      clientes: [{ oid: 7, nombre: "Cliente A" }],
    });
    expect(r.porCliente[0].tarifas).toHaveLength(0);
  });
});

describe("clasificación de servicios", () => {
  it("instalación de cámaras cuenta como instalación, no como ingreso recurrente", () => {
    expect(b.classifyConcept("Instalación de cámaras CCTV").categoria).toBe("instalacion");
  });
  it("una factura de mantenimiento no se cuenta como monitoreo", () => {
    expect(b.classifyConcept("Mantenimiento de panel de alarma").categoria).toBe("mantenimiento");
  });
  it("ANTARES DEL CARIBE nunca suma a monitoreo", () => {
    const r = b.analyze({
      facturas: [fac("1", "2026-01-05", 90000, 9, "Servicio de monitoreo y seguridad")],
      clientes: [{ oid: 9, nombre: "ANTARES DEL CARIBE SRL" }],
    });
    expect(r.resumen.monitoreoEstimado).toBe(0);
    expect(r.excluidos).toHaveLength(1);
  });
});

describe("acceso al análisis de facturación", () => {
  it("por defecto lo ve cualquier usuario de la intranet", () => {
    expect(b.canViewBilling({ email: "agente@safeone.com.do" }, { restringido: false, emails: [] })).toBe(true);
  });
  it("si se restringe, solo lo ven los correos de la lista", () => {
    const acc = { restringido: true, emails: ["sperez@safeone.com.do"] };
    expect(b.canViewBilling({ email: "agente@safeone.com.do" }, acc)).toBe(false);
    expect(b.canViewBilling({ email: "SPerez@safeone.com.do" }, acc)).toBe(true);
  });
  it("el super administrador siempre lo ve, aunque esté restringido", () => {
    expect(b.canViewBilling({ email: "tecnologia@safeone.com.do" }, { restringido: true, emails: [] })).toBe(true);
  });
});
