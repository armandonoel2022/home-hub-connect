export type HRFormType = "vacaciones" | "dias-libres" | "comida" | "ausencias" | "permisos" | "prestamos";

export type HRRequestStatus =
  | "Pendiente Supervisor"
  | "Aprobada Supervisor"
  | "Pendiente RRHH"
  // Loan-specific stages (simplificado: RRHH/Dilia → Gerencia General/Aurelio → RRHH aplica):
  | "Pendiente Gerencia General"
  | "Pendiente Aplicación RRHH"
  | "Aprobada"
  | "Rechazada";

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

export type LoanFrequency = "mensual" | "quincenal";

/** Abono/cuota cobrada de un préstamo. */
export interface LoanPayment {
  id: string;
  date: string;
  amount: number;
  by: string;
  note?: string;
}

/** Detalle financiero del préstamo. */
export interface LoanDetails {
  monthlySalary: number;
  amountRequested: number;
  termMonths: number;
  annualInterestRatePct: number;
  monthlyInstallment: number;
  calculatedMaxAvailable: number;
  maxInstallment: number;
  isOverPolicy: boolean;
  overrideJustification?: string;
  approvedAmount?: number;
  approvedTermMonths?: number;
  approvedInstallment?: number;
  // Frecuencia de descuento y plan de pagos
  frequency?: LoanFrequency;
  installmentsTotal?: number;
  totalInterest?: number;
  totalToPay?: number;
  // Excepción de antigüedad autorizada por RRHH (solicitud a nombre de otro)
  tenureExceptionByRRHH?: boolean;
  // Control de cobranza
  payments?: LoanPayment[];
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
  gerenciaApproval?: HRApprovalStep | null;
  loanApplyDate?: string | null;
  loanApplyComment?: string | null;
  loanDetails?: LoanDetails | null;
  beneficiaryId?: string | null;
  beneficiaryName?: string | null;
  requestedOnBehalf?: boolean;
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
}
