export type HRFormType = "vacaciones" | "dias-libres" | "comida" | "ausencias" | "permisos" | "prestamos";

export type HRRequestStatus = "Pendiente Supervisor" | "Aprobada Supervisor" | "Pendiente RRHH" | "Aprobada" | "Rechazada";

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
  by: string;       // user ID
  byName: string;
  at: string;        // ISO date
  approved: boolean;
  comment?: string;
}

export interface HRRequest {
  id: string;
  formType: HRFormType;
  status: HRRequestStatus;
  // Requester info
  requestedBy: string;      // user ID
  requestedByName: string;
  department: string;
  requestedAt: string;       // ISO date
  // Form data (key-value from the form fields)
  formData: Record<string, string>;
  // Approval chain
  supervisorId: string;      // reportsTo user
  supervisorName: string;
  supervisorApproval: HRApprovalStep | null;
  rrhhApproval: HRApprovalStep | null;
  // Rejection
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
}
