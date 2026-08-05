/**
 * Jerarquía de aprobación de vacaciones.
 * Los líderes de área NO aprueban sus propias vacaciones: cada uno reporta a un
 * superior, tal como se muestra en los bloques de departamento del dashboard.
 */

const norm = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** true si todos los tokens del patrón aparecen en el nombre completo. */
export function matchesName(fullName?: string, pattern?: string): boolean {
  const tokens = norm(fullName);
  const pat = norm(pattern);
  if (!tokens.length || !pat.length) return false;
  return pat.every((p) => tokens.includes(p));
}

/** Mapa: patrón del colaborador → patrón de su superior aprobador. */
const REPORTS_TO: Array<{ person: string; approver: string; approverLabel: string }> = [
  { person: "chrisnel", approver: "aurelio perez", approverLabel: "Crisóstomo Aurelio Pérez Santos" },
  { person: "samuel perez", approver: "aurelio perez", approverLabel: "Crisóstomo Aurelio Pérez Santos" },
  { person: "armando noel", approver: "samuel perez", approverLabel: "Samuel Aurelio Pérez" },
  { person: "dilia aguasvivas", approver: "samuel perez", approverLabel: "Samuel Aurelio Pérez" },
  { person: "remit lopez", approver: "samuel perez", approverLabel: "Samuel Aurelio Pérez" },
  { person: "perla nicole", approver: "samuel perez", approverLabel: "Samuel Aurelio Pérez" },
  { person: "bilianny michelle", approver: "samuel perez", approverLabel: "Samuel Aurelio Pérez" },
  { person: "luis alfredo ovalle", approver: "samuel perez", approverLabel: "Samuel Aurelio Pérez" },
];

/** Devuelve el aprobador directo (etiqueta + patrón) de una persona, si aplica. */
export function getDirectApprover(fullName?: string) {
  const rule = REPORTS_TO.find((r) => matchesName(fullName, r.person));
  return rule ? { pattern: rule.approver, label: rule.approverLabel } : null;
}

/** true si `approverName` está en la cadena de mando por encima de `employeeName`. */
export function isApproverFor(approverName?: string, employeeName?: string): boolean {
  let current = employeeName;
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const up = getDirectApprover(current);
    if (!up) return false;
    if (matchesName(approverName, up.pattern)) return true;
    if (seen.has(up.pattern)) return false;
    seen.add(up.pattern);
    current = up.label;
  }
  return false;
}

/** true si el colaborador tiene un superior definido en la jerarquía. */
export function hasDefinedApprover(fullName?: string): boolean {
  return !!getDirectApprover(fullName);
}

/** true si la persona es la misma que el usuario (nombre o código de empleado). */
export function isSamePerson(
  a: { name?: string; code?: string | number },
  b: { name?: string; code?: string | number },
): boolean {
  if (a.code && b.code && String(a.code) === String(b.code)) return true;
  return matchesName(a.name, b.name) || matchesName(b.name, a.name);
}
