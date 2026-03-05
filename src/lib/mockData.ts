import type { Ticket, Equipment, Vehicle, ArmedPersonnel } from "./types";

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

export const mockArmedPersonnel: ArmedPersonnel[] = [
  { id: "AP-001", name: "Roberto Martínez", photo: "", location: "Sede Principal - Garita 1", position: "Oficial de Seguridad", weaponType: "Pistola", weaponSerial: "PST-2024-001", weaponBrand: "Glock", weaponCaliber: "9mm", licenseNumber: "LIC-2024-0451", licenseExpiry: "2027-06-30", assignedDate: "2024-01-15", status: "Activo" },
  { id: "AP-002", name: "Fernando Castillo", photo: "", location: "Sede Norte - Ronda", position: "Supervisor de Seguridad", weaponType: "Pistola", weaponSerial: "PST-2024-002", weaponBrand: "Beretta", weaponCaliber: "9mm", licenseNumber: "LIC-2024-0452", licenseExpiry: "2027-03-15", assignedDate: "2024-02-01", status: "Activo" },
  { id: "AP-003", name: "Miguel Ángel Torres", photo: "", location: "Sede Sur - Garita 2", position: "Oficial de Seguridad", weaponType: "Escopeta", weaponSerial: "ESC-2023-015", weaponBrand: "Remington", weaponCaliber: "12 Gauge", licenseNumber: "LIC-2023-0890", licenseExpiry: "2026-12-31", assignedDate: "2023-08-20", status: "Activo" },
  { id: "AP-004", name: "Luis Hernández", photo: "", location: "Sede Principal - Ronda", position: "Oficial de Seguridad", weaponType: "Pistola", weaponSerial: "PST-2023-008", weaponBrand: "Glock", weaponCaliber: "9mm", licenseNumber: "LIC-2023-0567", licenseExpiry: "2026-08-15", assignedDate: "2023-05-10", status: "Licencia" },
];
