export interface DepartmentKPI {
  id: string;
  name: string;
  description: string;
  department: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: "up" | "down" | "stable";
  updatedBy: string;
  updatedAt: string;
}

// Department KPIs based on audit findings (INF-AUD-02, March 18, 2026)
export const INITIAL_DEPARTMENT_KPIS: DepartmentKPI[] = [
  {
    id: "DKPI-001",
    name: "Hallazgos Gerencia Cerrados",
    description: "Hallazgos de auditoría en Gerencia resueltos (7 encontrados)",
    department: "Gerencia",
    currentValue: 1,
    targetValue: 7,
    unit: "hallazgos",
    trend: "up",
    updatedBy: "Bilianny Fernández",
    updatedAt: "2026-03-19",
  },
  {
    id: "DKPI-002",
    name: "Documentación SGCS Actualizada",
    description: "Documentos del Sistema de Gestión actualizados (10 hallazgos pendientes)",
    department: "Calidad",
    currentValue: 2,
    targetValue: 10,
    unit: "documentos",
    trend: "up",
    updatedBy: "Bilianny Fernández",
    updatedAt: "2026-03-19",
  },
  {
    id: "DKPI-003",
    name: "Asociados de Negocio Conformes",
    description: "Proveedores con certificaciones y documentación estandarizada",
    department: "Administración",
    currentValue: 65,
    targetValue: 100,
    unit: "%",
    trend: "stable",
    updatedBy: "Chrisnel Fabián",
    updatedAt: "2026-03-19",
  },
  {
    id: "DKPI-004",
    name: "Hallazgos Seguridad Personal",
    description: "Hallazgos RRHH cerrados de auditoría (8 encontrados)",
    department: "Recursos Humanos",
    currentValue: 0,
    targetValue: 8,
    unit: "hallazgos",
    trend: "stable",
    updatedBy: "Dilia Aguasvivas",
    updatedAt: "2026-03-19",
  },
  {
    id: "DKPI-005",
    name: "Controles Acceso y Seg. Física",
    description: "Hallazgos de control de acceso resueltos (8 encontrados)",
    department: "Operaciones",
    currentValue: 1,
    targetValue: 8,
    unit: "hallazgos",
    trend: "up",
    updatedBy: "Remit López",
    updatedAt: "2026-03-19",
  },
  {
    id: "DKPI-006",
    name: "Seguridad Información Cumplimiento",
    description: "Hallazgos de seguridad informática resueltos (9 encontrados)",
    department: "Tecnología y Monitoreo",
    currentValue: 1,
    targetValue: 9,
    unit: "hallazgos",
    trend: "up",
    updatedBy: "Samuel A. Pérez",
    updatedAt: "2026-03-19",
  },
];
