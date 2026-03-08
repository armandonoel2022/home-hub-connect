import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from "lucide-react";
import { exportToPDF, exportToExcel, printTable } from "@/lib/exportUtils";

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportMenuProps {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  filename: string;
}

export default function ExportMenu({ title, subtitle, columns, data, filename }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  const opts = { title, subtitle, columns, data, filename };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Exportar</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 bg-card rounded-lg shadow-xl border border-border py-1 min-w-[180px]">
            <button
              onClick={() => { exportToPDF(opts); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4 text-destructive" />
              Exportar PDF
            </button>
            <button
              onClick={() => { exportToExcel(opts); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Exportar Excel
            </button>
            <button
              onClick={() => { printTable(opts); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              Imprimir
            </button>
          </div>
        </>
      )}
    </div>
  );
}
