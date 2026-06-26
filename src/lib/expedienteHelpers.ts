import type { GeneralExpedientePuesto, GeneralExpedienteCliente, ExpedienteOverlayEntry, GeneralWeaponDetail } from "@/lib/api";

// ¿El texto es una clasificación de letalidad (no un calibre real)?
const LETHALITY_RE = /^(no\s*letal|menos\s+que\s+letal|less\s+lethal|letal|lethal)$/i;

export function isLethalityLabel(value?: string | null): boolean {
  return LETHALITY_RE.test((value || "").trim());
}

// El campo Calibre debe mostrar SOLO un calibre real. En GENERAL el catálogo de
// "Calibre" a veces guarda la letalidad ("Menos que letal"/"Letal"); esos textos
// no son calibres, así que se ocultan (se muestran como —).
export function displayCaliber(value?: string | null): string {
  const v = (value || "").trim();
  if (!v || isLethalityLabel(v)) return "—";
  return v;
}

export function displayWeaponType(value?: string | null): string {
  const v = (value || "").trim();
  if (!v) return "—";
  if (/^(no\s*letal|menos\s+que\s+letal|less\s+lethal)$/i.test(v)) return "Menos que letal";
  if (/^letal$/i.test(v)) return "Letal";
  return v;
}

// gSafeOne a veces guarda textos-marcador en el campo SERIE en lugar de un
// número de serie real (p. ej. "ARMA ASIGNADA", "NO REQUIERE ARMA"). Estos no
// son seriales y no deben tratarse como armas reales.
const PLACEHOLDER_SERIAL_RE = /^(arma\s*asignada|no\s*requiere\s*arma|sin\s*arma|requiere\s*arma|n\/?a|ninguna?|—|-)$/i;

export function isPlaceholderSerial(serie?: string | null): boolean {
  return PLACEHOLDER_SERIAL_RE.test((serie || "").trim());
}

// Devuelve el serial real o null si está vacío o es un texto-marcador.
export function realSerial(serie?: string | null): string | null {
  const v = (serie || "").trim();
  if (!v || isPlaceholderSerial(v)) return null;
  return v;
}

// ¿El arma asociada tiene datos reales (más allá de un serial-marcador)?
function hasRealWeapon(p: { armaSerial?: string | null; arma?: GeneralWeaponDetail | null }): boolean {
  if (realSerial(p.armaSerial)) return true;
  const a = p.arma;
  return !!(a && (realSerial(a.serie) || a.marca || a.categoria || a.tipo || a.noLicencia));
}

// Requerimiento de arma efectivo: ignora marcadores "NO REQUIERE ARMA" y trata
// "ARMA ASIGNADA" sin arma real como que NO requiere arma.
export function postRequiresWeapon(p: { requiereArma?: boolean; armaSerial?: string | null; arma?: GeneralWeaponDetail | null }): boolean {
  const serie = (p.armaSerial || "").trim();
  if (/no\s*requiere\s*arma|sin\s*arma/i.test(serie)) return false;
  if (/arma\s*asignada/i.test(serie) && !hasRealWeapon(p)) return false;
  return !!p.requiereArma;
}

// Etiqueta de categoría del arma para mostrar junto al serial
// (Escopeta, Pistola, Revólver…). Cae a tipo/calibre solo si no hay categoría.
export function weaponCategoryLabel(
  arma?: { categoria?: string | null; tipo?: string | null; calibre?: string | null } | null,
  fallback?: string | null,
): string {
  const cat = (arma?.categoria || "").trim();
  if (cat) return cat;
  return displayWeaponType(arma?.tipo || arma?.calibre || fallback);
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
