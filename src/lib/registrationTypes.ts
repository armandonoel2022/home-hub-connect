export type RegistrationStatus = "pendiente" | "aprobado" | "rechazado";

export interface RegistrationRequest {
  id: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  birthday: string;
  justification: string;
  status: RegistrationStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
