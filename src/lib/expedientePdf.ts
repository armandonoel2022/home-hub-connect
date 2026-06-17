import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import letterhead from "@/assets/safeone-letterhead.png";
import {
  getLocationsByClient, getPostsByLocation, getLiveSnapshot, getLatestReportDate,
  type OpsClient,
} from "@/lib/opsExpediente";

/** Genera el expediente digital del cliente en PDF A4 con membrete SafeOne. */
export async function generateExpedientePDF(client: OpsClient, opts?: { open?: boolean }) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  let letterheadData = "";
  try {
    letterheadData = await fetch(letterhead).then((r) => r.blob()).then((b) =>
      new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(b);
      }),
    );
  } catch { /* noop */ }

  const addLetterhead = () => {
    if (letterheadData) {
      try { pdf.addImage(letterheadData, "PNG", 0, 0, W, H); } catch { /* noop */ }
    }
  };

  addLetterhead();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(20, 30, 60);
  pdf.text("EXPEDIENTE DIGITAL DEL CLIENTE", W / 2, 48, { align: "center" });

  pdf.setFontSize(12);
  pdf.text(client.nombre, W / 2, 56, { align: "center" });

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(70, 70, 70);
  pdf.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-DO")}`, W - 18, 48, { align: "right" });

  let y = 64;
  const left = 18;

  // Contrato
  const c = client.contrato || { numero: "", inicio: "", fin: "" };
  pdf.setFontSize(9);
  pdf.setTextColor(40, 40, 40);
  pdf.text(
    `Contrato: ${c.numero || "—"}   Vigencia: ${c.inicio || "—"} a ${c.fin || "—"}`,
    left, y,
  );
  y += 5;
  if (client.coordinates) {
    pdf.text(`Geolocalización cliente: ${client.coordinates}`, left, y);
    y += 5;
  }
  y += 2;

  const locations = getLocationsByClient(client.id);

  if (locations.length === 0) {
    pdf.setTextColor(120, 120, 120);
    pdf.text("Sin localidades registradas.", left, y + 4);
  }

  locations.forEach((loc) => {
    if (y > H - 40) { pdf.addPage(); addLetterhead(); y = 48; }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20, 30, 60);
    pdf.text(`Localidad: ${loc.nombre}`, left, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    if (loc.direccion) { pdf.text(`Dirección: ${loc.direccion}`, left, y); y += 4; }
    if (loc.coordinates) { pdf.text(`Geolocalización: ${loc.coordinates}`, left, y); y += 4; }

    const posts = getPostsByLocation(loc.id);
    posts.forEach((post) => {
      const snapshot = getLiveSnapshot(post.id);
      const fecha = getLatestReportDate(post.id);
      const turnoName = (id: string) => post.turnos.find((t) => t.id === id)?.nombre || "—";

      const body = snapshot.length > 0
        ? snapshot.map((s) => [
            turnoName(s.turnoId),
            s.personnelName || "—",
            s.presente ? "Presente" : "Ausente",
            post.requiereArma ? (s.armaTipo || "—") : "N/A",
            post.requiereArma ? (s.armaSerial || "—") : "N/A",
            s.novedades || "",
          ])
        : [["—", "Sin reporte", "—", post.requiereArma ? "—" : "N/A", post.requiereArma ? "—" : "N/A", ""]];

      autoTable(pdf, {
        startY: y + 1,
        margin: { left: left + 4, right: 14 },
        head: [[
          {
            content: `Puesto: ${post.nombre}${post.requiereArma ? "  (requiere arma)" : "  (sin arma)"}  ·  Reporte: ${fecha || "—"}`,
            colSpan: 6,
            styles: { halign: "left", fillColor: [30, 41, 66], textColor: [255, 255, 255] },
          },
        ], ["Turno", "Personal", "Estado", "Arma", "Serial", "Novedades"]],
        body,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1.3 },
        headStyles: { fillColor: [70, 80, 110], halign: "left", fontSize: 7.5 },
        didDrawPage: () => { /* keep */ },
      });
      // @ts-expect-error lastAutoTable provided by plugin
      y = (pdf.lastAutoTable?.finalY || y) + 4;
      if (y > H - 40) { pdf.addPage(); addLetterhead(); y = 48; }
    });
    y += 3;
  });

  const fileName = `Expediente-${client.nombre.replace(/[^a-z0-9]+/gi, "_")}.pdf`;
  if (opts?.open) {
    pdf.output("dataurlnewwindow");
  } else {
    pdf.save(fileName);
  }
}
