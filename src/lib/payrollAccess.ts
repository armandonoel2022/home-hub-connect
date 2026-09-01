import type { IntranetUser } from "@/lib/types";

/**
 * Control de acceso a información salarial.
 *
 * Sólo RRHH y una lista corta de excepciones pueden ver la nómina COMPLETA.
 * El resto accede a "Mi Nómina", donde el backend filtra por su propio
 * registro de Empleado o por su departamento (si es líder).
 *
 * Debe mantenerse alineado con FULL_ACCESS_EMAILS en backend/routes/my-payroll.js.
 */
export const PAYROLL_FULL_ACCESS_EMAILS = [
  "tecnologia@safeone.com.do", // Administrador de la Intranet
  "anoel@safeone.com.do",      // Armando Noel
  "aperez@safeone.com.do",     // Aurelio Pérez
  "sperez@safeone.com.do",     // Samuel Pérez
  "samuel@safeone.com.do",
  "aurelio@safeone.com.do",
  "cfabian@safeone.com.do",    // Chrisnel Fabián
];

const norm = (s?: string) => (s || "").toLowerCase().trim();

/** ¿Puede ver la nómina completa de toda la empresa? */
export function canViewFullPayroll(user: IntranetUser | null | undefined): boolean {
  if (!user) return false;
  if (PAYROLL_FULL_ACCESS_EMAILS.includes(norm(user.email))) return true;
  return /recursos humanos|rrhh/.test(norm(user.department));
}
