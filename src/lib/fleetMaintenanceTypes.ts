// Types for the SafeOne Fleet Maintenance module.
// Source workbook: Control_gastos_reparacion_y_mant._Flotilla_de_Vehiculos.xlsx
// Owner: Chrisnel Fabián (Administración)

export type FleetUnitKind = "motocicleta" | "vehiculo";

export interface FleetUnit {
  no: number;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | string;
  color: string;
  chasis: string;
  placa: string;
  aseguradora: string;
}

export interface MaintenanceEntry {
  kind: FleetUnitKind;
  unit: string | null;        // long descriptive label (matches "descripcion" in annual cost)
  placa: string;
  mes: string | null;
  asignacion: string | null;
  fecha: string;              // YYYY-MM-DD
  tipoMant: string | null;    // Mantenimiento, Reparación, Compra de piezas...
  taller: string | null;
  kilometraje: number | null;
  costo: number;              // RD$
  detalle: string | null;
}

export interface AnnualCostRow {
  descripcion: string;
  placa: string | null;
  monthly: Record<
    | "enero" | "febrero" | "marzo" | "abril" | "mayo" | "junio"
    | "julio" | "agosto" | "septiembre" | "octubre" | "noviembre" | "diciembre",
    number
  >;
  total: number;
}

export interface FleetSeed {
  generatedFrom: string;
  generatedAt: string;
  fleet: FleetUnit[];
  maintenance: MaintenanceEntry[];
  annualCost: AnnualCostRow[];
}
