export type TaskType = "tecnica" | "coordinacion" | "gestion" | "reunion";
export type TaskStatus = "completada" | "en_espera" | "requiere_seguimiento";
export type TimeBlock = "gestion_rapida" | "soporte_tecnico" | "reuniones" | "personalizado";

export interface TechTask {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  description: string;
  type: TaskType;
  status: TaskStatus;
  statusDetail?: string; // e.g. "En espera de Chrisnel"
  dependsOnThirdParty: boolean;
  thirdPartyName?: string;
  timeSpent: number; // minutes
  notes?: string;
  block: TimeBlock;
  customBlockName?: string;
  decisions?: string; // key decisions / agreements
  createdBy: string; // email
  createdAt: string; // ISO
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  tecnica: "Técnica",
  coordinacion: "Coordinación",
  gestion: "Gestión",
  reunion: "Reunión",
};

export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  tecnica: "hsl(210 80% 55%)",
  coordinacion: "hsl(42 100% 50%)",
  gestion: "hsl(160 60% 45%)",
  reunion: "hsl(280 60% 55%)",
};

export const TASK_TYPE_BG: Record<TaskType, string> = {
  tecnica: "bg-blue-100 text-blue-800 border-blue-300",
  coordinacion: "bg-amber-100 text-amber-800 border-amber-300",
  gestion: "bg-emerald-100 text-emerald-800 border-emerald-300",
  reunion: "bg-purple-100 text-purple-800 border-purple-300",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  completada: "Completada",
  en_espera: "En espera de…",
  requiere_seguimiento: "Requiere seguimiento",
};

export const BLOCK_LABELS: Record<TimeBlock, string> = {
  gestion_rapida: "Gestión Rápida (Mañana)",
  soporte_tecnico: "Soporte Técnico",
  reuniones: "Reuniones / Colaboración",
  personalizado: "Bloque Personalizado",
};

export const AUTHORIZED_EMAILS = [
  "anoel@safeone.com.do",
  "tecnologia@safeone.com.do",
];
