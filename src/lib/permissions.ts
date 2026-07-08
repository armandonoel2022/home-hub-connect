import type { IntranetUser } from "@/lib/types";
import { canAccessAnyAdminModule } from "@/lib/adminHubAccess";

/**
 * Sistema central de permisos por módulo.
 * Todo el sidebar, router-guard y páginas consultan este archivo.
 */

export const SUPER_USER_EMAIL = "tecnologia@safeone.com.do";
export const CO_ADMIN_IT_EMAIL = "anoel@safeone.com.do";

export type ModuleKey =
  | "dashboard"
  | "kpis"
  | "tasks"
  | "directory"
  | "calendar"
  | "tickets"
  | "itInventory"
  | "fleet"
  | "phoneFleet"
  | "armedPersonnel"
  | "workPosts"
  | "clientExpediente"
  | "weaponVault"
  | "maintenanceMatrix"
  | "uniforms"
  | "superintAudit"
  | "myHRRequests"
  | "hrApprovals"
  | "hrConsolidated"
  | "generalNomina"
  | "hrConstancias"
  | "purchaseRequests"
  | "hiringRequests"
  | "basc"
  | "training"
  | "sharedFiles"
  | "procedures"
  | "wiki"
  | "surveys"
  | "vacations"
  | "minorPurchases"
  | "clientTracking"
  | "userManagement"
  | "photoSync"
  | "techTasks"
  | "auditLog"
  | "reports"
  | "adminHub"
  | "adminForms"
  | "folderPermissions";

const norm = (s?: string) => (s || "").toLowerCase().trim();

export function isSuperUser(user: IntranetUser | null | undefined): boolean {
  return !!user && norm(user.email) === SUPER_USER_EMAIL;
}

export function isCoAdminIT(user: IntranetUser | null | undefined): boolean {
  return !!user && norm(user.email) === CO_ADMIN_IT_EMAIL;
}

export function isITSuper(user: IntranetUser | null | undefined): boolean {
  return isSuperUser(user) || isCoAdminIT(user);
}

/**
 * Editores autorizados del Expediente 360° (armas, licencias, fotos, traslados).
 * Debe mantenerse alineado con EDITOR_EMAILS en backend/routes/expediente-overlay.js.
 * El backend revalida el correo del usuario; esto solo controla la UI.
 */
export const OPS_EXPEDIENTE_EDITORS = [
  "tecnologia@safeone.com.do",
  "anoel@safeone.com.do",
  "aperez@safeone.com.do",
  "sperez@safeone.com.do",
  "samuel@safeone.com.do",
  "aurelio@safeone.com.do",
];

export function canEditExpediente(user: IntranetUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperUser(user) || !!user.isAdmin) return true;
  return OPS_EXPEDIENTE_EDITORS.includes(norm(user.email));
}

export function isAdmin(user: IntranetUser | null | undefined): boolean {
  return !!user?.isAdmin || isSuperUser(user);
}

export function isLeader(user: IntranetUser | null | undefined): boolean {
  return !!user?.isDepartmentLeader || isAdmin(user);
}

export function inDept(user: IntranetUser | null | undefined, ...depts: string[]): boolean {
  if (!user) return false;
  const d = norm(user.department);
  return depts.some((x) => norm(x) === d);
}

// Acceso por departamento (case-insensitive, soporta "Dirección Comercial" y "Gerencia Comercial")
const DEPT_ALIASES: Record<string, string[]> = {
  comercial: ["dirección comercial", "direccion comercial", "gerencia comercial"],
};

export function inDeptAlias(user: IntranetUser | null | undefined, alias: keyof typeof DEPT_ALIASES): boolean {
  if (!user) return false;
  const d = norm(user.department);
  return DEPT_ALIASES[alias].includes(d);
}

/**
 * canView: ¿puede el usuario ver el módulo en sidebar y abrirlo?
 */
export function canView(module: ModuleKey, user: IntranetUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperUser(user)) return true; // super lo ve todo

  switch (module) {
    // Acceso universal
    case "dashboard":
    case "directory":
    case "calendar":
    case "procedures":
    case "wiki":
    case "sharedFiles":
    case "surveys":
    case "training":
    case "myHRRequests":
      return true;

    // KPIs — Calidad + admin
    case "kpis":
      return isAdmin(user) || inDept(user, "Calidad");

    // Tareas — todos (cada quien ve las suyas)
    case "tasks":
      return true;

    // Tickets IT — todos (cada quien ve sus propios tickets / asignados)
    case "tickets":
      return true;

    // Inventario IT, Flota Celular — TI + super + anoel
    case "itInventory":
    case "phoneFleet":
      return isITSuper(user) || inDept(user, "Tecnología y Monitoreo") || isAdmin(user);

    // Flota Vehicular — todos pueden ver (edición se controla aparte)
    case "fleet":
      return true;

    // Módulos de Operaciones — Operaciones + Admin + Gerencia Gral + Dir. Comercial
    case "armedPersonnel":
    case "workPosts":
    case "clientExpediente":
    case "weaponVault":
    case "maintenanceMatrix":
    case "uniforms":
    case "superintAudit":
      return (
        isAdmin(user) ||
        inDept(user, "Operaciones", "Administración", "Gerencia General") ||
        inDeptAlias(user, "comercial")
      );

    // Bandeja de Aprobaciones RRHH — líderes/supervisores + RRHH + admin
    case "hrApprovals":
      return isLeader(user) || inDept(user, "Recursos Humanos") || isAdmin(user);

    // Consolidado RRHH por empleado — RRHH + admin
    case "hrConsolidated":
      return inDept(user, "Recursos Humanos") || isAdmin(user);

    // Nómina Analítica (GENERAL/gSafeOne) — RRHH, Tecnología y Monitoreo, líderes y admin
    case "generalNomina":
      return (
        isAdmin(user) ||
        isLeader(user) ||
        inDept(user, "Recursos Humanos", "Tecnología", "Tecnología y Monitoreo")
      );

    // Provisionamiento de Vacaciones — RRHH, líderes, Tecnología y Monitoreo, admin
    case "vacations":
      return (
        isAdmin(user) ||
        isLeader(user) ||
        inDept(user, "Recursos Humanos", "Tecnología", "Tecnología y Monitoreo")
      );


    // Constancias RRHH (Auditoría) — SOLO super
    case "hrConstancias":
      return isSuperUser(user);

    // Solicitudes de Compra — Admin, Contabilidad, CxC (creador ve las suyas siempre)
    case "purchaseRequests":
      return (
        isAdmin(user) ||
        inDept(user, "Administración", "Contabilidad", "Cuentas por Cobrar")
      );

    // Solicitudes de Personal — líderes + RRHH
    case "hiringRequests":
      return isLeader(user) || inDept(user, "Recursos Humanos");

    // BASC — Calidad + líderes (lectura)
    case "basc":
      return inDept(user, "Calidad") || isLeader(user);

    // Gastos Menores — CxC, Contabilidad, Admin
    case "minorPurchases":
      return isAdmin(user) || inDept(user, "Cuentas por Cobrar", "Contabilidad", "Administración");

    // Seguimiento Clientes Monitoreo
    case "clientTracking":
      return (
        isITSuper(user) ||
        isAdmin(user) ||
        inDept(user, "Tecnología y Monitoreo", "Administración", "Cuentas por Cobrar", "Gerencia General") ||
        inDeptAlias(user, "comercial")
      );

    // Gestión de Usuarios, Sincronizar fotos, Registro tareas IT — super + anoel
    case "userManagement":
    case "photoSync":
    case "techTasks":
      return isITSuper(user);

    // Auditoría / Reportes / Admin Forms — admin
    case "auditLog":
    case "reports":
    case "adminForms":
      return isAdmin(user);

    // Admin Hub — admin, Chrisnel, o cualquier usuario con módulos delegados
    case "adminHub":
      return isAdmin(user) || canAccessAnyAdminModule(user);


    // Gestión de permisos de carpetas — sólo super
    case "folderPermissions":
      return isSuperUser(user);

    default:
      return false;
  }
}

/**
 * canEdit: ¿puede modificar el contenido del módulo?
 */
export function canEdit(module: ModuleKey, user: IntranetUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperUser(user)) return true;

  switch (module) {
    case "fleet":
      return (
        isAdmin(user) ||
        inDept(user, "Administración", "Tecnología y Monitoreo")
      );

    case "kpis":
      return isAdmin(user) || inDept(user, "Calidad");

    case "basc":
      return isAdmin(user) || inDept(user, "Calidad");

    case "training":
      return isITSuper(user) || inDept(user, "Recursos Humanos") || isAdmin(user);

    case "hiringRequests":
      return isLeader(user) || inDept(user, "Recursos Humanos");

    default:
      // Por defecto: si puede ver, puede editar (módulos sin reglas especiales)
      return canView(module, user);
  }
}
