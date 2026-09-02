/**
 * Resultado de la última validación del archivo TSS.
 *
 * Se valida UNA vez en RRHH → Nómina (botón "Validar archivo TSS") y el
 * resultado queda persistido para que el Directorio de Empleados muestre el
 * badge TSS de cada empleado activo sin volver a cargar el archivo.
 */

const KEY = "safeone_tss_validation_v1";

export interface TssValidationSnapshot {
  period: string;
  validatedAt: string;
  validatedBy?: string;
  fileName?: string;
  totalRows: number;
  /** Cédulas (sólo dígitos) presentes en el archivo TSS */
  cedulas: string[];
  /** Nombres normalizados presentes en el archivo (respaldo cuando no hay cédula) */
  names: string[];
  /** Salario reportado por cédula */
  salaries: Record<string, number>;
}

/**
 * Canonicaliza una cédula dominicana.
 *
 * En la base de datos (tabla Empleado) el campo `Cedula` viene con guiones y con
 * los ceros a la izquierda: `000-0000000-0` (11 dígitos). En cambio los archivos
 * de la TSS suelen traer el número sin guiones y SIN los ceros iniciales
 * (ej. `111551818` → `00111551818`). Aquí se dejan sólo dígitos y se rellena a
 * 11 posiciones para que ambas fuentes sean comparables.
 */
export function normalizeCedulaKey(v?: string | null): string {
  const d = String(v || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 11) return d.slice(-11);
  if (d.length >= 7) return d.padStart(11, "0");
  return d;
}

export function normalizeNameKey(v?: string | null): string {
  return String(v || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Clave de nombre insensible al orden: la TSS exporta "Apellido Apellido, Nombre"
 * y GENERAL almacena "Nombre Apellido Apellido". Se comparan los tokens ordenados.
 */
export function nameTokenKey(v?: string | null): string {
  return normalizeNameKey(v)
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1)
    .sort()
    .join(" ");
}


export function saveTssValidation(snap: TssValidationSnapshot): void {
  try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* cuota */ }
  window.dispatchEvent(new CustomEvent("tss-validation-updated"));
}

export function getTssValidation(): TssValidationSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TssValidationSnapshot;
    return Array.isArray(s?.cedulas) ? s : null;
  } catch { return null; }
}

export function clearTssValidation(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("tss-validation-updated"));
}

export interface TssLookup {
  period: string;
  validatedAt: string;
  totalRows: number;
  /** true si el empleado (por cédula o nombre) aparece en el archivo TSS */
  isCovered: (emp: { cedula?: string | null; tss?: string | null; fullName?: string | null }) => boolean;
  reportedSalary: (cedula?: string | null) => number | null;
}

export function buildTssLookup(snap: TssValidationSnapshot | null): TssLookup | null {
  if (!snap) return null;
  const ceds = new Set(snap.cedulas.map(normalizeCedulaKey).filter(Boolean));
  const names = new Set((snap.names || []).map(normalizeNameKey).filter(Boolean));
  return {
    period: snap.period,
    validatedAt: snap.validatedAt,
    totalRows: snap.totalRows,
    isCovered: (emp) => {
      const ced = normalizeCedulaKey(emp?.cedula || emp?.tss);
      if (ced && ceds.has(ced)) return true;
      const nm = normalizeNameKey(emp?.fullName);
      return !!nm && names.has(nm);
    },
    reportedSalary: (cedula) => {
      const ced = normalizeCedulaKey(cedula);
      const v = ced ? snap.salaries?.[ced] : undefined;
      return typeof v === "number" ? v : null;
    },
  };
}
