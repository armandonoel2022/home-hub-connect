import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  filename: string;
}

// ─── PDF Export ───

export function exportToPDF({ title, subtitle, columns, data, filename }: ExportOptions) {
  const doc = new jsPDF({ orientation: data[0] && columns.length > 5 ? "landscape" : "portrait" });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, 14, 28);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${new Date().toLocaleString("es-DO")}`, 14, subtitle ? 34 : 28);

  const startY = subtitle ? 40 : 34;

  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.header)],
    body: data.map((row) => columns.map((c) => String(row[c.key] ?? "—"))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [42, 42, 54], textColor: [255, 215, 0], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 248] },
    didDrawPage: (hookData) => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `SafeOne Intranet — Página ${hookData.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

// ─── Excel Export ───

export function exportToExcel({ title, columns, data, filename }: ExportOptions) {
  const wsData = [
    [title],
    [`Generado: ${new Date().toLocaleString("es-DO")}`],
    [],
    columns.map((c) => c.header),
    ...data.map((row) => columns.map((c) => row[c.key] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width || 18 }));

  // Merge title row
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── Print ───

export function printTable({ title, subtitle, columns, data }: ExportOptions) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const rows = data
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:12px;">${row[c.key] ?? "—"}</td>`).join("")}</tr>`
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} — SafeOne</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #222; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #777; font-size: 12px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #2a2a36; color: #ffd700; padding: 8px 10px; font-size: 11px; text-align: left; }
        tr:nth-child(even) td { background: #f8f8fa; }
        .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
      <p class="subtitle">Generado: ${new Date().toLocaleString("es-DO")}</p>
      <table>
        <thead><tr>${columns.map((c) => `<th>${c.header}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="footer">SafeOne Intranet — Documento generado automáticamente</p>
      <script>window.print();</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
