/**
 * Asset-User Linking Service
 * 
 * Queries all asset types (equipment, phones, vehicles, armed personnel)
 * to find items assigned to a specific user by name matching.
 * Prepared for backend API integration.
 */

import type { Equipment, PhoneDevice, Vehicle, ArmedPersonnel } from "./types";

export interface AssignedAsset {
  type: "equipment" | "phone" | "vehicle" | "weapon";
  typeLabel: string;
  id: string;
  description: string;
  details: string;
}

export interface UserAssetSummary {
  userName: string;
  userId: string;
  assets: AssignedAsset[];
  totalCount: number;
}

/**
 * Find all assets assigned to a user by matching their fullName
 * against the assignedTo fields across all asset types.
 */
export function getUserAssignedAssets(
  userName: string,
  userId: string,
  equipment: Equipment[],
  phones: PhoneDevice[],
  vehicles: Vehicle[],
  armedPersonnel: ArmedPersonnel[]
): UserAssetSummary {
  const assets: AssignedAsset[] = [];
  const nameLower = userName.toLowerCase().trim();

  // Equipment (computers, monitors, printers, etc.)
  equipment.forEach((eq) => {
    if (eq.assignedTo && eq.assignedTo.toLowerCase().trim() === nameLower && eq.status !== "Dado de Baja") {
      assets.push({
        type: "equipment",
        typeLabel: eq.type,
        id: eq.id,
        description: `${eq.brand} ${eq.model}`,
        details: `Serial: ${eq.serial} | Estado: ${eq.status}`,
      });
    }
  });

  // Phone fleet
  phones.forEach((ph) => {
    if (ph.assignedTo && ph.assignedTo.toLowerCase().trim() === nameLower && ph.status !== "Dado de Baja") {
      assets.push({
        type: "phone",
        typeLabel: "Flota Celular",
        id: ph.id,
        description: `${ph.brand} ${ph.model}`,
        details: `IMEI: ${ph.imei} | Línea: ${ph.phoneNumber}`,
      });
    }
  });

  // Vehicles
  vehicles.forEach((vh) => {
    if (vh.assignedTo && vh.assignedTo.toLowerCase().trim() === nameLower && vh.status !== "Dado de Baja") {
      assets.push({
        type: "vehicle",
        typeLabel: "Vehículo",
        id: vh.id,
        description: `${vh.brand} ${vh.model} ${vh.year}`,
        details: `Placa: ${vh.plate}`,
      });
    }
  });

  // Armed personnel weapons (match by name in armed personnel records)
  armedPersonnel.forEach((ap) => {
    if (ap.name && ap.name.toLowerCase().trim() === nameLower && ap.status === "Activo" && ap.weaponSerial) {
      assets.push({
        type: "weapon",
        typeLabel: "Arma",
        id: ap.id,
        description: `${ap.weaponType} ${ap.weaponBrand}`,
        details: `Serial: ${ap.weaponSerial} | Calibre: ${ap.weaponCaliber}`,
      });
    }
  });

  return {
    userName,
    userId,
    assets,
    totalCount: assets.length,
  };
}

/**
 * Generate a formatted text summary of assets for ticket descriptions
 */
export function formatAssetListForTicket(summary: UserAssetSummary): string {
  if (summary.totalCount === 0) return "No se encontraron activos asignados a este usuario.";

  const lines = summary.assets.map(
    (a) => `• [${a.typeLabel}] ${a.description} (${a.id}) — ${a.details}`
  );
  return `Activos asignados a ${summary.userName} (${summary.totalCount} elementos):\n\n${lines.join("\n")}`;
}

/**
 * Generate offboarding ticket description
 */
export function generateOffboardingTicketDescription(
  userName: string,
  department: string,
  reason: string,
  assetSummary: UserAssetSummary
): string {
  const assetText = formatAssetListForTicket(assetSummary);
  return `TICKET AUTOMÁTICO — DESVINCULACIÓN DE PERSONAL\n\nColaborador: ${userName}\nDepartamento: ${department}\nMotivo: ${reason}\nFecha: ${new Date().toLocaleDateString("es-DO")}\n\n═══ ACTIVOS A RECUPERAR ═══\n\n${assetText}\n\n═══ ACCIONES REQUERIDAS ═══\n\n• Retirar todos los equipos físicos listados\n• Desactivar cuentas de correo y sistemas\n• Revocar accesos a Active Directory\n• Desactivar acceso a la intranet\n• Documentar entrega de equipos`;
}

/**
 * Generate onboarding ticket description
 */
export function generateOnboardingTicketDescription(
  userName: string,
  department: string,
  position: string,
  reportsToName: string
): string {
  return `TICKET AUTOMÁTICO — NUEVA CONTRATACIÓN\n\nColaborador: ${userName}\nDepartamento: ${department}\nPosición: ${position}\nReporta a: ${reportsToName}\nFecha de ingreso: ${new Date().toLocaleDateString("es-DO")}\n\n═══ ACCIONES REQUERIDAS ═══\n\n• Preparar equipo de cómputo (computadora, monitor, teclado, mouse)\n• Crear cuenta de correo electrónico\n• Crear usuario en Active Directory\n• Crear usuario en la intranet SafeOne\n• Asignar extensión telefónica\n• Configurar acceso a impresoras del departamento\n• Asignar flota celular (si aplica)\n• Instalar software necesario para el puesto\n• Coordinar con ${reportsToName} la entrega de equipos\n\n⚠️ Este ticket requiere aprobación del supervisor (${reportsToName}) para proceder con la entrega de equipos.`;
}
