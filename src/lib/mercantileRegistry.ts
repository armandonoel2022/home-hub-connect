/**
 * Registro Mercantil — helpers de estado y persistencia.
 *
 * Persistencia principal: backend JSON (mercantile-registry.json) en el
 * servidor local. Si el backend no está disponible (modo preview / sin API),
 * se usa localStorage con la clave `registrosMercantil` como respaldo, y se
 * sincroniza al backend en cuanto vuelve a estar disponible.
 */
import {
  isApiConfigured,
  mercantileRegistryApi,
  type MercantileRecord,
  type MercantileStore,
} from "@/lib/api";

export const LS_KEY = "registrosMercantil";

export type EstadoRegistro = "Vigente" | "Próximo a vencer" | "Vencido" | "Pendiente" | "Inactivo";

export interface EstadoInfo {
  estado: EstadoRegistro;
  /** Clases tailwind con tokens semánticos del design system */
  className: string;
  dot: string;
  dias: number | null;
}

export function calcularEstado(rec?: MercantileRecord | null): EstadoInfo {
  if (rec && rec.activo === false) {
    return { estado: "Inactivo", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", dias: null };
  }
  const vence = rec?.vence;
  if (!vence) {
    return { estado: "Pendiente", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", dias: null };
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${vence}T00:00:00`);
  const dias = Math.ceil((fin.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) {
    return { estado: "Vencido", className: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive", dias };
  }
  if (dias <= 30) {
    return { estado: "Próximo a vencer", className: "bg-amber-500/10 text-amber-600 border-amber-500/30", dot: "bg-amber-500", dias };
  }
  return { estado: "Vigente", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", dot: "bg-emerald-500", dias };
}

export const ESTADOS: EstadoRegistro[] = ["Vigente", "Próximo a vencer", "Vencido", "Pendiente", "Inactivo"];

// ─── localStorage (respaldo) ───

export function readLocalStore(): MercantileStore {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}") as MercantileStore;
  } catch {
    return {};
  }
}

export function writeLocalStore(store: MercantileStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

// ─── Operaciones (backend primero, localStorage de respaldo) ───

export async function loadStore(): Promise<MercantileStore> {
  if (isApiConfigured()) {
    try {
      const remote = await mercantileRegistryApi.all();
      writeLocalStore(remote || {});
      return remote || {};
    } catch {
      /* backend caído: se usa el respaldo local */
    }
  }
  return readLocalStore();
}

export function validarRegistro(rec: Partial<MercantileRecord>): string | null {
  if (!rec.registroMercantil?.trim()) return "El número de Registro Mercantil es obligatorio.";
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (rec.emision && !re.test(rec.emision)) return "Fecha de emisión inválida (YYYY-MM-DD).";
  if (rec.vence && !re.test(rec.vence)) return "Fecha de vencimiento inválida (YYYY-MM-DD).";
  if (rec.emision && rec.vence && rec.emision > rec.vence) {
    return "La fecha de emisión no puede ser mayor a la de vencimiento.";
  }
  return null;
}

export async function saveRegistro(clienteId: string | number, rec: Partial<MercantileRecord>): Promise<MercantileRecord> {
  const clean: MercantileRecord = {
    registroMercantil: (rec.registroMercantil || "").trim(),
    camaraComercio: (rec.camaraComercio || "").trim(),
    emision: (rec.emision || "").trim(),
    vence: (rec.vence || "").trim(),
    nota: (rec.nota || "").trim(),
    activo: rec.activo === false ? false : true,
    updatedAt: new Date().toISOString(),
  };
  if (isApiConfigured()) {
    try {
      const saved = await mercantileRegistryApi.save(clienteId, clean);
      const store = readLocalStore();
      store[String(clienteId)] = saved;
      writeLocalStore(store);
      return saved;
    } catch (e: any) {
      if (!String(e?.message || "").includes("API_NOT_CONFIGURED")) throw e;
    }
  }
  const store = readLocalStore();
  store[String(clienteId)] = clean;
  writeLocalStore(store);
  return clean;
}

export async function desactivarRegistro(clienteId: string | number, reason: string): Promise<MercantileRecord | null> {
  if (isApiConfigured()) {
    try {
      const saved = await mercantileRegistryApi.deactivate(clienteId, reason);
      const store = readLocalStore();
      store[String(clienteId)] = saved;
      writeLocalStore(store);
      return saved;
    } catch (e: any) {
      if (!String(e?.message || "").includes("API_NOT_CONFIGURED")) throw e;
    }
  }
  const store = readLocalStore();
  const cur = store[String(clienteId)];
  if (!cur) return null;
  const next = {
    ...cur,
    activo: false,
    nota: [cur.nota, `Desactivado: ${reason}`].filter(Boolean).join(" · "),
    updatedAt: new Date().toISOString(),
  };
  store[String(clienteId)] = next;
  writeLocalStore(store);
  return next;
}

export interface BulkRow {
  clienteId: string;
  registroMercantil: string;
  camaraComercio: string;
  emision: string;
  vence: string;
}

export interface BulkResult {
  total: number;
  exitos: number;
  errores: number;
  detalle: Array<{ fila: number; clienteId: string; ok: boolean; error?: string }>;
}

/** Parsea CSV: ClienteID,RegistroMercantil,CamaraComercio,Emision,Vence */
export function parseCsv(text: string): BulkRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0].toLowerCase();
  const body = first.includes("clienteid") ? lines.slice(1) : lines;
  return body.map((line) => {
    const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      clienteId: cols[0] || "",
      registroMercantil: cols[1] || "",
      camaraComercio: cols[2] || "",
      emision: cols[3] || "",
      vence: cols[4] || "",
    };
  });
}

export async function importarMasivo(rows: BulkRow[], validClientIds: string[]): Promise<BulkResult> {
  if (isApiConfigured()) {
    try {
      const res = await mercantileRegistryApi.bulk(rows, validClientIds);
      writeLocalStore(res.store || {});
      return { total: res.total, exitos: res.exitos, errores: res.errores, detalle: res.detalle };
    } catch (e: any) {
      if (!String(e?.message || "").includes("API_NOT_CONFIGURED")) throw e;
    }
  }
  // Respaldo local
  const store = readLocalStore();
  const valid = new Set(validClientIds.map(String));
  const detalle: BulkResult["detalle"] = [];
  let exitos = 0;
  rows.forEach((r, i) => {
    const fila = i + 1;
    if (!r.clienteId) { detalle.push({ fila, clienteId: r.clienteId, ok: false, error: "ClienteID vacío" }); return; }
    if (valid.size && !valid.has(r.clienteId)) {
      detalle.push({ fila, clienteId: r.clienteId, ok: false, error: "ClienteID no existe en la tabla Cliente" });
      return;
    }
    const err = validarRegistro(r);
    if (err) { detalle.push({ fila, clienteId: r.clienteId, ok: false, error: err }); return; }
    store[r.clienteId] = {
      registroMercantil: r.registroMercantil,
      camaraComercio: r.camaraComercio,
      emision: r.emision,
      vence: r.vence,
      activo: true,
      updatedAt: new Date().toISOString(),
    };
    exitos += 1;
    detalle.push({ fila, clienteId: r.clienteId, ok: true });
  });
  writeLocalStore(store);
  return { total: rows.length, exitos, errores: rows.length - exitos, detalle };
}
