import { useEffect, useMemo, useState } from "react";
import {
  generalSqlApi,
  employeesApi,
  getFileUrl,
  type GeneralPayslip,
  type GeneralPayslipsResponse,
  type GeneralPayrollPeriod,
  type GeneralEmployeePayment,
  type GeneralPaymentDetail,
  type GeneralPaymentCompare,
  type GeneralActiveEmployee,
  type Employee,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, RefreshCw, Receipt, AlertTriangle, History, ArrowLeftRight, UserX, Printer } from "lucide-react";
import { generateGeneralPayslipPDF, periodLabel } from "@/lib/generalPayslipPdf";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("es-DO") : "—");

function resolvePhoto(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/photos") || url.startsWith("/uploads")) return getFileUrl(url);
  return url;
}


/** Comprobantes de pago de gSafeOne: última nómina por defecto, con retroceso por períodos. */
export default function PayrollPayslipsPanel() {
  const [periods, setPeriods] = useState<GeneralPayrollPeriod[]>([]);
  const [periodKey, setPeriodKey] = useState<string>("last");
  const [data, setData] = useState<GeneralPayslipsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<GeneralPayslip | null>(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const [activeEmployees, setActiveEmployees] = useState<GeneralActiveEmployee[]>([]);
  const [localEmployees, setLocalEmployees] = useState<Employee[]>([]);
  const [printing, setPrinting] = useState(false);


  // Historial por empleado
  const [history, setHistory] = useState<GeneralEmployeePayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [payDetail, setPayDetail] = useState<GeneralPaymentDetail | null>(null);
  const [compare, setCompare] = useState<GeneralPaymentCompare | null>(null);
  const [selA, setSelA] = useState<number | null>(null);
  const [selB, setSelB] = useState<number | null>(null);

  const load = async (key = periodKey) => {
    setLoading(true);
    setError(null);
    try {
      const p = periods.find(x => `${x.ano}-${x.mes}-${x.periodo}` === key);
      setData(await generalSqlApi.payslips(p ? { ano: p.ano, mes: p.mes, periodo: p.periodo } : undefined));
    } catch (e: any) {
      setError(e?.message || "No se pudo consultar gSafeOne");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generalSqlApi.payrollPeriods().then(setPeriods).catch(() => setPeriods([]));
    generalSqlApi.employeesActive().then(r => setActiveEmployees(r.items || [])).catch(() => setActiveEmployees([]));
    employeesApi.getAll().then(setLocalEmployees).catch(() => setLocalEmployees([]));

    load("last");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPeriodChange = (k: string) => { setPeriodKey(k); load(k); };

  const items = data?.items || [];
  const ingresos = data?.conceptos.ingresos || [];
  const deducciones = data?.conceptos.deducciones || [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      [i.empleado, i.codigo, i.cedula, i.puesto].some(v => String(v || "").toLowerCase().includes(s))
    );
  }, [items, search]);

  /** Empleados activos que NO tienen pago en el período consultado. */
  const missing = useMemo(() => {
    const paid = new Set(items.map(i => String(i.codigo || "").trim()).filter(Boolean));
    return activeEmployees.filter(e => !paid.has(String(e.codigo || "").trim()));
  }, [items, activeEmployees]);

  const missingFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return missing;
    return missing.filter(e =>
      [e.nombreCompleto, e.codigo, e.cedula, e.puesto, e.departamento]
        .some(v => String(v || "").toLowerCase().includes(s))
    );
  }, [missing, search]);

  const openEmployee = async (row: GeneralPayslip) => {
    setDetail(row);
    setPayDetail(null); setCompare(null); setSelA(null); setSelB(null);
    if (!row.codigo) { setHistory([]); return; }
    setHistoryLoading(true);
    try {
      const h = await generalSqlApi.employeePayments(row.codigo);
      setHistory(h);
      // Selecciona el pago que corresponde a la quincena elegida arriba (no siempre el último)
      const match =
        h.find(p => p.ano === row.ano && p.mes === row.mes && p.periodo === row.periodo) || h[0];
      if (match) {
        setSelA(match.pagoOid);
        const idx = h.findIndex(p => p.pagoOid === match.pagoOid);
        setSelB(h[idx + 1]?.pagoOid ?? h[1]?.pagoOid ?? null);
        const d = await generalSqlApi.paymentDetail(row.codigo, match.pagoOid);
        setPayDetail(d);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPayDetail = async (pagoOid: number) => {
    if (!detail?.codigo) return;
    setSelA(pagoOid);
    try { setPayDetail(await generalSqlApi.paymentDetail(detail.codigo, pagoOid)); } catch { setPayDetail(null); }
  };

  const runCompare = async () => {
    if (!detail?.codigo || !selA || !selB) return;
    try { setCompare(await generalSqlApi.paymentCompare(detail.codigo, selA, selB)); } catch { setCompare(null); }
  };

  /** Genera el comprobante A4 membretado (hoja de datos + desglose) sin arrastrar la UI. */
  const printPayslip = async () => {
    if (!payDetail || !detail) return;
    setPrinting(true);
    try {
      const code = String(detail.codigo || "").trim();
      const ced = String(detail.cedula || "").replace(/\D/g, "");
      const local = localEmployees.find(e =>
        (code && String(e.employeeCode || "").trim() === code) ||
        (ced && [e.cedula, e.tss].some(v => String(v || "").replace(/\D/g, "") === ced))
      );
      const gen = activeEmployees.find(e =>
        (code && String(e.codigo || "").trim() === code) ||
        (ced && String(e.cedula || "").replace(/\D/g, "") === ced)
      );
      await generateGeneralPayslipPDF(payDetail, {
        nombre: detail.empleado || local?.fullName || gen?.nombreCompleto || "—",
        codigo: detail.codigo,
        cedula: detail.cedula || local?.cedula || gen?.cedula,
        puesto: detail.puesto || local?.position || gen?.puesto,
        departamento: local?.department || gen?.departamento,
        categoria: local?.category,
        nomina: local?.payrollType,
        fechaIngreso: local?.hireDate || gen?.fechaIngreso,
        estatus: local?.status || gen?.estatus,
        photoUrl: resolvePhoto(local?.photoUrl || local?.photo),
      }, { open: true });
    } finally {
      setPrinting(false);
    }
  };


  const exportCSV = () => {
    const headers = ["Empleado", "Código", "Cédula", "Puesto", "Fecha Pago", "Periodo", "Mes", "Año", "Nómina",
      ...ingresos, ...deducciones, "Total Devengado", "Total Deducciones", "Neto a Recibir"];
    const rows = filtered.map(i => [
      i.empleado, i.codigo, i.cedula, i.puesto, fmtDate(i.fechaPago), i.periodo, i.mes, i.ano, i.nomina,
      ...ingresos.map(c => i.ingresos[c] ?? 0),
      ...deducciones.map(c => i.deducciones[c] ?? 0),
      i.totalDevengado, i.totalDeducciones, i.neto,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comprobantes_pago_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2 mr-auto">
            <Receipt className="h-5 w-5 text-gold" />
            Comprobantes de pago (gSafeOne)
            <Badge variant="secondary">{filtered.length}</Badge>
          </h2>
          <Select value={periodKey} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last">Última nómina (último pago)</SelectItem>
              {periods.map(p => (
                <SelectItem key={`${p.ano}-${p.mes}-${p.periodo}`} value={`${p.ano}-${p.mes}-${p.periodo}`}>
                  {p.descripcion} · {fmtDate(p.fecha)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={missingOnly ? "default" : "outline"} size="sm" onClick={() => setMissingOnly(v => !v)}>
            <UserX className="h-4 w-4 mr-2" /> Sin pago ({missing.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar empleado, código, cédula o puesto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total devengado</p>
              <p className="text-lg font-bold text-green-600">{fmt(data.totals.devengado)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total deducciones</p>
              <p className="text-lg font-bold text-red-600">{fmt(data.totals.deducciones)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Neto a recibir</p>
              <p className="text-lg font-bold text-gold">{fmt(data.totals.neto)}</p>
            </CardContent></Card>
          </div>
        )}

        {missingOnly ? (
          <div className="overflow-auto max-h-[60vh] border rounded-md">
            <div className="p-3 text-xs text-muted-foreground border-b">
              Empleados activos en gSafeOne sin pago registrado en el período seleccionado. Pueden pertenecer al ciclo de
              pago de los días 7 y 22, o tratarse de una omisión que debe verificarse.
            </div>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="min-w-[220px]">Empleado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Departamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingFiltered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Todos los empleados activos tienen pago en este período</TableCell></TableRow>
                )}
                {missingFiltered.map(e => (
                  <TableRow key={e.oid}>
                    <TableCell className="font-medium">{e.nombreCompleto}</TableCell>
                    <TableCell className="font-mono text-xs">{e.codigo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.cedula || "—"}</TableCell>
                    <TableCell>{e.puesto || "—"}</TableCell>
                    <TableCell>{e.departamento || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
        <div className="overflow-auto max-h-[60vh] border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[200px]">Empleado</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Fecha pago</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Mes/Año</TableHead>
                {ingresos.map(c => <TableHead key={c} className="text-right whitespace-nowrap">{c}</TableHead>)}
                {deducciones.map(c => <TableHead key={c} className="text-right whitespace-nowrap text-red-600">{c}</TableHead>)}
                <TableHead className="text-right">Devengado</TableHead>
                <TableHead className="text-right">Deducciones</TableHead>
                <TableHead className="text-right">Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Consultando gSafeOne...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
              )}
              {filtered.map((i, idx) => (
                <TableRow key={`${i.codigo}-${idx}`} className="cursor-pointer" onClick={() => openEmployee(i)}>
                  <TableCell className="font-medium">{i.empleado}</TableCell>
                  <TableCell className="font-mono text-xs">{i.codigo || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{i.cedula || "—"}</TableCell>
                  <TableCell>{i.puesto || "—"}</TableCell>
                  <TableCell>{fmtDate(i.fechaPago)}</TableCell>
                  <TableCell>{i.periodo ?? "—"}</TableCell>
                  <TableCell>{i.mes ?? "—"}/{i.ano ?? "—"}</TableCell>
                  {ingresos.map(c => <TableCell key={c} className="text-right">{(i.ingresos[c] || 0) ? fmt(i.ingresos[c]) : "—"}</TableCell>)}
                  {deducciones.map(c => <TableCell key={c} className="text-right text-red-600">{(i.deducciones[c] || 0) ? fmt(i.deducciones[c]) : "—"}</TableCell>)}
                  <TableCell className="text-right font-semibold text-green-600">{fmt(i.totalDevengado)}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">{fmt(i.totalDeducciones)}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(i.neto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>

      {/* Detalle + historial del empleado */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-gold" /> {detail?.empleado} · {detail?.codigo}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Cédula: </span>{detail.cedula || "—"}</div>
                <div><span className="text-muted-foreground">Puesto: </span>{detail.puesto || "—"}</div>
              </div>

              {/* Historial */}
              <div>
                <p className="font-semibold mb-2 flex items-center gap-2"><History className="h-4 w-4" /> Historial de pagos</p>
                {historyLoading && <p className="text-muted-foreground">Cargando historial...</p>}
                <div className="border rounded-md overflow-auto max-h-56">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Devengado</TableHead>
                        <TableHead className="text-right">Deducciones</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-center">A / B</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map(h => (
                        <TableRow key={h.pagoOid} className={selA === h.pagoOid ? "bg-muted/60" : ""}>
                          <TableCell className="cursor-pointer" onClick={() => loadPayDetail(h.pagoOid)}>{fmtDate(h.fecha)}</TableCell>
                          <TableCell className="cursor-pointer" onClick={() => loadPayDetail(h.pagoOid)}>
                            Q{h.periodo} {h.mes}/{h.ano}
                          </TableCell>
                          <TableCell className="text-right text-green-600">{fmt(h.totalDevengado)}</TableCell>
                          <TableCell className="text-right text-red-600">{fmt(h.totalDeducciones)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(h.neto)}</TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <Button size="sm" variant={selA === h.pagoOid ? "default" : "outline"} className="h-6 px-2 mr-1" onClick={() => loadPayDetail(h.pagoOid)}>A</Button>
                            <Button size="sm" variant={selB === h.pagoOid ? "default" : "outline"} className="h-6 px-2" onClick={() => setSelB(h.pagoOid)}>B</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!historyLoading && history.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Sin pagos registrados</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Selección libre de cualquier par de quincenas */}
                <div className="flex flex-wrap items-end gap-2 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Quincena A</p>
                    <Select value={selA ? String(selA) : ""} onValueChange={(v) => loadPayDetail(Number(v))}>
                      <SelectTrigger className="w-[210px]"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {history.map(h => (
                          <SelectItem key={h.pagoOid} value={String(h.pagoOid)}>
                            Q{h.periodo} {h.mes}/{h.ano} · {fmtDate(h.fecha)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Quincena B</p>
                    <Select value={selB ? String(selB) : ""} onValueChange={(v) => setSelB(Number(v))}>
                      <SelectTrigger className="w-[210px]"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {history.map(h => (
                          <SelectItem key={h.pagoOid} value={String(h.pagoOid)}>
                            Q{h.periodo} {h.mes}/{h.ano} · {fmtDate(h.fecha)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" disabled={!selA || !selB || selA === selB} onClick={runCompare}>
                    <ArrowLeftRight className="h-4 w-4 mr-2" /> Comparar A vs B
                  </Button>
                </div>
              </div>

              {/* Comparación */}
              {compare && (
                <div>
                  <p className="font-semibold mb-2">
                    Comparación de períodos {compare.anomalias > 0 && <Badge variant="destructive" className="ml-2">{compare.anomalias} anomalías</Badge>}
                  </p>
                  <div className="border rounded-md overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="text-right">Actual (A)</TableHead>
                          <TableHead className="text-right">Anterior (B)</TableHead>
                          <TableHead className="text-right">Diferencia</TableHead>
                          <TableHead className="text-right">Variación</TableHead>
                          <TableHead>Alerta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compare.items.map(c => (
                          <TableRow key={`${c.concepto}-${c.tipo}`} className={c.anomalia ? "bg-destructive/10" : ""}>
                            <TableCell>{c.concepto}</TableCell>
                            <TableCell className="text-right">{fmt(c.actual)}</TableCell>
                            <TableCell className="text-right">{fmt(c.anterior)}</TableCell>
                            <TableCell className="text-right">{fmt(c.diferencia)}</TableCell>
                            <TableCell className="text-right">{c.variacion == null ? "—" : `${c.variacion}%`}</TableCell>
                            <TableCell>
                              {c.anomalia
                                ? <Badge variant="destructive">Anomalía</Badge>
                                : <Badge variant="secondary">Normal</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Desglose del pago seleccionado */}
              {payDetail && (
                <div>
                  <p className="font-semibold mb-1">
                    Desglose · {periodLabel(payDetail.periodo, payDetail.mes, payDetail.ano)} · pagado el {fmtDate(payDetail.fecha)}
                  </p>

                  <div className="mb-2">
                    <p className="text-green-600 font-medium">Ingresos</p>
                    {payDetail.lineas.filter(l => l.tipo === 1).map((l, k) => (
                      <div key={k} className="flex justify-between border-b border-border/50 py-1">
                        <span>{l.concepto}</span><span>{fmt(l.calculado)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-1"><span>Total devengado</span><span>{fmt(payDetail.totalDevengado)}</span></div>
                  </div>
                  <div>
                    <p className="text-red-600 font-medium">Deducciones</p>
                    {payDetail.lineas.filter(l => l.tipo !== 1).map((l, k) => (
                      <div key={k} className="flex justify-between border-b border-border/50 py-1">
                        <span>{l.concepto}</span><span>{fmt(l.calculado)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-1"><span>Total deducciones</span><span>{fmt(payDetail.totalDeducciones)}</span></div>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                    <span>Neto a recibir</span><span className="text-gold">{fmt(payDetail.neto)}</span>
                  </div>
                  <Button className="w-full mt-3" variant="outline" disabled={printing} onClick={printPayslip}>
                    <Printer className="h-4 w-4 mr-2" />
                    {printing ? "Generando comprobante..." : "Imprimir comprobante (hoja membretada)"}
                  </Button>

                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
