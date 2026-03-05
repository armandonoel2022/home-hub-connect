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
