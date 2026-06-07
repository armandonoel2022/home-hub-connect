import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Database, TrendingUp, AlertTriangle, CheckCircle2, Upload,
  RefreshCw, Activity, Server, FileSpreadsheet, BrainCircuit, ShieldAlert,
} from "lucide-react";
import {
  generalSqlApi, type GeneralSqlStatus, type GeneralPeriod, type PayrollAnalysis,
} from "@/lib/api";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import * as XLSX from "xlsx";

const money = (n: number) =>
  "RD$ " + (Number(n) || 0).toLocaleString("es-DO", { maximumFractionDigits: 0 });

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-600",
  discrepancia: "bg-amber-500/10 text-amber-600",
  faltante_excel: "bg-red-500/10 text-red-600",
  no_reportado: "bg-purple-500/10 text-purple-600",
};
const STATUS_LABEL: Record<string, string> = {
  ok: "Conforme",
  discrepancia: "Discrepancia",
  faltante_excel: "Falta en Excel",
  no_reportado: "No reportado",
};

const PayrollAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const allowed =
    user?.department === "Recursos Humanos" ||
    user?.department === "Tecnología" ||
    user?.department === "Tecnología y Monitoreo" ||
    user?.isAdmin;

  const [status, setStatus] = useState<GeneralSqlStatus | null>(null);
  const [periods, setPeriods] = useState<GeneralPeriod[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [previous, setPrevious] = useState<string>("");
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [excelName, setExcelName] = useState<string>("");
  const [analysis, setAnalysis] = useState<PayrollAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    generalSqlApi.status().then(setStatus).catch(() =>
      setStatus({ configured: false, connected: false, message: "API no disponible" })
    );
  }, [allowed]);

  const [autoRan, setAutoRan] = useState(false);

  useEffect(() => {
    if (!status?.connected) return;
    generalSqlApi.periods().then((p) => {
      setPeriods(p);
      if (p[0]) setCurrent(String(p[0].OID));
      if (p[1]) setPrevious(String(p[1].OID));
    }).catch((e) => toast({ title: "Error al leer períodos", description: String(e.message || e), variant: "destructive" }));
  }, [status?.connected]);

  // Análisis automático: en cuanto hay último período cargado, ejecuta el
  // comparativo contra el anterior y carga los 12 meses + predicción.
  useEffect(() => {
    if (autoRan || !current) return;
    setAutoRan(true);
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!allowed) return <Navigate to="/" replace />;

  const periodLabel = (p: GeneralPeriod) => {
    const nm = p.Nomina ? `${p.Nomina} · ` : "";
    const fecha = p.Fecha ? new Date(p.Fecha).toLocaleDateString("es-DO") : `${p.Ano}-${p.Mes}`;
    return `${nm}${fecha}${p.Cerrado ? " (Cerrado)" : ""}`;
  };

  const handleExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
        // Mapea columnas flexibles: empleado, codigo, concepto, monto
        const rows = json.map((r) => {
          const keys = Object.keys(r);
          const find = (re: RegExp) => keys.find((k) => re.test(k.toLowerCase()));
          return {
            empleado: r[find(/nombre|empleado|colaborador/) || ""] ?? "",
            codigo: r[find(/codigo|código|ficha|empid/) || ""] ?? "",
            concepto: r[find(/concepto|descripcion|descripción|tipo/) || ""] ?? "",
            monto: Number(String(r[find(/monto|valor|importe|pago/) || ""]).replace(/[^0-9.-]/g, "")) || 0,
          };
        }).filter((r) => r.empleado || r.codigo);
        setExcelRows(rows);
        setExcelName(file.name);
        toast({ title: "Excel cargado", description: `${rows.length} filas de cuentas y pagos.` });
      } catch (err: any) {
        toast({ title: "Excel inválido", description: String(err.message || err), variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const runAnalysis = async () => {
    if (!current) {
      toast({ title: "Selecciona un período", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await generalSqlApi.analyze({
        current,
        previous: previous || undefined,
        excelRows,
      });
      setAnalysis(res);
      toast({ title: "Análisis completado", description: `${res.summary.anomalias} anomalías detectadas.` });
    } catch (e: any) {
      toast({ title: "Error en el análisis", description: String(e.message || e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!analysis) return [];
    return [
      ...analysis.history.map((h) => ({ label: h.label, real: h.total })),
      ...analysis.prediction.projection.map((p) => ({ label: p.label, proyeccion: p.total })),
    ];
  }, [analysis]);

  const notConfigured = status && !status.configured;
  const notConnected = status && status.configured && !status.connected;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
          {/* Encabezado */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-gold" />
                Nómina Analítica — GENERAL (gSafeOne)
              </h1>
              <p className="text-sm text-muted-foreground">
                Lectura directa de SQL Server, detección de anomalías, conciliación con Excel y predicción de costos.
              </p>
            </div>
            <Button onClick={() => generalSqlApi.status().then(setStatus)} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Probar conexión
            </Button>
          </div>

          {/* Estado de conexión */}
          <div className={`rounded-xl border p-4 mb-6 flex items-center gap-3 ${
            status?.connected ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
          }`}>
            <Server className={`h-8 w-8 ${status?.connected ? "text-emerald-600" : "text-amber-600"}`} />
            <div className="flex-1">
              <div className="font-semibold text-card-foreground">
                {status?.connected ? "Conectado a gSafeOne" : "Sin conexión a gSafeOne"}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {status?.host} {status?.database ? `· ${status.database}` : ""} {status?.auth ? `· ${status.auth} auth` : ""}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">{status?.message || "Verificando…"}</div>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              status?.writeEnabled ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"
            }`}>
              {status?.writeEnabled ? "Lectura/Escritura" : "Solo lectura"}
            </span>
          </div>

          {notConfigured && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-card-foreground flex items-center gap-2">
                <Database className="h-4 w-4" /> Conexión no configurada
              </p>
              <p>En el servidor, dentro de <code className="font-mono">/backend</code>:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Instala drivers: <code className="font-mono">npm install mssql msnodesqlv8</code></li>
                <li>Instala el <em>ODBC Driver 17 for SQL Server</em> en Windows.</li>
                <li>En <code className="font-mono">backend/.env</code> agrega <code className="font-mono">GENERAL_SQL_HOST=SAFEONE-SERVER\SQL2019</code> y <code className="font-mono">GENERAL_SQL_DB=gSafeOne</code>.</li>
                <li>Reinicia el servicio del backend.</li>
              </ol>
            </div>
          )}

          {notConnected && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> {status?.message}
            </div>
          )}

          {status?.connected && (
            <>
              {/* Controles */}
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Período actual</label>
                  <Select value={current} onValueChange={setCurrent}>
                    <SelectTrigger><SelectValue placeholder="Selecciona período" /></SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={String(p.OID)} value={String(p.OID)}>{periodLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Comparar con (anterior)</label>
                  <Select value={previous} onValueChange={setPrevious}>
                    <SelectTrigger><SelectValue placeholder="Período anterior" /></SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={String(p.OID)} value={String(p.OID)}>{periodLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Excel cuentas y pagos</label>
                  <label className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background cursor-pointer text-sm hover:bg-muted/40">
                    <Upload className="h-4 w-4 text-gold" />
                    <span className="truncate">{excelName || "Subir archivo…"}</span>
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleExcel(e.target.files[0])} />
                  </label>
                </div>
                <div className="flex items-end">
                  <Button onClick={runAnalysis} disabled={loading || !current} className="w-full gap-2">
                    <Activity className="h-4 w-4" /> {loading ? "Analizando…" : "Analizar nómina"}
                  </Button>
                </div>
              </div>

              {analysis && (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <KpiCard label="Empleados" value={String(analysis.summary.empleados)} />
                    <KpiCard label="Bruto total" value={money(analysis.summary.brutoTotal)} />
                    <KpiCard label="Neto total" value={money(analysis.summary.netoTotal)} />
                    <KpiCard label="Deducciones" value={money(analysis.summary.deduccionesTotal)} />
                    <KpiCard
                      label="Anomalías"
                      value={`${analysis.summary.anomalias}`}
                      sub={`${analysis.summary.anomaliasAltas} críticas`}
                      danger={analysis.summary.anomaliasAltas > 0}
                    />
                  </div>

                  {/* Predicción */}
                  <div className="rounded-xl border border-border bg-card p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-gold" /> Proyección de costo de nómina
                      </h2>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>Tendencia: <strong className="capitalize">{analysis.prediction.trend}</strong></span>
                        <span>Crecim. prom.: <strong>{analysis.prediction.avgGrowthPct}%</strong></span>
                        <span>Confianza (R²): <strong>{(analysis.prediction.r2 * 100).toFixed(0)}%</strong></span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => money(v)} />
                        <Legend />
                        <Bar dataKey="real" name="Histórico" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Line dataKey="proyeccion" name="Proyección" stroke="hsl(var(--gold))" strokeWidth={2} strokeDasharray="5 5" dot />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Anomalías */}
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2 mb-4">
                        <AlertTriangle className="h-5 w-5 text-amber-500" /> Anomalías detectadas
                      </h2>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto">
                        {analysis.anomalies.length === 0 ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sin anomalías. Nómina consistente.
                          </p>
                        ) : analysis.anomalies.map((a, i) => (
                          <div key={i} className={`rounded-lg border p-3 text-sm ${SEVERITY_STYLE[a.severity]}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{a.empleado || a.codigo}</span>
                              <span className="text-[10px] uppercase tracking-wide font-bold">{a.type}</span>
                            </div>
                            <p className="text-xs mt-1 opacity-90">{a.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conciliación Excel */}
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h2 className="font-heading font-bold text-card-foreground flex items-center gap-2 mb-2">
                        <FileSpreadsheet className="h-5 w-5 text-gold" /> Conciliación horas extras / feriados
                      </h2>
                      {!excelName ? (
                        <p className="text-sm text-muted-foreground">Sube el Excel de cuentas y pagos para validar lo reportado.</p>
                      ) : (
                        <>
                          <div className="flex gap-2 flex-wrap text-xs mb-3">
                            <Pill className="bg-emerald-500/10 text-emerald-600">{analysis.reconciliation.summary.ok} conformes</Pill>
                            <Pill className="bg-amber-500/10 text-amber-600">{analysis.reconciliation.summary.discrepancia} discrepancias</Pill>
                            <Pill className="bg-red-500/10 text-red-600">{analysis.reconciliation.summary.faltanteExcel} faltan en Excel</Pill>
                            <Pill className="bg-purple-500/10 text-purple-600">{analysis.reconciliation.summary.noReportado} no reportados</Pill>
                          </div>
                          <div className="overflow-x-auto max-h-[360px]">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-card">
                                <tr className="text-left text-muted-foreground border-b border-border">
                                  <th className="py-2 pr-2">Empleado</th>
                                  <th className="py-2 px-2 text-right">Extra rep.</th>
                                  <th className="py-2 px-2 text-right">Extra Excel</th>
                                  <th className="py-2 px-2 text-right">Feriado rep.</th>
                                  <th className="py-2 px-2 text-right">Feriado Excel</th>
                                  <th className="py-2 pl-2">Estado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {analysis.reconciliation.rows.map((r, i) => (
                                  <tr key={i} className="hover:bg-muted/30">
                                    <td className="py-1.5 pr-2 font-medium">{r.empleado}</td>
                                    <td className="py-1.5 px-2 text-right">{money(r.reportadoExtra)}</td>
                                    <td className="py-1.5 px-2 text-right">{money(r.excelExtra)}</td>
                                    <td className="py-1.5 px-2 text-right">{money(r.reportadoFeriado)}</td>
                                    <td className="py-1.5 px-2 text-right">{money(r.excelFeriado)}</td>
                                    <td className="py-1.5 pl-2">
                                      <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[r.status]}`}>
                                        {STATUS_LABEL[r.status]}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

const KpiCard = ({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) => (
  <div className={`rounded-xl border p-4 bg-card ${danger ? "border-red-500/40" : "border-border"}`}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-xl font-heading font-bold ${danger ? "text-red-600" : "text-card-foreground"}`}>{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
  </div>
);

const Pill = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={`px-2 py-1 rounded-full font-semibold ${className}`}>{children}</span>
);

export default PayrollAnalytics;
