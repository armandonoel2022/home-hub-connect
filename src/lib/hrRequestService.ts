import type { HRRequest, HRNotification, LoanPayment } from "./hrRequestTypes";
import { hrRequestsApi, isApiConfigured } from "./api";

const STORAGE_KEY = "safeone_hr_requests";
const NOTIF_KEY = "safeone_hr_notifications";

// ─── Sync con backend ───
let pollHandle: ReturnType<typeof setInterval> | null = null;
let lastReqHash = "";
let lastNotifHash = "";
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return String(h);
};

function getAll(): HRRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(requests: HRRequest[]) {
  const json = JSON.stringify(requests);
  localStorage.setItem(STORAGE_KEY, json);
  lastReqHash = hash(json);
  try {
    window.dispatchEvent(new CustomEvent("safeone:hr-updated"));
  } catch {}
  // Push al backend (fire-and-forget)
  if (isApiConfigured()) {
    hrRequestsApi.replaceAll(requests).catch(() => {});
  }
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
  const json = JSON.stringify(notifs);
  localStorage.setItem(NOTIF_KEY, json);
  lastNotifHash = hash(json);
  try {
    window.dispatchEvent(new CustomEvent("safeone:hr-updated"));
  } catch {}
  if (isApiConfigured()) {
    hrRequestsApi.replaceAllNotifications(notifs).catch(() => {});
  }
}

// ─── Inicialización y polling con backend ───
async function pullFromBackend() {
  if (!isApiConfigured()) return;
  try {
    const [reqs, notifs] = await Promise.all([
      hrRequestsApi.list(),
      hrRequestsApi.listNotifications(),
    ]);
    const reqsJson = JSON.stringify(reqs || []);
    const notifsJson = JSON.stringify(notifs || []);
    const reqsHash = hash(reqsJson);
    const notifsHash = hash(notifsJson);
    let changed = false;
    if (reqsHash !== lastReqHash) {
      localStorage.setItem(STORAGE_KEY, reqsJson);
      lastReqHash = reqsHash;
      changed = true;
    }
    if (notifsHash !== lastNotifHash) {
      localStorage.setItem(NOTIF_KEY, notifsJson);
      lastNotifHash = notifsHash;
      changed = true;
    }
    if (changed) {
      try { window.dispatchEvent(new CustomEvent("safeone:hr-updated")); } catch {}
    }
  } catch { /* silencioso */ }
}

export function initHRRequestsSync() {
  if (!isApiConfigured()) return;
  // Inicializar hashes con lo que tenemos en local
  try { lastReqHash = hash(localStorage.getItem(STORAGE_KEY) || "[]"); } catch {}
  try { lastNotifHash = hash(localStorage.getItem(NOTIF_KEY) || "[]"); } catch {}
  pullFromBackend();
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(pullFromBackend, 10_000);
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

/** Solicitudes asociadas a un empleado (por id de usuario, código de empleado o nombre). */
export function getRequestsByEmployee(opts: { userId?: string; employeeCode?: string; fullName?: string }): HRRequest[] {
  const fn = (opts.fullName || "").trim().toLowerCase();
  return getAll().filter((r) => {
    if (opts.userId && r.requestedBy === opts.userId) return true;
    if (opts.userId && r.beneficiaryId === opts.userId) return true;
    if (fn && (r.requestedByName || "").toLowerCase() === fn) return true;
    if (fn && (r.beneficiaryName || "").toLowerCase() === fn) return true;
    return false;
  });
}

export function createHRRequest(request: HRRequest, rrhhUserIds: string[] = []): HRRequest {
  const all = getAll();
  all.unshift(request);
  save(all);

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

export function escalateLoanToGerencia(
  requestId: string,
  rrhhUserId: string,
  rrhhUserName: string,
  gerenciaUserId: string,
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
    comment: comment || "Antigüedad validada. Solicitando aprobación a Gerencia General.",
  };
  req.status = "Pendiente Gerencia General";
  save(all);

  addNotification(
    gerenciaUserId,
    `Solicitud de Préstamo ${req.id} de ${req.requestedByName} pendiente de tu aprobación.`,
    req.id,
  );
  addNotification(
    req.requestedBy,
    `Tu solicitud de préstamo ${req.id} fue validada por RRHH y enviada a Gerencia General (Aurelio Pérez).`,
    req.id,
  );
  return req;
}

export function approveLoanByGerencia(
  requestId: string,
  gerenciaUserId: string,
  gerenciaUserName: string,
  comment: string | undefined,
  rrhhUserIds: string[],
  override?: { approvedAmount?: number; approvedTermMonths?: number; approvedInstallment?: number; overrideJustification?: string },
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
  if (override && req.loanDetails) {
    req.loanDetails = {
      ...req.loanDetails,
      approvedAmount: override.approvedAmount ?? req.loanDetails.amountRequested,
      approvedTermMonths: override.approvedTermMonths ?? req.loanDetails.termMonths,
      approvedInstallment: override.approvedInstallment ?? req.loanDetails.monthlyInstallment,
      overrideJustification: override.overrideJustification || req.loanDetails.overrideJustification,
    };
  }
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
