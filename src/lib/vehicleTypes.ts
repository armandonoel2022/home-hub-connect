// Gestión de Flotilla Vehicular — SafeOne
// Modelo de datos completo del vehículo, asignaciones y documentación.

export const VEHICLE_TYPES = [
  "SUV",
  "Automovil",
  "Motocicleta",
  "Camioneta",
  "Furgon",
  "Otro",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const FUEL_TYPES = ["Gasolina", "Diesel", "Electrico", "Hibrido"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const VEHICLE_STATES = [
  "Activo",
  "En Mantenimiento",
  "Inactivo",
  "Descargado",
] as const;
export type VehicleState = (typeof VEHICLE_STATES)[number];

export const MARBETE_STATES = ["Al dia", "Vencido", "Pendiente"] as const;
export type MarbeteState = (typeof MARBETE_STATES)[number];

export const DEPARTAMENTOS = [
  "Gerencia General",
  "Gerencia Comercial",
  "RRHH",
  "Monitoreo",
  "Seguridad Electrónica",
  "Operaciones",
  "QA",
  "Servicio al Cliente",
  "Contabilidad",
  "Administración",
  "Tecnología y Monitoreo",
] as const;
export type Departamento = (typeof DEPARTAMENTOS)[number];

export interface VehicleDocuments {
  fotoVehiculo?: string;
  fotoMarbete?: string;
  fotoPlaca?: string;
  fotoPrestamo?: string;
  fotoCotizacion?: string;
  fotoSeguro?: string;
  fotoMatricula?: string;
}

export const DOCUMENT_FIELDS: { key: keyof VehicleDocuments; label: string; slug: string }[] = [
  { key: "fotoVehiculo", label: "Foto del vehículo", slug: "foto" },
  { key: "fotoMarbete", label: "Marbete", slug: "marbete" },
  { key: "fotoPlaca", label: "Placa", slug: "placa" },
  { key: "fotoMatricula", label: "Matrícula", slug: "matricula" },
  { key: "fotoSeguro", label: "Seguro", slug: "seguro" },
  { key: "fotoPrestamo", label: "Préstamo", slug: "prestamo" },
  { key: "fotoCotizacion", label: "Cotización", slug: "cotizacion" },
];

export interface VehicleAssignment {
  tipo: "Empleado" | "Departamento" | null;
  empleadoId?: string | null;
  empleadoNombre?: string | null;
  departamento?: string | null;
  fechaAsignacion?: string | null;
  fechaDevolucion?: string | null;
}

export interface VehicleInsurance {
  compania?: string;
  poliza?: string;
  vigenciaHasta?: string;
}

export interface VehicleHistoryEntry {
  id: string;
  fecha: string;
  tipo: "creacion" | "actualizacion" | "asignacion" | "devolucion" | "estado" | "documento" | "baja";
  descripcion: string;
  usuario: string;
}

export interface Vehiculo {
  id: string;
  tipo: VehicleType;
  marca: string;
  modelo: string;
  anio: number;
  vin: string;
  matricula: string;
  placa: string;
  color: string;
  kilometraje: number;
  capacidad: number;
  combustible: FuelType;

  estado: VehicleState;
  marbete: {
    fechaVencimiento: string | null;
    estado: MarbeteState;
  };

  asignacion: VehicleAssignment;

  activoFijoId?: string | null;
  numeroActivoFijo?: string | null;

  seguro?: VehicleInsurance;
  ultimoMantenimiento?: string | null;
  proximoMantenimiento?: string | null;

  documentos: VehicleDocuments;
  historial: VehicleHistoryEntry[];

  observaciones?: string;
  activo: boolean; // soft delete
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string;
}

export function emptyVehicle(): Omit<Vehiculo, "id" | "creadoEn" | "actualizadoEn" | "creadoPor"> {
  return {
    tipo: "Automovil",
    marca: "",
    modelo: "",
    anio: new Date().getFullYear(),
    vin: "",
    matricula: "",
    placa: "",
    color: "",
    kilometraje: 0,
    capacidad: 5,
    combustible: "Gasolina",
    estado: "Activo",
    marbete: { fechaVencimiento: null, estado: "Pendiente" },
    asignacion: { tipo: null },
    activoFijoId: null,
    numeroActivoFijo: null,
    seguro: {},
    ultimoMantenimiento: null,
    proximoMantenimiento: null,
    documentos: {},
    historial: [],
    observaciones: "",
    activo: true,
  };
}

/** Calcula el estado del marbete a partir de su fecha de vencimiento. */
export function computeMarbeteEstado(fecha: string | null | undefined): MarbeteState {
  if (!fecha) return "Pendiente";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(`${fecha}T00:00:00`);
  return venc.getTime() < hoy.getTime() ? "Vencido" : "Al dia";
}

export function daysUntil(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(`${fecha}T00:00:00`);
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000);
}

export function documentFileName(vehicleId: string, slug: string) {
  return `vehiculo_${vehicleId}_${slug}.jpg`;
}
