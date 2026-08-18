// Bóveda de Armas — capa de datos.
// Se alimenta EXACTAMENTE de la misma fuente que el Expediente de Clientes
// (GENERAL/gSafeOne + overlay local), pero enfocada solo en el armamento:
// qué hay registrado, qué está resguardado en bóveda y qué está en puesto.

import type { ArmaRow } from "@/components/operations/ArmasGlobalView";
import { VAULT_LABEL, type VaultMovement } from "@/lib/opsExpediente";

export type WeaponKind = "escopeta" | "revolver" | "pistola" | "otro";

export const KIND_LABEL: Record<WeaponKind, string> = {
  escopeta: "Escopetas",
  revolver: "Revólveres",
  pistola: "Pistolas",
  otro: "Otras",
};

/** Clasifica el arma por su categoría/tipo/calibre textual de GENERAL. */
export function classifyWeapon(...texts: Array<string | null | undefined>): WeaponKind {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/escopet|shotgun|calibre\s*12|12\s*ga|cal\.?\s*12/.test(t)) return "escopeta";
  if (/rev[oó]lver|revolver/.test(t)) return "revolver";
  if (/pistola|pistol|9\s*mm|9mm|\.?380|\.?45|glock|taurus|beretta/.test(t)) return "pistola";
  return "otro";
}

export interface VaultWeaponState {
  serial: string;
  kind: WeaponKind;
  tipo: string;
  marca: string;
  calibre: string;
  licencia: string;
  estatus: string;
  categoria: string;
  /** Ubicación actual: bóveda o puesto/cliente. */
  ubicacion: string;
  enBoveda: boolean;
  /** Empleado que tiene el arma (por movimiento) o vigilante del reporte. */
  asignadoA: string;
  asignadoCodigo: string;
  cliente: string;
  lastMovement?: VaultMovement;
}

/**
 * Combina el inventario del expediente con los movimientos registrados.
 * El último movimiento manda: `salida` → en puesto, `entrada` → en bóveda.
 */
export function buildVaultState(rows: ArmaRow[], movements: VaultMovement[]): VaultWeaponState[] {
  const last = new Map<string, VaultMovement>();
  movements
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .forEach((m) => { if (m.armaSerial) last.set(m.armaSerial.trim().toUpperCase(), m); });

  const seen = new Set<string>();
  const out: VaultWeaponState[] = [];

  rows.forEach((r) => {
    const serial = (r.serial || "").trim();
    if (!serial) return;
    const k = serial.toUpperCase();
    if (seen.has(k)) return;
    seen.add(k);

    const mv = last.get(k);
    const enBoveda = mv ? mv.tipo === "entrada" : r.enBoveda;
    out.push({
      serial,
      kind: classifyWeapon(r.categoria, r.tipo, r.marca, r.calibre),
      tipo: r.tipo || "—",
      marca: r.marca || "—",
      calibre: r.calibre || "—",
      licencia: r.licencia || "",
      estatus: r.estatus || "",
      categoria: r.categoria || "",
      ubicacion: enBoveda ? VAULT_LABEL : (mv ? mv.to : [r.cliente, r.puesto].filter(Boolean).join(" · ") || "En servicio"),
      enBoveda,
      asignadoA: enBoveda ? "" : (mv ? mv.personnel : r.vigilante || ""),
      asignadoCodigo: (mv?.empleadoCodigo as string) || "",
      cliente: r.cliente || "",
      lastMovement: mv,
    });
  });

  return out.sort((a, b) => a.serial.localeCompare(b.serial));
}

export interface KindCount { total: number; boveda: number; puesto: number }

export function countsByKind(list: VaultWeaponState[]): Record<WeaponKind, KindCount> {
  const base: Record<WeaponKind, KindCount> = {
    escopeta: { total: 0, boveda: 0, puesto: 0 },
    revolver: { total: 0, boveda: 0, puesto: 0 },
    pistola: { total: 0, boveda: 0, puesto: 0 },
    otro: { total: 0, boveda: 0, puesto: 0 },
  };
  list.forEach((w) => {
    const c = base[w.kind];
    c.total += 1;
    if (w.enBoveda) c.boveda += 1; else c.puesto += 1;
  });
  return base;
}

/** Validaciones de negocio para registrar un movimiento. */
export function validateMovement(
  w: VaultWeaponState | undefined,
  tipo: "entrega" | "devolucion",
  empleado: string,
): string | null {
  if (!w) return "Selecciona un arma del inventario.";
  if (!empleado) return "Selecciona el empleado activo.";
  if (tipo === "entrega" && !w.enBoveda) {
    return `El arma ${w.serial} ya está asignada${w.asignadoA ? ` a ${w.asignadoA}` : ""}. Registra primero su devolución.`;
  }
  if (tipo === "devolucion") {
    if (w.enBoveda) return `El arma ${w.serial} ya está en bóveda; no hay entrega pendiente.`;
    if (w.asignadoA && w.asignadoA.trim().toLowerCase() !== empleado.trim().toLowerCase()) {
      return `El arma ${w.serial} está asignada a ${w.asignadoA}; solo esa persona puede devolverla.`;
    }
  }
  return null;
}
