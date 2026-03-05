export type TicketCategory =
  | "Red"
  | "Asignación de Equipos (Nuevos)"
  | "Asignación de Equipos (Existentes)"
  | "Movimientos de Equipos"
  | "Instalación de Software"
  | "Impresión"
  | "Asignación de Flotas"
  | "Problemas con Datos de Flota"
  | "Otros";

export type TicketPriority = "Baja" | "Media" | "Alta" | "Crítica";
export type TicketStatus = "Abierto" | "En Progreso" | "En Espera" | "Resuelto" | "Cerrado";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string;
  department: string;
  createdAt: string;
  updatedAt: string;
  slaHours: number;
  slaDeadline: string;
  attachments: string[];
}

export type EquipmentType = "Computadora" | "Monitor" | "Impresora" | "Equipo de Red" | "Otro";
export type EquipmentStatus = "Disponible" | "Asignado" | "En Reparación" | "Dado de Baja";

export interface Equipment {
  id: string;
  type: EquipmentType;
  brand: string;
  model: string;
  serial: string;
  status: EquipmentStatus;
  assignedTo: string | null;
  department: string | null;
  acquisitionDate: string;
  notes: string;
}

export type VehicleStatus = "Activo" | "En Taller" | "Dado de Baja" | "Disponible";

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  assignedTo: string | null;
  acquisitionDate: string;
  mileage: number;
  notes: string;
}

export interface ArmedPersonnel {
  id: string;
  name: string;
  photo: string;
  location: string;
  position: string;
  supervisor: string;
  fleetPhone: string;
  personalPhone: string;
  address: string;
  weaponType: string;
  weaponSerial: string;
  weaponBrand: string;
  weaponCaliber: string;
  licenseNumber: string;
  licenseExpiry: string;
  assignedDate: string;
  status: "Activo" | "Licencia" | "Inactivo";
}

// Phone Fleet
export type PhoneStatus = "Activo" | "Disponible" | "En Reparación" | "Dado de Baja";

export interface PhoneDevice {
  id: string;
  imei: string;
  serial: string;
  brand: string;
  model: string;
  status: PhoneStatus;
  assignedTo: string | null;
  department: string | null;
  acquisitionDate: string;
  phoneNumber: string;
  notes: string;
}

// Users
export interface IntranetUser {
  id: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  birthday: string; // MM-DD format
  photoUrl: string;
  allowedDepartments: string[];
  isAdmin: boolean;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  "Red",
  "Asignación de Equipos (Nuevos)",
  "Asignación de Equipos (Existentes)",
  "Movimientos de Equipos",
  "Instalación de Software",
  "Impresión",
  "Asignación de Flotas",
  "Problemas con Datos de Flota",
  "Otros",
];

export const SLA_MAP: Record<TicketPriority, number> = {
  Baja: 72,
  Media: 24,
  Alta: 8,
  Crítica: 2,
};

export const DEPARTMENTS = [
  "Administración",
  "Gerencia General",
  "Gerencia Comercial",
  "Recursos Humanos",
  "Servicio al Cliente",
  "Calidad",
  "Cuentas por Cobrar",
  "Contabilidad",
  "Tecnología y Monitoreo",
  "Operaciones",
];

// ─── Purchase Requests ───
export type PurchaseRequestStatus = "Pendiente" | "Aprobada" | "Rechazada" | "En Revisión";

export interface PurchaseItem {
  name: string;
  description: string;
  quantity: number;
  estimatedPrice: number;
}

export interface PurchaseRequest {
  id: string;
  title: string;
  items: PurchaseItem[];
  totalAmount: number;
  justification: string;
  department: string;
  requestedBy: string;
  requestedAt: string;
  status: PurchaseRequestStatus;
  approvalLevel: "Jefe Directo" | "Gerencia General";
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  quotationFiles: string[]; // file names
  notes: string;
}

// Approval thresholds (configurable later)
export const PURCHASE_APPROVAL_THRESHOLDS = {
  directManager: 50000, // Up to 50k → jefe directo
  generalManager: Infinity, // Above 50k → Gerencia General
};

// ─── Hiring Requests ───
export type HiringRequestStatus =
  | "Borrador"
  | "Pendiente Gerente Área"
  | "Aprobada Gerente Área"
  | "Pendiente Gerencia General"
  | "Aprobada Gerencia General"
  | "Rechazada"
  | "En Proceso RRHH"
  | "Entrevista Programada"
  | "Completada";

export interface HiringRequest {
  id: string;
  positionTitle: string;
  department: string;
  justification: string;
  salaryRange: string;
  contractType: "Indefinido" | "Temporal" | "Proyecto";
  urgency: "Normal" | "Urgente";
  requirements: string;
  requestedBy: string;
  requestedAt: string;
  status: HiringRequestStatus;
  managerApproval: { by: string; at: string; approved: boolean } | null;
  gmApproval: { by: string; at: string; approved: boolean } | null;
  rejectionReason: string | null;
  interviewDate: string | null;
  interviewNotes: string;
  notes: string;
}

// ─── Notifications ───
export type NotificationType = "purchase" | "hiring" | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string; // ID of the request
  forUserId: string;
  read: boolean;
  createdAt: string;
  actionUrl: string;
}
