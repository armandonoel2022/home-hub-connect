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
  "Tecnología y Monitoreo": "IT",
  "Administración": "ADM",
  "Recursos Humanos": "RRHH",
  "Gerencia Comercial": "COM",
  "Operaciones": "OPS",
  "Seguridad Electrónica": "SE",
  "Gerencia General": "GG",
  "Calidad": "CAL",
};

export const DOC_TYPE_PREFIXES: Record<BASCManagedDocument["type"], string> = {
  procedimiento: "PRO",
  formulario: "F",
  matriz: "M",
  politica: "POL",
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

const STORAGE_KEY = "safeone-basc-documents-v1";

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

export const INITIAL_MANAGED_DOCS: BASCManagedDocument[] = [
  {
    id: "MDOC-001", code: "PRO-IT-01", name: "Procedimiento de Active Directory Corporativo",
    content: `<h2>1. Objetivo</h2><p>Establecer los lineamientos para la gestión del Active Directory corporativo, asegurando el control de accesos, la administración de cuentas de usuario y la correcta configuración de políticas de grupo (GPO).</p><h2>2. Alcance</h2><p>Este procedimiento aplica a todas las cuentas de usuario, grupos y unidades organizativas (OU) gestionadas dentro del dominio corporativo de Safe One Security.</p><h2>3. Responsabilidades</h2><ul><li><strong>Gerente de TI:</strong> Supervisar la correcta implementación y cumplimiento del procedimiento.</li><li><strong>Administrador de Sistemas:</strong> Ejecutar las tareas de creación, modificación y eliminación de cuentas.</li><li><strong>RRHH:</strong> Notificar altas, bajas y cambios de personal.</li></ul>`,
    type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "PRO-IT-01_Procedimiento_Active_Directory.docx", fileSize: "245 KB",
  },
  {
    id: "MDOC-002", code: "PRO-IT-02", name: "Procedimiento de Monitoreo de Red",
    content: `<h2>1. Objetivo</h2><p>Definir el proceso de monitoreo continuo de la infraestructura de red para detectar y responder a incidentes de conectividad y seguridad.</p><h2>2. Alcance</h2><p>Aplica a todos los equipos de red, servidores y dispositivos conectados a la infraestructura de Safe One Security.</p>`,
    type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "PRO-IT-02_Procedimiento_Monitoreo_Red.docx", fileSize: "198 KB",
  },
  {
    id: "MDOC-003", code: "PRO-IT-03", name: "Procedimiento de Implementación de Red Corporativa",
    content: `<h2>1. Objetivo</h2><p>Establecer los pasos para la implementación y configuración de redes corporativas en nuevas sedes o ampliaciones.</p>`,
    type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "PRO-IT-03_Procedimiento_Red_Corporativa.docx", fileSize: "312 KB",
  },
  {
    id: "MDOC-004", code: "PRO-IT-04", name: "Procedimiento de Gestión de Backup",
    content: `<h2>1. Objetivo</h2><p>Garantizar la protección de datos críticos mediante respaldos periódicos y la capacidad de restauración.</p>`,
    type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "PRO-IT-04_Procedimiento_Backup.docx", fileSize: "178 KB",
  },
  {
    id: "MDOC-005", code: "PRO-IT-05", name: "Procedimiento de Asignación de Equipos",
    content: `<h2>1. Objetivo</h2><p>Definir el proceso de asignación, control y devolución de equipos tecnológicos al personal.</p>`,
    type: "procedimiento", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "PRO-IT-05_Procedimiento_Asignacion_Equipos.docx", fileSize: "156 KB",
  },
  {
    id: "MDOC-006", code: "M-IT-01", name: "Formulario Matriz General de Usuarios IT",
    content: `<h2>Matriz General de Usuarios IT</h2><p>Registro completo de usuarios del sistema, incluyendo permisos, accesos y estado de cuenta.</p>`,
    type: "matriz", fileType: "excel", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "M-IT-01_Matriz_General_Usuarios_IT.xlsx", fileSize: "89 KB",
  },
  {
    id: "MDOC-007", code: "M-IT-02", name: "Formulario Matriz General de Partes Interesadas",
    content: `<h2>Matriz de Partes Interesadas</h2><p>Identificación y análisis de partes interesadas relevantes para el SGCS.</p>`,
    type: "matriz", fileType: "excel", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "M-IT-02_Matriz_Partes_Interesadas.xlsx", fileSize: "67 KB",
  },
  {
    id: "MDOC-008", code: "M-IT-03", name: "Formulario Matriz de Criticidad de la Información",
    content: `<h2>Matriz de Criticidad</h2><p>Clasificación de información según niveles de criticidad y controles requeridos.</p>`,
    type: "matriz", fileType: "excel", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "M-IT-03_Matriz_Criticidad_Informacion.xlsx", fileSize: "74 KB",
  },
  {
    id: "MDOC-009", code: "INF-IT-01", name: "Informe Técnico Modernización de Infraestructura TI",
    content: `<h2>Informe Técnico</h2><p>Análisis detallado de la infraestructura actual, deficiencias identificadas y plan de modernización propuesto.</p>`,
    type: "informe", fileType: "word", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "INFORME_TECNICO_MODERNIZACION_TI.docx", fileSize: "520 KB",
  },
  {
    id: "MDOC-010", code: "M-IT-04", name: "Mapa Completo Red SafeOneSecurity Levantamiento 2025",
    content: `<h2>Mapa de Red</h2><p>Diagrama completo de la topología de red incluyendo todos los segmentos, VLANs y dispositivos.</p>`,
    type: "matriz", fileType: "excel", department: "Tecnología y Monitoreo", departmentPrefix: "IT",
    version: "1.0", status: "vigente", createdBy: "Armando Noel", createdAt: "2026-03-15",
    updatedBy: "Armando Noel", updatedAt: "2026-03-15", hasFile: true,
    fileName: "Mapa_Red_SafeOneSecurity_2025.xlsx", fileSize: "340 KB",
  },
];
