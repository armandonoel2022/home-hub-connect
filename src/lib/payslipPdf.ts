import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import letterhead from "@/assets/safeone-letterhead.png";
import type { PayrollItem, PayrollRun } from "@/lib/api";
import { fmtRD, numberToWordsDOP } from "@/lib/payrollCalc";

/** Genera un volante de pago A4 con membretado SafeOne. */
export async function generatePayslipPDF(run: PayrollRun, item: PayrollItem, opts?: { open?: boolean; fileName?: string }) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  // Membretado a la página completa como fondo
  try {
    const img = await fetch(letterhead).then(r => r.blob()).then(b => new Promise<string>(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b);
    }));
    pdf.addImage(img, "PNG", 0, 0, W, H);
  } catch {}

  // Caja blanca semitransparente para el contenido
  pdf.setFillColor(255, 255, 255);
  pdf.rect(15, 45, W - 30, H - 90, "F");

  // Título
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(20, 30, 60);
  pdf.text("VOLANTE DE PAGO", W / 2, 56, { align: "center" });

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  pdf.text(`Período: ${run.period}    |    Fecha de pago: ${run.payDate}    |    Frecuencia: ${run.frequency === "quincenal" ? "Quincenal" : "Mensual"}`, W / 2, 62, { align: "center" });

  // Datos del empleado
  let y = 72;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(20, 30, 60);
  pdf.text("Datos del Colaborador", 20, y);
  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(40, 40, 40);

  const labelVal = (label: string, value: string, x: number, yy: number) => {
    pdf.setFont("helvetica", "bold"); pdf.text(label, x, yy);
    pdf.setFont("helvetica", "normal"); pdf.text(value || "—", x + 30, yy);
  };
  labelVal("Código:", item.employeeCode, 20, y);
  labelVal("Cédula:", item.cedula || "—", 110, y);
  y += 5;
  labelVal("Nombre:", item.fullName, 20, y);
  y += 5;
  labelVal("Departamento:", item.department, 20, y);
  labelVal("Puesto:", item.position, 110, y);
  y += 5;
  labelVal("Banco:", item.bank || "—", 20, y);
  labelVal("Categoría:", item.category, 110, y);
  y += 8;

  // Tabla devengado / descuentos
  autoTable(pdf, {
    startY: y,
    margin: { left: 20, right: 20 },
    theme: "grid",
    head: [["Concepto", "Devengado RD$", "Descuento RD$"]],
    body: [
      ["Salario del período", fmtRD(item.grossPeriod).replace("DOP", "").trim(), ""],
      ["SFS (Seguro Familiar Salud) 3.04%", "", fmtRD(item.sfs).replace("DOP", "").trim()],
      ["AFP (Pensiones) 2.87%", "", fmtRD(item.afp).replace("DOP", "").trim()],
      ["ISR (Impuesto sobre la Renta)", "", fmtRD(item.isr).replace("DOP", "").trim()],
    ],
    foot: [[
      { content: "TOTALES", styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtRD(item.grossPeriod).replace("DOP", "").trim(), styles: { fontStyle: "bold" } },
      { content: fmtRD(item.totalDeductions).replace("DOP", "").trim(), styles: { fontStyle: "bold" } },
    ]],
    headStyles: { fillColor: [20, 30, 60], textColor: 255, halign: "center" },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 40 }, 2: { halign: "right", cellWidth: 40 } },
    styles: { fontSize: 9.5 },
  });

  // Neto
  const finalY = (pdf as any).lastAutoTable.finalY + 6;
  pdf.setFillColor(212, 175, 55); // gold
  pdf.rect(20, finalY, W - 40, 12, "F");
  pdf.setTextColor(20, 30, 60);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("NETO A PAGAR:", 24, finalY + 8);
  pdf.text(fmtRD(item.net), W - 24, finalY + 8, { align: "right" });

  // Neto en letras
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8.5);
  pdf.setTextColor(60, 60, 60);
  const words = numberToWordsDOP(item.net);
  const split = pdf.splitTextToSize(`Son: ${words}`, W - 40);
  pdf.text(split, 20, finalY + 18);

  // Firma
  const sigY = finalY + 40;
  pdf.setDrawColor(120);
  pdf.line(30, sigY, 90, sigY);
  pdf.line(W - 90, sigY, W - 30, sigY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Firma del Colaborador", 60, sigY + 4, { align: "center" });
  pdf.text("Por la Empresa", W - 60, sigY + 4, { align: "center" });

  // Pie con disclaimer
  pdf.setFontSize(7.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Documento generado por SafeOne Intranet — ${new Date().toLocaleString("es-DO")}. Este volante refleja los descuentos de ley vigentes en República Dominicana.`,
    W / 2, H - 12, { align: "center", maxWidth: W - 30 }
  );

  const fname = opts?.fileName || `Volante_${item.employeeCode}_${run.period}.pdf`;
  if (opts?.open) {
    pdf.output("dataurlnewwindow");
  } else {
    pdf.save(fname);
  }
  return pdf;
}
