import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, UserX,
  TrendingUp, Calculator, Mail, Download, FileText, Lock, RefreshCw, Search,
  Building2, CreditCard, IdCard, User as UserIcon, Trash2,
} from "lucide-react";
import {
  payrollApi, employeesApi, isApiConfigured,
  type Employee, type PayrollRun, type TssCompareResult, type TssImportMeta,
} from "@/lib/api";
import { parseTssFile } from "@/lib/tssParser";
import { calcDeductions, fmtRD } from "@/lib/payrollCalc";
import { generatePayslipPDF } from "@/lib/payslipPdf";
import * as XLSX from "xlsx";

const TEST_EMAIL = "anoel@safeone.com.do";

type ComplianceStatus = "ok" | "missing" | "mismatch" | "inactive_in_tss";

interface EmployeeCompliance {
  employee: Employee;
  status: ComplianceStatus;
  tssRow?: any;
  matchType?: "cedula" | "nombre" | "none";
  difference?: number;
}

export default function Payroll() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = !!user && (user.isAdmin || user.department === "Recursos Humanos");

  const [tab, setTab] = useState("dashboard");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tssList, setTssList] = useState<TssImportMeta[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [compare, setCompare] = useState<TssCompareResult | null>(null);
  const [runs, setRuns] = useState<(Omit<PayrollRun, "items"> & { itemCount: number })[]>([]);
  const [activeRun, setActiveRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Dashboard filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ComplianceStatus>("all");
  const [filterDept, setFilterDept] = useState<string>("all");

  // Employee detail modal
  const [detailEmployee, setDetailEmployee] = useState<EmployeeCompliance | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payFrequency, setPayFrequency] = useState<"monthly" | "quincenal">("quincenal");
  const [sendingEmail, setSendingEmail] = useState(false);

  // ─── Load ───
  const loadEmployees = async () => {
    try {
      if (isApiConfigured()) {
        const data = await employeesApi.getAll();
        if (data?.length) { setEmployees(data); return; }
      }
      const r = await fetch("/data/employees_seed.json");
      if (r.ok) setEmployees(await r.json());
    } catch {
      try { const r = await fetch("/data/employees_seed.json"); if (r.ok) setEmployees(await r.json()); } catch {}
    }
  };

  const loadTss = async () => {
    if (!isApiConfigured()) return;
    try {
      const list = await payrollApi.listTss();
      setTssList(list);
      // Auto-seleccionar el más reciente si no hay nada seleccionado
      if (!selectedPeriod && list.length > 0) {
        const sorted = [...list].sort((a, b) => b.period.localeCompare(a.period));
        setSelectedPeriod(sorted[0].period);
      }
    } catch {}
  };

  const loadRuns = async () => {
    if (!isApiConfigured()) return;
    try { setRuns(await payrollApi.listRuns()); } catch {}
  };

  useEffect(() => { loadEmployees(); loadTss(); loadRuns(); }, []);

  useEffect(() => {
    if (selectedPeriod && isApiConfigured()) {
      payrollApi.compareTss(selectedPeriod).then(setCompare).catch(e => toast.error("Error: " + e.message));
    }
  }, [selectedPeriod]);

  // ─── Compliance index por empleado ───
  const complianceIndex = useMemo(() => {
    const map = new Map<string, EmployeeCompliance>();
    if (!compare) {
      employees.forEach(e => map.set(e.employeeCode, { employee: e, status: "missing" }));
      return map;
    }
    const okByCode = new Map(compare.matched.map((m: any) => [m.employeeCode, m]));
    const mismatchByCode = new Map(compare.salaryMismatch.map((m: any) => [m.employeeCode, m]));
    employees.forEach(e => {
      if (e.status !== "Activo") {
        // ¿Está fantasma en TSS?
        const ghost = compare.ghostTss.find((g: any) => g.intranetCode === e.employeeCode);
        if (ghost) map.set(e.employeeCode, { employee: e, status: "inactive_in_tss", tssRow: ghost });
        return;
      }
      const ok = okByCode.get(e.employeeCode);
      const mm = mismatchByCode.get(e.employeeCode);
      if (ok && mm) {
        map.set(e.employeeCode, { employee: e, status: "mismatch", tssRow: ok, matchType: ok.matchType, difference: mm.difference });
      } else if (ok) {
        map.set(e.employeeCode, { employee: e, status: "ok", tssRow: ok, matchType: ok.matchType });
      } else {
        map.set(e.employeeCode, { employee: e, status: "missing" });
      }
    });
    return map;
  }, [employees, compare]);

  const stats = useMemo(() => {
    const list = Array.from(complianceIndex.values());
    const active = list.filter(c => c.employee.status === "Activo");
    return {
      activeTotal: active.length,
      ok: active.filter(c => c.status === "ok").length,
      missing: active.filter(c => c.status === "missing").length,
      mismatch: active.filter(c => c.status === "mismatch").length,
      ghost: list.filter(c => c.status === "inactive_in_tss").length,
      tssReported: compare?.summary.tssReported || 0,
      ghostNotInIntranet: (compare?.ghostTss.filter((g: any) => !g.intranetCode).length) || 0,
    };
  }, [complianceIndex, compare]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    employees.forEach(e => e.department && s.add(e.department));
    return Array.from(s).sort();
  }, [employees]);

  const dashboardRows = useMemo(() => {
    let list = Array.from(complianceIndex.values()).filter(c => c.employee.status === "Activo");
    if (filterStatus !== "all") list = list.filter(c => c.status === filterStatus);
    if (filterDept !== "all") list = list.filter(c => c.employee.department === filterDept);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.employee.fullName.toLowerCase().includes(q) ||
        c.employee.employeeCode.toLowerCase().includes(q) ||
        String((c.employee as any).tss || "").toLowerCase().includes(q) ||
        c.employee.department?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));
  }, [complianceIndex, filterStatus, filterDept, search]);

  // ─── TSS import ───
  const handleTssUpload = async (file: File) => {
    if (!canManage) { toast.error("Solo RRHH/Admin"); return; }
    setImporting(true);
    try {
      const parsed = await parseTssFile(file);
      if (!parsed.rows.length) throw new Error("Archivo sin filas válidas");
      if (!isApiConfigured()) {
        toast.error("Necesitas que el backend esté corriendo para guardar el archivo TSS de forma persistente.");
      } else {
        await payrollApi.importTss({ period: parsed.period, rows: parsed.rows });
        toast.success(`Importado y guardado: ${parsed.period} (${parsed.rows.length} registros)`);
        await loadTss();
        setSelectedPeriod(parsed.period);
      }
    } catch (e: any) {
      toast.error("Error importando: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteTss = async (period: string) => {
    if (!canManage) return;
    if (!confirm(`¿Eliminar el período TSS ${period}?`)) return;
    try {
      await payrollApi.deleteTss(period);
      toast.success("Período eliminado");
      if (selectedPeriod === period) { setSelectedPeriod(""); setCompare(null); }
      await loadTss();
    } catch (e: any) { toast.error(e.message); }
  };

  // ─── Generación de nómina (sin cambios sustanciales, usa el detalle modal para casos individuales) ───
  const [genForm, setGenForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    payDate: new Date().toISOString().slice(0, 10),
    schedule: "admin" as "admin" | "ops",
    frequency: "quincenal" as "monthly" | "quincenal",
    scope: "category" as "all" | "category" | "selected",
  });

  const handleGenerateRun = async () => {
    if (!canManage) { toast.error("Solo RRHH/Admin"); return; }
    if (!isApiConfigured()) { toast.error("Backend requerido"); return; }
    setLoading(true);
    try {
      const run = await payrollApi.generateRun(genForm);
      setActiveRun(run);
      await loadRuns();
      toast.success(`Nómina generada: ${run.items.length} colaboradores`);
      setTab("runs");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally { setLoading(false); }
  };

  const handleSelectRun = async (id: string) => {
    try { setActiveRun(await payrollApi.getRun(id)); } catch (e: any) { toast.error(e.message); }
  };

  // ─── Volante para empleado individual desde el modal ───
  const buildAdHocPayslip = (c: EmployeeCompliance): { run: PayrollRun; item: any } => {
    const e = c.employee;
    const gross = Number(e.salary) || 0;
    const factor = payFrequency === "quincenal" ? 0.5 : 1;
    const d = calcDeductions(gross);
    const item = {
      employeeCode: e.employeeCode, fullName: e.fullName, cedula: (e as any).tss || "",
      department: e.department, position: e.position, bank: (e as any).bank || "",
      category: e.category || e.payrollType,
      grossMonthly: gross,
      grossPeriod: gross * factor,
      sfs: d.sfs * factor, afp: d.afp * factor, isr: d.isr * factor,
      totalDeductions: d.totalDeductions * factor, net: d.net * factor,
    };
    const run: PayrollRun = {
      id: `ADHOC-${e.employeeCode}-${Date.now()}`,
      period: payDate.slice(0, 7),
      payDate,
      schedule: (e.category || e.payrollType) === "Administrativo" ? "admin" : "ops",
      frequency: payFrequency,
      scope: "selected",
      createdAt: new Date().toISOString(),
      createdBy: user?.fullName || "Sistema",
      closed: false,
      items: [item],
      totals: { gross: item.grossPeriod, sfs: item.sfs, afp: item.afp, isr: item.isr, deductions: item.totalDeductions, net: item.net, count: 1 },
    };
    return { run, item };
  };

  const handleDownloadAdHoc = async () => {
    if (!detailEmployee) return;
    const { run, item } = buildAdHocPayslip(detailEmployee);
    await generatePayslipPDF(run, item, { fileName: `Volante_${item.employeeCode}_${run.period}_${run.frequency}.pdf` });
    toast.success("Volante PDF generado");
  };

  const handleSendAdHoc = async () => {
    if (!detailEmployee) return;
    setSendingEmail(true);
    try {
      const { run, item } = buildAdHocPayslip(detailEmployee);
      await generatePayslipPDF(run, item, { fileName: `Volante_${item.employeeCode}_${run.period}.pdf` });
      // Modo prueba: stub backend si está disponible
      toast.success(`PDF generado. Modo prueba: el envío real iría a ${TEST_EMAIL} cuando se configure SMTP.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSendingEmail(false); }
  };

  // ─── Payslip from generated run ───
  const [sendingCode, setSendingCode] = useState<string | null>(null);
  const handleDownloadPayslip = async (item: any) => {
    if (!activeRun) return;
    await generatePayslipPDF(activeRun, item);
  };
  const handleSendPayslip = async (item: any) => {
    if (!activeRun) return;
    setSendingCode(item.employeeCode);
    try {
      await generatePayslipPDF(activeRun, item, { fileName: `Volante_${item.employeeCode}_${activeRun.period}.pdf` });
      if (isApiConfigured()) {
        const r = await payrollApi.sendPayslip({ runId: activeRun.id, employeeCode: item.employeeCode, recipientEmail: TEST_EMAIL });
        toast.success(`Volante registrado para envío a ${r.log.actualEmail} (modo prueba)`);
      } else {
        toast.success(`PDF descargado. Modo prueba: ${TEST_EMAIL}`);
      }
    } catch (e: any) { toast.error(e.message); } finally { setSendingCode(null); }
  };

  const exportDashboardExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = dashboardRows.map(c => ({
      Codigo: c.employee.employeeCode,
      Nombre: c.employee.fullName,
      Departamento: c.employee.department,
      Puesto: c.employee.position,
      Categoria: c.employee.category || c.employee.payrollType,
      Cedula: (c.employee as any).tss || "",
      Salario_Intranet: Number(c.employee.salary) || 0,
      Salario_TSS: c.tssRow?.tssReportedSalary || c.tssRow?.salarioReportado || 0,
      Diferencia: c.difference || 0,
      Estado_Cumplimiento: STATUS_LABEL[c.status],
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Cumplimiento");
    if (compare) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([compare.summary]), "Resumen");
    }
    XLSX.writeFile(wb, `Cumplimiento_TSS_${selectedPeriod || "actual"}.xlsx`);
  };

  const exportRunExcel = () => {
    if (!activeRun) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeRun.items), "Nómina");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([activeRun.totals]), "Totales");
    XLSX.writeFile(wb, `Nomina_${activeRun.period}_${activeRun.schedule}.xlsx`);
  };

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rrhh/empleados")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Empleados
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="w-7 h-7 text-gold" /> Nómina y Cumplimiento TSS
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Dashboard de cumplimiento. Haz clic en un colaborador para ver detalles y emitir su volante de pago.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {tssList.length > 0 && (
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Período TSS" /></SelectTrigger>
                <SelectContent>
                  {tssList.sort((a, b) => b.period.localeCompare(a.period)).map(t => (
                    <SelectItem key={t.id} value={t.period}>{t.period} · {t.rowCount} reg.</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Label htmlFor="tss-file" className={`cursor-pointer ${!canManage ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition text-sm">
                <Upload className="w-4 h-4" />
                {importing ? "Importando..." : "Importar TSS"}
              </div>
              <input id="tss-file" type="file" accept=".xls,.xlsx,.html,.htm" className="hidden"
                disabled={!canManage || importing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTssUpload(f); e.currentTarget.value = ""; }} />
            </Label>
          </div>
        </div>

        {tssList.length === 0 && (
          <Card className="mb-4 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">No hay archivos TSS guardados todavía.</p>
                <p className="text-muted-foreground">Importa el primer reporte mensual con el botón "Importar TSS" arriba. Los datos quedan guardados de forma permanente en el servidor.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="dashboard"><TrendingUp className="w-4 h-4 mr-2" /> Dashboard</TabsTrigger>
            <TabsTrigger value="generate"><Calculator className="w-4 h-4 mr-2" /> Generar Nómina</TabsTrigger>
            <TabsTrigger value="runs"><FileText className="w-4 h-4 mr-2" /> Nóminas y Volantes</TabsTrigger>
            <TabsTrigger value="periods"><FileSpreadsheet className="w-4 h-4 mr-2" /> Períodos TSS</TabsTrigger>
          </TabsList>

          {/* ────────── TAB: Dashboard ────────── */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Activos en intranet" value={stats.activeTotal} icon={<UserIcon className="w-4 h-4" />} />
              <SummaryCard label="✅ Cumplen TSS" value={stats.ok} color="text-green-600" icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => setFilterStatus("ok")} />
              <SummaryCard label="🔴 Sin TSS (urgente)" value={stats.missing} color="text-red-600" icon={<AlertTriangle className="w-4 h-4" />}
                onClick={() => setFilterStatus("missing")} />
              <SummaryCard label="⚠️ Discrepancia salario" value={stats.mismatch} color="text-amber-600" icon={<AlertTriangle className="w-4 h-4" />}
                onClick={() => setFilterStatus("mismatch")} />
              <SummaryCard label="🟡 En TSS pero inactivos" value={stats.ghost} color="text-orange-600" icon={<UserX className="w-4 h-4" />}
                onClick={() => setFilterStatus("inactive_in_tss")} />
            </div>

            {compare && (
              <p className="text-xs text-muted-foreground">
                Período cargado: <strong>{compare.period}</strong> · Importado el {new Date(compare.importedAt).toLocaleString("es-DO")} ·
                {" "}{compare.summary.tssReported} registros en TSS
                {stats.ghostNotInIntranet > 0 && <> · <span className="text-orange-600">{stats.ghostNotInIntranet} en TSS no existen en intranet</span></>}
              </p>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                  <span>Colaboradores ({dashboardRows.length})</span>
                  <Button size="sm" variant="outline" onClick={exportDashboardExcel}>
                    <Download className="w-4 h-4 mr-2" /> Excel
                  </Button>
                </CardTitle>
                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre, código, cédula o depto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
                  </div>
                  <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="ok">✅ Cumplen</SelectItem>
                      <SelectItem value="missing">🔴 Sin TSS</SelectItem>
                      <SelectItem value="mismatch">⚠️ Discrepancia</SelectItem>
                      <SelectItem value="inactive_in_tss">🟡 Inactivos en TSS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterDept} onValueChange={setFilterDept}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los departamentos</SelectItem>
                      {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead className="text-right">Salario intranet</TableHead>
                        <TableHead className="text-right">Salario TSS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardRows.map(c => (
                        <TableRow key={c.employee.employeeCode}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setDetailEmployee(c)}>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell className="font-mono text-xs">{c.employee.employeeCode}</TableCell>
                          <TableCell className="font-medium">{c.employee.fullName}</TableCell>
                          <TableCell className="text-xs">{c.employee.department}</TableCell>
                          <TableCell className="font-mono text-xs">{(c.employee as any).tss || "—"}</TableCell>
                          <TableCell className="text-right">{fmtRD(Number(c.employee.salary) || 0)}</TableCell>
                          <TableCell className="text-right text-xs">{c.tssRow ? fmtRD(c.tssRow.tssReportedSalary || c.tssRow.salarioReportado || 0) : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {dashboardRows.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin resultados con los filtros actuales.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────── TAB: Generar nómina (masiva) ────────── */}
          <TabsContent value="generate" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Generar nómina masiva</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Período (YYYY-MM)</Label>
                    <Input type="month" value={genForm.period} onChange={(e) => setGenForm(f => ({ ...f, period: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Fecha de pago</Label>
                    <Input type="date" value={genForm.payDate} onChange={(e) => setGenForm(f => ({ ...f, payDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Calendario</Label>
                    <Select value={genForm.schedule} onValueChange={(v: any) => setGenForm(f => ({ ...f, schedule: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrativos (15 y 30)</SelectItem>
                        <SelectItem value="ops">Operativos: agentes, supervisores, monitoreo (7 y 22)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frecuencia</Label>
                    <Select value={genForm.frequency} onValueChange={(v: any) => setGenForm(f => ({ ...f, frequency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quincenal">Quincenal (mitad del salario)</SelectItem>
                        <SelectItem value="monthly">Mensual completa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Alcance</Label>
                    <Select value={genForm.scope} onValueChange={(v: any) => setGenForm(f => ({ ...f, scope: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">Solo los del calendario seleccionado</SelectItem>
                        <SelectItem value="all">Todos los activos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-md text-xs space-y-1">
                  <p><strong>Vista previa:</strong> {genForm.scope === "category"
                    ? `${employees.filter(e => e.status === "Activo" && (genForm.schedule === "admin" ? (e.category || e.payrollType) === "Administrativo" : (e.category || e.payrollType) !== "Administrativo")).length} colaboradores`
                    : `${employees.filter(e => e.status === "Activo").length} colaboradores`}</p>
                  <p>Descuentos: AFP 2.87% (tope 4 SM), SFS 3.04% (tope 10 SM), ISR según escala DGII vigente.</p>
                </div>
                <Button onClick={handleGenerateRun} disabled={!canManage || loading} className="w-full">
                  {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                  Generar nómina
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────── TAB: Runs ────────── */}
          <TabsContent value="runs" className="space-y-4">
            {runs.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Nóminas guardadas</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>ID</TableHead><TableHead>Período</TableHead><TableHead>Pago</TableHead>
                      <TableHead>Calendario</TableHead><TableHead className="text-right">Colaboradores</TableHead>
                      <TableHead>Estado</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {runs.map(r => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => handleSelectRun(r.id)}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell>{r.period}</TableCell>
                          <TableCell>{r.payDate}</TableCell>
                          <TableCell><Badge variant="outline">{r.schedule === "admin" ? "Admin (15/30)" : "Ops (7/22)"} · {r.frequency}</Badge></TableCell>
                          <TableCell className="text-right">{r.itemCount}</TableCell>
                          <TableCell>{r.closed ? <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" />Cerrada</Badge> : <Badge>Abierta</Badge>}</TableCell>
                          <TableCell><Button size="sm" variant="ghost">Ver</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {activeRun && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Nómina {activeRun.period} — {activeRun.schedule === "admin" ? "Administrativos (15/30)" : "Operativos (7/22)"}</span>
                    <Button size="sm" variant="outline" onClick={exportRunExcel}><Download className="w-4 h-4 mr-2" />Excel</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs mb-4 bg-muted/30 p-3 rounded">
                    <div><div className="text-muted-foreground">Colaboradores</div><div className="font-bold">{activeRun.totals.count}</div></div>
                    <div><div className="text-muted-foreground">Bruto</div><div className="font-bold">{fmtRD(activeRun.totals.gross)}</div></div>
                    <div><div className="text-muted-foreground">SFS</div><div>{fmtRD(activeRun.totals.sfs)}</div></div>
                    <div><div className="text-muted-foreground">AFP</div><div>{fmtRD(activeRun.totals.afp)}</div></div>
                    <div><div className="text-muted-foreground">ISR</div><div>{fmtRD(activeRun.totals.isr)}</div></div>
                    <div><div className="text-muted-foreground font-bold">Neto</div><div className="font-bold text-gold">{fmtRD(activeRun.totals.net)}</div></div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Departamento</TableHead>
                        <TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">SFS</TableHead>
                        <TableHead className="text-right">AFP</TableHead><TableHead className="text-right">ISR</TableHead>
                        <TableHead className="text-right">Neto</TableHead><TableHead>Acciones</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {activeRun.items.map(i => (
                          <TableRow key={i.employeeCode}>
                            <TableCell className="font-mono text-xs">{i.employeeCode}</TableCell>
                            <TableCell>{i.fullName}</TableCell>
                            <TableCell className="text-xs">{i.department}</TableCell>
                            <TableCell className="text-right">{fmtRD(i.grossPeriod)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtRD(i.sfs)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtRD(i.afp)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtRD(i.isr)}</TableCell>
                            <TableCell className="text-right font-bold">{fmtRD(i.net)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" title="Descargar volante" onClick={() => handleDownloadPayslip(i)}>
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" title={`Enviar volante (modo prueba → ${TEST_EMAIL})`}
                                  disabled={sendingCode === i.employeeCode}
                                  onClick={() => handleSendPayslip(i)}>
                                  <Mail className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <strong>Modo prueba:</strong> los envíos de volante se redirigen a <code>{TEST_EMAIL}</code> hasta que se configure SMTP real.
                  </p>
                </CardContent>
              </Card>
            )}

            {!activeRun && runs.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                No hay nóminas generadas. Ve a "Generar Nómina" para crear la primera.
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ────────── TAB: Períodos TSS guardados ────────── */}
          <TabsContent value="periods">
            <Card>
              <CardHeader><CardTitle>Archivos TSS guardados (persistencia)</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {tssList.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No hay períodos importados.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Período</TableHead><TableHead>Importado</TableHead><TableHead>Por</TableHead>
                      <TableHead className="text-right">Registros</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {tssList.sort((a, b) => b.period.localeCompare(a.period)).map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.period}</TableCell>
                          <TableCell className="text-xs">{new Date(t.importedAt).toLocaleString("es-DO")}</TableCell>
                          <TableCell className="text-xs">{t.importedBy}</TableCell>
                          <TableCell className="text-right">{t.rowCount}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedPeriod(t.period); setTab("dashboard"); }}>Ver</Button>
                            {canManage && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteTss(t.period)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ────────── MODAL: Detalle de empleado ────────── */}
        <Dialog open={!!detailEmployee} onOpenChange={(o) => !o && setDetailEmployee(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {detailEmployee && (() => {
              const e = detailEmployee.employee;
              const gross = Number(e.salary) || 0;
              const factor = payFrequency === "quincenal" ? 0.5 : 1;
              const d = calcDeductions(gross);
              const grossPeriod = gross * factor;
              const sfs = d.sfs * factor;
              const afp = d.afp * factor;
              const isr = d.isr * factor;
              const net = d.net * factor;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between gap-3 pr-6">
                      <div className="flex items-center gap-3">
                        <UserIcon className="w-5 h-5 text-gold" />
                        <span>{e.fullName}</span>
                      </div>
                      <StatusBadge status={detailEmployee.status} />
                    </DialogTitle>
                  </DialogHeader>

                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <InfoBlock icon={<IdCard className="w-4 h-4" />} title="Identificación">
                      <Field label="Código" value={e.employeeCode} mono />
                      <Field label="Cédula" value={(e as any).tss || "—"} mono />
                      <Field label="Estado" value={e.status} />
                    </InfoBlock>
                    <InfoBlock icon={<Building2 className="w-4 h-4" />} title="Puesto">
                      <Field label="Departamento" value={e.department} />
                      <Field label="Puesto" value={e.position} />
                      <Field label="Categoría" value={e.category || e.payrollType || "—"} />
                    </InfoBlock>
                    <InfoBlock icon={<CreditCard className="w-4 h-4" />} title="Pago">
                      <Field label="Salario mensual" value={fmtRD(gross)} bold />
                      <Field label="Banco" value={(e as any).bank || "—"} />
                      <Field label="Email" value={(e as any).email || "—"} />
                    </InfoBlock>
                    <InfoBlock icon={<FileSpreadsheet className="w-4 h-4" />} title="TSS">
                      {detailEmployee.tssRow ? (
                        <>
                          <Field label="Salario TSS" value={fmtRD(detailEmployee.tssRow.tssReportedSalary || detailEmployee.tssRow.salarioReportado || 0)} />
                          <Field label="Match por" value={detailEmployee.matchType || "—"} />
                          {detailEmployee.difference !== undefined && detailEmployee.difference !== 0 && (
                            <Field label="Diferencia" value={fmtRD(detailEmployee.difference)} className="text-amber-600 font-bold" />
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-red-600">No reportado en el período {selectedPeriod || "actual"}.</p>
                      )}
                    </InfoBlock>
                  </div>

                  <Separator className="my-2" />

                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-gold" /> Cálculo del comprobante de pago
                    </h4>
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-xs">Frecuencia</Label>
                        <Select value={payFrequency} onValueChange={(v: any) => setPayFrequency(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quincenal">Quincenal (½ del salario)</SelectItem>
                            <SelectItem value="monthly">Mensual completa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Fecha de pago</Label>
                        <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                      </div>
                    </div>

                    <div className="bg-muted/40 rounded-md p-4 space-y-1 text-sm">
                      <Row label="Salario bruto del período" value={fmtRD(grossPeriod)} bold />
                      <Row label={`SFS (${(0.0304 * 100).toFixed(2)}%)`} value={`- ${fmtRD(sfs)}`} className="text-muted-foreground" />
                      <Row label={`AFP (${(0.0287 * 100).toFixed(2)}%)`} value={`- ${fmtRD(afp)}`} className="text-muted-foreground" />
                      <Row label="ISR (escala DGII)" value={`- ${fmtRD(isr)}`} className="text-muted-foreground" />
                      <Separator className="my-2" />
                      <Row label="Total descuentos" value={`- ${fmtRD(sfs + afp + isr)}`} className="text-amber-700" />
                      <Row label="NETO A RECIBIR" value={fmtRD(net)} className="text-lg text-gold font-bold" bold />
                    </div>
                  </div>

                  <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button variant="outline" onClick={() => setDetailEmployee(null)}>Cerrar</Button>
                    <Button variant="outline" onClick={handleDownloadAdHoc}>
                      <Download className="w-4 h-4 mr-2" /> Descargar volante PDF
                    </Button>
                    <Button onClick={handleSendAdHoc} disabled={sendingEmail}>
                      <Mail className="w-4 h-4 mr-2" />
                      {sendingEmail ? "Enviando..." : `Enviar a ${TEST_EMAIL} (prueba)`}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </AppLayout>
  );
}

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  ok: "Cumple",
  missing: "Sin TSS",
  mismatch: "Discrepancia salario",
  inactive_in_tss: "Inactivo en TSS",
};

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const map = {
    ok: { cls: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle2 className="w-3 h-3 mr-1" />, label: "Cumple" },
    missing: { cls: "bg-red-100 text-red-800 border-red-300", icon: <AlertTriangle className="w-3 h-3 mr-1" />, label: "Sin TSS" },
    mismatch: { cls: "bg-amber-100 text-amber-800 border-amber-300", icon: <AlertTriangle className="w-3 h-3 mr-1" />, label: "Discrepancia" },
    inactive_in_tss: { cls: "bg-orange-100 text-orange-800 border-orange-300", icon: <UserX className="w-3 h-3 mr-1" />, label: "Inactivo en TSS" },
  } as const;
  const v = map[status];
  return <Badge variant="outline" className={`${v.cls} text-xs`}>{v.icon}{v.label}</Badge>;
}

function SummaryCard({ label, value, color, icon, onClick }: { label: string; value: number | string; color?: string; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition" : ""} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {icon && <div className={color || "text-muted-foreground"}>{icon}</div>}
        </div>
        <div className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-md p-3">
      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">{icon} {title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value, mono, bold, className }: { label: string; value: string; mono?: boolean; bold?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${bold ? "font-bold" : ""} ${className || ""}`}>{value}</span>
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className || ""}`}>
      <span className={bold ? "font-semibold" : ""}>{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}
