// Quién puede ver los gastos de mantenimiento de la flotilla.
const ALLOWED_USER_IDS = new Set(["USR-001", "USR-100", "USR-101"]);
const ALLOWED_DEPARTMENTS = new Set(["Administración", "Gerencia General", "Tecnología y Monitoreo"]);

export function canAccessFleetMaintenance(user: { id?: string; isAdmin?: boolean; department?: string } | null | undefined): boolean {
  return !!user && (!!user.isAdmin || ALLOWED_USER_IDS.has(String(user.id)) || ALLOWED_DEPARTMENTS.has(String(user.department)));
}
