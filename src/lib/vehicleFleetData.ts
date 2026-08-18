// Capa de datos de la Flotilla Vehicular.
// Server-first: si el backend Express está disponible todo el CRUD pasa por API.
// Si no (preview Lovable), persiste en localStorage. Sin data de ejemplo hardcoded.

import { fleetVehiclesApi, isApiConfigured } from "@/lib/api";
import type { Vehiculo, VehicleHistoryEntry } from "./vehicleTypes";

const STORAGE_KEY = "safeone_fleet_vehicles_v1";

let serverMode = false;
export const isVehicleServerMode = () => serverMode;

function readLocal(): Vehiculo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Vehiculo[]) : [];
  } catch {
    return [];
  }
}
/** Copia sin fotos (las imágenes base64 desbordan la cuota de localStorage). */
function stripDocs(items: Vehiculo[]): Vehiculo[] {
  return items.map((v) => ({ ...v, documentos: {} as Vehiculo["documentos"] }));
}

function writeLocal(items: Vehiculo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Cuota excedida: guardamos los datos sin las fotos para no perder el registro.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripDocs(items)));
    } catch {
      /* sin espacio: se ignora el caché local */
    }
  }
}


function nextId(items: Vehiculo[]) {
  const nums = items.map((v) => parseInt(String(v.id).replace(/\D/g, ""), 10) || 0);
  return `VEH-${String((Math.max(0, ...nums) || 0) + 1).padStart(4, "0")}`;
}

export function makeHistory(
  tipo: VehicleHistoryEntry["tipo"],
  descripcion: string,
  usuario: string
): VehicleHistoryEntry {
  return {
    id: `H-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fecha: new Date().toISOString(),
    tipo,
    descripcion,
    usuario: usuario || "Sistema",
  };
}

export async function listVehicles(includeInactive = false): Promise<Vehiculo[]> {
  if (isApiConfigured()) {
    try {
      const data = await fleetVehiclesApi.getAll(includeInactive);
      serverMode = true;
      writeLocal(stripDocs(data as Vehiculo[]));
      return data as Vehiculo[];
    } catch {
      serverMode = false;
    }
  } else {
    serverMode = false;
  }
  const local = readLocal();
  return includeInactive ? local : local.filter((v) => v.activo !== false);
}

function findDuplicate(items: Vehiculo[], v: Partial<Vehiculo>, ignoreId?: string) {
  const norm = (s?: string | null) => String(s || "").trim().toUpperCase();
  return items.find(
    (x) =>
      x.id !== ignoreId &&
      x.activo !== false &&
      ((norm(x.vin) && norm(x.vin) === norm(v.vin)) ||
        (norm(x.placa) && norm(x.placa) === norm(v.placa)) ||
        (norm(x.matricula) && norm(x.matricula) === norm(v.matricula)))
  );
}

export async function createVehicle(
  data: Omit<Vehiculo, "id" | "creadoEn" | "actualizadoEn">,
  usuario: string
): Promise<Vehiculo> {
  if (serverMode) {
    return (await fleetVehiclesApi.create({ ...data, creadoPor: usuario })) as Vehiculo;
  }
  const items = readLocal();
  const dup = findDuplicate(items, data);
  if (dup) throw new Error(`Ya existe un vehículo con ese VIN/placa/matrícula (${dup.id} — ${dup.placa})`);
  const now = new Date().toISOString();
  const vehicle: Vehiculo = {
    ...(data as Vehiculo),
    id: nextId(items),
    activo: true,
    creadoPor: usuario,
    historial: [makeHistory("creacion", "Vehículo registrado", usuario)],
    creadoEn: now,
    actualizadoEn: now,
  };
  writeLocal([...items, vehicle]);
  return vehicle;
}

export async function updateVehicle(
  id: string,
  data: Partial<Vehiculo>,
  extraHistory: VehicleHistoryEntry[] = []
): Promise<Vehiculo> {
  if (serverMode) {
    return (await fleetVehiclesApi.update(id, { ...data, __history: extraHistory })) as Vehiculo;
  }
  const items = readLocal();
  const idx = items.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error("Vehículo no encontrado");
  const dup = findDuplicate(items, { ...items[idx], ...data }, id);
  if (dup) throw new Error(`VIN/placa/matrícula duplicados con ${dup.id} — ${dup.placa}`);
  items[idx] = {
    ...items[idx],
    ...data,
    id,
    historial: [...(items[idx].historial || []), ...extraHistory],
    actualizadoEn: new Date().toISOString(),
  };
  writeLocal(items);
  return items[idx];
}

export async function deleteVehicle(id: string, motivo: string, usuario: string): Promise<void> {
  if (serverMode) {
    await fleetVehiclesApi.remove(id, motivo, usuario);
    return;
  }
  const items = readLocal();
  const idx = items.findIndex((v) => v.id === id);
  if (idx === -1) return;
  items[idx] = {
    ...items[idx],
    activo: false,
    estado: "Descargado",
    actualizadoEn: new Date().toISOString(),
    historial: [...(items[idx].historial || []), makeHistory("baja", motivo || "Vehículo descargado", usuario)],
  };
  writeLocal(items);
}

/** Comprime una imagen a JPEG dataURL (máx 1200px de ancho). */
export function compressImage(file: File, maxWidth = 1000, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no disponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
