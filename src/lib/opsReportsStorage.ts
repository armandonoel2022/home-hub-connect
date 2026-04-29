// Almacenamiento centralizado de reportes operativos (Monitoreo + Operaciones)
// para que RRHH pueda consultar y consolidar para nómina.

export type OpsReportType =
  | "horas-extras"
  | "dia-feriado"
  | "dia-libre-trabajado"
  | "ausencia"
  | "cobertura";

export type OpsReportSource = "Monitoreo" | "Operaciones";

export interface OpsReport {
  id: string;
  source: OpsReportSource;
  type: OpsReportType;
  personId: string;
  personName: string;
  department?: string;
  team?: string;
  date: string; // yyyy-MM-dd
  hours?: number;
  description: string;
  coveringFor?: string;
  createdBy: string;
  createdAt: string;
  status: "Pendiente RRHH" | "Asignada" | "Procesada";
  assignedTo?: string;
}

const KEY = "safeone_ops_reports";

export const REPORT_TYPE_LABEL: Record<OpsReportType, string> = {
  "horas-extras": "Horas Extras",
  "dia-feriado": "Día Feriado Trabajado",
  "dia-libre-trabajado": "Día Libre Trabajado",
  "ausencia": "Ausencia",
  "cobertura": "Cobertura de Turno",
};

export const getOpsReports = (): OpsReport[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveOpsReport = (report: OpsReport): void => {
  const all = getOpsReports();
  all.unshift(report);
  localStorage.setItem(KEY, JSON.stringify(all));
};

export const updateOpsReport = (id: string, patch: Partial<OpsReport>): void => {
  const all = getOpsReports().map((r) => (r.id === id ? { ...r, ...patch } : r));
  localStorage.setItem(KEY, JSON.stringify(all));
};
