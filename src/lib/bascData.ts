// BASC Objectives, Procedures, and Compliance Data
// Based on Internal Audit INF-AUD-02, March 18, 2026

export interface BASCObjective {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  linkedProcedures: string[];
  targetDate: string;
  responsible: string;
  department: string;
  status: "pendiente" | "en_progreso" | "cumplido" | "vencido";
  compliancePercent: number;
  evidences: BASCEvidence[];
  lastAudit: string | null;
  auditResult: "conforme" | "no_conforme" | "observación" | null;
}

export interface BASCEvidence {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  type: "documento" | "foto" | "registro" | "capacitación" | "auditoría";
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
}

export interface BASCProcedure {
  id: string;
  code: string;
  title: string;
  version: string;
  category: string;
  department: string;
  status: "vigente" | "en_revisión" | "obsoleto";
  lastReview: string;
  nextReview: string;
  linkedObjectives: string[];
}

export const BASC_OBJECTIVE_CATEGORIES = [
  "Gerencia",
  "Sistema de Gestión",
  "Asociados de Negocio",
  "Seguridad del Personal",
  "Control de Acceso y Seguridad Física",
  "Seguridad de la Información",
];

export const INITIAL_PROCEDURES: BASCProcedure[] = [
  { id: "PROC-001", code: "BASC-PR-001", title: "Control de Acceso a Instalaciones", version: "3.0", category: "Control de Acceso y Seguridad Física", department: "Operaciones", status: "vigente", lastReview: "2026-01-15", nextReview: "2026-07-15", linkedObjectives: ["OBJ-005"] },
  { id: "PROC-002", code: "BASC-PR-002", title: "Inspección Vehicular", version: "2.1", category: "Control de Acceso y Seguridad Física", department: "Operaciones", status: "vigente", lastReview: "2026-02-01", nextReview: "2026-08-01", linkedObjectives: ["OBJ-005"] },
  { id: "PROC-003", code: "BASC-PR-003", title: "Manejo y Control de Armas", version: "4.0", category: "Control de Acceso y Seguridad Física", department: "Operaciones", status: "en_revisión", lastReview: "2025-12-10", nextReview: "2026-06-10", linkedObjectives: ["OBJ-005"] },
  { id: "PROC-004", code: "BASC-PR-004", title: "Selección y Verificación de Personal", version: "2.0", category: "Seguridad del Personal", department: "Recursos Humanos", status: "vigente", lastReview: "2026-01-20", nextReview: "2026-07-20", linkedObjectives: ["OBJ-004"] },
  { id: "PROC-005", code: "BASC-PR-005", title: "Gestión de Riesgos y Requisitos Legales", version: "1.2", category: "Gerencia", department: "Administración", status: "en_revisión", lastReview: "2025-11-01", nextReview: "2026-05-01", linkedObjectives: ["OBJ-001"] },
  { id: "PROC-006", code: "BASC-PR-006", title: "Seguridad de Información y Datos", version: "2.5", category: "Seguridad de la Información", department: "Tecnología y Monitoreo", status: "vigente", lastReview: "2026-02-15", nextReview: "2026-08-15", linkedObjectives: ["OBJ-006"] },
  { id: "PROC-007", code: "BASC-PR-007", title: "Gestión Documental SGCS", version: "3.1", category: "Sistema de Gestión", department: "Calidad", status: "en_revisión", lastReview: "2026-03-01", nextReview: "2026-09-01", linkedObjectives: ["OBJ-002"] },
  { id: "PROC-008", code: "BASC-PR-008", title: "Gestión de Asociados de Negocio", version: "1.0", category: "Asociados de Negocio", department: "Administración", status: "vigente", lastReview: "2026-01-05", nextReview: "2026-07-05", linkedObjectives: ["OBJ-003"] },
];

// Objectives derived from real audit findings (INF-AUD-02, 18 marzo 2026)
export const INITIAL_OBJECTIVES: BASCObjective[] = [
  {
    id: "OBJ-001", code: "BASC-OBJ-001",
    title: "Revisión por la Dirección y Requisitos Legales",
    description: "Completar acta de revisión por la dirección, actualizar matriz de requisitos legales, documentar política de responsabilidad social y actualizar Ley de Lavado de Activos.",
    category: "Gerencia", linkedProcedures: ["PROC-005"], targetDate: "2026-06-30",
    responsible: "Bilianny Fernández", department: "Gerencia", status: "en_progreso", compliancePercent: 45,
    evidences: [
      { id: "EV-001", objectiveId: "OBJ-001", title: "Matriz de requisitos legales", description: "Tiene fecha actualizada pero sin actualización efectiva", type: "documento", uploadedBy: "Bilianny Fernández", uploadedAt: "2026-03-18", fileName: "matriz_requisitos_legales.xlsx" },
    ],
    lastAudit: "2026-03-18", auditResult: "observación",
  },
  {
    id: "OBJ-002", code: "BASC-OBJ-002",
    title: "Documentación y Registros del SGCS",
    description: "Definir competencias de auditores, actualizar mapa de procesos, consolidar listado maestro de documentos, completar métricas 2026, actualizar análisis FODA/PESTEL y eliminar referencia a OEA.",
    category: "Sistema de Gestión", linkedProcedures: ["PROC-007"], targetDate: "2026-06-30",
    responsible: "Bilianny Fernández", department: "Calidad", status: "en_progreso", compliancePercent: 35,
    evidences: [
      { id: "EV-002", objectiveId: "OBJ-002", title: "Mapa de procesos actual", description: "Requiere fecha de actualización", type: "documento", uploadedBy: "Bilianny Fernández", uploadedAt: "2026-03-18", fileName: "mapa_procesos.pdf" },
    ],
    lastAudit: "2026-03-18", auditResult: "no_conforme",
  },
  {
    id: "OBJ-003", code: "BASC-OBJ-003",
    title: "Gestión de Asociados de Negocio",
    description: "Asegurar que proveedores con servicios regulados presenten certificaciones vigentes. Estandarizar gestión documental (formato físico y digital) entre proveedores y clientes.",
    category: "Asociados de Negocio", linkedProcedures: ["PROC-008"], targetDate: "2026-06-30",
    responsible: "Chrisnel Fabián", department: "Administración", status: "en_progreso", compliancePercent: 65,
    evidences: [
      { id: "EV-003", objectiveId: "OBJ-003", title: "Listado de proveedores regulados", description: "Identificación de proveedores que requieren certificación", type: "registro", uploadedBy: "Chrisnel Fabián", uploadedAt: "2026-03-18", fileName: "proveedores_regulados.xlsx" },
    ],
    lastAudit: "2026-03-18", auditResult: "observación",
  },
  {
    id: "OBJ-004", code: "BASC-OBJ-004",
    title: "Seguridad en Procesos de Personal",
    description: "Socializar documentación SGCS con el personal, incluir política de seguridad en inducción, documentar prevención de corrupción/soborno, crear programa de incentivos y estandarizar documentación RRHH.",
    category: "Seguridad del Personal", linkedProcedures: ["PROC-004"], targetDate: "2026-06-30",
    responsible: "Dilia Aguasvivas", department: "Recursos Humanos", status: "en_progreso", compliancePercent: 30,
    evidences: [],
    lastAudit: "2026-03-18", auditResult: "no_conforme",
  },
  {
    id: "OBJ-005", code: "BASC-OBJ-005",
    title: "Control de Acceso y Seguridad Física",
    description: "Corregir registro de paquetería, apertura de acción correctiva por omisión de inspección ene-feb, codificar formulario de armas, documentar inventarios, crear procedimientos para incidentes sospechosos y eventos ilícitos.",
    category: "Control de Acceso y Seguridad Física", linkedProcedures: ["PROC-001", "PROC-002", "PROC-003"], targetDate: "2026-06-30",
    responsible: "Remit López", department: "Operaciones", status: "en_progreso", compliancePercent: 40,
    evidences: [
      { id: "EV-005", objectiveId: "OBJ-005", title: "Libro de registro de paquetería", description: "Página sin firma evidenciada en auditoría", type: "registro", uploadedBy: "Remit López", uploadedAt: "2026-03-18", fileName: "registro_paqueteria.pdf" },
    ],
    lastAudit: "2026-03-18", auditResult: "no_conforme",
  },
  {
    id: "OBJ-006", code: "BASC-OBJ-006",
    title: "Seguridad de la Información y Tecnología",
    description: "Agregar fechas y codificación a matrices, definir accesos en matriz de criticidad, incluir cargos/posiciones, estandarizar formatos, detallar informe de infraestructura y documentar gestión de ciberataques.",
    category: "Seguridad de la Información", linkedProcedures: ["PROC-006"], targetDate: "2026-06-30",
    responsible: "Samuel A. Pérez", department: "Tecnología y Monitoreo", status: "en_progreso", compliancePercent: 38,
    evidences: [
      { id: "EV-006", objectiveId: "OBJ-006", title: "Informe técnico de infraestructura", description: "No detalla deficiencias ni soluciones propuestas", type: "documento", uploadedBy: "Samuel A. Pérez", uploadedAt: "2026-03-18", fileName: "informe_infraestructura.pdf" },
    ],
    lastAudit: "2026-03-18", auditResult: "no_conforme",
  },
];
