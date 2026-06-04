import { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, ClipboardList, Filter, CheckCircle2, Trash2, Clock } from "lucide-react";
import { getOpsReports, REPORT_TYPE_LABEL, type OpsReportType } from "@/lib/opsReportsStorage";
import { payrollExtrasApi, type PayrollExtra } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const EXTRA_TYPE_LABEL: Record<PayrollExtra["type"], string> = {
  overtime: "Horas extras",
  night: "Horas nocturnas",
  holiday: "Feriado trabajado",
  meal: "Almuerzo descontable",
  late: "Horas tardías (descuento)",
};

const HRPayrollReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Acceso solo a RRHH y admins
  const allowed = user?.department === "Recursos Humanos" || user?.isAdmin;

  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [sourceFilter, setSourceFilter] = useState<"all" | "Monitoreo" | "Operaciones">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | OpsReportType>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const reports = useMemo(() => getOpsReports(), []);

  // ── Registros de horas extras enviados por líderes (PayrollExtras) ──
  const [extras, setExtras] = useState<PayrollExtra[]>([]);
  const refreshExtras = () => {
    payrollExtrasApi.list({ period: month }).then(setExtras).catch(() => setExtras([]));
  };
  useEffect(() => { refreshExtras(); }, [month]);

  const pendingExtras = extras.filter((e) => e.status === "Pendiente RRHH");
  const processedExtras = extras.filter((e) => e.status === "Procesada");

  const approveExtra = async (id: string) => {
    try {
      await payrollExtrasApi.update(id, { status: "Procesada" });
      toast({ title: "Aprobado", description: "Registro marcado como Procesado e incluido en la nómina." });
      refreshExtras();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo aprobar", variant: "destructive" });
    }
  };

  const rejectExtra = async (id: string) => {
    if (!confirm("¿Eliminar este registro? Se notificará al líder que lo registró.")) return;
    try {
      await payrollExtrasApi.remove(id);
      toast({ title: "Eliminado", description: "Registro removido del consolidado." });
      refreshExtras();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const approveAllPending = async () => {
    if (pendingExtras.length === 0) return;
    if (!confirm(`Aprobar ${pendingExtras.length} registro(s) pendientes?`)) return;
    await Promise.all(pendingExtras.map((p) => payrollExtrasApi.update(p.id, { status: "Procesada" }).catch(() => null)));
    toast({ title: "Aprobados", description: `${pendingExtras.length} registro(s) procesados.` });
    refreshExtras();
  };


  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (!r.date.startsWith(month)) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (search && !r.personName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [reports, month, sourceFilter, typeFilter, search]);

  // Consolidar por persona
  const consolidated = useMemo(() => {
    const map = new Map<string, {
      personId: string;
      personName: string;
      department: string;
      horasExtras: number;
      diasFeriados: number;
      diasLibres: number;
      ausencias: number;
      coberturas: number;
      totalReportes: number;
    }>();
    filtered.forEach((r) => {
      const cur = map.get(r.personId) || {
        personId: r.personId,
        personName: r.personName,
        department: r.department || r.source,
        horasExtras: 0, diasFeriados: 0, diasLibres: 0, ausencias: 0, coberturas: 0,
        totalReportes: 0,
      };
      cur.totalReportes += 1;
      if (r.type === "horas-extras") cur.horasExtras += r.hours || 0;
      if (r.type === "dia-feriado") cur.diasFeriados += 1;
      if (r.type === "dia-libre-trabajado") cur.diasLibres += 1;
      if (r.type === "ausencia") cur.ausencias += 1;
      if (r.type === "cobertura") cur.coberturas += 1;
      map.set(r.personId, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalReportes - a.totalReportes);
  }, [filtered]);

  const exportCSV = () => {
    const header = ["Empleado", "Departamento", "Horas Extras", "Días Feriados", "Días Libres Trabajados", "Ausencias", "Coberturas", "Total Reportes"];
    const rows = consolidated.map((c) => [
      c.personName, c.department, c.horasExtras, c.diasFeriados, c.diasLibres, c.ausencias, c.coberturas, c.totalReportes,
    ]);
    const detailHeader = ["", "", "", "", "", "", "", ""];
    const detailRows = [
      detailHeader,
      ["DETALLE", "Fecha", "Empleado", "Tipo", "Horas", "Origen", "Reportado por", "Estado"],
      ...filtered.map((r) => [
        "", r.date, r.personName, REPORT_TYPE_LABEL[r.type], r.hours ?? "", r.source, r.createdBy, r.status,
      ]),
    ];
    const all = [header, ...rows, ...detailRows];
    const csv = all
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_RRHH_Operaciones_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-gold" />
                Consolidado de Horas Extras y Feriados
              </h1>
              <p className="text-sm text-muted-foreground">
                Reportes de Centro de Monitoreo y Operaciones para nómina
              </p>
            </div>
            <Button onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          {/* Filtros */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-card-foreground">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Mes</Label>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Origen</Label>
                <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Monitoreo">Monitoreo</SelectItem>
                    <SelectItem value="Operaciones">Operaciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(Object.keys(REPORT_TYPE_LABEL) as OpsReportType[]).map((k) => (
                      <SelectItem key={k} value={k}>{REPORT_TYPE_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Empleado</Label>
                <Input placeholder="Buscar nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Horas extras enviadas por líderes (PayrollExtras) */}
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 bg-muted border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold text-card-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold" />
                Horas extras / nocturnas / feriados / almuerzos enviados por líderes
                {pendingExtras.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700">
                    {pendingExtras.length} pendiente(s)
                  </span>
                )}
              </h2>
              {pendingExtras.length > 0 && (
                <Button size="sm" onClick={approveAllPending} className="gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Aprobar todos
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Fecha</th>
                    <th className="text-left px-3 py-2 font-semibold">Empleado</th>
                    <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                    <th className="text-right px-3 py-2 font-semibold">Cantidad</th>
                    <th className="text-left px-3 py-2 font-semibold">Registrado por</th>
                    <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                    <th className="text-left px-3 py-2 font-semibold">Estado</th>
                    <th className="text-right px-3 py-2 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {extras.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Sin registros este período</td></tr>
                  ) : extras.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{e.date}</td>
                      <td className="px-3 py-2 font-medium">{e.employeeName}</td>
                      <td className="px-3 py-2">{EXTRA_TYPE_LABEL[e.type]}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {e.type === "meal" ? `RD$ ${e.amount}` : e.type === "holiday" ? `${e.days} día(s)` : `${e.hours}h`}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{e.registeredBy}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{e.description || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          e.status === "Procesada" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                        }`}>{e.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {e.status === "Pendiente RRHH" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => approveExtra(e.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Aprobar
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => rejectExtra(e.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Incluida en nómina</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {processedExtras.length > 0 && (
              <div className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/40 border-t border-border">
                {processedExtras.length} registro(s) ya procesado(s) este período.
              </div>
            )}
          </div>

          {/* Resumen consolidado */}
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 bg-muted border-b border-border">
              <h2 className="text-sm font-heading font-bold text-card-foreground">
                Consolidado por empleado ({consolidated.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Empleado</th>
                    <th className="text-left px-4 py-2 font-semibold">Departamento</th>
                    <th className="text-right px-4 py-2 font-semibold">Horas Extras</th>
                    <th className="text-right px-4 py-2 font-semibold">Feriados</th>
                    <th className="text-right px-4 py-2 font-semibold">Días Libres</th>
                    <th className="text-right px-4 py-2 font-semibold">Ausencias</th>
                    <th className="text-right px-4 py-2 font-semibold">Coberturas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consolidated.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin reportes para los filtros seleccionados</td></tr>
                  ) : consolidated.map((c) => (
                    <tr key={c.personId} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium text-card-foreground">{c.personName}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.department}</td>
                      <td className="px-4 py-2 text-right font-mono">{c.horasExtras > 0 ? `${c.horasExtras}h` : "—"}</td>
                      <td className="px-4 py-2 text-right">{c.diasFeriados || "—"}</td>
                      <td className="px-4 py-2 text-right">{c.diasLibres || "—"}</td>
                      <td className="px-4 py-2 text-right">{c.ausencias || "—"}</td>
                      <td className="px-4 py-2 text-right">{c.coberturas || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalle */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted border-b border-border">
              <h2 className="text-sm font-heading font-bold text-card-foreground">
                Detalle de reportes ({filtered.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Fecha</th>
                    <th className="text-left px-4 py-2 font-semibold">Empleado</th>
                    <th className="text-left px-4 py-2 font-semibold">Tipo</th>
                    <th className="text-right px-4 py-2 font-semibold">Horas</th>
                    <th className="text-left px-4 py-2 font-semibold">Origen</th>
                    <th className="text-left px-4 py-2 font-semibold">Reportado por</th>
                    <th className="text-left px-4 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin reportes</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{r.date}</td>
                      <td className="px-4 py-2 font-medium text-card-foreground">{r.personName}</td>
                      <td className="px-4 py-2">{REPORT_TYPE_LABEL[r.type]}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.hours ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.source}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{r.createdBy}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.status === "Procesada" ? "bg-emerald-500/10 text-emerald-600" :
                          r.status === "Asignada" ? "bg-blue-500/10 text-blue-600" :
                          "bg-amber-500/10 text-amber-600"
                        }`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

export default HRPayrollReport;
