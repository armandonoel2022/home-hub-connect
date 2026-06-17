// Operaciones — Expediente Digital del Cliente
// Modelo jerárquico: Cliente → Localidad → Puesto → Turno.
// El personal y el arma de cada puesto se alimentan del REPORTE DIARIO (el de ayer).
// Registro de bóveda (entrada/salida de armas del almacén) con FROM→TO.
//
// Persistencia: localStorage primario (funciona en preview) + sincronización
// best-effort con el backend local (JSON) cuando la API está configurada.

import type { ArmedPersonnel } from "@/lib/types";
import {
  isApiConfigured,
  opsClientsApi, opsLocationsApi, opsPostsApi, opsDailyReportsApi, vaultMovementsApi,
} from "@/lib/api";

// ─── Tipos ───
export interface OpsContrato {
  numero: string;
  inicio: string;
  fin: string;
}

export interface OpsClient {
  id: string;
  nombre: string;
  contrato: OpsContrato;
  coordinates: string;   // "lat,lng" o URL de Google Maps
  notas: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpsLocation {
  id: string;
  clientId: string;
  nombre: string;
  direccion: string;
  coordinates: string;
  mapsUrl: string;
  notas: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpsTurno {
  id: string;
  nombre: string;   // p.ej. Diurno, Nocturno, 24h
  horario: string;  // p.ej. "06:00 - 18:00"
}

export interface OpsPost {
  id: string;
  locationId: string;
  nombre: string;
  requiereArma: boolean;
  turnos: OpsTurno[];
  coordinates: string;
  notas: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyReport {
  id: string;
  fecha: string;          // YYYY-MM-DD
  postId: string;
  turnoId: string;
  personnelId: string;
  personnelName: string;
  presente: boolean;
  armaSerial: string;
  armaTipo: string;
  novedades: string;
  createdBy: string;
  createdAt: string;
}

export type VaultMovementType = "salida" | "entrada";

export interface VaultMovement {
  id: string;
  fecha: string;          // YYYY-MM-DD
  armaSerial: string;
  armaTipo: string;
  tipo: VaultMovementType; // salida = sale de bóveda; entrada = regresa a bóveda
  from: string;            // origen (Bóveda / nombre del puesto)
  to: string;              // destino (nombre del puesto / Bóveda)
  personnel: string;       // quién recibe/entrega el arma
  authorizedBy: string;    // quién autoriza
  notas: string;
  createdBy: string;
  createdAt: string;
}

// ─── Claves localStorage ───
const K_CLIENTS = "safeone_ops_clients_v1";
const K_LOCATIONS = "safeone_ops_locations_v1";
const K_POSTS = "safeone_ops_posts_v1";
const K_REPORTS = "safeone_ops_daily_reports_v1";
const K_VAULT = "safeone_vault_movements_v1";
const K_SEED = "safeone_ops_expediente_seed_v1";

export const VAULT_LABEL = "Bóveda / Almacén";
export const OPS_EVENT = "safeone:ops-expediente-updated";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function readLS<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch { /* noop */ }
  return [];
}

function writeLS<T>(key: string, list: T[]) {
  localStorage.setItem(key, JSON.stringify(list));
  try { window.dispatchEvent(new CustomEvent(OPS_EVENT)); } catch { /* noop */ }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Getters ───
export const getClients = () => readLS<OpsClient>(K_CLIENTS);
export const getLocations = () => readLS<OpsLocation>(K_LOCATIONS);
export const getPosts = () => readLS<OpsPost>(K_POSTS);
export const getDailyReports = () => readLS<DailyReport>(K_REPORTS);
export const getVaultMovements = () => readLS<VaultMovement>(K_VAULT);

export const getLocationsByClient = (clientId: string) =>
  getLocations().filter((l) => l.clientId === clientId);
export const getPostsByLocation = (locationId: string) =>
  getPosts().filter((p) => p.locationId === locationId);

// ─── Clientes ───
export function saveClient(input: Partial<OpsClient>): OpsClient {
  const list = getClients();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = list.findIndex((c) => c.id === input.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...input, updatedAt: now } as OpsClient;
      writeLS(K_CLIENTS, list);
      if (isApiConfigured()) opsClientsApi.update(input.id, list[idx]).catch(() => {});
      return list[idx];
    }
  }
  const created: OpsClient = {
    id: input.id || uid("OCL"),
    nombre: input.nombre || "",
    contrato: input.contrato || { numero: "", inicio: "", fin: "" },
    coordinates: input.coordinates || "",
    notas: input.notas || "",
    createdAt: now,
    updatedAt: now,
  };
  writeLS(K_CLIENTS, [created, ...list]);
  if (isApiConfigured()) opsClientsApi.create(created).catch(() => {});
  return created;
}

export function deleteClient(id: string) {
  writeLS(K_CLIENTS, getClients().filter((c) => c.id !== id));
  // cascada: localidades y puestos
  const locs = getLocationsByClient(id);
  locs.forEach((l) => deleteLocation(l.id, true));
  if (isApiConfigured()) opsClientsApi.remove(id).catch(() => {});
}

// ─── Localidades ───
export function saveLocation(input: Partial<OpsLocation>): OpsLocation {
  const list = getLocations();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = list.findIndex((l) => l.id === input.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...input, updatedAt: now } as OpsLocation;
      writeLS(K_LOCATIONS, list);
      if (isApiConfigured()) opsLocationsApi.update(input.id, list[idx]).catch(() => {});
      return list[idx];
    }
  }
  const created: OpsLocation = {
    id: input.id || uid("OLO"),
    clientId: input.clientId || "",
    nombre: input.nombre || "",
    direccion: input.direccion || "",
    coordinates: input.coordinates || "",
    mapsUrl: input.mapsUrl || "",
    notas: input.notas || "",
    createdAt: now,
    updatedAt: now,
  };
  writeLS(K_LOCATIONS, [created, ...list]);
  if (isApiConfigured()) opsLocationsApi.create(created).catch(() => {});
  return created;
}

export function deleteLocation(id: string, cascade = true) {
  writeLS(K_LOCATIONS, getLocations().filter((l) => l.id !== id));
  if (cascade) {
    getPostsByLocation(id).forEach((p) => deletePost(p.id));
  }
  if (isApiConfigured()) opsLocationsApi.remove(id).catch(() => {});
}

// ─── Puestos ───
export function savePost(input: Partial<OpsPost>): OpsPost {
  const list = getPosts();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = list.findIndex((p) => p.id === input.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...input, updatedAt: now } as OpsPost;
      writeLS(K_POSTS, list);
      if (isApiConfigured()) opsPostsApi.update(input.id, list[idx]).catch(() => {});
      return list[idx];
    }
  }
  const created: OpsPost = {
    id: input.id || uid("OPS"),
    locationId: input.locationId || "",
    nombre: input.nombre || "",
    requiereArma: input.requiereArma ?? false,
    turnos: input.turnos || [],
    coordinates: input.coordinates || "",
    notas: input.notas || "",
    createdAt: now,
    updatedAt: now,
  };
  writeLS(K_POSTS, [created, ...list]);
  if (isApiConfigured()) opsPostsApi.create(created).catch(() => {});
  return created;
}

export function deletePost(id: string) {
  writeLS(K_POSTS, getPosts().filter((p) => p.id !== id));
  if (isApiConfigured()) opsPostsApi.remove(id).catch(() => {});
}

// ─── Reporte Diario ───
export function saveDailyReport(input: Partial<DailyReport>): DailyReport {
  const list = getDailyReports();
  const created: DailyReport = {
    id: input.id || uid("ODR"),
    fecha: input.fecha || todayISO(),
    postId: input.postId || "",
    turnoId: input.turnoId || "",
    personnelId: input.personnelId || "",
    personnelName: input.personnelName || "",
    presente: input.presente ?? true,
    armaSerial: input.armaSerial || "",
    armaTipo: input.armaTipo || "",
    novedades: input.novedades || "",
    createdBy: input.createdBy || "",
    createdAt: new Date().toISOString(),
  };
  writeLS(K_REPORTS, [created, ...list]);
  if (isApiConfigured()) opsDailyReportsApi.create(created).catch(() => {});
  return created;
}

export function deleteDailyReport(id: string) {
  writeLS(K_REPORTS, getDailyReports().filter((r) => r.id !== id));
  if (isApiConfigured()) opsDailyReportsApi.remove(id).catch(() => {});
}

// Reemplaza el reporte de un puesto en una fecha por un nuevo set de filas.
export function replaceDailyReport(postId: string, fecha: string, rows: Partial<DailyReport>[], createdBy: string) {
  const remaining = getDailyReports().filter((r) => !(r.postId === postId && r.fecha === fecha));
  const now = new Date().toISOString();
  const created: DailyReport[] = rows.map((r) => ({
    id: uid("ODR"),
    fecha,
    postId,
    turnoId: r.turnoId || "",
    personnelId: r.personnelId || "",
    personnelName: r.personnelName || "",
    presente: r.presente ?? true,
    armaSerial: r.armaSerial || "",
    armaTipo: r.armaTipo || "",
    novedades: r.novedades || "",
    createdBy,
    createdAt: now,
  }));
  writeLS(K_REPORTS, [...created, ...remaining]);
  if (isApiConfigured()) created.forEach((c) => opsDailyReportsApi.create(c).catch(() => {}));
  return created;
}

// Última fecha con reporte para un puesto (preferimos ayer, sino la más reciente).
export function getLatestReportDate(postId: string): string | null {
  const dates = Array.from(new Set(getDailyReports().filter((r) => r.postId === postId).map((r) => r.fecha)));
  if (dates.length === 0) return null;
  const y = yesterdayISO();
  if (dates.includes(y)) return y;
  return dates.sort().reverse()[0];
}

// "Foto viva" del puesto: filas del último reporte disponible.
export function getLiveSnapshot(postId: string): DailyReport[] {
  const date = getLatestReportDate(postId);
  if (!date) return [];
  return getDailyReports().filter((r) => r.postId === postId && r.fecha === date);
}

// ─── Bóveda ───
export function saveVaultMovement(input: Partial<VaultMovement>): VaultMovement {
  const list = getVaultMovements();
  const created: VaultMovement = {
    id: input.id || uid("VMV"),
    fecha: input.fecha || todayISO(),
    armaSerial: input.armaSerial || "",
    armaTipo: input.armaTipo || "",
    tipo: input.tipo || "salida",
    from: input.from || "",
    to: input.to || "",
    personnel: input.personnel || "",
    authorizedBy: input.authorizedBy || "",
    notas: input.notas || "",
    createdBy: input.createdBy || "",
    createdAt: new Date().toISOString(),
  };
  writeLS(K_VAULT, [created, ...list]);
  if (isApiConfigured()) vaultMovementsApi.create(created).catch(() => {});
  return created;
}

export function deleteVaultMovement(id: string) {
  writeLS(K_VAULT, getVaultMovements().filter((m) => m.id !== id));
  if (isApiConfigured()) vaultMovementsApi.remove(id).catch(() => {});
}

// Ubicación actual de cada arma según el último movimiento (entrada vuelve a bóveda).
export interface WeaponLocationState {
  armaSerial: string;
  armaTipo: string;
  ubicacion: string;       // VAULT_LABEL o nombre del puesto/destino
  enBoveda: boolean;
  lastMovement: VaultMovement;
}

export function getWeaponLocations(): WeaponLocationState[] {
  const movements = getVaultMovements()
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // más reciente primero
  const seen = new Map<string, WeaponLocationState>();
  movements.forEach((m) => {
    if (!m.armaSerial || seen.has(m.armaSerial)) return;
    const enBoveda = m.tipo === "entrada";
    seen.set(m.armaSerial, {
      armaSerial: m.armaSerial,
      armaTipo: m.armaTipo,
      ubicacion: enBoveda ? VAULT_LABEL : m.to,
      enBoveda,
      lastMovement: m,
    });
  });
  return Array.from(seen.values());
}

export function getWeaponHistory(armaSerial: string): VaultMovement[] {
  return getVaultMovements()
    .filter((m) => m.armaSerial === armaSerial)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ─── Seed desde Personal Armado ───
function norm(s: string): string {
  return (s || "").trim();
}

export function seedFromPersonnel(personnel: ArmedPersonnel[], force = false): boolean {
  if (!force && (localStorage.getItem(K_SEED) || getClients().length > 0)) return false;
  if (!personnel || personnel.length === 0) return false;

  const now = new Date().toISOString();
  const clients: OpsClient[] = [];
  const locations: OpsLocation[] = [];
  const posts: OpsPost[] = [];
  const reports: DailyReport[] = [];
  const yest = yesterdayISO();

  const clientByName = new Map<string, OpsClient>();
  const locByKey = new Map<string, OpsLocation>();
  const postByKey = new Map<string, OpsPost>();

  const shiftName = (p: ArmedPersonnel): string => p.shiftType || "Diurno";

  personnel.forEach((p) => {
    if (p.status === "Inactivo") return;
    const clienteNom = norm(p.client) || "Cliente sin nombre";
    const localidadNom = norm(p.province) || "Sede Principal";
    const puestoNom = norm(p.location) || "Puesto General";

    // Cliente
    let client = clientByName.get(clienteNom.toLowerCase());
    if (!client) {
      client = {
        id: uid("OCL"), nombre: clienteNom,
        contrato: { numero: "", inicio: "", fin: "" },
        coordinates: "", notas: "", createdAt: now, updatedAt: now,
      };
      clientByName.set(clienteNom.toLowerCase(), client);
      clients.push(client);
    }

    // Localidad (por provincia dentro del cliente)
    const locKey = `${client.id}::${localidadNom.toLowerCase()}`;
    let loc = locByKey.get(locKey);
    if (!loc) {
      loc = {
        id: uid("OLO"), clientId: client.id, nombre: localidadNom,
        direccion: "", coordinates: p.coordinates || "", mapsUrl: "", notas: "",
        createdAt: now, updatedAt: now,
      };
      locByKey.set(locKey, loc);
      locations.push(loc);
    }

    // Puesto
    const postKey = `${loc.id}::${puestoNom.toLowerCase()}`;
    let post = postByKey.get(postKey);
    if (!post) {
      post = {
        id: uid("OPS"), locationId: loc.id, nombre: puestoNom,
        requiereArma: false, turnos: [], coordinates: p.coordinates || "",
        notas: "", createdAt: now, updatedAt: now,
      };
      postByKey.set(postKey, post);
      posts.push(post);
    }
    const hasWeapon = !!(p.weaponSerial || p.weaponType);
    if (hasWeapon) post.requiereArma = true;

    // Turno
    const tName = shiftName(p);
    let turno = post.turnos.find((t) => t.nombre.toLowerCase() === tName.toLowerCase());
    if (!turno) {
      turno = { id: uid("TRN"), nombre: tName, horario: p.shiftHours ? `${p.shiftHours}h` : "" };
      post.turnos.push(turno);
    }

    // Reporte diario semilla (de ayer) = foto viva del puesto
    reports.push({
      id: uid("ODR"), fecha: yest, postId: post.id, turnoId: turno.id,
      personnelId: p.id, personnelName: p.name || p.employeeCode,
      presente: p.status === "Activo",
      armaSerial: p.weaponSerial || "", armaTipo: p.weaponType || "",
      novedades: "", createdBy: "Semilla automática", createdAt: now,
    });
  });

  writeLS(K_CLIENTS, clients);
  writeLS(K_LOCATIONS, locations);
  writeLS(K_POSTS, posts);
  writeLS(K_REPORTS, reports);
  localStorage.setItem(K_SEED, "1");
  return true;
}

export function resetExpedienteSeed() {
  [K_CLIENTS, K_LOCATIONS, K_POSTS, K_REPORTS, K_SEED].forEach((k) => localStorage.removeItem(k));
}
