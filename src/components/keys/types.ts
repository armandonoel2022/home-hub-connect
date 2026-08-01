import type { KeyRecord, KeyEstado } from "@/lib/keysData";

/** Estados visuales del gabinete (derivados del estado real del KeyRecord). */
export type CabinetKeyState = "available" | "assigned" | "maintenance" | "lost";

export type CabinetKeyColor =
  | "yellow" | "red" | "green" | "blue" | "black"
  | "white" | "gray" | "orange" | "purple" | "transparent";

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

export const ESTADO_TO_CABINET: Record<KeyEstado, CabinetKeyState> = {
  disponible: "available",
  asignada: "assigned",
  retirada: "maintenance",
  extraviada: "lost",
};

export const COLOR_TOKENS: Record<CabinetKeyColor, { body: string; edge: string; text: string }> = {
  yellow:      { body: "#f2c313", edge: "#b48c00", text: "#1a1a1a" },
  red:         { body: "#e0413c", edge: "#992621", text: "#ffffff" },
  green:       { body: "#2fb457", edge: "#1c7538", text: "#ffffff" },
  blue:        { body: "#2f6fe0", edge: "#1c4694", text: "#ffffff" },
  black:       { body: "#2a2a2e", edge: "#111114", text: "#ffffff" },
  white:       { body: "#f3f4f6", edge: "#b6bac1", text: "#1a1a1a" },
  gray:        { body: "#9aa0a8", edge: "#6b7178", text: "#ffffff" },
  orange:      { body: "#f0821e", edge: "#a85512", text: "#ffffff" },
  purple:      { body: "#8b5cf6", edge: "#5b32b8", text: "#ffffff" },
  transparent: { body: "#dfe7ec", edge: "#a9b6bf", text: "#1a1a1a" },
};

/** Mapea el texto libre `colorIdentificador` (español) al token de color. */
export function normalizeColor(raw?: string): CabinetKeyColor {
  const t = (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (t.includes("amarill")) return "yellow";
  if (t.includes("roj")) return "red";
  if (t.includes("verde")) return "green";
  if (t.includes("azul")) return "blue";
  if (t.includes("negr")) return "black";
  if (t.includes("blanc")) return "white";
  if (t.includes("gris")) return "gray";
  if (t.includes("naranj")) return "orange";
  if (t.includes("morad") || t.includes("viole") || t.includes("rosa")) return "purple";
  return "transparent";
}
