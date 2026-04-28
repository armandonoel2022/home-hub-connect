export type HRFormType = "vacaciones" | "dias-libres" | "comida" | "ausencias" | "permisos" | "prestamos";

export type HRRequestStatus =
  | "Pendiente Supervisor"
  | "Aprobada Supervisor"
  | "Pendiente RRHH"
  // Loan-specific stages:
  | "Pendiente Administración" // RRHH escaló a Chrisnel Fabián
  | "Pendiente Gerencia General" // Chrisnel escaló a Aurelio Pérez
  | "Pendiente Aplicación RRHH" // Aprobado, RRHH debe registrar fecha de aplicación
  | "Aprobada"
  | "Rechazada";

export const HR_STATUS_FLOW: HRRequestStatus[] = [
  "Pendiente Supervisor",
  "Aprobada Supervisor",
  "Pendiente RRHH",
  "Aprobada",
];

export const HR_FORM_LABELS: Record<HRFormType, string> = {
  vacaciones: "Vacaciones",
  "dias-libres": "Días Libres",
  comida: "Comida",
  ausencias: "Ausencias",
  permisos: "Permisos",
  prestamos: "Solicitud de Préstamos",
};

export interface HRApprovalStep {
  by: string;
  byName: string;
  at: string;
  approved: boolean;
  comment?: string;
  /** For vacaciones: who covers during absence */
  coverPerson?: string;
}

export interface HRNotification {
  id: string;
  forUserId: string;
  message: string;
  requestId: string;
  read: boolean;
  createdAt: string;
}

export interface HRRequest {
  id: string;
  formType: HRFormType;
  status: HRRequestStatus;
  requestedBy: string;
  requestedByName: string;
  department: string;
  requestedAt: string;
  formData: Record<string, string>;
  supervisorId: string;
  supervisorName: string;
  supervisorApproval: HRApprovalStep | null;
  rrhhApproval: HRApprovalStep | null;
  /** Loan-only: Chrisnel Fabián review */
  adminApproval?: HRApprovalStep | null;
  /** Loan-only: Aurelio Pérez (Gerencia General) review */
  gerenciaApproval?: HRApprovalStep | null;
  /** Loan-only: scheduled application date set by RRHH after final approval */
  loanApplyDate?: string | null;
  loanApplyComment?: string | null;
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
}
