/**
 * Weapon-Asset Linking Service
 * 
 * Links armed personnel weapon records with Fixed Assets (tipo=ARM)
 * by matching weapon serial numbers. Allows Remit Lopez to see
 * asset inventory data without accessing the Fixed Assets module.
 */

import type { FixedAsset } from "./fixedAssetsData";
import type { ArmedPersonnel } from "./types";

export interface LinkedWeaponAsset {
  assetId: string;          // SSC-ARM-XXXXX
  serial: string;
  descripcion: string;
  estado: string;
  condicion: string;
  fechaAdquisicion: string;
  costoAdquisicion: number;
  ubicacion: string;
  departamento: string;
  codigoOriginal: string;
  notas?: string;
}

/**
 * Normalize serial for comparison: trim, lowercase, remove leading zeros
 */
function normalizeSerial(s: string): string {
  return s.trim().toLowerCase().replace(/^0+/, "");
}

/**
 * Find the fixed asset (ARM type) that matches a personnel weapon serial.
 */
export function findLinkedAsset(
  personnel: ArmedPersonnel,
  fixedAssets: FixedAsset[]
): LinkedWeaponAsset | null {
  if (!personnel.weaponSerial || personnel.weaponSerial === "No visible" || personnel.weaponSerial === "Borrosos") {
    return null;
  }

  const normSerial = normalizeSerial(personnel.weaponSerial);
  if (!normSerial) return null;

  const match = fixedAssets.find(
    (a) => a.tipo === "ARM" && normalizeSerial(a.serial) === normSerial
  );

  if (!match) return null;

  return {
    assetId: match.id,
    serial: match.serial,
    descripcion: match.descripcion,
    estado: match.estado,
    condicion: match.condicion,
    fechaAdquisicion: match.fechaAdquisicion,
    costoAdquisicion: match.costoAdquisicion,
    ubicacion: match.ubicacion,
    departamento: match.departamento,
    codigoOriginal: match.codigoOriginal,
    notas: match.notas,
  };
}

/**
 * Build a map of all personnel → linked assets for batch display.
 */
export function buildWeaponAssetMap(
  personnel: ArmedPersonnel[],
  fixedAssets: FixedAsset[]
): Map<string, LinkedWeaponAsset> {
  const armAssets = fixedAssets.filter((a) => a.tipo === "ARM");
  const map = new Map<string, LinkedWeaponAsset>();

  for (const p of personnel) {
    const linked = findLinkedAsset(p, armAssets as FixedAsset[]);
    if (linked) {
      map.set(p.id, linked);
    }
  }

  return map;
}

/**
 * Get linking statistics for dashboard display.
 */
export function getLinkingStats(
  personnel: ArmedPersonnel[],
  assetMap: Map<string, LinkedWeaponAsset>
) {
  const withWeapon = personnel.filter((p) => p.weaponSerial && p.weaponSerial !== "No visible" && p.weaponSerial !== "Borrosos");
  const linked = withWeapon.filter((p) => assetMap.has(p.id));
  const unlinked = withWeapon.filter((p) => !assetMap.has(p.id));

  return {
    totalPersonnel: personnel.length,
    withWeapon: withWeapon.length,
    linked: linked.length,
    unlinked: unlinked.length,
    linkPercentage: withWeapon.length > 0 ? Math.round((linked.length / withWeapon.length) * 100) : 0,
    unlinkedRecords: unlinked,
  };
}
