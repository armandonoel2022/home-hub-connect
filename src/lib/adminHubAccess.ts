import type { IntranetUser } from "@/lib/types";

/**
 * Control de acceso granular a los módulos del Hub de Administración.
 *
 * Chrisnel (o un administrador / superusuario) puede autorizar a cualquier
 * usuario de la intranet a ver SOLO los módulos que ella permita, de forma
 * individual (Control de Llaves, Órdenes de Compra, etc.).
 *
 * Se persiste en localStorage (entorno local de la intranet) y emite un evento
 * para refrescar otras vistas abiertas.
 */

const KEY = "safeone_adminhub_acl_v1";
const SUPER_EMAIL = "tecnologia@safeone.com.do";

export type AdminModuleKey =
  | "purchaseOrders"
  | "pettyCash"
  | "keys"
  | "corporateCards"
  | "fleetMaintenance"
  | "deviceRegistrations"
  | "fixedAssets";

export interface AdminModuleDef {
  key: AdminModuleKey;
  label: string;
  desc: string;
}

export const ADMIN_HUB_MODULES: AdminModuleDef[] = [
  { key: "purchaseOrders", label: "Órdenes de Compra / Servicio", desc: "Generar OC y OS con numeración automática" },
  { key: "pettyCash", label: "Caja Chica", desc: "Gastos menores con límite mensual y reposiciones" },
  { key: "keys", label: "Control de Llaves", desc: "Inventario, asignación, copias y revisiones" },
  { key: "corporateCards", label: "Tarjetas Corporativas", desc: "Tarjetas asignadas, límites y cargos mensuales" },
  { key: "fleetMaintenance", label: "Flotilla — Mantenimiento", desc: "Reparaciones y gastos de la flotilla" },
  { key: "deviceRegistrations", label: "Registros de Dispositivos", desc: "Altas de Flota Celular e Inventario IT (PRO-IT-05)" },
  { key: "fixedAssets", label: "Activos Fijos", desc: "Inventario y gestión de activos fijos" },
];

const norm = (s?: string) => (s || "").toLowerCase().trim();

export type AdminHubAcl = Record<string, AdminModuleKey[]>;

export function getAdminHubAcl(): AdminHubAcl {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AdminHubAcl) : {};
  } catch {
    return {};
  }
}

export function setUserModules(userId: string, modules: AdminModuleKey[]): AdminHubAcl {
  const acl = getAdminHubAcl();
  if (modules.length === 0) delete acl[userId];
  else acl[userId] = modules;
  localStorage.setItem(KEY, JSON.stringify(acl));
  try { window.dispatchEvent(new CustomEvent("safeone:adminhub-acl")); } catch {}
  return acl;
}

export function isSuperUser(user: IntranetUser | null | undefined): boolean {
  return !!user && norm(user.email) === SUPER_EMAIL;
}

/** Chrisnel — administradora del Hub que delega accesos. */
export function isChrisnel(user: IntranetUser | null | undefined): boolean {
  return !!user && norm(user.fullName).includes("chrisnel");
}

/** ¿Puede administrar (otorgar/revocar) accesos del Hub? */
export function canManageAdminHubAccess(user: IntranetUser | null | undefined): boolean {
  return !!user && (isSuperUser(user) || !!user.isAdmin || isChrisnel(user));
}

/** Acceso total: admins, super y Chrisnel ven todos los módulos. */
export function hasFullAdminHubAccess(user: IntranetUser | null | undefined): boolean {
  return canManageAdminHubAccess(user);
}

/** ¿Puede ver un módulo específico del Hub? */
export function canAccessAdminModule(
  user: IntranetUser | null | undefined,
  moduleKey: AdminModuleKey,
): boolean {
  if (!user) return false;
  if (hasFullAdminHubAccess(user)) return true;
  const acl = getAdminHubAcl();
  return (acl[user.id] || []).includes(moduleKey);
}

/** ¿Tiene acceso a al menos un módulo (para poder abrir el Hub)? */
export function canAccessAnyAdminModule(user: IntranetUser | null | undefined): boolean {
  if (!user) return false;
  if (hasFullAdminHubAccess(user)) return true;
  const acl = getAdminHubAcl();
  return (acl[user.id] || []).length > 0;
}
