import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import letterhead from "@/assets/safeone-letterhead.png";
import { generateAmortizationSchedule } from "@/lib/loanSettings";
import type { HRRequest } from "@/lib/hrRequestTypes";

const fmt = (n: number) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface AmortizationInput {
  employeeName: string;
  amount: number;
  annualRatePct: number;
  installments: number;
  frequency: "mensual" | "quincenal";
  startDate: string; // yyyy-mm-dd
  reference?: string;
  comment?: string;
}

/** Genera la hoja de amortización A4 con membretado SafeOne (estilo GENERAL). */
export async function generateAmortizationPDF(input: AmortizationInput, opts?: { open?: boolean; fileName?: string }) {
  const { rows, installment, totalInterest, totalToPay } = generateAmortizationSchedule(
    input.amount,
    input.installments,
    input.annualRatePct,
    input.startDate,
    input.frequency,
  );

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  try {
    const img = await fetch(letterhead).then(r => r.blob()).then(b => new Promise<string>(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b);
    }));
    pdf.addImage(img, "PNG", 0, 0, W, H);
  } catch {}

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(20, 30, 60);
  pdf.text("HOJA DE AMORTIZACIÓN — PRÉSTAMO CON INTERÉS", W / 2, 50, { align: "center" });

  const fechaHoy = new Date().toLocaleDateString("es-DO");
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Fecha: ${fechaHoy}`, W - 18, 50, { align: "right" });

  // Cabecera de datos
  let y = 62;
  const left = 18;
  const line = (label: string, value: string, x: number, yy: number) => {
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(70, 70, 70);
    pdf.text(label, x, yy);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(20, 20, 20);
    pdf.text(value, x + pdf.getTextWidth(label) + 2, yy);
  };
  pdf.setFontSize(10);
  line("Empleado:", ` ${input.employeeName}`, left, y);
  line("Referencia:", ` ${input.reference || "—"}`, W / 2 + 5, y);
  y += 7;
  line("Monto:", ` RD$ ${fmt(input.amount)}`, left, y);
  line("% Interés:", ` ${input.annualRatePct.toFixed(2)} anual`, W / 2 + 5, y);
  y += 7;
  line("Cant. Cuotas:", ` ${input.installments} (${input.frequency})`, left, y);
  line("Cuota:", ` RD$ ${fmt(installment)}`, W / 2 + 5, y);
  y += 7;
  if (input.comment) { line("Comentario:", ` ${input.comment}`, left, y); y += 7; }

  autoTable(pdf, {
    startY: y + 2,
    head: [["No.", "Fecha", "Interés", "Capital", "Bce. Capital", "Bce. Total", "Pagado"]],
    body: rows.map(r => [
      String(r.n),
      new Date(r.date + "T00:00:00").toLocaleDateString("es-DO"),
      fmt(r.interest),
      fmt(r.capital),
      fmt(r.balanceCapital),
      fmt(r.balanceTotal),
      "",
    ]),
    foot: [["", "Totales", fmt(totalInterest), fmt(input.amount), "", fmt(totalToPay), ""]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5, halign: "right" },
    headStyles: { fillColor: [30, 41, 66], halign: "center" },
    footStyles: { fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: "bold", halign: "right" },
    columnStyles: {
      0: { halign: "center" }, 1: { halign: "center" }, 6: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
  });

  const finalY = (pdf as any).lastAutoTable?.finalY || y + 40;
  pdf.setFontSize(8);
  pdf.setTextColor(110, 110, 110);
  pdf.text(
    "Cálculo de amortización francesa (cuota fija) con tasa mensual aplicada por cuota, conforme al sistema GENERAL.",
    W / 2, Math.min(finalY + 8, H - 20), { align: "center", maxWidth: W - 40 },
  );

  const fileName = opts?.fileName || `Amortizacion_${input.employeeName.replace(/\s+/g, "_")}.pdf`;
  if (opts?.open) pdf.output("dataurlnewwindow");
  else pdf.save(fileName);
}

/** Helper para construir el input desde una solicitud HR de préstamo. */
export function amortizationInputFromRequest(req: HRRequest): AmortizationInput {
  const d = req.loanDetails;
  const amount = d?.approvedAmount ?? d?.amountRequested ?? 0;
  const frequency = (d?.frequency || "mensual") as "mensual" | "quincenal";
  const installments = d?.installmentsTotal ?? d?.termMonths ?? 1;
  const startDate = req.loanApplyDate || new Date().toISOString().slice(0, 10);
  return {
    employeeName: req.beneficiaryName || req.requestedByName,
    amount,
    annualRatePct: d?.annualInterestRatePct ?? 0,
    installments,
    frequency,
    startDate,
    reference: req.id,
    comment: req.loanApplyComment || undefined,
  };
}
