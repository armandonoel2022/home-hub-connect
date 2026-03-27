import type { Ticket, Equipment, Vehicle, ArmedPersonnel, PhoneDevice } from "./types";
import { seedArmedPersonnel } from "./armedPersonnelData";

export const mockTickets: Ticket[] = [
  {
    id: "TK-001",
    title: "Sin acceso a la red en oficina 3",
    description: "Los equipos de la oficina 3 no tienen conexión a internet desde las 8:00 AM.",
    category: "Red",
    priority: "Alta",
    status: "En Progreso",
    createdBy: "María López",
    department: "Servicio al Cliente",
    createdAt: "2026-03-04T08:30:00",
    updatedAt: "2026-03-04T10:15:00",
    slaHours: 8,
    slaDeadline: "2026-03-04T16:30:00",
    attachments: [],
  },
  {
    id: "TK-002",
    title: "Asignar laptop a nuevo empleado",
    description: "Se requiere laptop para el nuevo analista del departamento de Contabilidad que inicia el 10 de marzo.",
    category: "Asignación de Equipos (Nuevos)",
    priority: "Media",
    status: "Abierto",
    createdBy: "Carlos Méndez",
    department: "Contabilidad",
    createdAt: "2026-03-03T14:00:00",
    updatedAt: "2026-03-03T14:00:00",
    slaHours: 24,
    slaDeadline: "2026-03-04T14:00:00",
    attachments: ["aprobacion_gerencia.pdf"],
  },
  {
    id: "TK-003",
    title: "Impresora no funciona en recepción",
    description: "La impresora HP LaserJet de recepción muestra error de atasco de papel constante.",
    category: "Impresión",
    priority: "Baja",
    status: "Resuelto",
    createdBy: "Ana Rodríguez",
    department: "Administración",
    createdAt: "2026-03-01T09:00:00",
    updatedAt: "2026-03-02T11:00:00",
    slaHours: 72,
    slaDeadline: "2026-03-04T09:00:00",
    attachments: [],
  },
  {
    id: "TK-004",
    title: "Instalar software de monitoreo en 5 equipos",
    description: "Se necesita instalar el nuevo software de monitoreo CCTV en los equipos de la sala de control.",
    category: "Instalación de Software",
    priority: "Crítica",
    status: "En Progreso",
    createdBy: "Jorge Pérez",
    department: "Tecnología y Monitoreo",
    createdAt: "2026-03-05T07:00:00",
    updatedAt: "2026-03-05T08:00:00",
    slaHours: 2,
    slaDeadline: "2026-03-05T09:00:00",
    attachments: [],
  },
];

export const mockEquipment: Equipment[] = [
  { id: "EQ-001", type: "Computadora", brand: "Dell", model: "OptiPlex 7090", serial: "DL7090-001", status: "Asignado", assignedTo: "María López", department: "Servicio al Cliente", acquisitionDate: "2024-06-15", notes: "" },
  { id: "EQ-002", type: "Computadora", brand: "HP", model: "ProDesk 400 G7", serial: "HP400G7-002", status: "Disponible", assignedTo: null, department: null, acquisitionDate: "2024-08-20", notes: "En almacén" },
  { id: "EQ-003", type: "Monitor", brand: "LG", model: "24MK430H", serial: "LG24-003", status: "Asignado", assignedTo: "Carlos Méndez", department: "Contabilidad", acquisitionDate: "2024-06-15", notes: "" },
  { id: "EQ-004", type: "Impresora", brand: "HP", model: "LaserJet Pro M404n", serial: "HPLJ-004", status: "En Reparación", assignedTo: null, department: "Administración", acquisitionDate: "2023-03-10", notes: "Problema de fusor" },
  { id: "EQ-005", type: "Equipo de Red", brand: "Ubiquiti", model: "USW-Pro-48-PoE", serial: "UBQ-005", status: "Asignado", assignedTo: null, department: "Tecnología y Monitoreo", acquisitionDate: "2025-11-01", notes: "Switch principal" },
  { id: "EQ-006", type: "Equipo de Red", brand: "Ubiquiti", model: "U6-Pro", serial: "UBQ-006", status: "Asignado", assignedTo: null, department: "Tecnología y Monitoreo", acquisitionDate: "2025-11-01", notes: "AP Piso 2" },
  { id: "EQ-007", type: "Computadora", brand: "Lenovo", model: "ThinkCentre M70q", serial: "LN70Q-007", status: "Dado de Baja", assignedTo: null, department: null, acquisitionDate: "2020-01-15", notes: "Obsoleto" },
];

export const mockVehicles: Vehicle[] = [
  { id: "VH-001", plate: "ABC-1234", brand: "Toyota", model: "Hilux", year: 2023, status: "Activo", assignedTo: "Ruta Norte", acquisitionDate: "2023-05-10", mileage: 45000, notes: "" },
  { id: "VH-002", plate: "DEF-5678", brand: "Nissan", model: "Frontier", year: 2022, status: "En Taller", assignedTo: null, acquisitionDate: "2022-08-15", mileage: 68000, notes: "Cambio de frenos" },
  { id: "VH-003", plate: "GHI-9012", brand: "Toyota", model: "Corolla", year: 2024, status: "Activo", assignedTo: "Gerencia", acquisitionDate: "2024-01-20", mileage: 12000, notes: "" },
  { id: "VH-004", plate: "JKL-3456", brand: "Hyundai", model: "Tucson", year: 2023, status: "Disponible", assignedTo: null, acquisitionDate: "2023-11-05", mileage: 30000, notes: "" },
];

export const mockArmedPersonnel: ArmedPersonnel[] = seedArmedPersonnel;

export const mockPhones: PhoneDevice[] = [
  { id: "PH-001", imei: "354123098765432", serial: "SM-A54-001", brand: "Samsung", model: "Galaxy A54", status: "Activo", assignedTo: "María López", department: "Servicio al Cliente", acquisitionDate: "2025-01-15", phoneNumber: "+505 8888-0001", notes: "" },
  { id: "PH-002", imei: "354123098765433", serial: "IP15-002", brand: "Apple", model: "iPhone 15", status: "Activo", assignedTo: "Gerente General", department: "Gerencia General", acquisitionDate: "2024-11-20", phoneNumber: "+505 8888-0002", notes: "" },
  { id: "PH-003", imei: "354123098765434", serial: "SM-A34-003", brand: "Samsung", model: "Galaxy A34", status: "Disponible", assignedTo: null, department: null, acquisitionDate: "2025-02-10", phoneNumber: "", notes: "En almacén" },
  { id: "PH-004", imei: "354123098765435", serial: "XM-NOTE12-004", brand: "Xiaomi", model: "Redmi Note 12", status: "En Reparación", assignedTo: null, department: "Operaciones", acquisitionDate: "2024-08-05", phoneNumber: "+505 8888-0004", notes: "Pantalla rota" },
  { id: "PH-005", imei: "354123098765436", serial: "SM-A14-005", brand: "Samsung", model: "Galaxy A14", status: "Activo", assignedTo: "Carlos Méndez", department: "Contabilidad", acquisitionDate: "2025-03-01", phoneNumber: "+505 8888-0005", notes: "" },
];
