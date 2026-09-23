import type { IntranetUser, Ticket, TicketStatus } from "@/lib/types";

/** Flujo oficial de estados de Tickets IT. */
export const WORKFLOW_STATUSES: TicketStatus[] = [
  "Recibido por Tecnología",
  "Asignado",
  "En Progreso",
  "En Espera",
  "Cerrado - Resuelto",
  "Cerrado - No Resuelto",
];

export const DEFAULT_ASSIGNEE = { name: "Armando Noel", email: "anoel@safeone.com.do" };
export const TICKETS_OWNER_EMAIL = "anoel@safeone.com.do";

/** Convierte estados anteriores al flujo nuevo. */
export function normalizeStatus(s: TicketStatus | string | undefined): TicketStatus {
  switch (s) {
    case "Abierto": return "Recibido por Tecnología";
    case "Resuelto":
    case "Cerrado": return "Cerrado - Resuelto";
    default: return (WORKFLOW_STATUSES.includes(s as TicketStatus) ? s : "Recibido por Tecnología") as TicketStatus;
  }
}

export const isClosed = (s: TicketStatus | string | undefined) => normalizeStatus(s).startsWith("Cerrado");

export function statusLabel(t: Pick<Ticket, "status" | "assignedTo">): string {
  const s = normalizeStatus(t.status);
  return s === "Asignado" ? `Asignado a: ${t.assignedTo || DEFAULT_ASSIGNEE.name}` : s;
}

export interface TicketSettings {
  agents: { id?: string; email: string; name: string }[];
}

export const isTicketsOwner = (u?: IntranetUser | null) =>
  !!u && (u.email || "").toLowerCase() === TICKETS_OWNER_EMAIL;

export function isTicketAgent(u: IntranetUser | null | undefined, settings?: TicketSettings | null): boolean {
  if (!u) return false;
  if (isTicketsOwner(u)) return true;
  const email = (u.email || "").toLowerCase();
  return !!settings?.agents?.some((a) => a.email.toLowerCase() === email || (a.id && a.id === u.id));
}

export function isRequester(t: Ticket, u?: IntranetUser | null) {
  if (!u) return false;
  return t.createdById === u.id ||
    (!!t.requesterEmail && t.requesterEmail.toLowerCase() === (u.email || "").toLowerCase());
}

export function isAssignedTo(t: Ticket, u?: IntranetUser | null) {
  if (!u) return false;
  const email = (u.email || "").toLowerCase();
  const assigned = (t.assignedToEmail || DEFAULT_ASSIGNEE.email).toLowerCase();
  return assigned === email || t.assignedToId === u.id;
}
