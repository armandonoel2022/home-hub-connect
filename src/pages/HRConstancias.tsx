import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Navigate } from "react-router-dom";
import { getOpsReports, REPORT_TYPE_LABEL, type OpsReport, type OpsReportType } from "@/lib/opsReportsStorage";
import { ShieldAlert, Download, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { exportToCSV } from "@/lib/exportUtils";

const HR_EMAILS = ["dilia@safeone.com.do", "rrhh@safeone.com.do", "tecnologia@safeone.com.do"];

const HRConstancias = () => {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [type, setType] = useState<OpsReportType | "all">("all");
  const [source, setSource] = useState<"Monitoreo" | "Operaciones" | "all">("all");
  const [status, setStatus] = useState<OpsReport["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  const isAllowed = user && (
    user.isAdmin ||
    HR_EMAILS.includes(user.email.toLowerCase()) ||
    /rrhh|recursos humanos|nómina|nomina/i.test(user.department || "")
  );

  if (!user) return null;
  if (!isAllowed) return <Navigate to="/" replace />;

  const reports = useMemo<OpsReport[]>(() => getOpsReports(), [tick]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (source !== "all" && r.source !== source) return false;
      if (status !== "all" && r.status !== status) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${r.personName} ${r.description} ${r.createdBy} ${r.department || ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reports, type, source, status, search, from, to]);

  const totals = useMemo(() => {
    const horas = filtered.filter((r) => r.type === "horas-extras").reduce((s, r) => s + (r.hours || 0), 0);
    const feriados = filtered.filter((r) => r.type === "dia-feriado").length;
    const libres = filtered.filter((r) => r.type === "dia-libre-trabajado").length;
    const ausencias = filtered.filter((r) => r.type === "ausencia").length;
    return { horas, feriados, libres, ausencias };
  }, [filtered]);

  const exportCSV = () => {
    const rows = filtered.map((r) => ({
      ID: r.id,
      Fecha: r.date,
      Tipo: REPORT_TYPE_LABEL[r.type],
      Origen: r.source,
      Agente: r.personName,
      Departamento: r.department || "",
      Equipo: r.team || "",
      Horas: r.hours ?? "",
      Descripcion: r.description,
      Reportado_por: r.createdBy,
      Estado: r.status,
      Creado: r.createdAt,
    }));
    exportToCSV(rows, `constancias_rrhh_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" /> Constancias de Reportes Operativos
            </h1>
            <p className="text-sm text-muted-foreground">
              Auditoría centralizada de horas extras, feriados, días libres trabajados y ausencias enviadas a RRHH.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recargar
            </Button>
            <Button size="sm" onClick={exportCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total reportes</div><div className="text-2xl font-bold">{filtered.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Horas extras</div><div className="text-2xl font-bold text-amber-600">{totals.horas.toFixed(1)}h</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Feriados trabajados</div><div className="text-2xl font-bold text-purple-600">{totals.feriados}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Días libres trabajados</div><div className="text-2xl font-bold text-cyan-600">{totals.libres}</div></Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Agente, descripción…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(REPORT_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Origen</label>
              <Select value={source} onValueChange={(v) => setSource(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Monitoreo">Monitoreo</SelectItem>
                  <SelectItem value="Operaciones">Operaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Pendiente RRHH">Pendiente RRHH</SelectItem>
                  <SelectItem value="Asignada">Asignada</SelectItem>
                  <SelectItem value="Procesada">Procesada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 md:col-span-6">
              <div>
                <label className="text-xs text-muted-foreground">Desde</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hasta</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead>Reportado por</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.date}</TableCell>
                  <TableCell className="text-xs">{REPORT_TYPE_LABEL[r.type]}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.source}</Badge></TableCell>
                  <TableCell className="text-xs font-medium">{r.personName}</TableCell>
                  <TableCell className="text-xs">{r.department || "—"}</TableCell>
                  <TableCell className="text-xs text-right">{r.hours ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.createdBy}</TableCell>
                  <TableCell>
                    <Badge className={
                      r.status === "Procesada" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" :
                      r.status === "Asignada" ? "bg-blue-500/10 text-blue-700 border-blue-200" :
                      "bg-amber-500/10 text-amber-700 border-amber-200"
                    }>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    No hay constancias con los filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      <Footer />
    </AppLayout>
  );
};

export default HRConstancias;
