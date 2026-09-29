import { isApiConfigured, opsHrRequestsApi } from "@/lib/api";
import type { IntranetUser } from "@/lib/types";

export type OpsReqTipo = "Ingreso" | "Salida" | "Sustitución" | "Uniformes";
export type OpsVacante = "Fijo" | "Disponible" | "Cubre Libre";
export type OpsPrioridad = "Normal" | "Alta" | "Crítica";
export type OpsEstado =
  | "Borrador" | "Enviada a RRHH" | "En revisión" | "En reclutamiento" | "Candidato propuesto"
  | "Cubierta satisfactoriamente" | "Cerrada sin cobertura" | "Cancelada por Operaciones";

export const TIPOS: OpsReqTipo[] = ["Ingreso", "Salida", "Sustitución", "Uniformes"];
export const VACANTES: OpsVacante[] = ["Fijo", "Disponible", "Cubre Libre"];
export const PRIORIDADES: OpsPrioridad[] = ["Normal", "Alta", "Crítica"];
export const MOTIVOS = ["Incumplimiento de horario", "Solicitud del cliente", "Renuncia", "Abandono de puesto", "Suspensión", "Falta grave", "Otro"];
export const ESTADOS: OpsEstado[] = ["Borrador", "Enviada a RRHH", "En revisión", "En reclutamiento", "Candidato propuesto", "Cubierta satisfactoriamente", "Cerrada sin cobertura", "Cancelada por Operaciones"];
export const CLOSED: OpsEstado[] = ["Cubierta satisfactoriamente", "Cerrada sin cobertura", "Cancelada por Operaciones"];
export const SLA_HORAS: Record<OpsPrioridad, number> = { Crítica: 24, Alta: 72, Normal: 168 };

export const UNIFORM_CATEGORIES = [
  "Camisas mangas largas", "Camisas mangas cortas", "T-shirts", "Holster (funda o pistolera)",
  "Pantalones tipo Cargo con bolsillos laterales", "Pantalones", "Zapatos", "Botas tipo militar",
  "Gorras", "Correas", "Jackets", "Linternas", "Otros",
] as const;
export const UNIFORM_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "28", "30", "32", "34", "36", "38", "40", "42", "44"] as const;
export type OpsUniformCategory = typeof UNIFORM_CATEGORIES[number];
export interface OpsUniformItem {
  id: string;
  category: OpsUniformCategory;
  quantity: number;
  size?: string;
  customDescription?: string;
}

export const ESTADO_STYLE: Record<OpsEstado, string> = {
  Borrador: "bg-muted text-muted-foreground",
  "Enviada a RRHH": "bg-primary/15 text-primary",
  "En revisión": "bg-accent text-accent-foreground",
  "En reclutamiento": "bg-secondary text-secondary-foreground",
  "Candidato propuesto": "bg-primary/25 text-primary",
  "Cubierta satisfactoriamente": "bg-green-600/15 text-green-700 dark:text-green-400",
  "Cerrada sin cobertura": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "Cancelada por Operaciones": "bg-destructive/15 text-destructive",
};

export interface OpsComment { id: string; autor: string; autorEmail?: string; texto: string; fecha: string; origen?: "intranet" | "correo" }
export interface OpsHistory { fecha: string; usuario: string; anterior: string | null; nuevo: string; nota?: string }
export interface OpsAttachment { name: string; dataUrl: string; uploadedAt: string; by: string }

export interface OpsHrRequest {
  id: string;
  tipo: OpsReqTipo;
  tipoVacante: OpsVacante;
  clienteId: string; clienteNombre: string;
  localidadId: string; localidadNombre: string;
  puestoId: string; puestoNombre: string;
  turnoId: string; turnoNombre: string;
  supervisorResponsable: string; supervisorEmail?: string;
  agenteSalienteId?: string; agenteSalienteNombre?: string;
  agentePropuestoId?: string; agentePropuestoNombre?: string;
  uniformRecipientId?: string; uniformRecipientName?: string; uniformRecipientCode?: string;
  uniformItems?: OpsUniformItem[];
  motivoBaja?: string; motivoComentario?: string;
  fechaEfectiva: string;
  prioridad: OpsPrioridad;
  requiereCoberturaUrgente: boolean;
  notificarCliente?: boolean; clienteEmail?: string; clienteNotificadoEn?: string;
  estado: OpsEstado;
  responsableActualId?: string; responsableActual?: string;
  rrhhAsignado?: string; rrhhAsignadoEmail?: string;
  slaHoras: number;
  fechaLimiteSLA: string | null;
  adjuntos: OpsAttachment[];
  comentarios: OpsComment[];
  historialEstados: OpsHistory[];
  creadoPor: string; creadoPorId: string; creadoPorEmail?: string;
  fechaCreacion: string; fechaEnvio?: string | null; fechaCierre?: string | null;
  primerMovimientoRRHH?: string | null;
  cierreComentario?: string;
  _mail?: { sent: boolean; reason?: string };
}

// ─── Roles ───
export type OpsRole = "admin" | "rrhh" | "coordinador" | "supervisor";
const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function findDilia(users: IntranetUser[]) {
  return users.find(u => norm(u.fullName).includes("dilia") && norm(u.fullName).includes("aguasvivas"));
}
export function isOpsCoordinator(u: IntranetUser) {
  const e = norm(u.email); const n = norm(u.fullName);
  return e === "mmarte@safeone.com.do" || (n.includes("samuel") && n.includes("perez"));
}
export function opsRolesFor(u: IntranetUser | null, users: IntranetUser[]): Set<OpsRole> {
  const r = new Set<OpsRole>();
  if (!u) return r;
  r.add("supervisor");
  if (u.isAdmin) r.add("admin");
  if (isOpsCoordinator(u)) r.add("coordinador");
  const dilia = findDilia(users);
  if (norm(u.department).includes("recursos humanos") || (dilia && (u.id === dilia.id || u.reportsTo === dilia.id))) r.add("rrhh");
  return r;
}
export function rrhhTeam(users: IntranetUser[]) {
  const dilia = findDilia(users);
  return users.filter(u => u.employeeStatus !== "Inactivo" && (norm(u.department).includes("recursos humanos") || (dilia && (u.id === dilia.id || u.reportsTo === dilia.id))));
}

// ─── SLA ───
export type Semaforo = "verde" | "amarillo" | "rojo" | "gris";
export function semaforo(r: OpsHrRequest, now = Date.now()): Semaforo {
  if (!r.fechaLimiteSLA || !r.fechaEnvio) return "gris";
  const end = r.fechaCierre ? new Date(r.fechaCierre).getTime() : now;
  const start = new Date(r.fechaEnvio).getTime();
  const limit = new Date(r.fechaLimiteSLA).getTime();
  if (r.fechaCierre) return end <= limit ? "verde" : "rojo";
  const pct = (limit - end) / (limit - start);
  return pct > 0.5 ? "verde" : pct >= 0.25 ? "amarillo" : "rojo";
}

// ─── Persistencia (backend o local en vista previa) ───
const LS = "safeone_ops_hr_requests";
const LS_TPL = "safeone_ops_hr_templates";
const readLS = <T,>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };

export async function listRequests(): Promise<OpsHrRequest[]> {
  if (isApiConfigured()) return opsHrRequestsApi.list();
  return readLS<OpsHrRequest>(LS);
}
export async function createRequest(data: Partial<OpsHrRequest>): Promise<OpsHrRequest> {
  if (isApiConfigured()) return opsHrRequestsApi.create(data);
  const list = readLS<OpsHrRequest>(LS);
  const max = list.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0);
  const now = new Date();
  const slaHoras = SLA_HORAS[data.prioridad as OpsPrioridad] || 168;
  const r = {
    ...data, id: `OPS-RRHH-${String(max + 1).padStart(6, "0")}`, slaHoras,
    fechaCreacion: now.toISOString(),
    fechaEnvio: data.estado === "Borrador" ? null : now.toISOString(),
    fechaLimiteSLA: data.estado === "Borrador" ? null : new Date(now.getTime() + slaHoras * 3600e3).toISOString(),
    comentarios: [], historialEstados: [{ fecha: now.toISOString(), usuario: data.creadoPor!, anterior: null, nuevo: data.estado! }],
  } as OpsHrRequest;
  localStorage.setItem(LS, JSON.stringify([r, ...list]));
  return r;
}
export async function updateRequest(id: string, patch: Partial<OpsHrRequest> & { _event?: string; _usuario?: string; _nota?: string }): Promise<OpsHrRequest> {
  if (isApiConfigured()) return opsHrRequestsApi.update(id, patch);
  const list = readLS<OpsHrRequest>(LS);
  const i = list.findIndex(r => r.id === id);
  const prev = list[i];
  const { _event, _usuario, _nota, ...p } = patch;
  const now = new Date().toISOString();
  const next = { ...prev, ...p } as OpsHrRequest;
  if (p.estado && p.estado !== prev.estado) {
    next.historialEstados = [...prev.historialEstados, { fecha: now, usuario: _usuario || "", anterior: prev.estado, nuevo: p.estado, nota: _nota }];
    if (prev.estado === "Borrador") { next.fechaEnvio = now; next.fechaLimiteSLA = new Date(Date.now() + SLA_HORAS[next.prioridad] * 3600e3).toISOString(); }
    if (!next.primerMovimientoRRHH && prev.estado === "Enviada a RRHH") next.primerMovimientoRRHH = now;
    if (CLOSED.includes(p.estado)) next.fechaCierre = now;
  }
  list[i] = next;
  localStorage.setItem(LS, JSON.stringify(list));
  return next;
}

export interface OpsTemplate { id: string; nombre: string; tipo: OpsReqTipo; tipoVacante: OpsVacante; prioridad: OpsPrioridad; motivoBaja?: string; notas?: string }
export async function listTemplates(): Promise<OpsTemplate[]> {
  if (isApiConfigured()) return opsHrRequestsApi.templates();
  return readLS<OpsTemplate>(LS_TPL);
}
export async function saveTemplates(list: OpsTemplate[]) {
  if (isApiConfigured()) return opsHrRequestsApi.saveTemplates(list);
  localStorage.setItem(LS_TPL, JSON.stringify(list));
}

export const DEFAULT_RRHH_RECIPIENTS = ["daguasvivas@safeone.com.do", "alira@safeone.com.do", "nperez@safeone.com.do", "abrito@safeone.com.do"];
const LS_SET = "safeone_ops_hr_recipients";
export async function getRrhhRecipients(): Promise<string[]> {
  if (isApiConfigured()) return (await opsHrRequestsApi.settings()).rrhhRecipients;
  try { return JSON.parse(localStorage.getItem(LS_SET) || "null") || DEFAULT_RRHH_RECIPIENTS; } catch { return DEFAULT_RRHH_RECIPIENTS; }
}
export async function saveRrhhRecipients(list: string[], by: string): Promise<string[]> {
  if (isApiConfigured()) return (await opsHrRequestsApi.saveSettings({ rrhhRecipients: list, updatedBy: by })).rrhhRecipients;
  localStorage.setItem(LS_SET, JSON.stringify(list)); return list;
}
