import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { isApiConfigured, ticketsApi, purchaseRequestsApi, hiringRequestsApi, usersApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileSpreadsheet, FileText, Download, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ReportType = "tickets" | "purchases" | "hiring" | "users";

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  { value: "tickets", label: "Tickets IT", description: "Reporte de tickets de soporte" },
  { value: "purchases", label: "Solicitudes de Compra", description: "Órdenes de compra y servicio" },
  { value: "hiring", label: "Solicitudes de Personal", description: "Requerimientos de contratación" },
  { value: "users", label: "Directorio de Personal", description: "Listado de colaboradores activos" },
];

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const apiMode = isApiConfigured();
  const [reportType, setReportType] = useState<ReportType>("tickets");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const loadData = async () => {
    if (!apiMode) return;
    setLoading(true);
    try {
      switch (reportType) {
        case "tickets": setData(await ticketsApi.getAll()); break;
        case "purchases": setData(await purchaseRequestsApi.getAll()); break;
        case "hiring": setData(await hiringRequestsApi.getAll()); break;
        case "users": setData(await usersApi.getAll()); break;
      }
    } catch {
      toast({ title: "Error cargando datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [reportType, apiMode]);

  const getColumns = (): { key: string; label: string }[] => {
    switch (reportType) {
      case "tickets": return [
        { key: "id", label: "ID" }, { key: "title", label: "Título" }, { key: "category", label: "Categoría" },
        { key: "priority", label: "Prioridad" }, { key: "status", label: "Estado" }, { key: "createdBy", label: "Creado por" },
        { key: "department", label: "Departamento" }, { key: "createdAt", label: "Fecha" },
      ];
      case "purchases": return [
        { key: "id", label: "ID" }, { key: "type", label: "Tipo" }, { key: "description", label: "Descripción" },
        { key: "requestedBy", label: "Solicitado por" }, { key: "department", label: "Departamento" },
        { key: "status", label: "Estado" }, { key: "createdAt", label: "Fecha" },
      ];
      case "hiring": return [
        { key: "id", label: "ID" }, { key: "position", label: "Posición" }, { key: "department", label: "Departamento" },
        { key: "status", label: "Estado" }, { key: "requestedBy", label: "Solicitado por" }, { key: "createdAt", label: "Fecha" },
      ];
      case "users": return [
        { key: "id", label: "ID" }, { key: "fullName", label: "Nombre" }, { key: "email", label: "Email" },
        { key: "department", label: "Departamento" }, { key: "position", label: "Posición" },
        { key: "employeeStatus", label: "Estado" },
      ];
      default: return [];
    }
  };

  const exportExcel = () => {
    const cols = getColumns();
    const rows = data.map(item => {
      const row: Record<string, any> = {};
      cols.forEach(c => { row[c.label] = item[c.key] || ""; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_${REPORT_OPTIONS.find(r => r.value === reportType)?.label.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Excel descargado exitosamente" });
  };

  const exportPDF = () => {
    const cols = getColumns();
    const doc = new jsPDF({ orientation: "landscape" });
    const title = REPORT_OPTIONS.find(r => r.value === reportType)?.label || "Reporte";
    doc.setFontSize(16);
    doc.text(`SafeOne - ${title}`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleDateString("es-DO")} | Total: ${data.length} registros`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [cols.map(c => c.label)],
      body: data.map(item => cols.map(c => {
        const val = item[c.key];
        if (c.key === "createdAt" && val) return new Date(val).toLocaleDateString("es-DO");
        return val || "";
      })),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [42, 42, 42], textColor: [255, 200, 0] },
    });

    doc.save(`Reporte_${title.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "PDF descargado exitosamente" });
  };

  const cols = getColumns();

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" /> Reportes
              </h1>
              <p className="text-sm text-muted-foreground">Genera y exporta reportes en PDF o Excel</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportExcel} disabled={data.length === 0} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </Button>
            <Button variant="outline" onClick={exportPDF} disabled={data.length === 0} className="gap-2">
              <FileText className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>

          {/* Preview */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                </div>
              ) : data.length === 0 ? (
                <div className="text-center py-12">
                  <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay datos disponibles.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {cols.map(c => (
                          <th key={c.key} className="text-left px-3 py-2 font-semibold text-foreground whitespace-nowrap">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(0, 50).map((item, i) => (
                        <tr key={item.id || i} className="border-b hover:bg-muted/30">
                          {cols.map(c => (
                            <td key={c.key} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[200px] truncate">
                              {c.key === "createdAt" && item[c.key] ? new Date(item[c.key]).toLocaleDateString("es-DO") : (item[c.key] || "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Mostrando 50 de {data.length} registros. Exporta para ver todos.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default Reports;
