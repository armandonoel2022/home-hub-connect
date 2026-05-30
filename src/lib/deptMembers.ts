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

/**
 * Firma de nombre tolerante a iniciales/segundos nombres: primer token + último token.
 * "Samuel A Perez" y "Samuel Aurelio Perez" producen ambos "samuel|perez".
 * Devuelve "" si no hay al menos 2 tokens (para evitar coincidencias falsas).
 */
export function nameSignature(name?: string): string {
  const tokens = normalizeText(name).split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return "";
  return `${tokens[0]}|${tokens[tokens.length - 1]}`;
}

export function significantNameTokens(name?: string): string[] {
  return normalizeText(name)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function isLikelySamePerson(shortName?: string, legalName?: string, shortDept?: string, legalDept?: string): boolean {
  const shortTokens = significantNameTokens(shortName);
  const legalTokens = significantNameTokens(legalName);
  const legalTokenSet = new Set(legalTokens);
  if (shortTokens.length < 2 || legalTokenSet.size < 2) return false;
  const allTokensMatch = shortTokens.every((token) => legalTokenSet.has(token));
  if (!allTokensMatch) return false;
  const sameFirstName = shortTokens[0] === legalTokens[0];
  const sameDepartment = !!shortDept && !!legalDept && mapHrDepartment(shortDept) === mapHrDepartment(legalDept);
  return sameFirstName || sameDepartment;
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
  // Firma de nombre (primer + último token) para tolerar diferencias de ortografía
  // como "Samuel A Perez" vs "Samuel Aurelio Perez".
  const usersByNameSig = new Map<string, IntranetUser>();
  intranetUsers.forEach((u) => {
    if (u.employeeCode) usersByCode.set(String(u.employeeCode), u);
    usersByName.set(normalizeText(u.fullName), u);
    const sig = nameSignature(u.fullName);
    if (sig && !usersByNameSig.has(sig)) usersByNameSig.set(sig, u);
  });

  const members: DeptMember[] = [];
  const usedUserIds = new Set<string>();

  // 1) Empleados de RRHH (fuente primaria)
  employees.forEach((e) => {
    const aliasMatches = intranetUsers.filter((u) => isLikelySamePerson(u.fullName, e.fullName, u.department, e.department));
    const uniqueAliasMatch = aliasMatches.length === 1 ? aliasMatches[0] : undefined;
    const match =
      (e.employeeCode && usersByCode.get(String(e.employeeCode))) ||
      usersByName.get(normalizeText(e.fullName)) ||
      usersByNameSig.get(nameSignature(e.fullName)) ||
      uniqueAliasMatch;
    if (match) usedUserIds.add(match.id);
    aliasMatches.forEach((u) => usedUserIds.add(u.id));

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
    // reportsTo de intranet puede ser un id USR (lo traducimos a la clave del líder)
    // o directamente la clave del líder (código de empleado de RRHH) cuando el líder
    // no tiene cuenta de intranet. En ese caso se usa tal cual.
    let reportsToKey: string | undefined;
    if (u.reportsTo) {
      const leader = intranetUsers.find((x) => x.id === u.reportsTo);
      reportsToKey = leader ? leader.employeeCode || leader.id : u.reportsTo;
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
