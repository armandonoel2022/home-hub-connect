import type { Employee } from "@/lib/api";
import { getFileUrl } from "@/lib/api";
import type { IntranetUser } from "@/lib/types";

// ─── Mapeo de departamentos de RRHH → departamentos del dashboard ───
// El directorio de RRHH usa nombres "crudos" (a veces sin tilde y con puestos
// operativos por cliente). El dashboard tiene 12 departamentos corporativos.
const HR_TO_DASHBOARD: Record<string, string> = {
  "gerencia general": "Gerencia General",
  "administracion y finanzas": "Administración",
  "administracion": "Administración",
  "gerencia comercial": "Gerencia Comercial",
  "recursos humanos": "Recursos Humanos",
  "tecnologia y monitoreo": "Tecnología y Monitoreo",
  "seguridad electronica": "Seguridad Electrónica",
  // Todo el personal de campo / clientes se agrupa en Operaciones
  "operaciones": "Operaciones",
  "operaciones interior": "Operaciones",
  "supervisores": "Operaciones",
  "safeone": "Operaciones",
  "galeria 360": "Operaciones",
  "macrotech": "Operaciones",
  "asoc. nacional": "Operaciones",
  "superintendencia de bancos": "Operaciones",
  "juancito sport": "Operaciones",
};

export function normalizeText(s?: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Traduce un departamento de RRHH al departamento del dashboard. */
export function mapHrDepartment(raw: string): string {
  const key = normalizeText(raw);
  return HR_TO_DASHBOARD[key] || raw || "Sin asignar";
}

function resolvePhoto(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/photos") || url.startsWith("/uploads")) return getFileUrl(url);
  return url;
}

export interface DeptMember {
  /** Clave única: código de empleado si existe, si no el id de intranet */
  key: string;
  employeeCode?: string;
  intranetUserId?: string;
  fullName: string;
  /** Departamento del dashboard (ya mapeado) */
  dashboardDept: string;
  /** Departamento original de RRHH */
  rawDepartment: string;
  position: string;
  photoUrl?: string;
  extension?: string;
  team?: string;
  shift?: string;
  isLeader: boolean;
  /** Clave (código) del líder al que reporta */
  reportsTo?: string;
  active: boolean;
}

/**
 * Construye el listado unificado de miembros para el dashboard de departamentos.
 * Fuente primaria: empleados de RRHH. Se enriquece con la cuenta de intranet
 * (foto, extensión, equipo, turno) cuando existe coincidencia por código o nombre.
 * Los usuarios de intranet sin empleado de RRHH se agregan también (para los
 * departamentos corporativos que no existen en el seed de RRHH).
 */
export function buildDeptMembers(
  employees: Employee[],
  intranetUsers: IntranetUser[],
): DeptMember[] {
  const usersByCode = new Map<string, IntranetUser>();
  const usersByName = new Map<string, IntranetUser>();
  intranetUsers.forEach((u) => {
    if (u.employeeCode) usersByCode.set(String(u.employeeCode), u);
    usersByName.set(normalizeText(u.fullName), u);
  });

  const members: DeptMember[] = [];
  const usedUserIds = new Set<string>();

  // 1) Empleados de RRHH (fuente primaria)
  employees.forEach((e) => {
    const match =
      (e.employeeCode && usersByCode.get(String(e.employeeCode))) ||
      usersByName.get(normalizeText(e.fullName));
    if (match) usedUserIds.add(match.id);

    members.push({
      key: e.employeeCode || match?.id || normalizeText(e.fullName),
      employeeCode: e.employeeCode,
      intranetUserId: match?.id,
      fullName: e.fullName,
      dashboardDept: mapHrDepartment(e.department),
      rawDepartment: e.department,
      position: e.position || match?.position || "",
      photoUrl: resolvePhoto(e.photoUrl || e.photo) || resolvePhoto(match?.photoUrl),
      extension: e.extension || match?.extension,
      team: e.team || match?.team,
      shift: e.shift || match?.shift,
      isLeader: !!e.isDeptLeader || !!match?.isDepartmentLeader,
      reportsTo: e.reportsToCode || undefined,
      active: normalizeText(e.status) !== "inactivo",
    });
  });

  // 2) Usuarios de intranet sin empleado de RRHH (depts corporativos extra)
  intranetUsers.forEach((u) => {
    if (usedUserIds.has(u.id)) return;
    if (u.employeeStatus === "Inactivo") return;
    // reportsTo de intranet es un id USR; lo traducimos a la clave del líder
    let reportsToKey: string | undefined;
    if (u.reportsTo) {
      const leader = intranetUsers.find((x) => x.id === u.reportsTo);
      reportsToKey = leader?.employeeCode || leader?.id;
    }
    members.push({
      key: u.employeeCode || u.id,
      employeeCode: u.employeeCode,
      intranetUserId: u.id,
      fullName: u.fullName,
      dashboardDept: u.department,
      rawDepartment: u.department,
      position: u.position,
      photoUrl: resolvePhoto(u.photoUrl),
      extension: u.extension,
      team: u.team,
      shift: u.shift,
      isLeader: !!u.isDepartmentLeader,
      reportsTo: reportsToKey,
      active: true,
    });
  });

  return members;
}
