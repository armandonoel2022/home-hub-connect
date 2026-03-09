import type { HRRequest, HRNotification } from "./hrRequestTypes";

const STORAGE_KEY = "safeone_hr_requests";
const NOTIF_KEY = "safeone_hr_notifications";

function getAll(): HRRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(requests: HRRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

// ─── Notifications ───
function getAllNotifications(): HRNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifs: HRNotification[]) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
}

export function getNotificationsForUser(userId: string): HRNotification[] {
  return getAllNotifications().filter((n) => n.forUserId === userId);
}

export function markNotificationRead(notifId: string) {
  const all = getAllNotifications();
  const n = all.find((x) => x.id === notifId);
  if (n) { n.read = true; saveNotifications(all); }
}

export function markAllNotificationsRead(userId: string) {
  const all = getAllNotifications();
  all.filter((n) => n.forUserId === userId).forEach((n) => { n.read = true; });
  saveNotifications(all);
}

function addNotification(forUserId: string, message: string, requestId: string) {
  const all = getAllNotifications();
  all.unshift({
    id: `HRN-${Date.now().toString(36)}`,
    forUserId,
    message,
    requestId,
    read: false,
    createdAt: new Date().toISOString(),
  });
  saveNotifications(all);
}

// ─── CRUD ───
export function getAllHRRequests(): HRRequest[] {
  return getAll();
}

export function getHRRequestById(id: string): HRRequest | undefined {
  return getAll().find((r) => r.id === id);
}

export function getPendingForUser(userId: string): HRRequest[] {
  return getAll().filter((r) => {
    if (r.status === "Pendiente Supervisor" && r.supervisorId === userId) return true;
    if (r.status === "Pendiente RRHH") return true;
    return false;
  });
}

export function getRequestsByUser(userId: string): HRRequest[] {
  return getAll().filter((r) => r.requestedBy === userId);
}

export function createHRRequest(request: HRRequest): HRRequest {
  const all = getAll();
  all.unshift(request);
  save(all);
  // Notify supervisor
  addNotification(
    request.supervisorId,
    `Nueva solicitud de ${request.formType} de ${request.requestedByName} pendiente de tu aprobación.`,
    request.id
  );
  return request;
}

export function approveBySupervisor(
  requestId: string,
  approverId: string,
  approverName: string,
  comment?: string,
  coverPerson?: string
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.status !== "Pendiente Supervisor") return null;

  req.supervisorApproval = {
    by: approverId,
    byName: approverName,
    at: new Date().toISOString(),
    approved: true,
    comment,
    coverPerson,
  };
  req.status = "Pendiente RRHH";
  save(all);

  // Notify requester that supervisor approved
  addNotification(
    req.requestedBy,
    `Tu solicitud ${req.id} de ${req.formType} fue aprobada por ${approverName}. Pendiente aprobación de RRHH.`,
    req.id
  );

  return req;
}

export function approveByRRHH(
  requestId: string,
  approverId: string,
  approverName: string,
  comment?: string
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.status !== "Pendiente RRHH") return null;

  req.rrhhApproval = {
    by: approverId,
    byName: approverName,
    at: new Date().toISOString(),
    approved: true,
    comment,
  };
  req.status = "Aprobada";
  save(all);

  // Notify requester that RRHH approved (fully approved)
  addNotification(
    req.requestedBy,
    `¡Tu solicitud ${req.id} de ${req.formType} fue APROBADA por RRHH! Ya puedes proceder.`,
    req.id
  );

  return req;
}

export function rejectRequest(
  requestId: string,
  rejectedBy: string,
  rejectedByName: string,
  reason: string
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req) return null;

  req.status = "Rechazada";
  req.rejectionReason = reason;
  req.rejectedBy = rejectedBy;
  req.rejectedAt = new Date().toISOString();
  save(all);

  // Notify requester
  addNotification(
    req.requestedBy,
    `Tu solicitud ${req.id} de ${req.formType} fue rechazada por ${rejectedByName}. Motivo: ${reason}`,
    req.id
  );

  return req;
}

export function generateRequestId(): string {
  return `HR-${Date.now().toString(36).toUpperCase()}`;
}
