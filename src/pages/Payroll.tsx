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
import { toast } from "sonner";
import {
  ArrowLeft, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, UserX,
  TrendingUp, Calculator, Mail, Download, Trash2, FileText, Lock, RefreshCw,
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

export default function Payroll() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = !!user && (user.isAdmin || user.department === "Recursos Humanos");

  const [tab, setTab] = useState("tss");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tssList, setTssList] = useState<TssImportMeta[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [compare, setCompare] = useState<TssCompareResult | null>(null);
  const [runs, setRuns] = useState<(Omit<PayrollRun, "items"> & { itemCount: number })[]>([]);
  const [activeRun, setActiveRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // ─── Load data ───
  const loadEmployees = async () => {
    try {
      if (isApiConfigured()) {
        const data = await employeesApi.getAll();
        if (data?.length) { setEmployees(data); return; }
      }
      const r = await fetch("/data/employees_seed.json");
      if (r.ok) setEmployees(await r.json());
    } catch (e) {
      try { const r = await fetch("/data/employees_seed.json"); if (r.ok) setEmployees(await r.json()); } catch {}
    }
  };

  const loadTss = async () => {
    if (!isApiConfigured()) return;
    try { setTssList(await payrollApi.listTss()); } catch {}
  };

  const loadRuns = async () => {
    if (!isApiConfigured()) return;
    try { setRuns(await payrollApi.listRuns()); } catch {}
  };

  useEffect(() => {
    loadEmployees(); loadTss(); loadRuns();
  }, []);

  useEffect(() => {
    if (selectedPeriod && isApiConfigured()) {
      payrollApi.compareTss(selectedPeriod).then(setCompare).catch(e => toast.error("Error: " + e.message));
    }
  }, [selectedPeriod]);

  // ─── TSS import ───
  const handleTssUpload = async (file: File) => {
    if (!canManage) { toast.error("Solo RRHH/Admin"); return; }
    setImporting(true);
    try {
      const parsed = await parseTssFile(file);
      if (!parsed.rows.length) throw new Error("Archivo sin filas válidas");
      if (!isApiConfigured()) {
        // Fallback local: hacer comparación en cliente
        runLocalCompare(parsed.period, parsed.rows);
        toast.success(`Archivo leído: ${parsed.rows.length} registros (modo offline, no persistido).`);
      } else {
        await payrollApi.importTss({ period: parsed.period, rows: parsed.rows });
        toast.success(`Importado: ${parsed.period} (${parsed.rows.length} registros)`);
        await loadTss();
        setSelectedPeriod(parsed.period);
      }
    } catch (e: any) {
      toast.error("Error importando: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // Comparación local (cuando no hay backend)
  const runLocalCompare = (period: string, rows: any[]) => {
    const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[,.]/g, "").replace(/\s+/g, " ").trim();
    const nor = (c: string) => String(c || "").replace(/\D/g, "");
    const tssByCed = new Map<string, any>();
    const tssByName = new Map<string, any>();
    rows.forEach(r => { if (r.cedula) tssByCed.set(r.cedula, r); if (r.nombre) tssByName.set(norm(r.nombre), r); });
    const matched: any[] = [], missingTss: any[] = [], ghostTss: any[] = [], salaryMismatch: any[] = [];
    const matchedCeds = new Set<string>();
    employees.forEach(e => {
      const ced = nor((e as any).tss);
      let row = ced ? tssByCed.get(ced) : null;
      let matchType: string = row ? "cedula" : "none";
      if (!row) { row = tssByName.get(norm(e.fullName)); if (row) matchType = "nombre"; }
      if (e.status === "Activo") {
        if (row) {
          matchedCeds.add(row.cedula);
          matched.push({
            employeeCode: e.employeeCode, fullName: e.fullName, department: e.department, position: e.position,
            category: e.category || e.payrollType, cedula: (e as any).tss || row.cedula,
            intranetSalary: Number(e.salary) || 0, tssReportedSalary: row.salarioReportado,
            tssSalary: row.salarioSS, afp: row.afpAfiliado, sfs: row.sfsAfiliado, matchType,
          });
          const intra = Number(e.salary) || 0;
          if (intra > 0 && Math.abs(intra - row.salarioReportado) > 100) {
            salaryMismatch.push({ employeeCode: e.employeeCode, fullName: e.fullName, department: e.department, intranetSalary: intra, tssReportedSalary: row.salarioReportado, difference: intra - row.salarioReportado });
          }
        } else {
          missingTss.push({ employeeCode: e.employeeCode, fullName: e.fullName, department: e.department, position: e.position, category: e.category || e.payrollType, cedula: (e as any).tss || "", intranetSalary: Number(e.salary) || 0 });
        }
      }
    });
    rows.forEach(r => {
      if (matchedCeds.has(r.cedula)) return;
      const inactive = employees.find(e => nor((e as any).tss) === r.cedula || norm(e.fullName) === norm(r.nombre));
      ghostTss.push({ cedula: r.cedula, fullName: r.nombre, idNss: r.idNss, tssReportedSalary: r.salarioReportado, total: r.total, intranetStatus: inactive ? inactive.status : "No registrado", intranetCode: inactive?.employeeCode || "" });
    });
    setCompare({
      period, importedAt: new Date().toISOString(),
      summary: { activeEmployees: employees.filter(e => e.status === "Activo").length, tssReported: rows.length, matched: matched.length, missingTss: missingTss.length, ghostTss: ghostTss.length, salaryMismatch: salaryMismatch.length },
      matched, missingTss, ghostTss, salaryMismatch,
    });
    setSelectedPeriod(period);
  };

  // ─── Generación de nómina ───
  const [genForm, setGenForm] = useState({
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    payDate: new Date().toISOString().slice(0, 10),
    schedule: "admin" as "admin" | "ops",
    frequency: "quincenal" as "monthly" | "quincenal",
    scope: "category" as "all" | "category" | "selected",
  });

  const handleGenerateRun = async () => {
    if (!canManage) { toast.error("Solo RRHH/Admin"); return; }
    setLoading(true);
    try {
      if (isApiConfigured()) {
        const run = await payrollApi.generateRun(genForm);
        setActiveRun(run);
        await loadRuns();
        toast.success(`Nómina generada: ${run.items.length} colaboradores`);
      } else {
        // Fallback local
        const target = employees.filter(e => {
          if (e.status !== "Activo") return false;
          if (genForm.scope === "all") return true;
          if (genForm.scope === "category") {
            const isAdmin = (e.category || e.payrollType) === "Administrativo";
            return genForm.schedule === "admin" ? isAdmin : !isAdmin;
          }
          return true;
        });
        const factor = genForm.frequency === "quincenal" ? 0.5 : 1;
        const items = target.map(e => {
          const gross = Number(e.salary) || 0;
          const d = calcDeductions(gross);
          return {
            employeeCode: e.employeeCode, fullName: e.fullName, cedula: (e as any).tss || "",
            department: e.department, position: e.position, bank: e.bank, category: e.category || e.payrollType,
            grossMonthly: gross, grossPeriod: gross * factor,
            sfs: d.sfs * factor, afp: d.afp * factor, isr: d.isr * factor,
            totalDeductions: d.totalDeductions * factor, net: d.net * factor,
          };
        });
        const totals = items.reduce((a, i) => ({
          gross: a.gross + i.grossPeriod, sfs: a.sfs + i.sfs, afp: a.afp + i.afp,
          isr: a.isr + i.isr, deductions: a.deductions + i.totalDeductions, net: a.net + i.net,
        }), { gross: 0, sfs: 0, afp: 0, isr: 0, deductions: 0, net: 0 });
        setActiveRun({
          id: `LOCAL-${Date.now()}`, period: genForm.period, payDate: genForm.payDate,
          schedule: genForm.schedule, frequency: genForm.frequency, scope: genForm.scope,
          createdAt: new Date().toISOString(), createdBy: user?.fullName || "Local", closed: false,
          items, totals: { ...totals, count: items.length },
        });
        toast.success(`Nómina generada (modo offline): ${items.length} colaboradores`);
      }
      setTab("runs");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally { setLoading(false); }
  };

  const handleSelectRun = async (id: string) => {
    if (id.startsWith("LOCAL-")) return;
    try { setActiveRun(await payrollApi.getRun(id)); } catch (e: any) { toast.error(e.message); }
  };

  // ─── Payslip actions ───
  const [sendingCode, setSendingCode] = useState<string | null>(null);

  const handleDownloadPayslip = async (item: any) => {
    if (!activeRun) return;
    await generatePayslipPDF(activeRun, item);
  };

  const handleSendPayslip = async (item: any) => {
    if (!activeRun) return;
    setSendingCode(item.employeeCode);
    try {
      // Generar PDF (siempre, aunque sea modo prueba para tener registro local)
      await generatePayslipPDF(activeRun, item, { fileName: `Volante_${item.employeeCode}_${activeRun.period}.pdf` });
      if (isApiConfigured()) {
        const r = await payrollApi.sendPayslip({
          runId: activeRun.id, employeeCode: item.employeeCode,
          recipientEmail: TEST_EMAIL,
        });
        toast.success(`Volante registrado para envío a ${r.log.actualEmail} (modo prueba)`);
      } else {
        toast.success(`PDF descargado. Modo prueba: el envío real iría a ${TEST_EMAIL} cuando se configure SMTP.`);
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally { setSendingCode(null); }
  };

  // ─── Excel exports ───
  const exportCompareExcel = () => {
    if (!compare) return;
    const wb = XLSX.utils.book_new();
    const sheet = (name: string, rows: any[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
    sheet("Resumen", [{ ...compare.summary, periodo: compare.period }]);
    sheet("Activos OK", compare.matched);
    sheet("Sin registro TSS", compare.missingTss);
    sheet("TSS sin Activo", compare.ghostTss);
    sheet("Discrepancia Salario", compare.salaryMismatch);
    XLSX.writeFile(wb, `Cumplimiento_TSS_${compare.period}.xlsx`);
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

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="w-7 h-7 text-gold" /> Nómina y Cumplimiento TSS
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Importa la factura mensual de la TSS, compárala contra los empleados activos, genera nómina y emite volantes de pago membretados.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="tss"><FileSpreadsheet className="w-4 h-4 mr-2" /> Cumplimiento TSS</TabsTrigger>
            <TabsTrigger value="generate"><Calculator className="w-4 h-4 mr-2" /> Generar Nómina</TabsTrigger>
            <TabsTrigger value="runs"><FileText className="w-4 h-4 mr-2" /> Nóminas y Volantes</TabsTrigger>
          </TabsList>

          {/* ────────── TAB 1: TSS ────────── */}
          <TabsContent value="tss" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Importar reporte TSS (.xls / .xlsx)</span>
                  {tssList.length > 0 && (
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="w-[220px]"><SelectValue placeholder="Período guardado" /></SelectTrigger>
                      <SelectContent>
                        {tssList.map(t => (
                          <SelectItem key={t.id} value={t.period}>{t.period} ({t.rowCount} reg.)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap">
                  <Label htmlFor="tss-file" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition">
                      <Upload className="w-4 h-4" />
                      {importing ? "Importando..." : "Seleccionar archivo TSS"}
                    </div>
                    <input id="tss-file" type="file" accept=".xls,.xlsx,.html,.htm" className="hidden"
                      disabled={!canManage || importing}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTssUpload(f); e.currentTarget.value = ""; }} />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Acepta el .xls que descarga TSS (HTML UTF-16) o .xlsx nativo. Se cruza por cédula y, como respaldo, por nombre.
                  </p>
                </div>
              </CardContent>
            </Card>

            {compare && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <SummaryCard label="Activos en intranet" value={compare.summary.activeEmployees} icon={<TrendingUp className="w-4 h-4" />} />
                  <SummaryCard label="Reportados a TSS" value={compare.summary.tssReported} color="text-blue-600" icon={<FileSpreadsheet className="w-4 h-4" />} />
                  <SummaryCard label="Activos OK" value={compare.summary.matched} color="text-green-600" icon={<CheckCircle2 className="w-4 h-4" />} />
                  <SummaryCard label="Sin TSS (urgente)" value={compare.summary.missingTss} color="text-red-600" icon={<AlertTriangle className="w-4 h-4" />} />
                  <SummaryCard label="TSS sin Activo" value={compare.summary.ghostTss} color="text-amber-600" icon={<UserX className="w-4 h-4" />} />
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={exportCompareExcel}>
                    <Download className="w-4 h-4 mr-2" /> Exportar a Excel
                  </Button>
                </div>

                <Tabs defaultValue="missing">
                  <TabsList>
                    <TabsTrigger value="missing">🔴 Sin TSS ({compare.missingTss.length})</TabsTrigger>
                    <TabsTrigger value="ghost">🟡 TSS sin Activo ({compare.ghostTss.length})</TabsTrigger>
                    <TabsTrigger value="mismatch">⚠️ Discrepancia salario ({compare.salaryMismatch.length})</TabsTrigger>
                    <TabsTrigger value="ok">✅ OK ({compare.matched.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="missing">
                    <ListTable
                      empty="🎉 Todos los activos están registrados en TSS."
                      headers={["Código", "Nombre", "Departamento", "Puesto", "Categoría", "Cédula", "Salario intranet"]}
                      rows={compare.missingTss.map(r => [r.employeeCode, r.fullName, r.department, r.position, r.category, r.cedula || "—", fmtRD(r.intranetSalary)])}
                    />
                  </TabsContent>
                  <TabsContent value="ghost">
                    <ListTable
                      empty="No hay registros TSS sin contrapartida activa."
                      headers={["Cédula", "Nombre", "ID NSS", "Salario reportado", "Total factura", "Estado intranet"]}
                      rows={compare.ghostTss.map(r => [r.cedula, r.fullName, r.idNss, fmtRD(r.tssReportedSalary), fmtRD(r.total), r.intranetStatus])}
                    />
                  </TabsContent>
                  <TabsContent value="mismatch">
                    <ListTable
                      empty="Salarios coinciden con lo reportado a TSS."
                      headers={["Código", "Nombre", "Departamento", "Salario intranet", "Salario TSS", "Diferencia"]}
                      rows={compare.salaryMismatch.map(r => [r.employeeCode, r.fullName, r.department, fmtRD(r.intranetSalary), fmtRD(r.tssReportedSalary), fmtRD(r.difference)])}
                    />
                  </TabsContent>
                  <TabsContent value="ok">
                    <ListTable
                      empty="Sin coincidencias."
                      headers={["Código", "Nombre", "Departamento", "Cédula", "Salario intranet", "Salario TSS", "Match"]}
                      rows={compare.matched.map(r => [r.employeeCode, r.fullName, r.department, r.cedula, fmtRD(r.intranetSalary), fmtRD(r.tssReportedSalary), r.matchType])}
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}

            {!compare && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                Importa un archivo TSS para ver el cruce con los empleados activos.
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ────────── TAB 2: Generar ────────── */}
          <TabsContent value="generate" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Parámetros de la nómina</CardTitle></CardHeader>
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
                  <p>Descuentos aplicados: AFP 2.87% (tope 4 SM), SFS 3.04% (tope 10 SM), ISR según escala DGII vigente.</p>
                </div>

                <Button onClick={handleGenerateRun} disabled={!canManage || loading} className="w-full">
                  {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                  Generar nómina
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────────── TAB 3: Runs ────────── */}
          <TabsContent value="runs" className="space-y-4">
            {runs.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Nóminas guardadas</CardTitle></CardHeader>
                <CardContent>
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={exportRunExcel}><Download className="w-4 h-4 mr-2" />Excel</Button>
                    </div>
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
                    <strong>Modo prueba:</strong> los envíos de volante se registran y se redirigen a <code>{TEST_EMAIL}</code>. Cuando se configure SMTP en el servidor, se podrá activar el envío real.
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
        </Tabs>
      </div>
      <Footer />
    </AppLayout>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number | string; color?: string; icon?: React.ReactNode }) {
  return (
    <Card>
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

function ListTable({ headers, rows, empty }: { headers: string[]; rows: any[][]; empty: string }) {
  if (!rows.length) return <Card><CardContent className="py-8 text-center text-muted-foreground">{empty}</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 0 ? "font-mono text-xs" : ""}>{c}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
