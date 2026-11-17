import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { canExploreSafeOne } from "./safeoneExplorerAccess";

const require = createRequire(import.meta.url);
const lib = require("../../backend/lib/safeoneExplorer.js");

describe("quién puede abrir el Explorador SafeOne", () => {
  it.each(["anoel@safeone.com.do", "tecnologia@safeone.com.do", "CFabian@safeone.com.do"])("%s puede", (email) => {
    expect(lib.canExplore({ email })).toBe(true);
    expect(canExploreSafeOne({ email })).toBe(true);
  });
  it("otro usuario no puede, aunque sea administrador", () => {
    expect(lib.canExplore({ email: "aperez@safeone.com.do", isAdmin: true })).toBe(false);
    expect(canExploreSafeOne({ email: "aperez@safeone.com.do" })).toBe(false);
  });
});

describe("seguridad de las consultas", () => {
  it("solo acepta tablas que existen en la base", () => {
    expect(lib.resolveName("cargoscp", ["CargosCP", "Trans"])).toBe("CargosCP");
    expect(lib.resolveName("CargosCP; DROP TABLE Trans", ["CargosCP", "Trans"])).toBeNull();
  });
  it("no devuelve contenido binario", () => {
    expect(lib.serializeRows([{ Imagen: Buffer.from([1, 2, 3]) }])[0].Imagen).toBe("[binario 3 bytes]");
  });
});

describe("foto antes / después", () => {
  it("muestra solo las tablas cuyo número creció", () => {
    const cambios = lib.diffIdentities({ CargosCP: 243369, Trans: 473823, Cliente: 56344 }, { CargosCP: 243370, Trans: 473826, Cliente: 56344 });
    expect(cambios).toEqual([
      { tabla: "Trans", antes: 473823, actual: 473826, nuevos: 3 },
      { tabla: "CargosCP", antes: 243369, actual: 243370, nuevos: 1 },
    ]);
  });
});
