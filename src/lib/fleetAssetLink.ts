// Vinculación entre placas de la flotilla y activos fijos (SSC-VEH / SSC-MOT)
import type { FixedAsset } from "./fixedAssetsData";
import { loadFixedAssets } from "./fixedAssetsData";

export interface LinkedAsset {
  asset: FixedAsset;
  matchedBy: "placa" | "descripcion" | "serial";
}

const norm = (s: string) => (s || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, "");

export async function getAssetsByPlaca(placa: string): Promise<LinkedAsset[]> {
  if (!placa) return [];
  const all = await loadFixedAssets();
  const target = norm(placa);
  const vehAssets = all.filter(a => a.tipo === "VEH" || a.tipo === "MOT");

  const matches: LinkedAsset[] = [];
  for (const a of vehAssets) {
    if (norm(a.serial) === target) { matches.push({ asset: a, matchedBy: "serial" }); continue; }
    const desc = norm(a.descripcion);
    const notas = norm(a.notas || "");
    if (desc.includes(target) || notas.includes(target)) {
      matches.push({ asset: a, matchedBy: desc.includes(target) ? "descripcion" : "placa" });
    }
  }
  return matches;
}

export async function buildPlacaIndex(): Promise<Map<string, FixedAsset>> {
  const all = await loadFixedAssets();
  const idx = new Map<string, FixedAsset>();
  for (const a of all.filter(x => x.tipo === "VEH" || x.tipo === "MOT")) {
    // Heuristic: placa often appears in descripcion or serial
    const tokens = [a.serial, a.descripcion, a.notas || ""]
      .join(" ")
      .toUpperCase()
      .split(/[\s,;\-/()]+/)
      .filter(t => t.length >= 4 && t.length <= 12);
    for (const t of tokens) {
      if (!idx.has(t)) idx.set(t, a);
    }
  }
  return idx;
}
