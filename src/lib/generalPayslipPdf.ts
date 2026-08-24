import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import letterhead from "@/assets/safeone-letterhead.png";
import type { GeneralPaymentDetail, GeneralActiveEmployee } from "@/lib/api";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

/** "Segunda quincena de agosto 2026" */
export function periodLabel(periodo?: number | null, mes?: number | null, ano?: number | null): string {
  const m = mes && mes >= 1 && mes <= 12 ? MESES[mes - 1] : "";
  const q = periodo === 1 ? "Primera quincena" : periodo === 2 ? "Segunda quincena" : "Período";
  return [q, m ? `de ${m}` : "", ano ? String(ano) : ""].filter(Boolean).join(" ");
}

/**
 * Fecha real de pago SafeOne según la quincena:
 *  - Q1 (01–15) → se paga el día 15 del mismo mes
 *  - Q2 (16–fin) → se paga el último día del mes
 * La fecha almacenada en gSafeOne corresponde al procesamiento del pago, no al
 * desembolso, por eso no se usa para la leyenda del comprobante.
 */
export function payDateForPeriod(
  periodo?: number | null, mes?: number | null, ano?: number | null,
): Date | null {
  if (!mes || !ano || mes < 1 || mes > 12) return null;
  const day = periodo === 1 ? 15 : new Date(ano, mes, 0).getDate();
  return new Date(ano, mes - 1, day);
}

/** "30/8/2026" o "—" */
export function payDateLabel(periodo?: number | null, mes?: number | null, ano?: number | null): string {
  const d = payDateForPeriod(periodo, mes, ano);
  return d ? d.toLocaleDateString("es-DO") : "—";
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then(r => r.blob());
    return await new Promise<string>(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface PayslipEmployeeInfo {
  nombre: string;
  codigo?: string | null;
  cedula?: string | null;
  puesto?: string | null;
  departamento?: string | null;
  categoria?: string | null;
  nomina?: string | null;
  fechaIngreso?: string | null;
  estatus?: string | null;
  photoUrl?: string | null;
}

export function employeeInfoFromActive(e?: GeneralActiveEmployee | null): Partial<PayslipEmployeeInfo> {
  if (!e) return {};
  return {
    departamento: e.departamento,
    fechaIngreso: e.fechaIngreso,
    estatus: e.estatus,
    puesto: e.puesto,
  };
}

/** Comprobante de pago A4 membretado: hoja de datos del empleado + desglose del pago. */
export async function generateGeneralPayslipPDF(
  detail: GeneralPaymentDetail,
  emp: PayslipEmployeeInfo,
  opts?: { open?: boolean; fileName?: string },
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const lh = await toDataUrl(letterhead);
  if (lh) pdf.addImage(lh, "PNG", 0, 0, W, H);

  // Panel blanco de contenido
  pdf.setFillColor(255, 255, 255);
  pdf.rect(14, 42, W - 28, H - 84, "F");

  // Título
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(20, 30, 60);
  pdf.text("COMPROBANTE DE PAGO", W / 2, 53, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(70, 70, 70);
  pdf.text(periodLabel(detail.periodo, detail.mes, detail.ano), W / 2, 59.5, { align: "center" });

  pdf.setFontSize(8.5);
  pdf.setTextColor(120, 120, 120);
  const hoy = new Date();
  pdf.text(
    `Generado el ${hoy.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })} a las ${hoy.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}`,
    W / 2, 64.5, { align: "center" },
  );

  // ── Hoja de datos del empleado ──
  let y = 72;
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.6);
  pdf.line(20, y, W - 20, y);
  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(20, 30, 60);
  pdf.text("DATOS DEL EMPLEADO", 20, y);
  y += 4;

  const photoBoxX = W - 20 - 28;
  const photoBoxY = y;
  const photoW = 28;
  const photoH = 34;

  let photo: string | null = null;
  if (emp.photoUrl) photo = await toDataUrl(emp.photoUrl);
  pdf.setDrawColor(200);
  pdf.setLineWidth(0.3);
  pdf.rect(photoBoxX, photoBoxY, photoW, photoH);
  if (photo) {
    try {
      pdf.addImage(photo, photo.includes("image/png") ? "PNG" : "JPEG", photoBoxX + 0.5, photoBoxY + 0.5, photoW - 1, photoH - 1);
    } catch { /* ignore */ }
  } else {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text("Sin foto", photoBoxX + photoW / 2, photoBoxY + photoH / 2, { align: "center" });
  }

  const rows: Array<[string, string]> = [
    ["Nombre", emp.nombre || "—"],
    ["Código", emp.codigo || "—"],
    ["Cédula", emp.cedula || "—"],
    ["Puesto", emp.puesto || "—"],
    ["Departamento", emp.departamento || "—"],
    ["Categoría", emp.categoria || "—"],
    ["Nómina", emp.nomina || "—"],
    ["Fecha de ingreso", emp.fechaIngreso ? new Date(emp.fechaIngreso).toLocaleDateString("es-DO") : "—"],
    ["Estatus", emp.estatus || "—"],
    ["Fecha de pago", payDateLabel(detail.periodo, detail.mes, detail.ano)],
  ];

  let ry = y + 5;
  pdf.setFontSize(9.5);
  rows.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(90, 90, 90);
    pdf.text(label, 20, ry);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    pdf.text(String(value), 58, ry, { maxWidth: photoBoxX - 62 });
    ry += 5.2;
  });

  y = Math.max(ry, photoBoxY + photoH) + 6;

  // ── Desglose del pago ──
  const ingresos = detail.lineas.filter(l => l.tipo === 1);
  const deducciones = detail.lineas.filter(l => l.tipo !== 1);
  const maxRows = Math.max(ingresos.length, deducciones.length);
  const body: any[] = [];
  for (let i = 0; i < maxRows; i++) {
    body.push([
      ingresos[i]?.concepto || "",
      ingresos[i] ? money(ingresos[i].calculado) : "",
      deducciones[i]?.concepto || "",
      deducciones[i] ? money(deducciones[i].calculado) : "",
    ]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: 20, right: 20 },
    theme: "grid",
    head: [["Ingresos", "RD$", "Deducciones", "RD$"]],
    body,
    foot: [[
      { content: "Total devengado", styles: { fontStyle: "bold" } },
      { content: money(detail.totalDevengado), styles: { fontStyle: "bold", halign: "right" } },
      { content: "Total deducciones", styles: { fontStyle: "bold" } },
      { content: money(detail.totalDeducciones), styles: { fontStyle: "bold", halign: "right" } },
    ]],
    headStyles: { fillColor: [20, 30, 60], textColor: 255, halign: "left" },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 33, halign: "right" },
      2: { cellWidth: 52 },
      3: { cellWidth: 33, halign: "right" },
    },
    styles: { fontSize: 9, cellPadding: 1.8 },
  });

  const finalY = (pdf as any).lastAutoTable.finalY + 6;
  pdf.setFillColor(212, 175, 55);
  pdf.rect(20, finalY, W - 40, 12, "F");
  pdf.setTextColor(20, 30, 60);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("NETO A RECIBIR:", 24, finalY + 8);
  pdf.text(`RD$ ${money(detail.neto)}`, W - 24, finalY + 8, { align: "right" });

  // Firmas
  const sigY = Math.min(finalY + 40, H - 45);
  pdf.setDrawColor(120);
  pdf.setLineWidth(0.3);
  pdf.line(30, sigY, 90, sigY);
  pdf.line(W - 90, sigY, W - 30, sigY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(60, 60, 60);
  pdf.text("Firma del Colaborador", 60, sigY + 4, { align: "center" });
  pdf.text("Por la Empresa", W - 60, sigY + 4, { align: "center" });

  pdf.setFontSize(7.5);
  pdf.setTextColor(130, 130, 130);
  pdf.text(
    "Documento generado electrónicamente por la Intranet SafeOne. Información confidencial de uso exclusivo del colaborador.",
    W / 2, H - 14, { align: "center", maxWidth: W - 40 },
  );

  const fname = opts?.fileName ||
    `Comprobante_${emp.codigo || "empleado"}_${detail.ano || ""}-${String(detail.mes || "").padStart(2, "0")}-Q${detail.periodo || ""}.pdf`;
  if (opts?.open) {
    // Blob URL: más fiable que "dataurlnewwindow" (que se abre en blanco dentro de iframes/preview).
    try {
      const url = URL.createObjectURL(pdf.output("blob"));
      const win = window.open(url, "_blank");
      if (!win) pdf.save(fname);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      pdf.save(fname);
    }
  } else {
    pdf.save(fname);
  }
  return pdf;
}
