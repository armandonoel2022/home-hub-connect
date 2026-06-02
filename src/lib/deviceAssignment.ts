/**
 * Capa compartida para la digitalización del procedimiento PRO-IT-05
 * (Asignación de equipos). Maneja:
 *  - Catálogos de estados y tipos
 *  - Generación de la Hoja de Asignación (F-IT-13) en PDF firmable
 *  - Registro de altas de dispositivos para Chrisnel Fabián (overlay + Admin Hub)
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import letterhead from "@/assets/safeone-letterhead.png";
import type { EquipmentStatus, PhoneStatus, AssignmentEvidence, Equipment, SoftwareEntry } from "./types";

// ─── Catálogos ───
export const PHONE_STATUSES: PhoneStatus[] = [
  "En Stock", "Asignado", "Prestado", "En Reparación", "Dañado", "Dado de Baja",
];

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  "Disponible", "Asignado", "Prestado", "En Reparación", "Dañado", "Dado de Baja",
];

export const phoneStatusColors: Record<string, string> = {
  Activo: "bg-emerald-50 text-emerald-700",
  Asignado: "bg-emerald-50 text-emerald-700",
  "En Stock": "bg-blue-50 text-blue-700",
  Disponible: "bg-blue-50 text-blue-700",
  Prestado: "bg-purple-50 text-purple-700",
  "En Reparación": "bg-amber-50 text-amber-700",
  Dañado: "bg-red-50 text-red-700",
  "Dado de Baja": "bg-gray-100 text-gray-500",
};

export const equipmentStatusColors: Record<string, string> = {
  Disponible: "bg-blue-50 text-blue-700",
  Asignado: "bg-emerald-50 text-emerald-700",
  Prestado: "bg-purple-50 text-purple-700",
  "En Reparación": "bg-amber-50 text-amber-700",
  Dañado: "bg-red-50 text-red-700",
  "Dado de Baja": "bg-gray-100 text-gray-500",
};

// ─── Hoja de Asignación (PDF) ───
export interface AssignmentSheetData {
  /** Identificador del registro de dispositivo */
  deviceId: string;
  /** Categoría: "Flota Celular" | "Inventario IT" */
  source: string;
  deviceType: string;
  brand: string;
  model: string;
  serial: string;
  imei?: string;
  color?: string;
  storage?: string;
  ram?: string;
  phoneNumber?: string;
  acquisitionDate?: string;
  /** Nombre del colaborador receptor (opcional si se entrega a un departamento) */
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  position?: string;
  deliveredBy?: string;
}

async function loadLetterhead(): Promise<string | null> {
  try {
    const blob = await fetch(letterhead).then((r) => r.blob());
    return await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const CLAUSES = [
  "El colaborador declara recibir el equipo descrito en óptimas condiciones de funcionamiento y completo con sus accesorios.",
  "El equipo es propiedad de SafeOne Security Company SRL y se entrega exclusivamente para fines laborales.",
  "El colaborador se compromete a custodiar el equipo, reportar de inmediato cualquier daño, pérdida o robo, y a no instalar software no autorizado.",
  "Al momento de su desvinculación (renuncia, despido o término de contrato) el colaborador deberá devolver el equipo con todos sus accesorios al departamento de Tecnología.",
  "Cualquier daño por negligencia o mal uso podrá ser deducido conforme a las políticas internas y la legislación vigente.",
];

/** Genera la Hoja de Asignación de Equipos (F-IT-13) en A4 con membrete. */
export async function generateAssignmentSheetPDF(
  data: AssignmentSheetData,
  opts?: { open?: boolean; fileName?: string }
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();

  const lh = await loadLetterhead();
  if (lh) {
    try { pdf.addImage(lh, "PNG", 0, 0, W, pdf.internal.pageSize.getHeight()); } catch { /* ignore */ }
  }

  let y = 38;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(20, 20, 20);
  pdf.text("HOJA DE ASIGNACIÓN DE EQUIPOS", W / 2, y, { align: "center" });
  y += 6;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(90, 90, 90);
  pdf.text("F-IT-13 · Procedimiento PRO-IT-05 · SafeOne Security Company SRL", W / 2, y, { align: "center" });
  y += 4;
  pdf.text(`Documento generado: ${new Date().toLocaleString("es-DO")}`, W / 2, y, { align: "center" });
  y += 8;

  // Datos del receptor (colaborador o departamento solicitante)
  const hasEmployee = !!(data.employeeName && data.employeeName.trim());
  autoTable(pdf, {
    startY: y,
    theme: "grid",
    head: [[hasEmployee ? "DATOS DEL COLABORADOR" : "DEPARTAMENTO SOLICITANTE", ""]],
    body: hasEmployee
      ? [
          ["Nombre completo", data.employeeName || "—"],
          ["Código de empleado", data.employeeCode || "—"],
          ["Departamento", data.department || "—"],
          ["Puesto / Posición", data.position || "—"],
        ]
      : [
          ["Departamento solicitante", data.department || "—"],
          ["Responsable / Contacto", data.position || "Por asignar"],
          ["Nota", "Equipo entregado al departamento; pendiente de asignación a un colaborador."],
        ],
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 245, 245] } },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  // @ts-ignore
  y = pdf.lastAutoTable.finalY + 4;

  // Datos del equipo
  const deviceRows: string[][] = [
    ["Categoría", data.source],
    ["Tipo de dispositivo", data.deviceType || "—"],
    ["Marca / Modelo", `${data.brand || ""} ${data.model || ""}`.trim() || "—"],
    ["Serie", data.serial || "—"],
  ];
  if (data.imei) deviceRows.push(["IMEI", data.imei]);
  if (data.phoneNumber) deviceRows.push(["Línea telefónica", data.phoneNumber]);
  if (data.color) deviceRows.push(["Color", data.color]);
  if (data.storage) deviceRows.push(["Almacenamiento", data.storage]);
  if (data.ram) deviceRows.push(["RAM", data.ram]);
  if (data.acquisitionDate) deviceRows.push(["Fecha de adquisición", data.acquisitionDate]);
  deviceRows.push(["ID de inventario", data.deviceId]);

  autoTable(pdf, {
    startY: y,
    theme: "grid",
    head: [["DATOS DEL EQUIPO ENTREGADO", ""]],
    body: deviceRows,
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 245, 245] } },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  // @ts-ignore
  y = pdf.lastAutoTable.finalY + 6;

  // Cláusulas
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(20, 20, 20);
  pdf.text("TÉRMINOS Y CONDICIONES DE CUSTODIA", 14, y);
  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(50, 50, 50);
  CLAUSES.forEach((c, i) => {
    const lines = pdf.splitTextToSize(`${i + 1}. ${c}`, W - 28);
    pdf.text(lines, 14, y);
    y += lines.length * 4 + 1.5;
  });

  y += 12;
  // Firmas
  const colW = (W - 28) / 2;
  pdf.setDrawColor(120, 120, 120);
  pdf.line(20, y, 20 + colW - 12, y);
  pdf.line(20 + colW + 4, y, 20 + colW * 2 - 8, y);
  y += 4;
  pdf.setFontSize(8.5);
  pdf.setTextColor(40, 40, 40);
  pdf.text(`${data.employeeName || data.department || "Departamento solicitante"}`, 20, y);
  pdf.text(`${data.deliveredBy || "Tecnología y Monitoreo"}`, 20 + colW + 4, y);
  y += 4;
  pdf.setTextColor(110, 110, 110);
  pdf.text(hasEmployee ? "Firma del colaborador (recibe)" : "Firma del responsable del departamento", 20, y);
  pdf.text("Firma responsable de entrega", 20 + colW + 4, y);

  const fileName = opts?.fileName || `Hoja_Asignacion_${(data.employeeName || data.department || "equipo").replace(/\s+/g, "_")}_${data.deviceId}.pdf`;
  if (opts?.open) {
    // Abrir en una pestaña nueva de forma fiable (evita bloqueos de "dataurlnewwindow").
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      // Si el navegador bloquea la ventana, descargamos el PDF como respaldo.
      pdf.save(fileName);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    pdf.save(fileName);
  }
}

// ─── Registro de altas de dispositivos (overlay para Chrisnel) ───
export interface DeviceRegistration {
  id: string;
  deviceId: string;
  source: "Flota Celular" | "Inventario IT";
  deviceType: string;
  brand: string;
  model: string;
  serial: string;
  imei?: string;
  status: string;
  assignedTo?: string | null;
  department?: string | null;
  registeredBy: string;
  registeredAt: string;
  /** Constancia firmada u otra evidencia */
  evidence?: AssignmentEvidence[];
  /** Visto por Chrisnel en el overlay */
  acknowledged: boolean;
}

const REG_KEY = "safeone_device_registrations";

export function getDeviceRegistrations(): DeviceRegistration[] {
  try {
    return JSON.parse(localStorage.getItem(REG_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveDeviceRegistrations(list: DeviceRegistration[]) {
  localStorage.setItem(REG_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("safeone-device-registration"));
}

export function addDeviceRegistration(
  reg: Omit<DeviceRegistration, "id" | "registeredAt" | "acknowledged">
): DeviceRegistration {
  const list = getDeviceRegistrations();
  const entry: DeviceRegistration = {
    ...reg,
    id: `DREG-${Date.now().toString().slice(-8)}`,
    registeredAt: new Date().toISOString(),
    acknowledged: false,
  };
  saveDeviceRegistrations([entry, ...list]);
  return entry;
}

export function acknowledgeDeviceRegistration(id: string) {
  const list = getDeviceRegistrations().map((r) =>
    r.id === id ? { ...r, acknowledged: true } : r
  );
  saveDeviceRegistrations(list);
}

export function acknowledgeAllDeviceRegistrations() {
  const list = getDeviceRegistrations().map((r) => ({ ...r, acknowledged: true }));
  saveDeviceRegistrations(list);
}

export function getPendingDeviceRegistrations(): DeviceRegistration[] {
  return getDeviceRegistrations().filter((r) => !r.acknowledged);
}

/** Lee un archivo como data URL (para constancias firmadas). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ─── Inventario de Software ───
export interface ParsedSoftwareInventory {
  equipo?: string;
  serial?: string;
  modelo?: string;
  fecha?: string;
  apps: SoftwareEntry[];
}

/**
 * Parsea un archivo de certificación de software con el formato:
 *   FECHA: ...
 *   EQUIPO: SSC-LAP-29615
 *   SERIAL: ...
 *   MODELO: ...
 *   ---
 *   Nombre - Versión - Fabricante
 */
export function parseSoftwareInventory(text: string): ParsedSoftwareInventory {
  const lines = text.replace(/\uFEFF/g, "").split(/\r?\n/);
  const result: ParsedSoftwareInventory = { apps: [] };
  let inApps = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!inApps) {
      if (/^-{2,}$/.test(line)) { inApps = true; continue; }
      const m = line.match(/^(FECHA|EQUIPO|SERIAL|MODELO)\s*:\s*(.*)$/i);
      if (m) {
        const key = m[1].toUpperCase();
        const val = m[2].trim();
        if (key === "FECHA") result.fecha = val;
        else if (key === "EQUIPO") result.equipo = val;
        else if (key === "SERIAL") result.serial = val;
        else if (key === "MODELO") result.modelo = val;
        continue;
      }
      // Si no hay separador "---" igual empezamos a leer apps cuando hay " - "
      if (line.includes(" - ")) inApps = true;
    }
    if (inApps) {
      const parts = line.split(" - ");
      const name = (parts[0] || "").trim();
      if (!name) continue;
      const version = (parts[1] || "").trim();
      const publisher = parts.slice(2).join(" - ").trim();
      result.apps.push({ name, version, publisher });
    }
  }
  // Eliminar duplicados exactos
  const seen = new Set<string>();
  result.apps = result.apps.filter((a) => {
    const k = `${a.name}|${a.version}|${a.publisher}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return result;
}

/**
 * Genera la Ficha / Hoja del Equipo registrado (inventario IT) en PDF,
 * incluyendo especificaciones, periféricos, asignación e inventario de software.
 */
export async function generateEquipmentSheetPDF(
  eq: Equipment,
  opts?: { open?: boolean; fileName?: string; linkedMonitorLabel?: string }
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();

  const lh = await loadLetterhead();
  if (lh) {
    try { pdf.addImage(lh, "PNG", 0, 0, W, pdf.internal.pageSize.getHeight()); } catch { /* ignore */ }
  }

  let y = 38;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(20, 20, 20);
  pdf.text("FICHA DE EQUIPO — INVENTARIO IT", W / 2, y, { align: "center" });
  y += 6;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(90, 90, 90);
  pdf.text(`Activo Fijo: ${eq.fixedAssetCode || eq.id}  ·  SafeOne Security Company SRL`, W / 2, y, { align: "center" });
  y += 4;
  pdf.text(`Documento generado: ${new Date().toLocaleString("es-DO")}`, W / 2, y, { align: "center" });
  y += 8;

  const specRows: string[][] = [
    ["Activo Fijo", eq.fixedAssetCode || "—"],
    ["ID interno", eq.id],
    ["Tipo", eq.type || "—"],
    ["Marca / Modelo", `${eq.brand || ""} ${eq.model || ""}`.trim() || "—"],
    ["Serie", eq.serial || "—"],
    ["Estado", eq.status || "—"],
  ];
  if (eq.color) specRows.push(["Color", eq.color]);
  if (eq.processor) specRows.push(["Procesador", eq.processor]);
  if (eq.ram) specRows.push(["RAM", eq.ram]);
  if (eq.storage) specRows.push(["Almacenamiento", eq.storage]);
  if (eq.operatingSystem) specRows.push(["Sistema Operativo", eq.operatingSystem]);
  if (eq.osLanguage) specRows.push(["Idioma", eq.osLanguage]);
  if (eq.bios) specRows.push(["BIOS", eq.bios]);
  const perifs = [
    eq.hasMouse ? "Mouse" : null,
    eq.hasKeyboard ? "Teclado" : null,
    eq.hasMonitor ? `Monitor${opts?.linkedMonitorLabel ? ` (${opts.linkedMonitorLabel})` : ""}` : null,
  ].filter(Boolean);
  if (perifs.length) specRows.push(["Periféricos", perifs.join(", ")]);
  if (eq.acquisitionDate) specRows.push(["Fecha de adquisición", eq.acquisitionDate]);

  autoTable(pdf, {
    startY: y,
    theme: "grid",
    head: [["DATOS DEL EQUIPO", ""]],
    body: specRows,
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 245, 245] } },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  // @ts-ignore
  y = pdf.lastAutoTable.finalY + 4;

  autoTable(pdf, {
    startY: y,
    theme: "grid",
    head: [["ASIGNACIÓN", ""]],
    body: [
      ["Asignado a", eq.assignedTo || "Sin asignar"],
      ["Código de empleado", eq.assignedToCode || "—"],
      ["Departamento", eq.department || "—"],
      ["Fecha de asignación", eq.assignedDate || "—"],
    ],
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 245, 245] } },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  // @ts-ignore
  y = pdf.lastAutoTable.finalY + 4;

  // Inventario de software
  if (eq.softwareInventory && eq.softwareInventory.length) {
    autoTable(pdf, {
      startY: y,
      theme: "striped",
      head: [["#", "Software", "Versión", "Fabricante"]],
      body: eq.softwareInventory.map((s, i) => [String(i + 1), s.name, s.version || "—", s.publisher || "—"]),
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 7.5, cellPadding: 1.4 },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 30 }, 3: { cellWidth: 45 } },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        pdf.setFontSize(8); pdf.setTextColor(120, 120, 120);
      },
    });
    // @ts-ignore
    y = pdf.lastAutoTable.finalY + 2;
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Inventario de software: ${eq.softwareInventory.length} aplicaciones${eq.softwareUpdatedAt ? ` · actualizado ${new Date(eq.softwareUpdatedAt).toLocaleDateString("es-DO")}` : ""}`, 14, y);
  }

  const fileName = opts?.fileName || `Ficha_Equipo_${(eq.fixedAssetCode || eq.id).replace(/\s+/g, "_")}.pdf`;
  if (opts?.open) {
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) pdf.save(fileName);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    pdf.save(fileName);
  }
}
