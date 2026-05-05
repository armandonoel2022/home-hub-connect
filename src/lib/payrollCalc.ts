/**
 * Cálculo de descuentos de ley DR (espejo del backend, para fallback sin API).
 * Tasas vigentes 2026.
 */
const SM = 24633;
export const SFS_RATE = 0.0304;
export const AFP_RATE = 0.0287;
export const SFS_CAP = SM * 10;
export const AFP_CAP = SM * 4;

const ISR_BRACKETS = [
  { from: 0,         to: 416220.00, rate: 0,    fixed: 0 },
  { from: 416220.01, to: 624329.00, rate: 0.15, fixed: 0 },
  { from: 624329.01, to: 867123.00, rate: 0.20, fixed: 31216 },
  { from: 867123.01, to: Infinity,  rate: 0.25, fixed: 79776 },
];

export function calcISRMonthly(taxableMonthly: number) {
  const annual = taxableMonthly * 12;
  const b = ISR_BRACKETS.find(x => annual >= x.from && annual <= x.to);
  if (!b || b.rate === 0) return 0;
  return Math.max(0, (b.fixed + (annual - b.from + 0.01) * b.rate) / 12);
}

export function calcDeductions(grossMonthly: number) {
  const sfs = Math.min(grossMonthly, SFS_CAP) * SFS_RATE;
  const afp = Math.min(grossMonthly, AFP_CAP) * AFP_RATE;
  const taxable = grossMonthly - sfs - afp;
  const isr = calcISRMonthly(taxable);
  return {
    sfs: round2(sfs),
    afp: round2(afp),
    isr: round2(isr),
    totalDeductions: round2(sfs + afp + isr),
    net: round2(grossMonthly - sfs - afp - isr),
  };
}

export function round2(n: number) { return Math.round(n * 100) / 100; }

export function fmtRD(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n || 0);
}

const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function centenas(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return DECENAS[d] + (u ? " Y " + UNIDADES[u] : "");
  }
  const c = Math.floor(n / 100), r = n % 100;
  return CENTENAS[c] + (r ? " " + centenas(r) : "");
}
function miles(n: number): string {
  if (n < 1000) return centenas(n);
  const m = Math.floor(n / 1000), r = n % 1000;
  const pre = m === 1 ? "MIL" : centenas(m) + " MIL";
  return pre + (r ? " " + centenas(r) : "");
}
function millones(n: number): string {
  if (n < 1_000_000) return miles(n);
  const m = Math.floor(n / 1_000_000), r = n % 1_000_000;
  const pre = m === 1 ? "UN MILLÓN" : centenas(m) + " MILLONES";
  return pre + (r ? " " + miles(r) : "");
}

export function numberToWordsDOP(n: number): string {
  const entero = Math.floor(n);
  const cent = Math.round((n - entero) * 100);
  const enteroTxt = entero === 0 ? "CERO" : millones(entero);
  return `${enteroTxt} PESOS DOMINICANOS CON ${String(cent).padStart(2, "0")}/100`;
}
