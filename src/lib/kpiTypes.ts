export interface DepartmentKPI {
  id: string;
  name: string;
  description: string;
  department: string;
  currentValue: number;
  targetValue: number;
  unit: string; // %, cantidad, etc.
  trend: "up" | "down" | "stable";
  updatedBy: string;
  updatedAt: string;
}

export const INITIAL_DEPARTMENT_KPIS: DepartmentKPI[] = [
  {
    id: "DKPI-001",
    name: "Presupuesto Ejecutado",
    description: "Porcentaje del presupuesto anual ejecutado",
    department: "Administración",
    currentValue: 32,
    targetValue: 100,
    unit: "%",
    trend: "up",
    updatedBy: "Chrisnel Fabian",
    updatedAt: "2026-03-05",
  },
  {
    id: "DKPI-002",
    name: "Cuentas por Pagar al Día",
    description: "Porcentaje de proveedores pagados dentro del plazo",
    department: "Administración",
    currentValue: 88,
    targetValue: 100,
    unit: "%",
    trend: "up",
    updatedBy: "Chrisnel Fabian",
    updatedAt: "2026-03-05",
  },
  {
    id: "DKPI-003",
    name: "Auditorías Internas Completadas",
    description: "Auditorías internas realizadas en el trimestre",
    department: "Calidad",
    currentValue: 3,
    targetValue: 6,
    unit: "auditorías",
    trend: "stable",
    updatedBy: "Bilianny Fernández",
    updatedAt: "2026-03-04",
  },
  {
    id: "DKPI-004",
    name: "No Conformidades Cerradas",
    description: "Porcentaje de no conformidades resueltas",
    department: "Calidad",
    currentValue: 75,
    targetValue: 100,
    unit: "%",
    trend: "up",
    updatedBy: "Bilianny Fernández",
    updatedAt: "2026-03-04",
  },
  {
    id: "DKPI-005",
    name: "Disponibilidad de Sistemas",
    description: "Uptime de sistemas críticos en el mes",
    department: "Tecnología y Monitoreo",
    currentValue: 99.2,
    targetValue: 99.9,
    unit: "%",
    trend: "stable",
    updatedBy: "Administrador SafeOne",
    updatedAt: "2026-03-06",
  },
  {
    id: "DKPI-006",
    name: "Tickets Resueltos",
    description: "Porcentaje de tickets IT resueltos en el mes",
    department: "Tecnología y Monitoreo",
    currentValue: 82,
    targetValue: 95,
    unit: "%",
    trend: "up",
    updatedBy: "Administrador SafeOne",
    updatedAt: "2026-03-06",
  },
];
