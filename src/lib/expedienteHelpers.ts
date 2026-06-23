import type { GeneralExpedientePuesto, GeneralExpedienteCliente, ExpedienteOverlayEntry, GeneralWeaponDetail } from "@/lib/api";

// "No letal" se muestra en toda la intranet como "Menos que letal".
export function displayCaliber(value?: string | null): string {
  const v = (value || "").trim();
  if (!v) return "—";
  if (/^no\s*letal$/i.test(v)) return "Menos que letal";
  return v;
}

export function displayWeaponType(value?: string | null): string {
  const v = (value || "").trim();
  if (!v) return "—";
  if (/^(no\s*letal|menos\s+que\s+letal|less\s+lethal)$/i.test(v)) return "Menos que letal";
  if (/^letal$/i.test(v)) return "Letal";
  return v;
}

// Clave estable para ocultar una línea del expediente (persiste aunque el OID
// del reporte diario cambie cada día): cliente · puesto · vigilante.
export function lineHideKey(cliente: GeneralExpedienteCliente, p: GeneralExpedientePuesto): string {
  const n = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const cli = cliente.codigo != null ? `c${cliente.codigo}` : n(cliente.nombre);
  return `${cli}|${n(p.puesto)}|${n(p.vigilante)}|${n(p.armaSerial)}`;
}

// Aplica las sobrescrituras de auditoría (overlay) sobre el arma de SQL/GENERAL.
export function applyWeaponOverride(
  arma: GeneralWeaponDetail | null,
  ov?: ExpedienteOverlayEntry,
): GeneralWeaponDetail | null {
  if (!arma && !ov) return null;
  const base: GeneralWeaponDetail = arma || {
    oid: null, serie: null, marca: null, tipo: null, calibre: null,
    categoria: null, noLicencia: null, estatus: null, propietario: null,
  };
  if (!ov) return base;
  return {
    ...base,
    marca: ov.marca ?? base.marca,
    tipo: ov.tipo ?? base.tipo,
    calibre: ov.calibre ?? base.calibre,
    categoria: ov.categoria ?? base.categoria,
    noLicencia: ov.noLicencia ?? base.noLicencia,
    estatus: ov.estatus ?? base.estatus,
    propietario: ov.propietario ?? base.propietario,
  };
}
