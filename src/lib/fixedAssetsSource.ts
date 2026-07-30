// ── Origen de datos del inventario de Activo Fijo ──
// Fuente primaria: [SafeOne].[dbo].[ActivoFijo] (base de datos).
// El JSON local queda solo como registros creados directamente en la intranet
// (aún no grabados en la base) y como respaldo/fallback sin conexión.

import { fixedAssetsSqlApi, type SafeOneActivoFijoRow } from "@/lib/api";
import { loadFixedAssets, type FixedAsset, type AssetTypeCode } from "@/lib/fixedAssetsData";

const OVERLAY_KEY = "safeone_fixed_assets_overlay_v1";

/** Campos operativos que NO existen en la base y se guardan localmente por OID. */
export interface AssetOverlay {
  tipo?: AssetTypeCode;
  estado?: FixedAsset["estado"];
  condicion?: FixedAsset["condicion"];
  vidaUtilAnios?: number;
  notas?: string;
}

export function loadOverlays(): Record<string, AssetOverlay> {
  try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || "{}"); } catch { return {}; }
}

export function saveOverlay(oid: number, patch: AssetOverlay) {
  const all = loadOverlays();
  all[String(oid)] = { ...all[String(oid)], ...patch };
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(all));
}

/** Heurística de tipo a partir de descripción / tipo / categoría de la base. */
export function guessTipo(text: string): AssetTypeCode {
  const t = (text || "").toUpperCase();
  const rules: [RegExp, AssetTypeCode][] = [
    [/PISTOL|ESCOPET|REVOLV|ARMA|FUSIL/, "ARM"],
    [/LAPTOP|PORTATIL|PORTÁTIL|NOTEBOOK/, "LAP"],
    [/MONITOR|PANTALLA|TELEVIS|TV\b/, "MON"],
    [/IMPRESOR|PRINTER|SCANNER|ESCANER|ESCÁNER/, "IMP"],
    [/CAMION|CAMIÓN|JEEP|CAMIONET|VEHIC|VEHÍC|AUTOM|CARRO/, "VEH"],
    [/MOTOR|MOTOCICL|SCOOTER/, "MOT"],
    [/SILL|BUTAC/, "SIL"],
    [/ESCRITORIO|MESA|MODULO|MÓDULO/, "ESC"],
    [/ARCHIV|GAVET|ESTANT/, "ARC"],
    [/AIRE|SPLIT|INVERTER|ACONDICION/, "AAC"],
    [/RADIO|BASTON|BASTÓN|TRANSMIS/, "RAD"],
    [/TELEFON|TELÉFON|CELULAR|SMARTPHONE/, "TEL"],
    [/CAMARA|CÁMARA|CCTV|DVR|NVR/, "CAM"],
    [/NEVERA|MICROOND|GREVER|ESTUFA|LAVADOR|ABANICO/, "ELC"],
    [/UPS|INVERSOR|BATERI|BATERÍ|PLANTA|GENERADOR/, "ENE"],
    [/CALCULADOR/, "CAL"],
    [/CPU|COMPUTAD|DESKTOP|SERVIDOR|PC\b/, "PC"],
    [/PAPEL|GRAPAD|SUMINISTR/, "OFI"],
  ];
  for (const [re, code] of rules) if (re.test(t)) return code;
  return "OTR";
}

const clean = (v: any) => {
  const s = v == null ? "" : String(v).trim();
  return s === "NULL" ? "" : s;
};

/** Convierte una fila de SafeOne al modelo de la intranet. */
export function mapSqlRowToAsset(
  r: SafeOneActivoFijoRow,
  overlays: Record<string, AssetOverlay> = {}
): FixedAsset {
  const ov = overlays[String(r.OID)] || {};
  const descripcion = clean(r.Descripcion);
  const tipo = ov.tipo || guessTipo(`${descripcion} ${clean((r as any).TipoNombre)} ${clean((r as any).CategoriaNombre)}`);
  const encargado = clean(r.Encargado);

  return {
    id: clean(r.CodigoBarra) || `AF-${r.OID}`,
    codigoOriginal: clean(r.CodigoBarra),
    tipo,
    descripcion,
    marca: clean((r as any).SuplidorNombre),
    modelo: clean(r.Modelo),
    serial: clean(r.Serial),
    fechaAdquisicion: r.FechaAdq ? String(r.FechaAdq).slice(0, 10) : "",
    costoAdquisicion: Number(r.CostoAdq) || 0,
    categoria: clean((r as any).CategoriaNombre) || clean((r as any).TipoNombre),
    ubicacion: clean(r.Ubicacion),
    departamento: clean(r.Departamento),
    depreciacion: Number(r.Depreciacion) || 0,
    estado: ov.estado || (r.Retirado ? "dado_de_baja" : encargado ? "asignado" : "disponible"),
    condicion: ov.condicion || (r.Retirado ? "obsoleto" : "funcionando"),
    asignadoA: encargado,
    vidaUtilAnios: ov.vidaUtilAnios,
    notas: ov.notas ?? clean(r.Comentario),
    sqlOid: r.OID,
    origen: "sql",
  };
}

export interface InventorySource {
  origen: "sql" | "local";
  assets: FixedAsset[];
  localOnly: FixedAsset[];
  message?: string;
}

/**
 * Carga el inventario desde la base de datos SafeOne.
 * Los activos del JSON que NO existen en la base (por serial o código) se
 * mantienen aparte como "registrados en la intranet" pendientes de grabar.
 */
export async function loadInventory(includeRetired = false): Promise<InventorySource> {
  const local = (await loadFixedAssets()).map(a => ({ ...a, origen: "intranet" as const }));
  try {
    const { rows } = await fixedAssetsSqlApi.list(includeRetired);
    const overlays = loadOverlays();
    const assets = rows.map(r => mapSqlRowToAsset(r, overlays));

    const norm = (s: any) => String(s ?? "").toUpperCase().replace(/[\s\-_/]/g, "");
    const keys = new Set<string>();
    assets.forEach(a => {
      if (a.serial) keys.add(norm(a.serial));
      if (a.codigoOriginal) keys.add(norm(a.codigoOriginal));
    });
    const localOnly = local.filter(a =>
      !(a.serial && keys.has(norm(a.serial))) && !(a.codigoOriginal && keys.has(norm(a.codigoOriginal))) && !keys.has(norm(a.id))
    );

    return { origen: "sql", assets, localOnly };
  } catch (e: any) {
    return { origen: "local", assets: local, localOnly: [], message: e?.message || "Sin conexión a SafeOne" };
  }
}
