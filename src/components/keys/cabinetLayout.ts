import type { CabinetSlot } from "./types";

/** Geometría del gabinete (coordenadas en unidades del viewBox de cada puerta). */
export const DOOR_WIDTH = 560;
export const DOOR_HEIGHT = 560;

const LEFT_COLS = 10;
const LEFT_ROWS = 3;
const LEFT_X0 = 46;
const LEFT_DX = 52;
const LEFT_Y0 = 96;
const LEFT_DY = 150;

const RIGHT_X0 = 46;
const RIGHT_DX = 52;
const RIGHT_Y0 = 96;

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

function buildLayout(): CabinetSlot[] {
  const slots: CabinetSlot[] = [];
  // Puerta izquierda: 001 – 030 (3 filas x 10)
  for (let row = 0; row < LEFT_ROWS; row++) {
    for (let col = 0; col < LEFT_COLS; col++) {
      const n = row * LEFT_COLS + col + 1;
      slots.push({
        code: pad(n),
        door: "left",
        x: LEFT_X0 + col * LEFT_DX,
        y: LEFT_Y0 + row * LEFT_DY,
      });
    }
  }
  // Puerta derecha: 031 – 040 (1 fila x 10)
  for (let col = 0; col < 10; col++) {
    const n = 31 + col;
    slots.push({
      code: pad(n),
      door: "right",
      x: RIGHT_X0 + col * RIGHT_DX,
      y: RIGHT_Y0,
    });
  }
  return slots;
}

export const cabinetLayout: CabinetSlot[] = buildLayout();

export const leftSlots: CabinetSlot[] = cabinetLayout.filter((s) => s.door === "left");
export const rightSlots: CabinetSlot[] = cabinetLayout.filter((s) => s.door === "right");

/** Filas visuales (para dibujar las barras metálicas de soporte). */
export const leftRailYs: number[] = [0, 1, 2].map((r) => LEFT_Y0 + r * LEFT_DY);
export const rightRailYs: number[] = [RIGHT_Y0, RIGHT_Y0 + 190, RIGHT_Y0 + 380];
export { RIGHT_DX, LEFT_DX };
