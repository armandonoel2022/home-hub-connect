import type { KeyRecord, KeyEstado } from "@/lib/keysData";

/** Estados visuales del gabinete (derivados del estado real del KeyRecord). */
export type CabinetKeyState = "available" | "assigned" | "maintenance" | "lost";

export type CabinetKeyColor =
  | "yellow"
  | "red"
  | "green"
  | "blue"
  | "black"
  | "white"
  | "gray"
  | "orange"
  | "purple"
  | "transparent";

export interface CabinetSlot {
  /** Código de posición: "001" … "040" */
  code: string;
  /** Puerta a la que pertenece la posición */
  door: "left" | "right";
  /** Coordenadas dentro del viewBox de la puerta */
  x: number;
  y: number;
}

/** Llave ya resuelta para pintarse en el gabinete. */
export interface CabinetKeyView {
  slot: CabinetSlot;
  record: KeyRecord | null;
  state: CabinetKeyState;
  /** true = la llave no está físicamente en el gabinete (prestada/extraviada). */
  out: boolean;
  color: CabinetKeyColor;
  label: string;
}

export interface CabinetCounters {
  available: number;
  assigned: number;
  maintenance: number;
  lost: number;
  empty: number;
}

/**
 * Mapeo de estados reales a estados visuales del gabinete.
 * Ahora incluye "prestada" como "assigned" para que aparezca como fuera del gabinete.
 */
export const ESTADO_TO_CABINET: Record<KeyEstado, CabinetKeyState> = {
  disponible: "available",
  asignada: "assigned",
  
  retirada: "maintenance",
  extraviada: "lost",
};

/**
 * Tokens de color para cada tipo de llave.
 */
export const COLOR_TOKENS: Record<CabinetKeyColor, { body: string; edge: string; text: string }> = {
  yellow: { body: "#f2c313", edge: "#b48c00", text: "#1a1a1a" },
  red: { body: "#e0413c", edge: "#992621", text: "#ffffff" },
  green: { body: "#2fb457", edge: "#1c7538", text: "#ffffff" },
  blue: { body: "#2f6fe0", edge: "#1c4694", text: "#ffffff" },
  black: { body: "#2a2a2e", edge: "#111114", text: "#ffffff" },
  white: { body: "#f3f4f6", edge: "#b6bac1", text: "#1a1a1a" },
  gray: { body: "#9aa0a8", edge: "#6b7178", text: "#ffffff" },
  orange: { body: "#f0821e", edge: "#a85512", text: "#ffffff" },
  purple: { body: "#8b5cf6", edge: "#5b32b8", text: "#ffffff" },
  transparent: { body: "#dfe7ec", edge: "#a9b6bf", text: "#1a1a1a" },
};

/**
 * Mapea el texto libre `colorIdentificador` (español) al token de color.
 * Ahora soporta más variantes de colores incluyendo "prestada" y otros.
 */
export function normalizeColor(raw?: string): CabinetKeyColor {
  const t = (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Colores básicos
  if (t.includes("amarill")) return "yellow";
  if (t.includes("roj")) return "red";
  if (t.includes("verde")) return "green";
  if (t.includes("azul")) return "blue";
  if (t.includes("negr")) return "black";
  if (t.includes("blanc")) return "white";
  if (t.includes("gris")) return "gray";
  if (t.includes("naranj")) return "orange";
  if (t.includes("morad") || t.includes("viole") || t.includes("rosa")) return "purple";

  // Si no hay color o está vacío, retornamos transparente
  return "transparent";
}

/**
 * Devuelve el nombre en español de un color para mostrarlo en la UI.
 */
export function getColorName(color: CabinetKeyColor): string {
  const names: Record<CabinetKeyColor, string> = {
    yellow: "Amarillo",
    red: "Rojo",
    green: "Verde",
    blue: "Azul",
    black: "Negro",
    white: "Blanco",
    gray: "Gris",
    orange: "Naranja",
    purple: "Morado",
    transparent: "Transparente",
  };
  return names[color];
}

/**
 * Obtiene la etiqueta visual para un estado del gabinete.
 */
export function getStateLabel(state: CabinetKeyState): string {
  const labels: Record<CabinetKeyState, string> = {
    available: "Disponible",
    assigned: "Prestada",
    maintenance: "Mantenimiento",
    lost: "Extraviada",
  };
  return labels[state];
}

/**
 * Obtiene el color de fondo para un estado del gabinete (para badges).
 */
export function getStateBadgeColor(state: CabinetKeyState): string {
  const colors: Record<CabinetKeyState, string> = {
    available: "bg-green-100 text-green-800 border-green-300",
    assigned: "bg-yellow-100 text-yellow-800 border-yellow-300",
    maintenance: "bg-orange-100 text-orange-800 border-orange-300",
    lost: "bg-red-100 text-red-800 border-red-300",
  };
  return colors[state];
}

/**
 * Función helper para saber si una llave está disponible para ser prestada.
 */
export function isKeyAvailable(record: KeyRecord | null): boolean {
  if (!record) return false;
  return record.estado === "disponible" && (record.cantidadEnCaja ?? 0) > 0;
}

/**
 * Función helper para saber si una llave está prestada.
 */
export function isKeyBorrowed(record: KeyRecord | null): boolean {
  if (!record) return false;
  return record.estado === "asignada";
}

/**
 * Función helper para saber si una llave está fuera del gabinete.
 * (prestada, extraviada o retirada)
 */
export function isKeyOut(record: KeyRecord | null): boolean {
  if (!record) return true; // Si no hay registro, el gancho está vacío
  return (
    record.estado === "extraviada" ||
    record.estado === "retirada" ||
    (typeof record.cantidadEnCaja === "number" && record.cantidadEnCaja <= 0)
  );
}
