// OSM Incident Management Data Types & Storage

export interface IncidentEvidence {
  id: string;
  type: "photo" | "video" | "audio";
  name: string;
  dataUrl: string; // base64 data URL for localStorage; would be file URL with backend
  uploadedAt: string;
  uploadedBy: string;
}

export interface IncidentComment {
  id: string;
  text: string;
  author: string;
  authorEmail: string;
  createdAt: string;
}

export type IncidentStatus = "abierta" | "en_progreso" | "esperando_cliente" | "esperando_servicio_al_cliente" | "resuelta" | "cerrada";
export type IncidentPriority = "critica" | "alta" | "media" | "baja";

export interface OSMIncident {
  id: string;
  clientId: string;
  clientName: string;
  accountCode: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  contact: string;
  phone: string;
  // Customer service workflow
  csRequestSent: boolean;
  csRequestDate?: string;
  csCompletedDate?: string;
  csCompletedBy?: string;
  csNotes?: string;
  csBroadcastSent: boolean;
  // Evidence
  evidence: IncidentEvidence[];
  comments: IncidentComment[];
  // Metadata
  createdAt: string;
  createdBy: string;
  createdByEmail: string;
  updatedAt: string;
  updatedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CSRequest {
  id: string;
  incidentId: string;
  clientName: string;
  accountCode: string;
  message: string;
  requestedBy: string;
  requestedAt: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  completionNotes?: string;
  broadcastSent: boolean;
}

const INCIDENTS_KEY = "osm_incidents";
const CS_REQUESTS_KEY = "osm_cs_requests";
const SEED_KEY = "osm_incidents_seed_v";
const CURRENT_SEED = 2;

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// Authorized editors: monitoring team + Luis Ovalle + Armando Noel
const EDIT_AUTHORIZED_EMAILS = [
  "anoel@safeone.com.do",
  "tecnologia@safeone.com.do",
  "lovalle@safeone.com.do",
  // Monitoring team emails can be added here
];

export function canEditIncident(userEmail: string): boolean {
  if (!userEmail) return false;
  const email = userEmail.toLowerCase();
  // Allow monitoring team, IT, Luis Ovalle, and admins
  return EDIT_AUTHORIZED_EMAILS.some(e => e.toLowerCase() === email) ||
    email.includes("monitoreo") ||
    email.includes("admin");
}

// Customer service recipients
export const CS_RECIPIENT = { name: "Perla Gonzalez", email: "pgonzalez@safeone.com.do" };

// Broadcast recipients after CS completes task
export const BROADCAST_RECIPIENTS = [
  { name: "Monitoreo", role: "department" },
  { name: "Armando Noel", email: "anoel@safeone.com.do" },
  { name: "Samuel A. Perez", email: "sperez@safeone.com.do" },
  { name: "Leonela Baez", email: "lbaez@safeone.com.do" },
  { name: "Luis Ovalle", email: "lovalle@safeone.com.do" },
  { name: "Chrisnel Fabian", email: "cfabian@safeone.com.do" },
  { name: "Cristy Fernandez (CxC)", email: "cfernandez@safeone.com.do" },
];

function getInitialIncidents(): OSMIncident[] {
  const now = new Date().toISOString();
  return [
    {
      id: genId("INC"), clientId: "", clientName: "FARMAMED", accountCode: "8003",
      title: "Sensor requiere revisión - Visita técnica necesaria",
      description: "La chica necesita una visita tecnica para revisar un sensor",
      status: "abierta", priority: "media", contact: "", phone: "809-977-1644",
      csRequestSent: false, csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-03-24T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "RESIDENCIA CAROLINA HENRIQUEZ", accountCode: "5488",
      title: "Sin notificaciones en Kronos",
      description: "Seguimiento en kronos, no llegan notificaciones.",
      status: "en_progreso", priority: "alta", contact: "CAROLINA HENRIQUEZ", phone: "809-880-5964",
      csRequestSent: false, csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-03-24T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "JEROME AUTOSERVICES SRL", accountCode: "9107",
      title: "Cuenta inactiva desde 2024",
      description: "Desde el 2024 sin realizar ninguna actividad en la cuenta, verificar con el cliente.",
      status: "esperando_cliente", priority: "alta", contact: "NATANAEL JEROME", phone: "809-214-9102",
      csRequestSent: true, csRequestDate: "2026-03-25T09:00:00Z", csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-03-24T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "EDIFICIO LFT (RES. MARISOL CONTRERAS)", accountCode: "8907",
      title: "Sin alertas desde enero 29",
      description: "Desde 29 de enero sin recibir alertas de esta cuenta, contactar con el cliente para preguntar.",
      status: "esperando_cliente", priority: "alta", contact: "MARI CONTRERAS", phone: "240-370-2519",
      csRequestSent: true, csRequestDate: "2026-03-26T10:00:00Z", csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-03-24T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "SOBREMESA EMPRESARIAL Y CATERING, SRL", accountCode: "4013",
      title: "1 mes sin cierre",
      description: "Lleva 1 mes sin realizar el cierre. Confirmar con el cliente si tiene algun problema.",
      status: "esperando_servicio_al_cliente", priority: "media", contact: "ERICK FLORES", phone: "809-980-0949",
      csRequestSent: true, csRequestDate: "2026-04-01T10:00:00Z", csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-04-01T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "Residencia - Alba Yris Santos", accountCode: "8001",
      title: "15+ días sin cierre",
      description: "Lleva mas de 15 dias sin realizar un cierre.",
      status: "en_progreso", priority: "media", contact: "ALBA YRIS SANTOS", phone: "809-383-9888",
      csRequestSent: false, csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-04-01T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "JEAN LICORES", accountCode: "5481",
      title: "Alertas no llegan correctamente",
      description: "El sistema no nos llegan las alertas correctamente.",
      status: "en_progreso", priority: "alta", contact: "JUAN CARLOS SERRATA", phone: "829-357-6735",
      csRequestSent: false, csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-03-24T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
    {
      id: genId("INC"), clientId: "", clientName: "R & V AUTO TUNING", accountCode: "8998",
      title: "Sin cierre desde ago 2025",
      description: "Desde el 2025-8-22 sin realizar un cierre verificar.",
      status: "en_progreso", priority: "media", contact: "VILMA VARGAS", phone: "829-384-6792",
      csRequestSent: false, csBroadcastSent: false,
      evidence: [], comments: [],
      createdAt: "2026-03-24T10:00:00Z", createdBy: "Monitoreo", createdByEmail: "monitoreo@safeone.com.do",
      updatedAt: now,
    },
  ];
}

export function getIncidents(): OSMIncident[] {
  const sv = localStorage.getItem(SEED_KEY);
  const stored = localStorage.getItem(INCIDENTS_KEY);
  if (!stored || sv !== String(CURRENT_SEED)) {
    const initial = getInitialIncidents();
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(initial));
    localStorage.setItem(SEED_KEY, String(CURRENT_SEED));
    return initial;
  }
  return JSON.parse(stored);
}

export function saveIncidents(incidents: OSMIncident[]): void {
  localStorage.setItem(INCIDENTS_KEY, JSON.stringify(incidents));
}

export function addIncident(incident: Omit<OSMIncident, "id">): OSMIncident {
  const incidents = getIncidents();
  const newInc: OSMIncident = { ...incident, id: genId("INC") };
  incidents.push(newInc);
  saveIncidents(incidents);
  return newInc;
}

export function updateIncident(id: string, updates: Partial<OSMIncident>): void {
  const incidents = getIncidents();
  const idx = incidents.findIndex(i => i.id === id);
  if (idx >= 0) {
    incidents[idx] = { ...incidents[idx], ...updates, updatedAt: new Date().toISOString() };
    saveIncidents(incidents);
  }
}

export function addIncidentComment(incidentId: string, comment: Omit<IncidentComment, "id">): void {
  const incidents = getIncidents();
  const idx = incidents.findIndex(i => i.id === incidentId);
  if (idx >= 0) {
    incidents[idx].comments.push({ ...comment, id: genId("CMT") });
    incidents[idx].updatedAt = new Date().toISOString();
    saveIncidents(incidents);
  }
}

export function addIncidentEvidence(incidentId: string, evidence: Omit<IncidentEvidence, "id">): void {
  const incidents = getIncidents();
  const idx = incidents.findIndex(i => i.id === incidentId);
  if (idx >= 0) {
    incidents[idx].evidence.push({ ...evidence, id: genId("EV") });
    incidents[idx].updatedAt = new Date().toISOString();
    saveIncidents(incidents);
  }
}

// CS Requests
export function getCSRequests(): CSRequest[] {
  const stored = localStorage.getItem(CS_REQUESTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveCSRequests(requests: CSRequest[]): void {
  localStorage.setItem(CS_REQUESTS_KEY, JSON.stringify(requests));
}

export function addCSRequest(request: Omit<CSRequest, "id">): CSRequest {
  const requests = getCSRequests();
  const newReq: CSRequest = { ...request, id: genId("CSR") };
  requests.push(newReq);
  saveCSRequests(requests);
  return newReq;
}

export function completeCSRequest(id: string, completedBy: string, notes: string): void {
  const requests = getCSRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx >= 0) {
    requests[idx].completed = true;
    requests[idx].completedAt = new Date().toISOString();
    requests[idx].completedBy = completedBy;
    requests[idx].completionNotes = notes;
    saveCSRequests(requests);
  }
}

// Report generation helpers
export function getIncidentsByDateRange(start: Date, end: Date): OSMIncident[] {
  return getIncidents().filter(i => {
    const d = new Date(i.createdAt);
    return d >= start && d <= end;
  });
}

export function generateDailyReport(date: Date): {
  date: string;
  total: number;
  opened: number;
  resolved: number;
  pending: number;
  byPriority: Record<IncidentPriority, number>;
  byStatus: Record<IncidentStatus, number>;
  incidents: OSMIncident[];
} {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const all = getIncidents();
  const dayIncidents = all.filter(i => {
    const created = new Date(i.createdAt);
    const updated = new Date(i.updatedAt);
    return (created >= dayStart && created <= dayEnd) || (updated >= dayStart && updated <= dayEnd);
  });

  const opened = dayIncidents.filter(i => new Date(i.createdAt) >= dayStart && new Date(i.createdAt) <= dayEnd).length;
  const resolved = dayIncidents.filter(i => i.resolvedAt && new Date(i.resolvedAt) >= dayStart && new Date(i.resolvedAt) <= dayEnd).length;
  const pending = all.filter(i => i.status !== "resuelta" && i.status !== "cerrada").length;

  const byPriority = { critica: 0, alta: 0, media: 0, baja: 0 } as Record<IncidentPriority, number>;
  const byStatus = { abierta: 0, en_progreso: 0, esperando_cliente: 0, esperando_servicio_al_cliente: 0, resuelta: 0, cerrada: 0 } as Record<IncidentStatus, number>;

  all.forEach(i => {
    byPriority[i.priority]++;
    byStatus[i.status]++;
  });

  return {
    date: date.toISOString().slice(0, 10),
    total: all.length,
    opened,
    resolved,
    pending,
    byPriority,
    byStatus,
    incidents: dayIncidents,
  };
}

export function generateWeeklyReport(endDate: Date) {
  const start = new Date(endDate);
  start.setDate(start.getDate() - 6);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(generateDailyReport(d));
  }
  const all = getIncidents();
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    dailyReports: days,
    totalIncidents: all.length,
    totalPending: all.filter(i => i.status !== "resuelta" && i.status !== "cerrada").length,
    totalResolved: all.filter(i => i.status === "resuelta" || i.status === "cerrada").length,
  };
}
