// ── Fixed Assets Data Layer ──

export const ASSET_TYPES = [
  { code: "ARM", label: "Armas", icon: "Shield" },
  { code: "LAP", label: "Laptops", icon: "Laptop" },
  { code: "PC", label: "Computadoras", icon: "Monitor" },
  { code: "MON", label: "Monitores", icon: "MonitorSmartphone" },
  { code: "IMP", label: "Impresoras", icon: "Printer" },
  { code: "VEH", label: "Vehículos", icon: "Car" },
  { code: "MOT", label: "Motocicletas", icon: "Bike" },
  { code: "SIL", label: "Sillas/Sillones", icon: "Armchair" },
  { code: "ESC", label: "Escritorios/Mesas", icon: "Table" },
  { code: "ARC", label: "Archivos/Gavetas", icon: "Archive" },
  { code: "AAC", label: "Aires Acondicionados", icon: "Wind" },
  { code: "RAD", label: "Radios", icon: "Radio" },
  { code: "TEL", label: "Teléfonos", icon: "Phone" },
  { code: "CAM", label: "Cámaras/CCTV", icon: "Camera" },
  { code: "ELC", label: "Electrodomésticos", icon: "Refrigerator" },
  { code: "ENE", label: "Energía/UPS", icon: "Zap" },
  { code: "CAL", label: "Calculadoras", icon: "Calculator" },
  { code: "OFI", label: "Suministros Oficina", icon: "Paperclip" },
  { code: "OTR", label: "Otros", icon: "Package" },
] as const;

export type AssetTypeCode = typeof ASSET_TYPES[number]["code"];

export type AssetEstado = "asignado" | "disponible" | "prestado" | "almacenado" | "dado_de_baja";
export type AssetCondicion = "funcionando" | "averiado" | "en_reparacion" | "obsoleto";

export interface FixedAsset {
  id: string;
  codigoOriginal: string;
  tipo: AssetTypeCode;
  descripcion: string;
  marca: string;
  modelo: string;
  serial: string;
  fechaAdquisicion: string;
  costoAdquisicion: number;
  categoria: string;
  ubicacion: string;
  departamento: string;
  depreciacion: number;
  estado: AssetEstado;
  condicion: AssetCondicion;
  asignadoA: string;
  vidaUtilAnios?: number;
  notas?: string;
}

const STORAGE_KEY = "safeone_fixed_assets";
const LOADED_KEY = "safeone_fixed_assets_loaded";

export async function loadFixedAssets(): Promise<FixedAsset[]> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }

  // First load: fetch seed data
  if (!localStorage.getItem(LOADED_KEY)) {
    try {
      const res = await fetch("/data/fixed_assets_seed.json");
      if (res.ok) {
        const data: FixedAsset[] = await res.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(LOADED_KEY, "true");
        return data;
      }
    } catch { /* ignore */ }
  }

  return [];
}

export function saveFixedAssets(assets: FixedAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

export function generateAssetId(tipo: AssetTypeCode, assets: FixedAsset[]): string {
  const existing = assets.filter(a => a.tipo === tipo);
  const nums = existing.map(a => {
    const parts = a.id.split("-");
    return parseInt(parts[parts.length - 1], 10) || 0;
  });
  const next = (Math.max(0, ...nums) + 1).toString().padStart(5, "0");
  return `SSC-${tipo}-${next}`;
}

export function getAssetTypeLabel(code: string): string {
  return ASSET_TYPES.find(t => t.code === code)?.label || code;
}

export const ESTADOS: { value: AssetEstado; label: string; color: string }[] = [
  { value: "asignado", label: "Asignado", color: "hsl(220 70% 50%)" },
  { value: "disponible", label: "Disponible", color: "hsl(142 70% 45%)" },
  { value: "prestado", label: "Prestado", color: "hsl(42 100% 50%)" },
  { value: "almacenado", label: "Almacenado", color: "hsl(200 60% 50%)" },
  { value: "dado_de_baja", label: "Dado de Baja", color: "hsl(0 70% 50%)" },
];

export const CONDICIONES: { value: AssetCondicion; label: string; color: string }[] = [
  { value: "funcionando", label: "Funcionando", color: "hsl(142 70% 45%)" },
  { value: "averiado", label: "Averiado", color: "hsl(0 70% 50%)" },
  { value: "en_reparacion", label: "En Reparación", color: "hsl(42 100% 50%)" },
  { value: "obsoleto", label: "Obsoleto", color: "hsl(0 0% 50%)" },
];

export const UBICACIONES = [
  "Oficina Operaciones", "Oficina Administrativa", "Central Monitoreo",
  "Radios Ferreteria", "Oficina Gerencia", "Galerias 360",
  "OF. Plaza de la Salud", "Almacen", "Oficina Gerencia Comercial",
  "Oficina RRHH", "Gerencia IT y Seguridad Electronica", "Oficina de ventas",
  "Salon de Conferencia", "Operaciones Byes Romana", "Oficina area Tecnica",
  "Oficina Gerencia Recursos Humanos", "Oficina Global Transfer",
  "Lobby", "Recepcion", "Comedor",
];

export const DEPARTAMENTOS = ["Operaciones", "Administracion", "Tecnología", "RRHH", "Comercial", "Gerencia"];
