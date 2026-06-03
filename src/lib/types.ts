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
  createdById?: string; // user ID of creator
  assignedTo?: string; // department or person assigned
  assignedToId?: string; // user ID assigned
  department: string;
  createdAt: string;
  updatedAt: string;
  slaHours: number;
  slaDeadline: string;
  attachments: string[];
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
}

export type EquipmentType =
  | "Computadora"
  | "Laptop"
  | "Workstation"
  | "Monitor"
  | "Impresora"
  | "Pantalla / TV"
  | "Proyector"
  | "Teléfono IP"
  | "Equipo de Red"
  | "Otro";
export type EquipmentStatus =
  | "Disponible"
  | "Asignado"
  | "Prestado"
  | "En Reparación"
  | "Dañado"
  | "Dado de Baja";

/** Evidencia de constancia de asignación firmada (PDF/JPG/PNG) */
export interface AssignmentEvidence {
  /** URL relativa del backend o data URL en modo local */
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy?: string;
}

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
  // Especificaciones / metadatos extendidos
  color?: string;
  storage?: string;
  ram?: string;
  /** Ubicación física actual del dispositivo (oficina, almacén, etc.) */
  currentLocation?: string;
  /** Código de empleado al que está asignado (para vínculo confiable) */
  assignedToCode?: string;
  /** Constancia(s) de asignación firmada(s) */
  assignmentEvidence?: AssignmentEvidence[];
  assignedDate?: string;
  /** Código de Activo Fijo (ej. SSC-LAP-29615). Sirve como identificador físico. */
  fixedAssetCode?: string;
  // ─ Especificaciones para laptops / workstations / computadoras ─
  operatingSystem?: string;
  osLanguage?: string;
  bios?: string;
  processor?: string;
  // ─ Periféricos ─
  hasMouse?: boolean;
  hasKeyboard?: boolean;
  hasMonitor?: boolean;
  /** ID de un Monitor registrado en el mismo inventario al que está vinculado */
  linkedMonitorId?: string;
  // ─ Fotos del/los dispositivo(s) ─
  devicePhotos?: AssignmentEvidence[];
  // ─ Inventario de software ─
  softwareInventory?: SoftwareEntry[];
  softwareUpdatedAt?: string;
  softwareSource?: string;
}

/** Entrada del inventario de software instalado en un equipo. */
export interface SoftwareEntry {
  name: string;
  version: string;
  publisher: string;
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

export type WeaponCondition =
  | "En buenas condiciones"
  | "En condiciones"
  | "Falta de mantenimiento"
  | "Arma inoperativa"
  | "El seguro no sirve"
  | "No esta en condiciones"
  | "Arma en fiscalia"
  | "Arma no estaba disponible";

export interface PersonnelTransfer {
  id: string;
  date: string;
  fromClient: string;
  fromLocation: string;
  toClient: string;
  toLocation: string;
  reason: string;
  replacedBy?: string; // name or ID of replacement
  authorizedBy: string;
}

export type ShiftType = "12h" | "24h" | "24h+" | "Personalizado";

export interface ArmedPersonnel {
  id: string;
  employeeCode: string;
  name: string;
  photo: string;
  weaponPhoto?: string;
  agentPhotos?: PhotoRecord[];
  weaponPhotos?: PhotoRecord[];
  licensePhoto?: string;          // foto de la licencia del arma (con marca de agua)
  licensePhotoUploadedAt?: string;
  licensePhotoUploadedBy?: string;
  client: string;
  location: string; // puesto
  province: string;
  position: string;
  supervisor: string;
  fleetPhone: string;
  personalPhone: string;
  address: string;
  weaponType: string;
  weaponSerial: string;
  weaponBrand: string;
  weaponCaliber: string; // "Letal" | "No letal"
  ammunitionCount: number;
  coordinates: string; // "lat, lng"
  weaponCondition: string;
  licenseNumber: string;
  licenseExpiry: string;
  assignedDate: string;
  status: "Activo" | "Licencia" | "Inactivo";
  shiftType?: ShiftType;
  shiftHours?: number; // horas del turno (12, 24, etc.)
  shiftNotes?: string; // notas sobre el turno
  transferHistory?: PersonnelTransfer[];
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}

// Phone Fleet
export type PhoneStatus =
  | "Activo"
  | "Asignado"
  | "En Stock"
  | "Disponible"
  | "Prestado"
  | "En Reparación"
  | "Dañado"
  | "Dado de Baja";

export type MobileDeviceType = "Celular" | "Tablet";

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
  // Campos extendidos
  deviceType?: MobileDeviceType;
  color?: string;
  storage?: string;
  ram?: string;
  assignedToCode?: string;
  assignedDate?: string;
  assignmentEvidence?: AssignmentEvidence[];
}

// Users
export type EmployeeStatus = "Activo" | "Inactivo";
export type OffboardingReason = "Renuncia" | "Despido" | "Fin de Contrato" | "Otro";

export interface IntranetUser {
  id: string;
  // Código de empleado (ej. "3751") — distinto del id interno (USR-XXX)
  employeeCode?: string;
  fullName: string;
  // Identidad desglosada (opcional, para integración con ERP/contabilidad)
  firstName1?: string;
  firstName2?: string;
  lastName1?: string;
  lastName2?: string;
  cedula?: string;
  email: string;
  department: string;
  position: string;
  birthday: string; // MM-DD format
  photoUrl: string;
  allowedDepartments: string[];
  isAdmin: boolean;
  isDepartmentLeader?: boolean;
  reportsTo?: string; // user ID of the person they report to
  fleetPhone?: string;
  extension?: string; // internal phone extension
  shift?: string; // turno de trabajo
  team?: string; // equipo asignado (e.g. "ALNAP", "Banco Caribe")
  // Work schedule
  workDaysPerWeek?: number; // días laborables por semana (default 5)
  hireDate?: string; // fecha de ingreso (ISO date)
  // Password management
  passwordHash?: string; // hashed password (local mode uses simple hash)
  mustChangePassword?: boolean; // forced change on next login
  lastPasswordChange?: string; // ISO date of last password change
  // Offboarding
  employeeStatus?: EmployeeStatus;
  offboardingDate?: string;
  offboardingReason?: OffboardingReason;
  offboardingNotes?: string;
  offboardingBy?: string; // user ID who initiated
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
  "Operaciones",
  "Servicio al Cliente",
  "Calidad",
  "Cuentas por Cobrar",
  "Contabilidad",
  "Tecnología y Monitoreo",
  "Seguridad Electrónica",
];

// ─── Purchase Requests ───
export type PurchaseRequestStatus =
  | "Pendiente"
  | "Aprobada Jefe"
  | "Pendiente GG"
  | "Aprobada"
  | "En Proceso Compra"
  | "Completada"
  | "Rechazada";

export const PURCHASE_STEPS: PurchaseRequestStatus[] = [
  "Pendiente",
  "Aprobada Jefe",
  "Pendiente GG",
  "Aprobada",
  "En Proceso Compra",
  "Completada",
];

export const PURCHASE_STEP_LABELS: Record<string, string> = {
  "Pendiente": "Solicitud Enviada",
  "Aprobada Jefe": "Aprobada por Jefe",
  "Pendiente GG": "Pendiente Gerencia General",
  "Aprobada": "Aprobada",
  "En Proceso Compra": "En Proceso de Compra",
  "Completada": "Completada",
  "Rechazada": "Rechazada",
};

export interface PurchaseItem {
  name: string;
  description: string;
  quantity: number;
  estimatedPrice: number;
}

export interface ApprovalStep {
  by: string;
  at: string;
  approved: boolean;
  comment?: string;
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
  // Step tracking
  managerApproval: ApprovalStep | null;
  gmApproval: ApprovalStep | null;
  purchaseStartedAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  quotationFiles: string[];
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
  hasVehicle: boolean;
  vehicleType: string;
  residentialZone: string;
  requestedBy: string;
  requestedAt: string;
  status: HiringRequestStatus;
  managerApproval: { by: string; at: string; approved: boolean } | null;
  gmApproval: { by: string; at: string; approved: boolean } | null;
  rejectionReason: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rrhhStartedAt?: string | null;
  interviewDate: string | null;
  interviewNotes: string;
  completedAt?: string | null;
  notes: string;
}

// ─── Minor Purchases (Caja Chica / Tarjeta Corporativa) ───
export type PaymentMethod = "Caja Chica" | "Tarjeta Corporativa";
export type MinorPurchaseStatus = "Pendiente" | "Aprobado" | "Rechazado" | "Anulado";
export type LinkedDocType = "OC" | "OS" | "";

export interface MinorPurchase {
  id: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  category: string;
  department: string;
  requestedBy: string;
  requestedByName: string;
  /** Fecha real del gasto (ISO YYYY-MM-DD). Editable por el usuario. */
  expenseDate: string;
  /** Fecha del registro en sistema (auditoría). */
  requestedAt: string;
  status: MinorPurchaseStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  assignedApprover: string | null;
  /** Ruta del comprobante (relativa a /uploads/minor-purchases/...). */
  receiptUrl: string;
  /** Nombre original del archivo del comprobante. */
  receiptName?: string;
  notes: string;
  purchasedBy: string;
  /** Persona que solicita el gasto (puede ser texto libre o nombre del directorio). */
  requestedFor?: string;
  /** Vínculo opcional a Orden de Compra/Servicio. */
  linkedDocType?: LinkedDocType;
  linkedDocNumber?: string;
  /** Anulación con justificación. */
  voided?: boolean;
  voidedReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  /** Historial de cambios de ID (auditoría). */
  idHistory?: IdChangeRecord[];
  /** Excedente del límite mensual de Caja Chica autorizado por Chrisnel Fabian. */
  overLimitAuthorized?: boolean;
  overLimitAuthorizedBy?: string;
  overLimitAuthorizedAt?: string;
  overLimitJustification?: string;
}

export interface IdChangeRecord {
  previousId: string;
  newId: string;
  changedBy: string;
  changedAt: string;
  reason: string;
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

// ─── Photo Records (Audit trail for armed personnel) ───
export interface PhotoRecord {
  id: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedById?: string;
  kind: "agent" | "weapon";
  metadata?: {
    weaponType?: string;
    weaponSerial?: string;
    notes?: string;
  };
}

// ─── Uniforms & Flashlights Inventory ───
export type UniformSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
export type UniformType =
  | "Camisa"
  | "Pantalón"
  | "Gorra"
  | "Chaleco"
  | "Bota"
  | "Cinturón"
  | "Otro";

export interface UniformItem {
  id: string;
  type: UniformType;
  size: UniformSize;
  quantityInStock: number;
  unitCost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UniformAssignment {
  id: string;
  uniformItemId: string;
  uniformType: UniformType;
  uniformSize: UniformSize;
  employeeCode: string;
  employeeName: string;
  quantity: number;
  deliveredAt: string;
  deliveredBy: string;
  condition: "Nuevo" | "Bueno" | "Regular" | "Reemplazar";
  notes?: string;
  createdAt?: string;
}

export type FlashlightStatus = "Disponible" | "Asignada" | "En reparación" | "Dada de baja";

export interface FlashlightItem {
  id: string;
  code: string;
  brand: string;
  model: string;
  serial?: string;
  status: FlashlightStatus;
  assignedToCode?: string;
  assignedToName?: string;
  assignedAt?: string;
  assignedBy?: string;
  condition: "Nueva" | "Buena" | "Regular" | "Reemplazar";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
