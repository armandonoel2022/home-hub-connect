// BASC Document Management System with Department Nomenclature

export interface BASCManagedDocument {
  id: string;
  code: string;
  name: string;
  type: "procedimiento" | "formulario" | "matriz" | "politica" | "registro" | "manual" | "informe";
  fileType: "pdf" | "word" | "excel" | "image" | "other" | "none";
  department: string;
  departmentPrefix: string;
  version: string;
  status: "vigente" | "borrador" | "en_revisión" | "obsoleto";
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  fileName?: string;
  fileSize?: string;
  hasFile: boolean;
  fileData?: string; // base64 data for preview
  fileMimeType?: string;
  // Review workflow
  reviewStatus: "sin_archivo" | "pendiente" | "aprobado" | "rechazado";
  reviewComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
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

const STORAGE_KEY = "safeone-basc-documents-v3";
const FILE_STORAGE_KEY = "safeone-basc-files-v1";

export function loadDocuments(): BASCManagedDocument[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const docs = JSON.parse(saved) as BASCManagedDocument[];
      // Migrate old docs without reviewStatus
      return docs.map(d => ({
        ...d,
        reviewStatus: d.reviewStatus || (d.hasFile ? "pendiente" : "sin_archivo"),
      }));
    }
  } catch {}
  return INITIAL_MANAGED_DOCS;
}

export function saveDocuments(docs: BASCManagedDocument[]) {
  // Save docs without fileData to keep localStorage small
  const docsWithoutData = docs.map(({ fileData, ...rest }) => rest);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(docsWithoutData)); } catch {}
}

// Separate storage for file data (base64)
export function saveFileData(docId: string, data: string, mimeType: string) {
  try {
    const files = JSON.parse(localStorage.getItem(FILE_STORAGE_KEY) || "{}");
    files[docId] = { data, mimeType };
    localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(files));
  } catch {}
}

export function loadFileData(docId: string): { data: string; mimeType: string } | null {
  try {
    const files = JSON.parse(localStorage.getItem(FILE_STORAGE_KEY) || "{}");
    return files[docId] || null;
  } catch { return null; }
}

export function deleteFileData(docId: string) {
  try {
    const files = JSON.parse(localStorage.getItem(FILE_STORAGE_KEY) || "{}");
    delete files[docId];
    localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(files));
  } catch {}
}

export function getFileTypeFromName(fileName: string): BASCManagedDocument["fileType"] {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "xls" || ext === "xlsx") return "excel";
  if (["jpg", "jpeg", "png", "bmp", "gif", "webp"].includes(ext || "")) return "image";
  return "other";
}

export function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimes: Record<string, string> = {
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    bmp: "image/bmp", gif: "image/gif", webp: "image/webp",
  };
  return mimes[ext || ""] || "application/octet-stream";
}

// Calculate document compliance
export function calcDocCompliance(docs: BASCManagedDocument[]): number {
  if (docs.length === 0) return 0;
  const approved = docs.filter(d => d.reviewStatus === "aprobado").length;
  return Math.round((approved / docs.length) * 100);
}

export const BASC_AREAS = [
  "GERENCIA", "SGCS", "RR.HH", "Operaciones", "Administración/Comercial", "IT",
] as const;

const makeDoc = (
  id: string, code: string, name: string, type: BASCManagedDocument["type"],
  department: string, deptPrefix: string, status: BASCManagedDocument["status"],
  createdAt: string, updatedAt: string
): BASCManagedDocument => ({
  id, code, name, type, fileType: "none", department, departmentPrefix: deptPrefix,
  version: "01", status, createdBy: "Gerencia General", createdAt,
  updatedBy: "Gerencia General", updatedAt, hasFile: false, reviewStatus: "sin_archivo",
});

export const INITIAL_MANAGED_DOCS: BASCManagedDocument[] = [
  // === GERENCIA ===
  makeDoc("MDOC-001", "PO-G-01", "Política General de Seguridad", "politica", "Gerencia", "G", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-002", "PRO-G-01", "Procedimiento control de firmas y sellos", "procedimiento", "Gerencia", "G", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-003", "PRO-G-02", "Procedimiento gestión de la seguridad", "procedimiento", "Gerencia", "G", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-004", "PRO-G-04", "Procedimiento Gestión del riesgo", "procedimiento", "Gerencia", "G", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-005", "PRO-G-05", "Procedimiento Monitoreo, medición y mejora", "procedimiento", "Gerencia", "G", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-006", "PRO-G-06", "Procedimiento Requisitos legales", "procedimiento", "Gerencia", "G", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-007", "PRO-G-07", "Procedimiento Revisión por la dirección", "procedimiento", "Gerencia", "G", "borrador", "2026-03-15", "2026-03-15"),
  // === SGCS ===
  makeDoc("MDOC-008", "PO-SG-01", "Política Manual de seguridad BASC", "politica", "SGCS", "SG", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-009", "PRO-SG-01", "Procedimiento control maestro de documentos", "procedimiento", "SGCS", "SG", "vigente", "2016-07-15", "2025-07-25"),
  makeDoc("MDOC-010", "PRO-SG-02", "Procedimiento Auditoría Interna", "procedimiento", "SGCS", "SG", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-011", "PRO-SG-03", "Procedimiento Acción correctiva y preventiva", "procedimiento", "SGCS", "SG", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-012", "PRO-SG-04", "Procedimiento Determinación de Contexto", "procedimiento", "SGCS", "SG", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-013", "PRO-SG-05", "Procedimiento Determinación de Partes Interesadas", "procedimiento", "SGCS", "SG", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-014", "PRO-SG-06", "Procedimiento Determinación de los Procesos Dentro de la Organización", "procedimiento", "SGCS", "SG", "borrador", "2025-07-25", "2025-07-25"),
  // === RR.HH ===
  makeDoc("MDOC-015", "PO-RH-01", "Política manual de inducción", "politica", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-016", "P-RH-01", "Política Comunicación interna", "politica", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-017", "P-RH-02", "Política de Pruebas médicas y antecedentes penales", "politica", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-018", "PL-RH-04", "Política Visitas Domiciliarias", "politica", "Recursos Humanos", "RH", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-019", "PRO-RH-01", "Procedimiento Reclutamiento y Selección", "procedimiento", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-020", "PRO-RH-02", "Procedimiento mantenimiento base de datos empleados", "procedimiento", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-021", "PRO-RH-03", "Política carnets de identificación", "politica", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-022", "PRO-RH-04", "Procedimiento Terminación contrato de trabajo", "procedimiento", "Recursos Humanos", "RH", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-023", "PGR-RH-01", "Programa de capacitación", "manual", "Recursos Humanos", "RH", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-024", "PGR-RH-02", "Programa de concientización", "manual", "Recursos Humanos", "RH", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-025", "PGR-RH-03", "Programa de incentivos", "manual", "Recursos Humanos", "RH", "borrador", "2026-03-15", "2026-03-15"),
  // === OPERACIONES ===
  makeDoc("MDOC-026", "PRO-OP-01", "Procedimiento Control de acceso", "procedimiento", "Operaciones", "OP", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-027", "PRO-OP-02", "Procedimiento desarme a Visitantes", "procedimiento", "Operaciones", "OP", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-028", "PRO-OP-03", "Procedimiento para el uso de lockers", "procedimiento", "Operaciones", "OP", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-029", "PRO-OP-04", "Procedimiento Reporte incidentes sospechosos", "procedimiento", "Operaciones", "OP", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-030", "PRO-OP-05", "Procedimiento Inspección de seguridad", "procedimiento", "Operaciones", "OP", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-031", "PRO-OP-06", "Procedimiento Plan de Contingencia", "procedimiento", "Operaciones", "OP", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-032", "PRO-OP-07", "Procedimiento Eventos Ilícitos en la empresa", "procedimiento", "Operaciones", "OP", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-033", "PRO-OP-08", "Procedimiento Operativo Safeone Security Company", "procedimiento", "Operaciones", "OP", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-034", "PRO-OP-09", "Procedimiento Plan de emergencia, contingencia y evacuación", "procedimiento", "Operaciones", "OP", "borrador", "2026-03-15", "2026-03-15"),
  // === GENERAL ===
  makeDoc("MDOC-035", "PRO-G-03", "Procedimiento Control de llaves", "procedimiento", "Gerencia", "G", "vigente", "2016-07-15", "2016-07-15"),
  // === ADMINISTRACIÓN/COMERCIAL ===
  makeDoc("MDOC-036", "PRO-ADM-01", "Procedimiento Revisión asociados de negocios", "procedimiento", "Administración/Comercial", "ADM", "vigente", "2016-07-15", "2016-07-15"),
  // === IT ===
  makeDoc("MDOC-037", "PO-IT-01", "Política Seguridad de la Información", "politica", "Tecnología y Monitoreo", "IT", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-038", "PRO-IT-01", "Procedimiento de Active Directory Corporativo", "procedimiento", "Tecnología y Monitoreo", "IT", "vigente", "2016-07-15", "2016-07-15"),
  makeDoc("MDOC-039", "PRO-IT-02", "Procedimiento de Monitoreo de Red", "procedimiento", "Tecnología y Monitoreo", "IT", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-040", "PRO-IT-03", "Procedimiento de Implementación de Red Corporativa", "procedimiento", "Tecnología y Monitoreo", "IT", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-041", "PRO-IT-04", "Procedimiento de Gestión de Backup", "procedimiento", "Tecnología y Monitoreo", "IT", "borrador", "2026-03-15", "2026-03-15"),
  makeDoc("MDOC-042", "PRO-IT-05", "Procedimiento de Asignación de equipos", "procedimiento", "Tecnología y Monitoreo", "IT", "borrador", "2026-03-15", "2026-03-15"),
];
