// BASC Document Management System with Department Nomenclature

export interface BASCManagedDocument {
  id: string;
  code: string; // e.g. PRO-IT-01, F-ADM-03, M-IT-02
  name: string;
  content: string; // rich text content for in-app editing
  type: "procedimiento" | "formulario" | "matriz" | "politica" | "registro" | "manual" | "informe";
  fileType: "pdf" | "word" | "excel" | "image" | "other";
  department: string;
  departmentPrefix: string; // IT, ADM, RRHH, COM, OPS, SE, TEC
  version: string;
  status: "vigente" | "borrador" | "en_revisión" | "obsoleto";
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  fileName?: string; // original uploaded file name
  fileSize?: string;
  hasFile: boolean; // whether a file was uploaded
}

export const DEPARTMENT_PREFIXES: Record<string, string> = {
  "Gerencia": "G",
  "SGCS": "SG",
  "Recursos Humanos": "RH",
  "Operaciones": "OP",
  "Administración/Comercial": "ADM",
  "Tecnología y Monitoreo": "IT",
  "Seguridad Electrónica": "SE",
  "Gerencia General": "GG",
  "Calidad": "CAL",
};

export const DOC_TYPE_PREFIXES: Record<BASCManagedDocument["type"], string> = {
  procedimiento: "PRO",
  formulario: "F",
  matriz: "M",
  politica: "PO",
  registro: "REG",
  manual: "MAN",
  informe: "INF",
};

export function generateDocCode(type: BASCManagedDocument["type"], deptPrefix: string, sequence: number): string {
  return `${DOC_TYPE_PREFIXES[type]}-${deptPrefix}-${String(sequence).padStart(2, "0")}`;
}

export function getNextSequence(docs: BASCManagedDocument[], type: BASCManagedDocument["type"], deptPrefix: string): number {
  const prefix = `${DOC_TYPE_PREFIXES[type]}-${deptPrefix}-`;
  const existing = docs
    .filter(d => d.code.startsWith(prefix))
    .map(d => {
      const num = parseInt(d.code.replace(prefix, ""), 10);
      return isNaN(num) ? 0 : num;
    });
  return existing.length > 0 ? Math.max(...existing) + 1 : 1;
}

const STORAGE_KEY = "safeone-basc-documents-v2";

export function loadDocuments(): BASCManagedDocument[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_MANAGED_DOCS;
}

export function saveDocuments(docs: BASCManagedDocument[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(docs)); } catch {}
}

export const BASC_AREAS = [
  "GERENCIA",
  "SGCS",
  "RR.HH",
  "Operaciones",
  "Administración/Comercial",
  "IT",
] as const;

export const INITIAL_MANAGED_DOCS: BASCManagedDocument[] = [
  // === GERENCIA ===
  { id: "MDOC-001", code: "PO-G-01", name: "Política General de Seguridad", content: "", type: "politica", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-002", code: "PRO-G-01", name: "Procedimiento control de firmas y sellos", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-003", code: "PRO-G-02", name: "Procedimiento gestión de la seguridad", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-004", code: "PRO-G-04", name: "Procedimiento Gestión del riesgo", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-005", code: "PRO-G-05", name: "Procedimiento Monitoreo, medición y mejora", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-006", code: "PRO-G-06", name: "Procedimiento Requisitos legales", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-007", code: "PRO-G-07", name: "Procedimiento Revisión por la dirección", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  // === SGCS ===
  { id: "MDOC-008", code: "PO-SG-01", name: "Política Manual de seguridad BASC", content: "", type: "politica", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-009", code: "PRO-SG-01", name: "Procedimiento control maestro de documentos", content: "", type: "procedimiento", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2025-07-25", hasFile: false },
  { id: "MDOC-010", code: "PRO-SG-02", name: "Procedimiento Auditoría Interna", content: "", type: "procedimiento", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-011", code: "PRO-SG-03", name: "Procedimiento Acción correctiva y preventiva", content: "", type: "procedimiento", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-012", code: "PRO-SG-04", name: "Procedimiento Determinación de Contexto", content: "", type: "procedimiento", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-013", code: "PRO-SG-05", name: "Procedimiento Determinación de Partes Interesadas", content: "", type: "procedimiento", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-014", code: "PRO-SG-06", name: "Procedimiento Determinación de los Procesos Dentro de la Organización", content: "", type: "procedimiento", fileType: "word", department: "SGCS", departmentPrefix: "SG", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2025-07-25", updatedBy: "Gerencia General", updatedAt: "2025-07-25", hasFile: false },
  // === RR.HH ===
  { id: "MDOC-015", code: "PO-RH-01", name: "Política manual de inducción", content: "", type: "politica", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-016", code: "P-RH-01", name: "Política Comunicación interna", content: "", type: "politica", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-017", code: "P-RH-02", name: "Política de Pruebas médicas y antecedentes penales", content: "", type: "politica", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-018", code: "PL-RH-04", name: "Política Visitas Domiciliarias", content: "", type: "politica", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-019", code: "PRO-RH-01", name: "Procedimiento Reclutamiento y Selección", content: "", type: "procedimiento", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-020", code: "PRO-RH-02", name: "Procedimiento mantenimiento base de datos empleados", content: "", type: "procedimiento", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-021", code: "PRO-RH-03", name: "Política carnets de identificación", content: "", type: "politica", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-022", code: "PRO-RH-04", name: "Procedimiento Terminación contrato de trabajo", content: "", type: "procedimiento", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-023", code: "PGR-RH-01", name: "Programa de capacitación", content: "", type: "manual", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-024", code: "PGR-RH-02", name: "Programa de concientización", content: "", type: "manual", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-025", code: "PGR-RH-03", name: "Programa de incentivos", content: "", type: "manual", fileType: "word", department: "Recursos Humanos", departmentPrefix: "RH", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  // === OPERACIONES ===
  { id: "MDOC-026", code: "PRO-OP-01", name: "Procedimiento Control de acceso", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-027", code: "PRO-OP-02", name: "Procedimiento desarme a Visitantes", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-028", code: "PRO-OP-03", name: "Procedimiento para el uso de lockers", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-029", code: "PRO-OP-04", name: "Procedimiento Reporte incidentes sospechosos", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-030", code: "PRO-OP-05", name: "Procedimiento Inspección de seguridad", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-031", code: "PRO-OP-06", name: "Procedimiento Plan de Contingencia", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-032", code: "PRO-OP-07", name: "Procedimiento Eventos Ilícitos en la empresa", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-033", code: "PRO-OP-08", name: "Procedimiento Operativo Safeone Security Company", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-034", code: "PRO-OP-09", name: "Procedimiento Plan de emergencia, contingencia y evacuación", content: "", type: "procedimiento", fileType: "word", department: "Operaciones", departmentPrefix: "OP", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  // === GENERAL / SIN AREA ===
  { id: "MDOC-035", code: "PRO-G-03", name: "Procedimiento Control de llaves", content: "", type: "procedimiento", fileType: "word", department: "Gerencia", departmentPrefix: "G", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  // === ADMINISTRACIÓN/COMERCIAL ===
  { id: "MDOC-036", code: "PRO-ADM-01", name: "Procedimiento Revisión asociados de negocios", content: "", type: "procedimiento", fileType: "word", department: "Administración/Comercial", departmentPrefix: "ADM", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  // === IT ===
  { id: "MDOC-037", code: "PO-IT-01", name: "Política Seguridad de la Información", content: "", type: "politica", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-038", code: "PRO-IT-01", name: "Procedimiento de Active Directory Corporativo", content: "", type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT", version: "01", status: "vigente", createdBy: "Gerencia General", createdAt: "2016-07-15", updatedBy: "Gerencia General", updatedAt: "2016-07-15", hasFile: false },
  { id: "MDOC-039", code: "PRO-IT-02", name: "Procedimiento de Monitoreo de Red", content: "", type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-040", code: "PRO-IT-03", name: "Procedimiento de Implementación de Red Corporativa", content: "", type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-041", code: "PRO-IT-04", name: "Procedimiento de Gestión de Backup", content: "", type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
  { id: "MDOC-042", code: "PRO-IT-05", name: "Procedimiento de Asignación de equipos", content: "", type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT", version: "01", status: "borrador", createdBy: "Gerencia General", createdAt: "2026-03-15", updatedBy: "Gerencia General", updatedAt: "2026-03-15", hasFile: false },
];
