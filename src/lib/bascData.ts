// BASC Objectives, Procedures, and Compliance Data

export interface BASCObjective {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  linkedProcedures: string[]; // procedure IDs
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
  "Control de Acceso",
  "Seguridad Física",
  "Seguridad de Personal",
  "Gestión de Vehículos",
  "Seguridad de Información",
  "Gestión de Riesgos",
  "Capacitación y Concientización",
  "Trazabilidad y Documentación",
];

export const INITIAL_PROCEDURES: BASCProcedure[] = [
  { id: "PROC-001", code: "BASC-PR-001", title: "Control de Acceso a Instalaciones", version: "3.0", category: "Control de Acceso", department: "Operaciones", status: "vigente", lastReview: "2026-01-15", nextReview: "2026-07-15", linkedObjectives: ["OBJ-001", "OBJ-002"] },
  { id: "PROC-002", code: "BASC-PR-002", title: "Inspección Vehicular", version: "2.1", category: "Gestión de Vehículos", department: "Operaciones", status: "vigente", lastReview: "2026-02-01", nextReview: "2026-08-01", linkedObjectives: ["OBJ-003"] },
  { id: "PROC-003", code: "BASC-PR-003", title: "Manejo y Control de Armas", version: "4.0", category: "Seguridad de Personal", department: "Operaciones", status: "vigente", lastReview: "2025-12-10", nextReview: "2026-06-10", linkedObjectives: ["OBJ-004"] },
  { id: "PROC-004", code: "BASC-PR-004", title: "Selección y Verificación de Personal", version: "2.0", category: "Seguridad de Personal", department: "Recursos Humanos", status: "vigente", lastReview: "2026-01-20", nextReview: "2026-07-20", linkedObjectives: ["OBJ-005"] },
  { id: "PROC-005", code: "BASC-PR-005", title: "Gestión de Riesgos Operacionales", version: "1.2", category: "Gestión de Riesgos", department: "Administración", status: "en_revisión", lastReview: "2025-11-01", nextReview: "2026-05-01", linkedObjectives: ["OBJ-006"] },
  { id: "PROC-006", code: "BASC-PR-006", title: "Seguridad de Información y Datos", version: "2.5", category: "Seguridad de Información", department: "Tecnología y Monitoreo", status: "vigente", lastReview: "2026-02-15", nextReview: "2026-08-15", linkedObjectives: ["OBJ-007"] },
  { id: "PROC-007", code: "BASC-PR-007", title: "Capacitación BASC al Personal", version: "3.1", category: "Capacitación y Concientización", department: "Recursos Humanos", status: "vigente", lastReview: "2026-03-01", nextReview: "2026-09-01", linkedObjectives: ["OBJ-008"] },
  { id: "PROC-008", code: "BASC-PR-008", title: "Trazabilidad de Servicios", version: "1.0", category: "Trazabilidad y Documentación", department: "Operaciones", status: "vigente", lastReview: "2026-01-05", nextReview: "2026-07-05", linkedObjectives: ["OBJ-009"] },
];

export const INITIAL_OBJECTIVES: BASCObjective[] = [
  {
    id: "OBJ-001", code: "BASC-OBJ-001",
    title: "100% del personal con carnet de acceso vigente",
    description: "Garantizar que todo el personal cuenta con su carnet de acceso actualizado y verificado.",
    category: "Control de Acceso", linkedProcedures: ["PROC-001"], targetDate: "2026-06-30",
    responsible: "Remit López", department: "Operaciones", status: "en_progreso", compliancePercent: 85,
    evidences: [
      { id: "EV-001", objectiveId: "OBJ-001", title: "Registro de carnets emitidos Q1", description: "Listado completo de carnets", type: "registro", uploadedBy: "Remit López", uploadedAt: "2026-03-01", fileName: "carnets_q1_2026.xlsx" },
      { id: "EV-002", objectiveId: "OBJ-001", title: "Foto panel de control de acceso", description: "Evidencia fotográfica del sistema", type: "foto", uploadedBy: "Anoel", uploadedAt: "2026-02-20", fileName: "panel_acceso.jpg" },
    ],
    lastAudit: "2026-02-28", auditResult: "conforme",
  },
  {
    id: "OBJ-002", code: "BASC-OBJ-002",
    title: "Registro diario de visitantes al 100%",
    description: "Mantener bitácora digital de todos los visitantes con verificación de identidad.",
    category: "Control de Acceso", linkedProcedures: ["PROC-001"], targetDate: "2026-12-31",
    responsible: "Remit López", department: "Operaciones", status: "cumplido", compliancePercent: 100,
    evidences: [
      { id: "EV-003", objectiveId: "OBJ-002", title: "Bitácora digital febrero 2026", description: "Registro completo de visitantes", type: "registro", uploadedBy: "Remit López", uploadedAt: "2026-03-02", fileName: "bitacora_feb_2026.pdf" },
    ],
    lastAudit: "2026-02-28", auditResult: "conforme",
  },
  {
    id: "OBJ-003", code: "BASC-OBJ-003",
    title: "Inspección vehicular pre-operacional al 100%",
    description: "Realizar inspección documentada antes de cada salida de vehículos de la flotilla.",
    category: "Gestión de Vehículos", linkedProcedures: ["PROC-002"], targetDate: "2026-12-31",
    responsible: "Remit López", department: "Operaciones", status: "en_progreso", compliancePercent: 72,
    evidences: [
      { id: "EV-004", objectiveId: "OBJ-003", title: "Checklist inspecciones marzo", description: "Formularios completados", type: "documento", uploadedBy: "Remit López", uploadedAt: "2026-03-05", fileName: "inspecciones_mar.pdf" },
    ],
    lastAudit: "2026-02-28", auditResult: "observación",
  },
  {
    id: "OBJ-004", code: "BASC-OBJ-004",
    title: "Control de armamento con inventario mensual",
    description: "Verificar mensualmente el estado y asignación de todas las armas de fuego.",
    category: "Seguridad de Personal", linkedProcedures: ["PROC-003"], targetDate: "2026-12-31",
    responsible: "Remit López", department: "Operaciones", status: "cumplido", compliancePercent: 100,
    evidences: [
      { id: "EV-005", objectiveId: "OBJ-004", title: "Inventario armamento febrero", description: "Conteo y verificación de seriales", type: "registro", uploadedBy: "Remit López", uploadedAt: "2026-03-01", fileName: "inv_armas_feb.xlsx" },
      { id: "EV-006", objectiveId: "OBJ-004", title: "Acta de entrega-recepción", description: "Documento firmado por responsables", type: "documento", uploadedBy: "Anoel", uploadedAt: "2026-02-28", fileName: "acta_armas.pdf" },
    ],
    lastAudit: "2026-02-28", auditResult: "conforme",
  },
  {
    id: "OBJ-005", code: "BASC-OBJ-005",
    title: "Verificación de antecedentes al 100% del personal nuevo",
    description: "Todo personal nuevo debe pasar verificación de antecedentes antes de su ingreso.",
    category: "Seguridad de Personal", linkedProcedures: ["PROC-004"], targetDate: "2026-12-31",
    responsible: "Dilia Aguasvivas", department: "Recursos Humanos", status: "en_progreso", compliancePercent: 90,
    evidences: [
      { id: "EV-007", objectiveId: "OBJ-005", title: "Listado verificaciones Q1", description: "Personal verificado en el trimestre", type: "registro", uploadedBy: "Dilia Aguasvivas", uploadedAt: "2026-03-03", fileName: "verificaciones_q1.xlsx" },
    ],
    lastAudit: "2026-02-28", auditResult: "conforme",
  },
  {
    id: "OBJ-006", code: "BASC-OBJ-006",
    title: "Actualizar matriz de riesgos semestralmente",
    description: "Revisar y actualizar la matriz de riesgos operacionales cada 6 meses.",
    category: "Gestión de Riesgos", linkedProcedures: ["PROC-005"], targetDate: "2026-06-01",
    responsible: "Anoel", department: "Administración", status: "pendiente", compliancePercent: 40,
    evidences: [],
    lastAudit: null, auditResult: null,
  },
  {
    id: "OBJ-007", code: "BASC-OBJ-007",
    title: "Protección de datos sensibles con cifrado",
    description: "Implementar cifrado en todos los sistemas que manejen datos sensibles de clientes.",
    category: "Seguridad de Información", linkedProcedures: ["PROC-006"], targetDate: "2026-09-30",
    responsible: "Anoel", department: "Tecnología y Monitoreo", status: "en_progreso", compliancePercent: 65,
    evidences: [
      { id: "EV-008", objectiveId: "OBJ-007", title: "Informe de cifrado de sistemas", description: "Estado de implementación", type: "documento", uploadedBy: "Anoel", uploadedAt: "2026-03-01", fileName: "cifrado_status.pdf" },
    ],
    lastAudit: "2026-02-28", auditResult: "observación",
  },
  {
    id: "OBJ-008", code: "BASC-OBJ-008",
    title: "Capacitación BASC anual al 100% del personal",
    description: "Todo el personal debe completar la capacitación BASC al menos una vez al año.",
    category: "Capacitación y Concientización", linkedProcedures: ["PROC-007"], targetDate: "2026-12-31",
    responsible: "Dilia Aguasvivas", department: "Recursos Humanos", status: "en_progreso", compliancePercent: 55,
    evidences: [
      { id: "EV-009", objectiveId: "OBJ-008", title: "Registro capacitación febrero", description: "Asistencia y evaluaciones", type: "capacitación", uploadedBy: "Dilia Aguasvivas", uploadedAt: "2026-03-02", fileName: "capacitacion_feb.pdf" },
    ],
    lastAudit: null, auditResult: null,
  },
  {
    id: "OBJ-009", code: "BASC-OBJ-009",
    title: "Trazabilidad completa de servicios prestados",
    description: "Documentar toda la cadena de servicio desde la solicitud hasta la entrega final.",
    category: "Trazabilidad y Documentación", linkedProcedures: ["PROC-008"], targetDate: "2026-12-31",
    responsible: "Remit López", department: "Operaciones", status: "en_progreso", compliancePercent: 78,
    evidences: [
      { id: "EV-010", objectiveId: "OBJ-009", title: "Flujograma de trazabilidad", description: "Diagrama actualizado", type: "documento", uploadedBy: "Remit López", uploadedAt: "2026-02-15", fileName: "flujograma_trazabilidad.pdf" },
    ],
    lastAudit: "2026-02-28", auditResult: "conforme",
  },
];
