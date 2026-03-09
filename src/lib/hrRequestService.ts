import type { HRRequest, HRRequestStatus } from "./hrRequestTypes";

const STORAGE_KEY = "safeone_hr_requests";

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

export function getAllHRRequests(): HRRequest[] {
  return getAll();
}

export function getHRRequestById(id: string): HRRequest | undefined {
  return getAll().find((r) => r.id === id);
}

/** Requests where a user needs to take action (approve/reject) */
export function getPendingForUser(userId: string): HRRequest[] {
  return getAll().filter((r) => {
    if (r.status === "Pendiente Supervisor" && r.supervisorId === userId) return true;
    if (r.status === "Pendiente RRHH") {
      // Any RRHH department member with isDepartmentLeader can approve
      return true; // filtered in UI by department
    }
    return false;
  });
}

/** Requests submitted by a user */
export function getRequestsByUser(userId: string): HRRequest[] {
  return getAll().filter((r) => r.requestedBy === userId);
}

export function createHRRequest(request: HRRequest): HRRequest {
  const all = getAll();
  all.unshift(request);
  save(all);
  return request;
}

export function approveBySupevisor(
  requestId: string,
  approverId: string,
  approverName: string,
  comment?: string
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
  };
  req.status = "Pendiente RRHH";
  save(all);
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
  return req;
}

export function rejectRequest(
  requestId: string,
  rejectedBy: string,
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
  return req;
}

export function generateRequestId(): string {
  return `HR-${Date.now().toString(36).toUpperCase()}`;
}
