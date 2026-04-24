/**
 * Generador de certificados PDF para Capacitaciones BASC.
 * Diseño A4 horizontal con paleta corporativa (dorado / carbón).
 */
import jsPDF from "jspdf";
import type { TrainingCertificate } from "./trainingTypes";
import logoSrc from "@/assets/safeone-logo.png";

async function imgToDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function generateCertificatePdf(cert: TrainingCertificate): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 297
  const H = doc.internal.pageSize.getHeight(); // 210

  // Fondo carbón
  doc.setFillColor(26, 31, 44);
  doc.rect(0, 0, W, H, "F");

  // Marco dorado interior
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.3);
  doc.rect(11, 11, W - 22, H - 22);

  // Logo
  try {
    const logoData = await imgToDataUrl(logoSrc);
    doc.addImage(logoData, "PNG", W / 2 - 18, 18, 36, 18, undefined, "FAST");
  } catch {}

  // Título
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("CERTIFICADO DE CAPACITACIÓN", W / 2, 50, { align: "center" });

  doc.setTextColor(220, 220, 220);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("SafeOne Security Company — Sistema de Gestión BASC", W / 2, 58, { align: "center" });

  // "Se otorga a"
  doc.setFontSize(13);
  doc.setTextColor(200, 200, 200);
  doc.text("Se otorga el presente certificado a", W / 2, 78, { align: "center" });

  // Nombre destacado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  doc.text(cert.fullName.toUpperCase(), W / 2, 95, { align: "center" });

  // Cargo y depto
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(212, 175, 55);
  const cargoLine = [cert.position, cert.department].filter(Boolean).join(" — ");
  if (cargoLine) doc.text(cargoLine, W / 2, 103, { align: "center" });

  // Texto principal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(220, 220, 220);
  doc.text("Por haber completado satisfactoriamente el curso", W / 2, 118, { align: "center" });

  // Curso
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(`«${cert.courseName}»`, W / 2, 130, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text(`Código del curso: ${cert.courseCode}`, W / 2, 138, { align: "center" });

  if (typeof cert.score === "number") {
    doc.setFontSize(11);
    doc.setTextColor(212, 175, 55);
    doc.text(`Calificación obtenida: ${cert.score}%`, W / 2, 146, { align: "center" });
  }

  // Footer: fecha + verificación
  const issued = new Date(cert.issuedAt).toLocaleDateString("es-DO", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`Emitido el ${issued} en Santo Domingo, R.D.`, W / 2, 165, { align: "center" });

  // Línea de firma
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 50, 180, W / 2 + 50, 180);
  doc.setFontSize(10);
  doc.setTextColor(212, 175, 55);
  doc.text("Gerencia de Recursos Humanos", W / 2, 186, { align: "center" });
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text("SafeOne Security Company, SRL", W / 2, 191, { align: "center" });

  // Verificación
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Cert. N°: ${cert.id}    |    Verificación: ${cert.verificationCode}`, W / 2, H - 14, { align: "center" });

  return doc;
}

export async function downloadCertificatePdf(cert: TrainingCertificate) {
  const doc = await generateCertificatePdf(cert);
  doc.save(`Certificado_${cert.courseCode}_${cert.fullName.replace(/\s+/g, "_")}.pdf`);
}

export async function printCertificatePdf(cert: TrainingCertificate) {
  const doc = await generateCertificatePdf(cert);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) {
    w.addEventListener("load", () => {
      try { w.print(); } catch {}
    });
  }
}
