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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, UserX, Calculator, Mail,
  Download, Search, Save, ShieldCheck, ShieldOff, Briefcase, FileUp, Ghost,
} from "lucide-react";
import { employeesApi, isApiConfigured, tasksApi, type Employee } from "@/lib/api";
import { calcDeductions, fmtRD } from "@/lib/payrollCalc";
import { generatePayslipPDF } from "@/lib/payslipPdf";
import { parseTssFile, type TssRow } from "@/lib/tssParser";
import * as XLSX from "xlsx";

function normalizeCedula(c?: string) { return String(c || "").replace(/\D/g, ""); }
function normalizeName(n?: string) {
  return String(n || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[,.]/g, "").replace(/\s+/g, " ").trim();
}

const TEST_EMAIL = "anoel@safeone.com.do";

type ComplianceStatus = "ok" | "missing" | "pending_unregister" | "ghost_active";

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  ok: "Registrado en TSS",
  missing: "Sin registrar en TSS",
  pending_unregister: "Pendiente baja TSS",
  ghost_active: "Activo sin TSS (urgente)",
};

const STATUS_COLOR: Record<ComplianceStatus, string> = {
  ok: "bg-green-600",
  missing: "bg-red-600",
  pending_unregister: "bg-amber-500",
  ghost_active: "bg-red-700",
};

function classifyEmployee(e: Employee): ComplianceStatus {
  const isActive = e.status === "Activo";
  if (isActive) return e.tssRegistered ? "ok" : "ghost_active";
  // Inactivo
  if (e.tssRegistered && !e.tssPendingUnregister) return "missing"; // sigue en TSS pero no es activo → debe darse de baja
  if (e.tssPendingUnregister) return "pending_unregister";
  return "ok"; // inactivo y no está en TSS → todo bien
}

export default function Payroll() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = !!user && (user.isAdmin || user.department === "Recursos Humanos");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | ComplianceStatus>("all");
  const [filterDept, setFilterDept] = useState<string>("all");

  // Modal
  const [detail, setDetail] = useState<Employee | null>(null);
  const [editTss, setEditTss] = useState({
    tssRegistered: false,
    tssReportedSalary: 0,
    tssNotes: "",
  });
  const [unregisterReason, setUnregisterReason] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payFrequency, setPayFrequency] = useState<"monthly" | "quincenal">("quincenal");
  const [saving, setSaving] = useState(false);

  // Validación contra archivo TSS
  const [validation, setValidation] = useState<null | {
    period: string;
    rows: TssRow[];
    matchedActive: Array<{ e: Employee; tss: TssRow; salaryDiff: number }>;
    activeNotInTss: Employee[];      // activos que NO aparecen en archivo TSS
    tssNotActive: TssRow[];          // en TSS pero no son empleados activos
  }>(null);
  const [validating, setValidating] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // ─── Load ───
  const loadEmployees = async () => {
    setLoading(true);
    try {
      if (isApiConfigured()) {
        const data = await employeesApi.getAll();
        if (data?.length) { setEmployees(data); return; }
      }
      const r = await fetch("/data/employees_seed.json");
      if (r.ok) setEmployees(await r.json());
    } catch {
      try { const r = await fetch("/data/employees_seed.json"); if (r.ok) setEmployees(await r.json()); } catch {}
    } finally { setLoading(false); }
  };

  useEffect(() => { loadEmployees(); }, []);

  // Cargar valores TSS al abrir modal
  useEffect(() => {
    if (detail) {
      setEditTss({
        tssRegistered: !!detail.tssRegistered,
        tssReportedSalary: Number(detail.tssReportedSalary) || Number(detail.salary) || 0,
        tssNotes: detail.tssNotes || "",
      });
      setUnregisterReason("");
    }
  }, [detail]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.status === "Activo");
    const inactive = employees.filter(e => e.status !== "Activo");
    return {
      activeTotal: active.length,
      ok: active.filter(e => e.tssRegistered).length,
      ghostActive: active.filter(e => !e.tssRegistered).length,
      inactiveStillInTss: inactive.filter(e => e.tssRegistered && !e.tssPendingUnregister).length,
      pendingUnregister: inactive.filter(e => e.tssPendingUnregister).length,
      reportedSalaryTotal: active
        .filter(e => e.tssRegistered)
        .reduce((s, e) => s + (Number(e.tssReportedSalary) || Number(e.salary) || 0), 0),
    };
  }, [employees]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    employees.forEach(e => e.department && s.add(e.department));
    return Array.from(s).sort();
  }, [employees]);

  const rows = useMemo(() => {
    let list = employees.map(e => ({ e, status: classifyEmployee(e) }));
    if (filterStatus !== "all") list = list.filter(x => x.status === filterStatus);
    if (filterDept !== "all") list = list.filter(x => x.e.department === filterDept);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(x =>
        x.e.fullName.toLowerCase().includes(q) ||
        x.e.employeeCode.toLowerCase().includes(q) ||
        String(x.e.tss || "").toLowerCase().includes(q) ||
        x.e.department?.toLowerCase().includes(q) ||
        x.e.position?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.e.fullName.localeCompare(b.e.fullName));
  }, [employees, filterStatus, filterDept, search]);

  // ─── Acciones ───
  const handleSaveTss = async () => {
    if (!detail || !canManage) return;
    setSaving(true);
    try {
      const patch: Partial<Employee> = {
        tssRegistered: editTss.tssRegistered,
        tssReportedSalary: Number(editTss.tssReportedSalary) || 0,
        tssNotes: editTss.tssNotes,
        tssRegisteredAt: editTss.tssRegistered
          ? (detail.tssRegisteredAt || new Date().toISOString())
          : detail.tssRegisteredAt,
      };
      if (isApiConfigured()) {
        const updated = await employeesApi.update(detail.employeeCode, patch);
        setEmployees(prev => prev.map(e => e.employeeCode === detail.employeeCode ? updated : e));
        setDetail(updated);
      } else {
        const updated = { ...detail, ...patch } as Employee;
        setEmployees(prev => prev.map(e => e.employeeCode === detail.employeeCode ? updated : e));
        setDetail(updated);
      }
      toast.success("Estado TSS actualizado");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleRequestUnregister = async () => {
    if (!detail || !canManage) return;
    if (!unregisterReason.trim()) { toast.error("Indica el motivo de la baja"); return; }
    setSaving(true);
    try {
      const patch: Partial<Employee> = {
        tssPendingUnregister: true,
        tssPendingUnregisterAt: new Date().toISOString(),
        tssPendingUnregisterReason: unregisterReason.trim(),
      };
      if (isApiConfigured()) {
        const updated = await employeesApi.update(detail.employeeCode, patch);
        setEmployees(prev => prev.map(e => e.employeeCode === detail.employeeCode ? updated : e));
        setDetail(updated);
        // Crear tarea para Aurelio (best effort)
        try {
          await tasksApi.create({
            title: `Baja TSS: ${detail.fullName}`,
            description: `Solicitud de baja en la TSS para ${detail.fullName} (cédula ${detail.tss || "N/D"}). Motivo: ${unregisterReason.trim()}`,
            assignedTo: "tecnologia@safeone.com.do",
            priority: "alta",
            status: "pendiente",
            createdBy: user?.fullName || user?.email || "Sistema",
            relatedTo: `empleado:${detail.employeeCode}`,
            type: "tss_unregister",
          });
        } catch { /* tarea opcional */ }
      } else {
        const updated = { ...detail, ...patch } as Employee;
        setEmployees(prev => prev.map(e => e.employeeCode === detail.employeeCode ? updated : e));
        setDetail(updated);
      }
      toast.success("Solicitud de baja TSS registrada");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleConfirmUnregister = async () => {
    if (!detail || !canManage) return;
    setSaving(true);
    try {
      const patch: Partial<Employee> = {
        tssRegistered: false,
        tssPendingUnregister: false,
        tssNotes: `${detail.tssNotes || ""}\n[${new Date().toLocaleDateString("es-DO")}] Baja TSS confirmada.`.trim(),
      };
      if (isApiConfigured()) {
        const updated = await employeesApi.update(detail.employeeCode, patch);
        setEmployees(prev => prev.map(e => e.employeeCode === detail.employeeCode ? updated : e));
        setDetail(updated);
      } else {
        const updated = { ...detail, ...patch } as Employee;
        setEmployees(prev => prev.map(e => e.employeeCode === detail.employeeCode ? updated : e));
        setDetail(updated);
      }
      toast.success("Baja TSS confirmada");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ─── Volante ad-hoc ───
  const buildAdHocPayslip = (e: Employee) => {
    const gross = Number(e.tssReportedSalary) || Number(e.salary) || 0;
    const factor = payFrequency === "quincenal" ? 0.5 : 1;
    const d = calcDeductions(gross);
    const item = {
      employeeCode: e.employeeCode, fullName: e.fullName, cedula: e.tss || "",
      department: e.department, position: e.position, bank: e.bank || "",
      category: e.category || e.payrollType,
      grossMonthly: gross,
      grossPeriod: gross * factor,
      sfs: d.sfs * factor, afp: d.afp * factor, isr: d.isr * factor,
      totalDeductions: d.totalDeductions * factor, net: d.net * factor,
    };
    const run = {
      id: `ADHOC-${e.employeeCode}-${Date.now()}`,
      period: payDate.slice(0, 7),
      payDate,
      schedule: ((e.category || e.payrollType) === "Administrativo" ? "admin" : "ops") as "admin" | "ops",
      frequency: payFrequency,
      scope: "selected" as const,
      createdAt: new Date().toISOString(),
      createdBy: user?.fullName || "Sistema",
      closed: false,
      items: [item],
      totals: { gross: item.grossPeriod, sfs: item.sfs, afp: item.afp, isr: item.isr, deductions: item.totalDeductions, net: item.net, count: 1 },
    };
    return { run, item };
  };

  const handleDownloadPayslip = async () => {
    if (!detail) return;
    const { run, item } = buildAdHocPayslip(detail);
    await generatePayslipPDF(run, item, { fileName: `Volante_${item.employeeCode}_${run.period}_${run.frequency}.pdf` });
    toast.success("Volante PDF generado");
  };

  const handleSendPayslip = async () => {
    if (!detail) return;
    const { run, item } = buildAdHocPayslip(detail);
    await generatePayslipPDF(run, item, { fileName: `Volante_${item.employeeCode}_${run.period}.pdf` });
    toast.success(`PDF generado. Modo prueba: el envío real iría a ${TEST_EMAIL} cuando se configure SMTP.`);
  };

  const exportExcel = () => {
    const data = rows.map(({ e, status }) => ({
      Codigo: e.employeeCode,
      Nombre: e.fullName,
      Departamento: e.department,
      Puesto: e.position,
      Categoria: e.category || e.payrollType,
      Cedula: e.tss || "",
      Estatus_Empleado: e.status,
      Salario_Intranet: Number(e.salary) || 0,
      Salario_TSS: Number(e.tssReportedSalary) || 0,
      Diferencia: (Number(e.salary) || 0) - (Number(e.tssReportedSalary) || 0),
      Cumplimiento: STATUS_LABEL[status],
      Notas_TSS: e.tssNotes || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Cumplimiento TSS");
    XLSX.writeFile(wb, `Cumplimiento_TSS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ─── Validación con archivo TSS ───
  const handleValidateFile = async (file: File) => {
    setValidating(true);
    try {
      const parsed = await parseTssFile(file);
      const tssByCed = new Map<string, TssRow>();
      const tssByName = new Map<string, TssRow>();
      parsed.rows.forEach(r => {
        if (r.cedula) tssByCed.set(r.cedula, r);
        if (r.nombre) tssByName.set(normalizeName(r.nombre), r);
      });

      const matchedActive: Array<{ e: Employee; tss: TssRow; salaryDiff: number }> = [];
      const activeNotInTss: Employee[] = [];
      const matchedTssCeds = new Set<string>();

      employees.forEach(e => {
        if (e.status !== "Activo") return;
        const ced = normalizeCedula(e.tss);
        let row = ced ? tssByCed.get(ced) : null;
        if (!row) row = tssByName.get(normalizeName(e.fullName)) || null;
        if (row) {
          matchedTssCeds.add(row.cedula);
          matchedActive.push({
            e, tss: row,
            salaryDiff: (Number(e.salary) || 0) - row.salarioReportado,
          });
        } else {
          activeNotInTss.push(e);
        }
      });

      const tssNotActive = parsed.rows.filter(r => !matchedTssCeds.has(r.cedula));

      setValidation({
        period: parsed.period,
        rows: parsed.rows,
        matchedActive,
        activeNotInTss,
        tssNotActive,
      });
      setShowValidation(true);
      toast.success(`Archivo TSS procesado: ${parsed.rows.length} registros del período ${parsed.period}`);
    } catch (e: any) {
      toast.error(`Error al procesar archivo TSS: ${e.message}`);
    } finally {
      setValidating(false);
    }
  };

  // Reconciliar: aplicar cambios masivos en empleados según validación
  const handleReconcile = async () => {
    if (!validation || !canManage) return;
    setSaving(true);
    let updates = 0;
    try {
      // Marcar como registrados en TSS los que aparecen en el archivo
      for (const { e, tss } of validation.matchedActive) {
        if (e.tssRegistered && Number(e.tssReportedSalary) === tss.salarioReportado) continue;
        const patch: Partial<Employee> = {
          tssRegistered: true,
          tssReportedSalary: tss.salarioReportado,
          tssRegisteredAt: e.tssRegisteredAt || new Date().toISOString(),
          tss: e.tss || tss.cedula,
        };
        if (isApiConfigured()) {
          const upd = await employeesApi.update(e.employeeCode, patch);
          setEmployees(prev => prev.map(x => x.employeeCode === e.employeeCode ? upd : x));
        } else {
          setEmployees(prev => prev.map(x => x.employeeCode === e.employeeCode ? { ...x, ...patch } : x));
        }
        updates++;
      }
      // Marcar como sin TSS los activos que NO aparecen
      for (const e of validation.activeNotInTss) {
        if (e.tssRegistered === false) continue;
        const patch: Partial<Employee> = { tssRegistered: false };
        if (isApiConfigured()) {
          const upd = await employeesApi.update(e.employeeCode, patch);
          setEmployees(prev => prev.map(x => x.employeeCode === e.employeeCode ? upd : x));
        } else {
          setEmployees(prev => prev.map(x => x.employeeCode === e.employeeCode ? { ...x, ...patch } : x));
        }
        updates++;
      }
      toast.success(`${updates} empleados actualizados según el archivo TSS`);
      setShowValidation(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportValidationExcel = () => {
    if (!validation) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      validation.matchedActive.map(({ e, tss, salaryDiff }) => ({
        Codigo: e.employeeCode, Nombre: e.fullName, Cedula: tss.cedula,
        Departamento: e.department, Puesto: e.position,
        Salario_Intranet: Number(e.salary) || 0,
        Salario_TSS_Reportado: tss.salarioReportado,
        Diferencia: salaryDiff,
      }))
    ), "Cumplen TSS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      validation.activeNotInTss.map(e => ({
        Codigo: e.employeeCode, Nombre: e.fullName, Cedula: e.tss || "",
        Departamento: e.department, Puesto: e.position,
        Salario_Intranet: Number(e.salary) || 0,
        Accion: "Inscribir en TSS",
      }))
    ), "Activos sin TSS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      validation.tssNotActive.map(r => ({
        Cedula: r.cedula, Nombre: r.nombre, ID_NSS: r.idNss,
        Salario_TSS: r.salarioReportado, Total_Pagado: r.total,
        Accion: "Solicitar baja TSS",
      }))
    ), "Pagamos sin ser empleados");
    XLSX.writeFile(wb, `Validacion_TSS_${validation.period}.xlsx`);
  };


  // ─── Vista detalle: deducciones en vivo ───
  const liveCalc = useMemo(() => {
    if (!detail) return null;
    const gross = Number(editTss.tssReportedSalary) || Number(detail.salary) || 0;
    const factor = payFrequency === "quincenal" ? 0.5 : 1;
    const d = calcDeductions(gross);
    return {
      gross,
      grossPeriod: gross * factor,
      sfs: d.sfs * factor,
      afp: d.afp * factor,
      isr: d.isr * factor,
      total: d.totalDeductions * factor,
      net: d.net * factor,
    };
  }, [detail, editTss.tssReportedSalary, payFrequency]);

  const detailStatus = detail ? classifyEmployee(detail) : null;

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
              <ShieldCheck className="w-7 h-7 text-gold" /> Cumplimiento TSS y Nómina
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Revisa el cumplimiento TSS de cada empleado, marca su estado y genera comprobantes de pago.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <label htmlFor="tss-validate-input">
              <input
                id="tss-validate-input" type="file" accept=".xls,.xlsx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleValidateFile(f); e.target.value = ""; }}
              />
              <Button variant="default" disabled={validating} asChild>
                <span className="cursor-pointer">
                  <FileUp className="w-4 h-4 mr-2" />
                  {validating ? "Procesando..." : "Validar archivo TSS"}
                </span>
              </Button>
            </label>
            {validation && (
              <Button variant="outline" onClick={() => setShowValidation(true)}>
                <ShieldCheck className="w-4 h-4 mr-2" /> Ver validación ({validation.period})
              </Button>
            )}
            <Button variant="outline" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-2" /> Exportar Excel
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard
            label="Activos" value={stats.activeTotal}
            color="text-foreground" active={filterStatus === "all"}
            onClick={() => setFilterStatus("all")}
          />
          <KpiCard
            label="✅ Cumplen TSS" value={stats.ok}
            color="text-green-600" active={filterStatus === "ok"}
            onClick={() => setFilterStatus("ok")}
          />
          <KpiCard
            label="🔴 Sin TSS (urgente)" value={stats.ghostActive}
            color="text-red-600" active={filterStatus === "ghost_active"}
            onClick={() => setFilterStatus("ghost_active")}
          />
          <KpiCard
            label="🟡 Inactivos en TSS" value={stats.inactiveStillInTss}
            color="text-amber-600" active={filterStatus === "missing"}
            onClick={() => setFilterStatus("missing")}
          />
          <KpiCard
            label="⏳ Bajas pendientes" value={stats.pendingUnregister}
            color="text-orange-600" active={filterStatus === "pending_unregister"}
            onClick={() => setFilterStatus("pending_unregister")}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, cédula, código, departamento..."
              value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los departamentos</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="ok">Registrado en TSS</SelectItem>
              <SelectItem value="ghost_active">Activo sin TSS</SelectItem>
              <SelectItem value="missing">Inactivo aún en TSS</SelectItem>
              <SelectItem value="pending_unregister">Baja pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Salario interno</TableHead>
                    <TableHead className="text-right">Salario TSS</TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Cumplimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Sin resultados</TableCell></TableRow>
                  ) : rows.map(({ e, status }) => (
                    <TableRow key={e.employeeCode} className="cursor-pointer hover:bg-accent/40" onClick={() => setDetail(e)}>
                      <TableCell className="font-mono text-xs">{e.employeeCode}</TableCell>
                      <TableCell className="font-medium">{e.fullName}</TableCell>
                      <TableCell className="text-xs">{e.tss || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{e.department}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{fmtRD(Number(e.salary) || 0)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {e.tssReportedSalary ? fmtRD(Number(e.tssReportedSalary)) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={e.status === "Activo" ? "bg-green-600" : "bg-slate-500"}>{e.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && <p className="text-xs text-muted-foreground p-3 border-t">{rows.length} de {employees.length} empleados</p>}
          </CardContent>
        </Card>
      </div>
      <Footer />

      {/* ─── Modal de Detalle ─── */}
      <Dialog open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && detailStatus && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>{detail.fullName}</span>
                  <Badge className={STATUS_COLOR[detailStatus]}>{STATUS_LABEL[detailStatus]}</Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Datos del empleado */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Info label="Código" value={detail.employeeCode} />
                <Info label="Cédula" value={detail.tss || "—"} />
                <Info label="Estatus" value={detail.status} />
                <Info label="Departamento" value={detail.department} />
                <Info label="Puesto" value={detail.position} />
                <Info label="Categoría" value={detail.category || detail.payrollType} />
                <Info label="Banco" value={detail.bank || "—"} />
                <Info label="Salario interno" value={fmtRD(Number(detail.salary) || 0)} />
                <Info label="Email" value={detail.email || "—"} />
              </div>

              <Separator />

              {/* Edición TSS */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gold" /> Estado TSS
                </h3>
                <div className="flex items-center gap-3 p-3 rounded border bg-card">
                  <Switch
                    id="tss-reg" checked={editTss.tssRegistered}
                    onCheckedChange={v => setEditTss(s => ({ ...s, tssRegistered: v }))}
                    disabled={!canManage}
                  />
                  <Label htmlFor="tss-reg" className="cursor-pointer flex-1">
                    Registrado en la TSS con descuentos de ley
                  </Label>
                  {detail.tssRegisteredAt && (
                    <span className="text-xs text-muted-foreground">
                      desde {new Date(detail.tssRegisteredAt).toLocaleDateString("es-DO")}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Salario reportado a TSS</Label>
                    <Input type="number" value={editTss.tssReportedSalary || ""}
                      onChange={e => setEditTss(s => ({ ...s, tssReportedSalary: +e.target.value }))}
                      disabled={!canManage} />
                  </div>
                  <div className="flex items-end">
                    {editTss.tssReportedSalary > 0 && Number(detail.salary) > 0 && (
                      <p className={`text-xs ${
                        Math.abs(editTss.tssReportedSalary - Number(detail.salary)) > 100
                          ? "text-amber-600" : "text-green-600"
                      }`}>
                        {Math.abs(editTss.tssReportedSalary - Number(detail.salary)) > 100
                          ? `⚠️ Diferencia: ${fmtRD(editTss.tssReportedSalary - Number(detail.salary))}`
                          : "✓ Salarios coinciden"}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Notas TSS</Label>
                  <Textarea rows={2} value={editTss.tssNotes}
                    onChange={e => setEditTss(s => ({ ...s, tssNotes: e.target.value }))}
                    placeholder="Observaciones internas (opcional)"
                    disabled={!canManage} />
                </div>

                {canManage && (
                  <Button onClick={handleSaveTss} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" /> Guardar estado TSS
                  </Button>
                )}

                {/* Bloque de baja: solo si empleado inactivo y registrado en TSS */}
                {detail.status !== "Activo" && detail.tssRegistered && !detail.tssPendingUnregister && canManage && (
                  <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ShieldOff className="w-4 h-4 text-amber-600" />
                        Empleado inactivo aún registrado en TSS
                      </p>
                      <Textarea rows={2} placeholder="Motivo de la baja (renuncia, despido, etc.)"
                        value={unregisterReason} onChange={e => setUnregisterReason(e.target.value)} />
                      <Button variant="outline" onClick={handleRequestUnregister} disabled={saving}>
                        <ShieldOff className="w-4 h-4 mr-2" /> Solicitar baja en TSS
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {detail.tssPendingUnregister && (
                  <Card className="border-orange-300 bg-orange-50/50 dark:bg-orange-950/20">
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm">
                        <strong>Baja pendiente</strong> solicitada el{" "}
                        {detail.tssPendingUnregisterAt ? new Date(detail.tssPendingUnregisterAt).toLocaleDateString("es-DO") : "—"}.
                      </p>
                      <p className="text-sm text-muted-foreground">Motivo: {detail.tssPendingUnregisterReason}</p>
                      {canManage && (
                        <Button variant="outline" onClick={handleConfirmUnregister} disabled={saving}>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar baja procesada
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Comprobante de pago en vivo */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-gold" /> Comprobante de pago
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha de pago</Label>
                    <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Frecuencia</Label>
                    <Select value={payFrequency} onValueChange={(v: any) => setPayFrequency(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quincenal">Quincenal (½ del mes)</SelectItem>
                        <SelectItem value="monthly">Mensual completa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {liveCalc && (
                  <Card>
                    <CardContent className="pt-4">
                      <Table>
                        <TableBody>
                          <Row label="Salario bruto del período" value={fmtRD(liveCalc.grossPeriod)} />
                          <Row label="SFS (3.04%)" value={`- ${fmtRD(liveCalc.sfs)}`} muted />
                          <Row label="AFP (2.87%)" value={`- ${fmtRD(liveCalc.afp)}`} muted />
                          <Row label="ISR" value={`- ${fmtRD(liveCalc.isr)}`} muted />
                          <Row label="Total deducciones" value={`- ${fmtRD(liveCalc.total)}`} />
                          <Row label="Neto a recibir" value={fmtRD(liveCalc.net)} bold />
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleDownloadPayslip}>
                    <Download className="w-4 h-4 mr-2" /> Descargar PDF
                  </Button>
                  <Button variant="outline" onClick={handleSendPayslip}>
                    <Mail className="w-4 h-4 mr-2" /> Enviar (modo prueba: {TEST_EMAIL})
                  </Button>
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function KpiCard({ label, value, color, active, onClick }: {
  label: string; value: number; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition ${active ? "ring-2 ring-gold" : "hover:shadow-md"}`}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <TableRow>
      <TableCell className={`${muted ? "text-muted-foreground" : ""} ${bold ? "font-bold" : ""}`}>{label}</TableCell>
      <TableCell className={`text-right ${bold ? "font-bold text-lg text-green-700" : ""}`}>{value}</TableCell>
    </TableRow>
  );
}
