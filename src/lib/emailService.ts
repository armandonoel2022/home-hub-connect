/**
 * Email Notification Service
 * 
 * This module provides the infrastructure for email notifications.
 * Currently queues emails in localStorage. When migrated to a server,
 * replace `sendEmail` with actual API calls (e.g., Resend, SendGrid, SMTP).
 */

export interface EmailNotification {
  id: string;
  to: string;
  subject: string;
  body: string;
  type: "registration_request" | "registration_approved" | "registration_rejected" | "ticket_update" | "approval_needed" | "birthday" | "general";
  createdAt: string;
  sent: boolean;
  sentAt: string | null;
}

const STORAGE_KEY = "safeone_email_queue";

function getQueue(): EmailNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: EmailNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Queue an email notification.
 * In production, this would call an API endpoint to send emails.
 */
export function queueEmail(
  to: string,
  subject: string,
  body: string,
  type: EmailNotification["type"]
): EmailNotification {
  const email: EmailNotification = {
    id: `EMAIL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    to,
    subject,
    body,
    type,
    createdAt: new Date().toISOString(),
    sent: false,
    sentAt: null,
  };
  const queue = getQueue();
  queue.unshift(email);
  saveQueue(queue);

  // Log for development — in production this would be an API call
  console.info(`📧 [Email Queued] To: ${to} | Subject: ${subject} | Type: ${type}`);

  return email;
}

/** Get all queued emails (for admin review) */
export function getEmailQueue(): EmailNotification[] {
  return getQueue();
}

/** Mark an email as sent (for future server-side processing) */
export function markEmailSent(id: string) {
  const queue = getQueue();
  const idx = queue.findIndex((e) => e.id === id);
  if (idx >= 0) {
    queue[idx].sent = true;
    queue[idx].sentAt = new Date().toISOString();
    saveQueue(queue);
  }
}

// ─── Convenience senders ───

export function notifyRegistrationRequest(leaderEmail: string, applicantName: string, department: string) {
  queueEmail(
    leaderEmail,
    `Nueva solicitud de acceso: ${applicantName}`,
    `${applicantName} ha solicitado acceso a la intranet en el departamento de ${department}. Por favor revisa la solicitud en el módulo de Gestión de Usuarios.`,
    "registration_request"
  );
}

export function notifyRegistrationApproved(applicantEmail: string, applicantName: string) {
  queueEmail(
    applicantEmail,
    "Tu solicitud de acceso ha sido aprobada",
    `Hola ${applicantName}, tu solicitud de acceso a la intranet SafeOne ha sido aprobada. Ya puedes iniciar sesión con tu correo electrónico y la contraseña proporcionada.`,
    "registration_approved"
  );
}

export function notifyRegistrationRejected(applicantEmail: string, applicantName: string, reason: string) {
  queueEmail(
    applicantEmail,
    "Tu solicitud de acceso ha sido rechazada",
    `Hola ${applicantName}, tu solicitud de acceso ha sido rechazada. Motivo: ${reason}. Contacta a tu líder de departamento para más información.`,
    "registration_rejected"
  );
}
