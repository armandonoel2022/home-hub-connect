/**
 * Audit Report Generator — Superintendencia
 * Consolidates per-agent data (personal info, weapons, photos, uniforms, flashlights)
 * into PDF and Excel exports.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type {
  ArmedPersonnel,
  UniformAssignment,
  FlashlightItem,
  PhotoRecord,
} from "./types";

export interface AuditAgentBundle {
  agent: ArmedPersonnel;
  uniforms: UniformAssignment[];
  flashlights: FlashlightItem[];
}

interface ReportMeta {
  generatedBy: string;
  generatedAt?: string;
}

function allPhotos(a: ArmedPersonnel): PhotoRecord[] {
  const out: PhotoRecord[] = [];
  if (a.photo && !(a.agentPhotos?.length))
    out.push({
      id: "legacy-agent",
      url: a.photo,
      uploadedAt: a.assignedDate || "",
      uploadedBy: "—",
      kind: "agent",
    });
  if (a.weaponPhoto && !(a.weaponPhotos?.length))
    out.push({
      id: "legacy-weapon",
      url: a.weaponPhoto,
      uploadedAt: a.assignedDate || "",
      uploadedBy: "—",
      kind: "weapon",
      metadata: { weaponType: a.weaponType, weaponSerial: a.weaponSerial },
    });
  if (a.agentPhotos) out.push(...a.agentPhotos);
  if (a.weaponPhotos) out.push(...a.weaponPhotos);
  return out;
}

/* ─── PDF ─── */
export function exportAuditReportPDF(bundles: AuditAgentBundle[], meta: ReportMeta) {
  const doc = new jsPDF({ orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = meta.generatedAt || new Date().toLocaleString("es-DO");

  // Cover
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("Reporte de Auditoría — Personal Armado", pageWidth / 2, 40, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(110, 110, 110);
  doc.text("SafeOne Security Company", pageWidth / 2, 50, { align: "center" });
  doc.text(`Generado: ${now}`, pageWidth / 2, 58, { align: "center" });
  doc.text(`Responsable: ${meta.generatedBy}`, pageWidth / 2, 64, { align: "center" });
  doc.text(`Agentes incluidos: ${bundles.length}`, pageWidth / 2, 70, { align: "center" });

  bundles.forEach((b, idx) => {
    doc.addPage();
    const a = b.agent;
    let y = 18;

    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(`${idx + 1}. ${a.name}`, 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Código: ${a.employeeCode || "—"}  |  Cliente: ${a.client || "—"}  |  Puesto: ${a.location || "—"}`,
      14,
      y
    );
    y += 5;
    doc.text(
      `Provincia: ${a.province || "—"}  |  Posición: ${a.position || "—"}  |  Supervisor: ${a.supervisor || "—"}`,
      14,
      y
    );
    y += 5;
    doc.text(
      `Tel. flota: ${a.fleetPhone || "—"}  |  Personal: ${a.personalPhone || "—"}  |  Estado: ${a.status}`,
      14,
      y
    );
    y += 8;

    // Photos: agent + weapon (thumb each)
    try {
      if (a.photo) {
        doc.addImage(a.photo, "JPEG", 14, y, 30, 30, undefined, "FAST");
      }
      if (a.weaponPhoto) {
        doc.addImage(a.weaponPhoto, "JPEG", 50, y, 30, 30, undefined, "FAST");
      }
    } catch {
      // ignore image errors
    }
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Foto agente", 14, y + 33);
    doc.text("Foto arma", 50, y + 33);

    // Weapon block
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("Arma asignada", 90, y);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Tipo: ${a.weaponType || "—"}`, 90, y + 6);
    doc.text(`Serial: ${a.weaponSerial || "—"}`, 90, y + 11);
    doc.text(`Marca: ${a.weaponBrand || "—"}`, 90, y + 16);
    doc.text(`Calibre: ${a.weaponCaliber || "—"}`, 90, y + 21);
    doc.text(`Condición: ${a.weaponCondition || "—"}`, 90, y + 26);
    doc.text(`Licencia: ${a.licenseNumber || "—"} (vence ${a.licenseExpiry || "—"})`, 90, y + 31);
    y += 42;

    // Uniforms table
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text("Uniformes entregados", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Tipo", "Talla", "Cant.", "Condición", "Entregado", "Por"]],
      body: b.uniforms.length
        ? b.uniforms.map((u) => [
            u.uniformType,
            u.uniformSize,
            String(u.quantity),
            u.condition,
            u.deliveredAt?.slice(0, 10) || "—",
            u.deliveredBy || "—",
          ])
        : [["—", "—", "—", "—", "—", "—"]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [42, 42, 54], textColor: [255, 215, 0] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Flashlights
    doc.setFontSize(11);
    doc.text("Linternas asignadas", 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["Código", "Marca", "Modelo", "Serial", "Condición", "Asignada"]],
      body: b.flashlights.length
        ? b.flashlights.map((f) => [
            f.code,
            f.brand,
            f.model,
            f.serial || "—",
            f.condition,
            f.assignedAt?.slice(0, 10) || "—",
          ])
        : [["—", "—", "—", "—", "—", "—"]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [42, 42, 54], textColor: [255, 215, 0] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Photo evidence list
    const photos = allPhotos(a);
    if (photos.length) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(11);
      doc.text("Evidencias fotográficas", 14, y);
      autoTable(doc, {
        startY: y + 2,
        head: [["#", "Tipo", "Fecha carga", "Responsable", "Metadatos"]],
        body: photos.map((p, i) => [
          String(i + 1),
          p.kind === "agent" ? "Agente" : "Arma",
          p.uploadedAt ? new Date(p.uploadedAt).toLocaleString("es-DO") : "—",
          p.uploadedBy || "—",
          p.metadata
            ? [p.metadata.weaponType, p.metadata.weaponSerial, p.metadata.notes]
                .filter(Boolean)
                .join(" · ")
            : "—",
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [42, 42, 54], textColor: [255, 215, 0] },
        margin: { left: 14, right: 14 },
      });
    }
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `SafeOne Intranet — Auditoría Superintendencia — Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  doc.save(`Auditoria_Personal_Armado_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ─── Excel ─── */
export function exportAuditReportExcel(bundles: AuditAgentBundle[], meta: ReportMeta) {
  const wb = XLSX.utils.book_new();
  const now = meta.generatedAt || new Date().toLocaleString("es-DO");

  // Sheet 1: Agents
  const agentsRows = bundles.map(({ agent: a, uniforms, flashlights }) => ({
    Código: a.employeeCode,
    Nombre: a.name,
    Cliente: a.client,
    Puesto: a.location,
    Provincia: a.province,
    Posición: a.position,
    Supervisor: a.supervisor,
    "Tel. Flota": a.fleetPhone,
    "Tel. Personal": a.personalPhone,
    Estado: a.status,
    "Uniformes (total)": uniforms.reduce((s, u) => s + (u.quantity || 0), 0),
    "Linternas (total)": flashlights.length,
    "Fotos agente": (a.agentPhotos?.length || 0) + (a.photo ? 1 : 0),
    "Fotos arma": (a.weaponPhotos?.length || 0) + (a.weaponPhoto ? 1 : 0),
  }));
  const s1 = XLSX.utils.json_to_sheet([
    { Reporte: "Auditoría Personal Armado", Generado: now, Responsable: meta.generatedBy },
    {},
    ...agentsRows,
  ]);
  XLSX.utils.book_append_sheet(wb, s1, "Agentes");

  // Sheet 2: Weapons
  const weapons = bundles.map(({ agent: a }) => ({
    Código: a.employeeCode,
    Agente: a.name,
    Tipo: a.weaponType,
    Serial: a.weaponSerial,
    Marca: a.weaponBrand,
    Calibre: a.weaponCaliber,
    Munición: a.ammunitionCount,
    Condición: a.weaponCondition,
    Licencia: a.licenseNumber,
    Vencimiento: a.licenseExpiry,
    Asignada: a.assignedDate,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weapons), "Armas");

  // Sheet 3: Uniforms
  const uniformsRows = bundles.flatMap(({ agent: a, uniforms }) =>
    uniforms.map((u) => ({
      Código: a.employeeCode,
      Agente: a.name,
      Tipo: u.uniformType,
      Talla: u.uniformSize,
      Cantidad: u.quantity,
      Condición: u.condition,
      Entregado: u.deliveredAt,
      "Entregado por": u.deliveredBy,
      Notas: u.notes || "",
    }))
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(uniformsRows.length ? uniformsRows : [{ info: "Sin uniformes asignados" }]),
    "Uniformes"
  );

  // Sheet 4: Flashlights
  const flashRows = bundles.flatMap(({ agent: a, flashlights }) =>
    flashlights.map((f) => ({
      Código: a.employeeCode,
      Agente: a.name,
      "Código Linterna": f.code,
      Marca: f.brand,
      Modelo: f.model,
      Serial: f.serial || "",
      Condición: f.condition,
      Estado: f.status,
      Asignada: f.assignedAt,
      "Asignada por": f.assignedBy,
    }))
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(flashRows.length ? flashRows : [{ info: "Sin linternas asignadas" }]),
    "Linternas"
  );

  // Sheet 5: Photo evidence (metadata only)
  const photoRows = bundles.flatMap(({ agent: a }) =>
    allPhotos(a).map((p, i) => ({
      Código: a.employeeCode,
      Agente: a.name,
      "#": i + 1,
      Tipo: p.kind === "agent" ? "Agente" : "Arma",
      "Fecha carga": p.uploadedAt,
      Responsable: p.uploadedBy,
      "Tipo arma": p.metadata?.weaponType || "",
      "Serial arma": p.metadata?.weaponSerial || "",
      Notas: p.metadata?.notes || "",
    }))
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(photoRows.length ? photoRows : [{ info: "Sin evidencias" }]),
    "Evidencias Fotos"
  );

  XLSX.writeFile(wb, `Auditoria_Personal_Armado_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
