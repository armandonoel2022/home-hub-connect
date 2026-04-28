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
  // Notify in-app listeners (NotificationOverlay)
  try {
    window.dispatchEvent(new CustomEvent("safeone:hr-updated"));
  } catch {}
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
  try {
    window.dispatchEvent(new CustomEvent("safeone:hr-updated"));
  } catch {}
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
  if (!forUserId) return;
  const all = getAllNotifications();
  all.unshift({
    id: `HRN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    forUserId,
    message,
    requestId,
    read: false,
    createdAt: new Date().toISOString(),
  });
  saveNotifications(all);
}

/** Notify all RRHH leaders/members. Caller passes a list of user IDs. */
export function notifyUsers(userIds: string[], message: string, requestId: string) {
  userIds.filter(Boolean).forEach((uid) => addNotification(uid, message, requestId));
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

export function createHRRequest(request: HRRequest, rrhhUserIds: string[] = []): HRRequest {
  const all = getAll();
  all.unshift(request);
  save(all);

  // Loan requests: skip supervisor — go straight to RRHH for review
  if (request.formType === "prestamos") {
    notifyUsers(
      rrhhUserIds,
      `Nueva solicitud de Préstamo de ${request.requestedByName} (RD$ ${request.formData["Monto Solicitado (RD$)"] || "—"}). Pendiente revisión RRHH.`,
      request.id,
    );
  } else {
    addNotification(
      request.supervisorId,
      `Nueva solicitud de ${request.formType} de ${request.requestedByName} pendiente de tu aprobación.`,
      request.id,
    );
  }
  return request;
}

export function approveBySupervisor(
  requestId: string,
  approverId: string,
  approverName: string,
  comment?: string,
  coverPerson?: string,
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

  addNotification(
    req.requestedBy,
    `Tu solicitud ${req.id} de ${req.formType} fue aprobada por ${approverName}. Pendiente aprobación de RRHH.`,
    req.id,
  );

  return req;
}

export function approveByRRHH(
  requestId: string,
  approverId: string,
  approverName: string,
  comment?: string,
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

  addNotification(
    req.requestedBy,
    `¡Tu solicitud ${req.id} de ${req.formType} fue APROBADA por RRHH! Ya puedes proceder.`,
    req.id,
  );

  return req;
}

// ─── Loan-specific flow ───

/** RRHH validó antigüedad y escala a Administración (Chrisnel Fabián). */
export function escalateLoanToAdmin(
  requestId: string,
  rrhhUserId: string,
  rrhhUserName: string,
  adminUserId: string,
  comment?: string,
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.formType !== "prestamos") return null;

  req.rrhhApproval = {
    by: rrhhUserId,
    byName: rrhhUserName,
    at: new Date().toISOString(),
    approved: true,
    comment: comment || "Antigüedad validada. Escalado a Administración.",
  };
  req.status = "Pendiente Administración";
  save(all);

  addNotification(
    adminUserId,
    `Solicitud de Préstamo ${req.id} de ${req.requestedByName} pendiente de tu aprobación.`,
    req.id,
  );
  addNotification(
    req.requestedBy,
    `Tu solicitud de préstamo ${req.id} fue validada por RRHH y enviada a Administración.`,
    req.id,
  );
  return req;
}

/** Chrisnel aprueba el préstamo directamente. */
export function approveLoanByAdmin(
  requestId: string,
  adminUserId: string,
  adminUserName: string,
  comment: string | undefined,
  rrhhUserIds: string[],
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.status !== "Pendiente Administración") return null;

  req.adminApproval = {
    by: adminUserId,
    byName: adminUserName,
    at: new Date().toISOString(),
    approved: true,
    comment,
  };
  req.status = "Pendiente Aplicación RRHH";
  save(all);

  notifyUsers(
    rrhhUserIds,
    `Préstamo ${req.id} aprobado por ${adminUserName}. Registra la fecha de aplicación.`,
    req.id,
  );
  addNotification(
    req.requestedBy,
    `Tu solicitud de préstamo ${req.id} fue aprobada por Administración.`,
    req.id,
  );
  return req;
}

/** Chrisnel decide escalar a Don Aurelio (Gerencia General). */
export function escalateLoanToGerencia(
  requestId: string,
  adminUserId: string,
  adminUserName: string,
  gerenciaUserId: string,
  comment?: string,
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.status !== "Pendiente Administración") return null;

  req.adminApproval = {
    by: adminUserId,
    byName: adminUserName,
    at: new Date().toISOString(),
    approved: true,
    comment: comment || "Escalado a Gerencia General para aprobación final.",
  };
  req.status = "Pendiente Gerencia General";
  save(all);

  addNotification(
    gerenciaUserId,
    `Solicitud de Préstamo ${req.id} de ${req.requestedByName} escalada por ${adminUserName} para tu aprobación final.`,
    req.id,
  );
  addNotification(
    req.requestedBy,
    `Tu solicitud de préstamo ${req.id} fue escalada a Gerencia General.`,
    req.id,
  );
  return req;
}

/** Aurelio aprueba el préstamo (final). */
export function approveLoanByGerencia(
  requestId: string,
  gerenciaUserId: string,
  gerenciaUserName: string,
  comment: string | undefined,
  rrhhUserIds: string[],
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.status !== "Pendiente Gerencia General") return null;

  req.gerenciaApproval = {
    by: gerenciaUserId,
    byName: gerenciaUserName,
    at: new Date().toISOString(),
    approved: true,
    comment,
  };
  req.status = "Pendiente Aplicación RRHH";
  save(all);

  notifyUsers(
    rrhhUserIds,
    `Préstamo ${req.id} aprobado por ${gerenciaUserName} (Gerencia General). Registra la fecha de aplicación.`,
    req.id,
  );
  addNotification(
    req.requestedBy,
    `Tu solicitud de préstamo ${req.id} fue APROBADA por Gerencia General.`,
    req.id,
  );
  return req;
}

/** RRHH registra fecha de aplicación y cierra el préstamo. */
export function applyLoan(
  requestId: string,
  rrhhUserId: string,
  rrhhUserName: string,
  applyDate: string,
  comment?: string,
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req || req.status !== "Pendiente Aplicación RRHH") return null;

  req.loanApplyDate = applyDate;
  req.loanApplyComment = comment || null;
  req.status = "Aprobada";
  // Record the final RRHH application as a second touch on rrhhApproval comment
  if (req.rrhhApproval) {
    req.rrhhApproval.comment = `${req.rrhhApproval.comment || ""} | Aplicado por ${rrhhUserName} el ${applyDate}${comment ? ` — ${comment}` : ""}`;
  }
  save(all);

  addNotification(
    req.requestedBy,
    `✅ Tu préstamo ${req.id} fue APLICADO por ${rrhhUserName}. Fecha de aplicación: ${applyDate}.${comment ? ` Nota: ${comment}` : ""}`,
    req.id,
  );
  return req;
}

export function rejectRequest(
  requestId: string,
  rejectedBy: string,
  rejectedByName: string,
  reason: string,
): HRRequest | null {
  const all = getAll();
  const req = all.find((r) => r.id === requestId);
  if (!req) return null;

  req.status = "Rechazada";
  req.rejectionReason = reason;
  req.rejectedBy = rejectedBy;
  req.rejectedAt = new Date().toISOString();
  save(all);

  addNotification(
    req.requestedBy,
    `Tu solicitud ${req.id} de ${req.formType} fue rechazada por ${rejectedByName}. Motivo: ${reason}`,
    req.id,
  );

  return req;
}

export function generateRequestId(): string {
  return `HR-${Date.now().toString(36).toUpperCase()}`;
}
