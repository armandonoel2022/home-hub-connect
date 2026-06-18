// Operaciones — Expediente Digital del Cliente
// Modelo jerárquico: Cliente → Localidad → Puesto → Turno.
// El personal y el arma de cada puesto se alimentan del REPORTE DIARIO (el de ayer).
// Registro de bóveda (entrada/salida de armas del almacén) con FROM→TO.
//
// Persistencia: localStorage primario (funciona en preview) + sincronización
// best-effort con el backend local (JSON) cuando la API está configurada.

import type { ArmedPersonnel } from "@/lib/types";
import { loadPosts, type WorkPost } from "@/lib/postsData";
import {
  isApiConfigured,
  opsClientsApi, opsLocationsApi, opsPostsApi, opsDailyReportsApi, vaultMovementsApi,
  type GeneralExpediente,
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
  origin?: "ops" | "manual";
  sourceKey?: string;
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
  origin?: "ops" | "manual";
  sourceKey?: string;
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
  origin?: "ops" | "manual";
  sourceKey?: string;
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
const K_SYNC_HASH = "safeone_ops_expediente_sync_hash_v1";

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
    origin: input.origin ?? "manual",
    sourceKey: input.sourceKey,
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
    origin: input.origin ?? "manual",
    sourceKey: input.sourceKey,
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
    origin: input.origin ?? "manual",
    sourceKey: input.sourceKey,
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

// ─── Sincronización con Operaciones (Personal Armado + Puestos) ───
// El Expediente "Manual" es un ESPEJO VIVO de Operaciones: se re-deriva la
// estructura y se MEZCLA con lo existente, conservando ediciones manuales.
function norm(s: string): string {
  return (s || "").trim();
}
function nkey(s: string): string {
  return norm(s).toLowerCase();
}

const AUTO_CREATED_BY = "Semilla automática";
const OPS_CREATED_BY = "Operaciones";

interface DerivedClient { sourceKey: string; nombre: string; coordinates: string; }
interface DerivedLoc { sourceKey: string; clientSK: string; nombre: string; coordinates: string; }
interface DerivedPost { sourceKey: string; locSK: string; nombre: string; requiereArma: boolean; turnos: Set<string>; coordinates: string; }
interface DerivedRow { turnoNombre: string; personnelId: string; personnelName: string; presente: boolean; armaSerial: string; armaTipo: string; }

function buildDerived(personnel: ArmedPersonnel[], workPosts: WorkPost[]) {
  const clients = new Map<string, DerivedClient>();
  const locs = new Map<string, DerivedLoc>();
  const posts = new Map<string, DerivedPost>();
  const reports = new Map<string, DerivedRow[]>();

  const ensureChain = (clienteNom: string, localidadNom: string, puestoNom: string, coord: string): string => {
    const cNom = norm(clienteNom) || "Cliente sin nombre";
    const lNom = norm(localidadNom) || "Sede Principal";
    const pNom = norm(puestoNom) || "Puesto General";
    const cSK = `c:${cNom.toLowerCase()}`;
    const lSK = `${cSK}|l:${lNom.toLowerCase()}`;
    const pSK = `${lSK}|p:${pNom.toLowerCase()}`;
    if (!clients.has(cSK)) clients.set(cSK, { sourceKey: cSK, nombre: cNom, coordinates: "" });
    if (!locs.has(lSK)) locs.set(lSK, { sourceKey: lSK, clientSK: cSK, nombre: lNom, coordinates: coord || "" });
    else if (coord && !locs.get(lSK)!.coordinates) locs.get(lSK)!.coordinates = coord;
    if (!posts.has(pSK)) posts.set(pSK, { sourceKey: pSK, locSK: lSK, nombre: pNom, requiereArma: false, turnos: new Set(), coordinates: coord || "" });
    else if (coord && !posts.get(pSK)!.coordinates) posts.get(pSK)!.coordinates = coord;
    if (!reports.has(pSK)) reports.set(pSK, []);
    return pSK;
  };

  (personnel || []).forEach((p) => {
    if (p.status === "Inactivo") return;
    const pSK = ensureChain(p.client, p.province, p.location, p.coordinates || "");
    const post = posts.get(pSK)!;
    if (p.weaponSerial || p.weaponType) post.requiereArma = true;
    const tName = p.shiftType || "Diurno";
    post.turnos.add(tName);
    reports.get(pSK)!.push({
      turnoNombre: tName,
      personnelId: p.id,
      personnelName: p.name || p.employeeCode,
      presente: p.status === "Activo",
      armaSerial: p.weaponSerial || "",
      armaTipo: p.weaponType || "",
    });
  });

  (workPosts || []).forEach((wp) => {
    const pSK = ensureChain(wp.cliente, wp.provincia, wp.nombre, wp.coordenada || "");
    const post = posts.get(pSK)!;
    if (wp.weapons && wp.weapons.length) post.requiereArma = true;
    const rows = reports.get(pSK)!;
    const existingNames = new Set(rows.map((r) => r.personnelName.toLowerCase()));
    const weapons = (wp.weapons || []).slice();

    (wp.guards || []).forEach((g, idx) => {
      const tName = g.shift || "Diurno";
      post.turnos.add(tName);
      if (existingNames.has(g.guardName.toLowerCase())) return;
      let w = weapons.find((x) => (x.assignedGuardIds || []).includes(g.id));
      if (!w) w = weapons[idx];
      rows.push({
        turnoNombre: tName,
        personnelId: g.id,
        personnelName: g.guardName,
        presente: true,
        armaSerial: w?.serial || "",
        armaTipo: w?.arma || "",
      });
      if (w) { const i = weapons.indexOf(w); if (i >= 0) weapons.splice(i, 1); }
    });

    // Armas sin agente asignado: se muestran igual para que se vean en el puesto.
    weapons.forEach((w) => {
      rows.push({
        turnoNombre: "Diurno",
        personnelId: w.id,
        personnelName: "(Arma sin asignar)",
        presente: true,
        armaSerial: w.serial || "",
        armaTipo: w.arma || "",
      });
    });
  });

  posts.forEach((p) => { if (p.turnos.size === 0) p.turnos.add("Diurno"); });
  return { clients, locs, posts, reports };
}

// Estructura derivada común (clientes/localidades/puestos/reportes) lista para
// volcar al Expediente Manual conservando ediciones manuales.
type Derived = ReturnType<typeof buildDerived>;

// Deriva la jerarquía a partir del Expediente "Vivo" (GENERAL/SQL Server).
function buildDerivedFromGeneral(general: GeneralExpediente): Derived {
  const clients = new Map<string, DerivedClient>();
  const locs = new Map<string, DerivedLoc>();
  const posts = new Map<string, DerivedPost>();
  const reports = new Map<string, DerivedRow[]>();

  const ensureChain = (clienteNom: string, localidadNom: string, puestoNom: string): string => {
    const cNom = norm(clienteNom) || "Cliente sin nombre";
    const lNom = norm(localidadNom) || "Sede Principal";
    const pNom = norm(puestoNom) || "Puesto General";
    const cSK = `c:${cNom.toLowerCase()}`;
    const lSK = `${cSK}|l:${lNom.toLowerCase()}`;
    const pSK = `${lSK}|p:${pNom.toLowerCase()}`;
    if (!clients.has(cSK)) clients.set(cSK, { sourceKey: cSK, nombre: cNom, coordinates: "" });
    if (!locs.has(lSK)) locs.set(lSK, { sourceKey: lSK, clientSK: cSK, nombre: lNom, coordinates: "" });
    if (!posts.has(pSK)) posts.set(pSK, { sourceKey: pSK, locSK: lSK, nombre: pNom, requiereArma: false, turnos: new Set(), coordinates: "" });
    if (!reports.has(pSK)) reports.set(pSK, []);
    return pSK;
  };

  (general?.clientes || []).forEach((c) => {
    (c.puestos || []).forEach((p) => {
      const pSK = ensureChain(c.nombre, p.localidad || "", p.puesto || "");
      const post = posts.get(pSK)!;
      if (p.armaSerial || p.requiereArma) post.requiereArma = true;
      const tName = "Diurno";
      post.turnos.add(tName);
      reports.get(pSK)!.push({
        turnoNombre: tName,
        personnelId: String(p.lineaOID ?? p.vigilanteOID ?? ""),
        personnelName: p.vigilante || "(Sin asignar)",
        presente: true,
        armaSerial: p.armaSerial || "",
        armaTipo: p.armaModelo || p.arma?.tipo || "",
      });
    });
  });

  posts.forEach((p) => { if (p.turnos.size === 0) p.turnos.add("Diurno"); });
  return { clients, locs, posts, reports };
}

// Vuelca la estructura derivada al Expediente Manual conservando ediciones
// manuales (origin "manual"). Devuelve true si hubo cambios.
function applyDerived(derived: Derived, force: boolean): boolean {
  const hash = JSON.stringify({
    c: Array.from(derived.clients.values()),
    l: Array.from(derived.locs.values()),
    p: Array.from(derived.posts.values()).map((x) => ({ ...x, turnos: Array.from(x.turnos) })),
    r: Array.from(derived.reports.entries()),
  });
  if (!force && localStorage.getItem(K_SYNC_HASH) === hash && getClients().length > 0) return false;

  const now = new Date().toISOString();
  const yest = yesterdayISO();
  const isManual = (o: { origin?: string }) => o.origin === "manual";

  const exClients = getClients();
  const exLocs = getLocations();
  const exPosts = getPosts();
  const exReports = getDailyReports();

  // ── Clientes ──
  const exClientBySK = new Map<string, OpsClient>();
  exClients.forEach((c) => { if (!isManual(c)) exClientBySK.set(c.sourceKey || `c:${nkey(c.nombre)}`, c); });
  const finalClients: OpsClient[] = exClients.filter(isManual);
  const clientIdBySK = new Map<string, string>();
  derived.clients.forEach((d, sk) => {
    const ex = exClientBySK.get(sk);
    if (ex) {
      const merged: OpsClient = { ...ex, nombre: d.nombre, origin: "ops", sourceKey: sk, coordinates: ex.coordinates || d.coordinates || "", updatedAt: now };
      finalClients.push(merged);
      clientIdBySK.set(sk, merged.id);
    } else {
      const id = uid("OCL");
      finalClients.push({ id, nombre: d.nombre, contrato: { numero: "", inicio: "", fin: "" }, coordinates: d.coordinates || "", notas: "", origin: "ops", sourceKey: sk, createdAt: now, updatedAt: now });
      clientIdBySK.set(sk, id);
    }
  });

  // ── Localidades ──
  const exClientNameById = new Map(exClients.map((c) => [c.id, c.nombre]));
  const locSK = (l: OpsLocation) => l.sourceKey || `c:${nkey(exClientNameById.get(l.clientId) || "")}|l:${nkey(l.nombre)}`;
  const exLocBySK = new Map<string, OpsLocation>();
  exLocs.forEach((l) => { if (!isManual(l)) exLocBySK.set(locSK(l), l); });
  const finalLocs: OpsLocation[] = exLocs.filter(isManual);
  const locIdBySK = new Map<string, string>();
  derived.locs.forEach((d, sk) => {
    const clientId = clientIdBySK.get(d.clientSK);
    if (!clientId) return;
    const ex = exLocBySK.get(sk);
    if (ex) {
      const merged: OpsLocation = { ...ex, clientId, nombre: d.nombre, origin: "ops", sourceKey: sk, coordinates: ex.coordinates || d.coordinates || "", updatedAt: now };
      finalLocs.push(merged);
      locIdBySK.set(sk, merged.id);
    } else {
      const id = uid("OLO");
      finalLocs.push({ id, clientId, nombre: d.nombre, direccion: "", coordinates: d.coordinates || "", mapsUrl: "", notas: "", origin: "ops", sourceKey: sk, createdAt: now, updatedAt: now });
      locIdBySK.set(sk, id);
    }
  });

  // ── Puestos ──
  const exLocSkById = new Map<string, string>();
  exLocs.forEach((l) => exLocSkById.set(l.id, locSK(l)));
  const exPostBySK = new Map<string, OpsPost>();
  exPosts.forEach((p) => { if (!isManual(p)) exPostBySK.set(p.sourceKey || `${exLocSkById.get(p.locationId) || ""}|p:${nkey(p.nombre)}`, p); });
  const finalPosts: OpsPost[] = exPosts.filter(isManual);
  const postIdBySK = new Map<string, string>();
  const postById = new Map<string, OpsPost>();
  derived.posts.forEach((d, sk) => {
    const locationId = locIdBySK.get(d.locSK);
    if (!locationId) return;
    const turnosArr = Array.from(d.turnos);
    const ex = exPostBySK.get(sk);
    let fp: OpsPost;
    if (ex) {
      const turnos = ex.turnos.slice();
      turnosArr.forEach((tn) => { if (!turnos.some((t) => nkey(t.nombre) === nkey(tn))) turnos.push({ id: uid("TRN"), nombre: tn, horario: "" }); });
      fp = { ...ex, locationId, nombre: d.nombre, requiereArma: ex.requiereArma || d.requiereArma, origin: "ops", sourceKey: sk, coordinates: ex.coordinates || d.coordinates || "", turnos, updatedAt: now };
    } else {
      fp = { id: uid("OPS"), locationId, nombre: d.nombre, requiereArma: d.requiereArma, turnos: turnosArr.map((tn) => ({ id: uid("TRN"), nombre: tn, horario: "" })), coordinates: d.coordinates || "", notas: "", origin: "ops", sourceKey: sk, createdAt: now, updatedAt: now };
    }
    finalPosts.push(fp);
    postIdBySK.set(sk, fp.id);
    postById.set(fp.id, fp);
  });

  // ── Reportes (foto viva) ──
  const autoCreators = new Set([AUTO_CREATED_BY, OPS_CREATED_BY]);
  const manualPostIds = new Set(finalPosts.filter(isManual).map((p) => p.id));
  const allPostIds = new Set(finalPosts.map((p) => p.id));
  const preserved = exReports.filter((r) => (!autoCreators.has(r.createdBy) || manualPostIds.has(r.postId)) && allPostIds.has(r.postId));
  const newReports: DailyReport[] = [];
  derived.reports.forEach((rows, pSK) => {
    const postId = postIdBySK.get(pSK);
    if (!postId) return;
    const post = postById.get(postId)!;
    rows.forEach((row) => {
      const turno = post.turnos.find((t) => nkey(t.nombre) === nkey(row.turnoNombre)) || post.turnos[0];
      newReports.push({
        id: uid("ODR"), fecha: yest, postId, turnoId: turno?.id || "",
        personnelId: row.personnelId, personnelName: row.personnelName,
        presente: row.presente, armaSerial: row.armaSerial, armaTipo: row.armaTipo,
        novedades: "", createdBy: OPS_CREATED_BY, createdAt: now,
      });
    });
  });

  writeLS(K_CLIENTS, finalClients);
  writeLS(K_LOCATIONS, finalLocs);
  writeLS(K_POSTS, finalPosts);
  writeLS(K_REPORTS, [...newReports, ...preserved]);
  localStorage.setItem(K_SYNC_HASH, hash);
  localStorage.setItem(K_SEED, "1");
  return true;
}

/**
 * Espejo vivo del Expediente Manual a partir de Operaciones.
 * (Conservado por compatibilidad; el Expediente ahora se alimenta de GENERAL.)
 */
export function syncFromOperaciones(personnel: ArmedPersonnel[], workPosts: WorkPost[], force = false): boolean {
  const ppl = personnel || [];
  const wps = workPosts || [];
  if (ppl.length === 0 && wps.length === 0) return false;
  return applyDerived(buildDerived(ppl, wps), force);
}

/**
 * Espejo vivo del Expediente Manual a partir de la conexión al servidor
 * (Expediente GENERAL/SQL). Esta es ahora la ÚNICA fuente del Manual para
 * evitar data basura proveniente de Operaciones.
 */
export function syncFromGeneral(general: GeneralExpediente | null, force = false): boolean {
  if (!general || !general.clientes || general.clientes.length === 0) return false;
  return applyDerived(buildDerivedFromGeneral(general), force);
}

// Compatibilidad: sembrar/sincronizar desde Personal Armado (+ Puestos guardados).
export function seedFromPersonnel(personnel: ArmedPersonnel[], force = false): boolean {
  let workPosts: WorkPost[] = [];
  try { workPosts = loadPosts(); } catch { /* noop */ }
  return syncFromOperaciones(personnel, workPosts, force);
}

export function resetExpedienteSeed() {
  [K_CLIENTS, K_LOCATIONS, K_POSTS, K_REPORTS, K_SEED, K_SYNC_HASH].forEach((k) => localStorage.removeItem(k));
}
