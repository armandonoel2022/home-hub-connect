/**
 * Pestaña "Punches" — analiza reportes Active Track de Kronos NET.
 *
 * Persistencia:
 *   - Reportes guardados en backend por fecha (kind='punches').
 *   - Reglas de rondas por cliente en `/api/monitoring-punch-rules`. Las reglas
 *     se aplican en el cliente con `evaluatePunchReport()` para que cualquier
 *     cambio en reglas se refleje sin reprocesar el HTM.
 *
 * Para cada ronda se reporta:
 *   - matched: dentro de toleranceMin
 *   - precise: dentro de precisionMin (±10min por defecto)
 *   - deviationMin: minutos con signo respecto al objetivo (-5, +12, etc.)
 */
import { useEffect, useMemo, useState } from "react";
import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileUp, X, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight,
  Footprints, Settings2, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  parsePunchHtmFile, evaluatePunchReport, mergePunchReports,
  type PunchParsedReport, type ExpectedRound, type PunchClientSummary,
} from "@/lib/punchHtmParser";
import {
  analyzePunchTiming, diffPunchReports, fmtMinutes,
  type PunchDiff, type PunchChange,
} from "@/lib/punchAnalytics";
import type { KronosParsedReport } from "@/lib/kronosHtmParser";
import {
  monitoringReportsApi, punchRulesApi, monitoringAccountSettingsApi,
  type MonitoringReportMeta, type PunchRule, type PunchRoundConfig, type MonitoringAccountSetting,
} from "@/lib/api";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "medium" });
}
function fmtTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
}
function fmtDeviation(min?: number): string {
  if (min === undefined) return "";
  if (min === 0) return "exacto";
  const sign = min > 0 ? "+" : "−";
  return `${sign}${Math.abs(min)} min`;
}

const COMPLIANCE_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  ok:        { label: "Cumplió", className: "text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  partial:   { label: "Parcial", className: "text-amber-400 border-amber-500/30", icon: AlertTriangle },
  missed:    { label: "Incumplió", className: "text-red-400 border-red-500/30", icon: XCircle },
  "no-rules":{ label: "Sin regla", className: "text-muted-foreground border-border", icon: Footprints },
};

function RoundBadge({ r }: { r: ExpectedRound }) {
  if (!r.matched) {
    return <Badge variant="outline" className="text-red-400 border-red-500/30">{r.time} ✗</Badge>;
  }
  const cls = r.precise
    ? "text-emerald-400 border-emerald-500/30"
    : "text-amber-400 border-amber-500/30";
  return (
    <Badge variant="outline" className={cls} title={`${r.matchedPoint || ""} @ ${fmtTime(r.matchedAt)}`}>
      {r.time} {r.precise ? "✓" : "≈"} {fmtTime(r.matchedAt)}
      {r.deviationMin !== undefined && r.deviationMin !== 0 && (
        <span className="ml-1 text-[10px] opacity-80">({fmtDeviation(r.deviationMin)})</span>
      )}
    </Badge>
  );
}

export default function PunchActivityTab() {
  const [rawReport, setRawReport] = useState<PunchParsedReport | null>(null);
  const [rules, setRules] = useState<PunchRule[]>([]);
  const [settings, setSettings] = useState<Record<string, MonitoringAccountSetting>>({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MonitoringReportMeta[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [meta, setMeta] = useState<MonitoringReportMeta | null>(null);
  const [prevReport, setPrevReport] = useState<PunchParsedReport | null>(null);
  const [compareReportId, setCompareReportId] = useState<string | null>(null);
  const [kronosReport, setKronosReport] = useState<KronosParsedReport | null>(null);
  const [kronosMeta, setKronosMeta] = useState<MonitoringReportMeta | null>(null);
  const [filter, setFilter] = useState<"all" | "missed" | "partial" | "ok" | "no-rules" | "baton">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rulesOpen, setRulesOpen] = useState(false);

  const toggleExpand = (k: string) => setExpanded(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const loadRules = async () => {
    try { setRules(await punchRulesApi.list()); }
    catch (e: any) { if (e.message !== "API_NOT_CONFIGURED") console.warn("Reglas:", e.message); }
  };
  const loadSettings = async () => {
    try {
      const list = await monitoringAccountSettingsApi.list();
      const m: Record<string, MonitoringAccountSetting> = {};
      list.forEach(s => { m[s.accountCode] = s; });
      setSettings(m);
    } catch (e: any) { if (e.message !== "API_NOT_CONFIGURED") console.warn("Settings:", e.message); }
  };

  const loadHistory = async () => {
    try {
      const list = await monitoringReportsApi.list("punches");
      setHistory(list);
      if (!activeReportId && list.length > 0) await loadReport(list[0].id, list);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") console.warn("Historial Punches:", e.message);
    }
  };

  /** Carga el reporte inmediatamente anterior (por fecha) para comparar. */
  const loadComparison = async (currentId: string, histList: MonitoringReportMeta[]) => {
    const sorted = [...histList].sort((a, b) => (b.reportDate || "").localeCompare(a.reportDate || ""));
    const idx = sorted.findIndex(h => h.id === currentId);
    const prevMeta = idx >= 0 ? sorted.slice(idx + 1).find(h => h.id !== currentId) : undefined;
    if (!prevMeta) { setPrevReport(null); setCompareReportId(null); return; }
    try {
      const prevDoc = await monitoringReportsApi.get<PunchParsedReport>(prevMeta.id);
      setPrevReport(prevDoc.payload);
      setCompareReportId(prevDoc.id);
    } catch { setPrevReport(null); setCompareReportId(null); }
  };

  const changeComparison = async (id: string) => {
    if (id === "none") { setPrevReport(null); setCompareReportId(null); return; }
    try {
      const prevDoc = await monitoringReportsApi.get<PunchParsedReport>(id);
      setPrevReport(prevDoc.payload);
      setCompareReportId(prevDoc.id);
    } catch (e: any) { toast.error(`No se pudo cargar el reporte de comparación: ${e.message}`); }
  };

  const loadReport = async (id: string, histList?: MonitoringReportMeta[]) => {
    setLoading(true);
    try {
      const doc = await monitoringReportsApi.get<PunchParsedReport>(id);
      setRawReport(doc.payload);
      setActiveReportId(doc.id);
      setMeta({ id: doc.id, kind: doc.kind, reportDate: doc.reportDate, fileName: doc.fileName, uploadedAt: doc.uploadedAt, uploadedBy: doc.uploadedBy });
      await loadComparison(doc.id, histList || history);
    } catch (e: any) {
      toast.error(`Error al cargar reporte: ${e.message}`);
    } finally { setLoading(false); }
  };

  const loadLatestKronos = async () => {
    try {
      const list = await monitoringReportsApi.list("kronos");
      if (list.length === 0) return;
      const latest = list[0];
      const doc = await monitoringReportsApi.get<KronosParsedReport>(latest.id);
      setKronosReport(doc.payload);
      setKronosMeta({ id: doc.id, kind: doc.kind, reportDate: doc.reportDate, fileName: doc.fileName, uploadedAt: doc.uploadedAt, uploadedBy: doc.uploadedBy });
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") console.warn("Kronos p/Punches:", e.message);
    }
  };

  useEffect(() => { loadRules(); loadSettings(); loadHistory(); loadLatestKronos(); /* eslint-disable-next-line */ }, []);

  /** Códigos de cuenta marcados como Active Track en Actividad Kronos.
   *  Incluye: (a) LX con serviceType="Active Track" directamente,
   *           (b) TODAS las LX que comparten clientId con alguna LX bastón
   *               (fallback por cliente facturable). */
  const batonCodes = useMemo(() => {
    const s = new Set<string>();
    const clientIdsWithBaton = new Set<string>();
    Object.values(settings).forEach(st => {
      if (st.serviceType === "Active Track") {
        s.add(st.accountCode);
        if (st.clientId) clientIdsWithBaton.add(st.clientId);
      }
    });
    Object.values(settings).forEach(st => {
      if (st.clientId && clientIdsWithBaton.has(st.clientId)) s.add(st.accountCode);
    });
    return s;
  }, [settings]);

  // Reevaluar cuando cambien las reglas o el reporte
  const baseReport = useMemo(() => rawReport ? evaluatePunchReport(rawReport, rules) : null, [rawReport, rules]);

  /** Cuentas Active Track detectadas en el último reporte de Actividad Kronos
   *  que NO tienen punches en el reporte cargado. Se agregan para no tener
   *  que ingresarlas a mano y para ver su última señal. */
  const kronosActiveTrack = useMemo<PunchClientSummary[]>(() => {
    if (!kronosReport) return [];
    const present = new Set((baseReport?.clients || []).map(c => c.accountCode.trim()));
    return kronosReport.rows
      .filter(r => batonCodes.has(r.accountCode.trim()) && !present.has(r.accountCode.trim()))
      .map(r => ({
        accountCode: r.accountCode,
        accountName: r.accountName,
        punches: [],
        uniquePoints: [],
        firstPunch: null,
        lastPunch: r.lastSignal,
        expectedRounds: [],
        compliance: "no-rules" as const,
        source: "kronos" as const,
        kronosDaysSince: r.daysSince,
        kronosCrit: r.criticidad === "ok" ? "ok" : r.criticidad,
      }));
  }, [kronosReport, baseReport, batonCodes]);

  // Reporte visible = punches cargados + Active Track derivados de Kronos
  const report = useMemo(() => {
    if (!baseReport) return null;
    const withSource = baseReport.clients.map(c => ({ ...c, source: c.source ?? ("punch-report" as const) }));
    return { ...baseReport, clients: [...withSource, ...kronosActiveTrack] };
  }, [baseReport, kronosActiveTrack]);

  // Media de tiempos de las rondas (Active Track) del reporte actual.
  const timing = useMemo(() => analyzePunchTiming(report), [report]);

  // Comparación contra el reporte anterior (o el elegido manualmente).
  const prevEvaluated = useMemo(() => (prevReport ? evaluatePunchReport(prevReport, rules) : null), [prevReport, rules]);
  const diff: PunchDiff = useMemo(() => diffPunchReports(prevEvaluated, report), [prevEvaluated, report]);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const parsed = await parsePunchHtmFile(file);
      if (parsed.clients.length === 0) {
        toast.error("No se detectaron punches. Verifica que el archivo sea el reporte Active Track de Kronos NET.");
        return;
      }
      setRawReport(parsed);
      try {
        const dateKey = parsed.reportDate ? parsed.reportDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const saved = await monitoringReportsApi.upsert<PunchParsedReport>({
          kind: "punches", reportDate: dateKey, fileName: file.name, payload: parsed,
        });
        setActiveReportId(saved.id);
        setMeta({ id: saved.id, kind: saved.kind, reportDate: saved.reportDate, fileName: saved.fileName, uploadedAt: saved.uploadedAt, uploadedBy: saved.uploadedBy });
        const freshList = await monitoringReportsApi.list("punches");
        setHistory(freshList);
        await loadComparison(saved.id, freshList);
        toast.success(`Reporte guardado (${parsed.clients.length} clientes, ${parsed.rawRowCount} punches)`);
      } catch (e: any) {
        if (e.message === "API_NOT_CONFIGURED") toast.warning("Backend no configurado: el reporte solo es visible en esta sesión");
        else toast.error(`Reporte cargado pero no se pudo guardar: ${e.message}`);
      }
    } catch (e: any) {
      toast.error(`Error al procesar archivo: ${e.message}`);
    } finally { setLoading(false); }
  };

  const stats = report ? {
    total: report.clients.length,
    ok: report.clients.filter(c => c.compliance === "ok").length,
    partial: report.clients.filter(c => c.compliance === "partial").length,
    missed: report.clients.filter(c => c.compliance === "missed").length,
    noRules: report.clients.filter(c => c.compliance === "no-rules").length,
    baton: report.clients.filter(c => batonCodes.has(c.accountCode)).length,
  } : null;

  const filtered = report ? report.clients.filter(c => {
    if (filter === "baton") return batonCodes.has(c.accountCode);
    return filter === "all" || c.compliance === filter;
  }) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Footprints className="h-4 w-4 text-primary" /> Cargar reporte de Punches (.htm)
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setRulesOpen(true)}>
            <Settings2 className="h-3 w-3 mr-2" /> Reglas ({rules.length})
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground flex-1 min-w-[260px]">
                Exporta desde Kronos NET → "Resumen de señales" filtrado por READ (Active Track).
                Las reglas de rondas se gestionan desde el botón superior y se aplican
                automáticamente a los reportes cargados.
              </p>
              <label>
                <input type="file" accept=".htm,.html" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
                <Button size="sm" variant="default" disabled={loading} asChild>
                  <span className="cursor-pointer">
                    <FileUp className="h-3 w-3 mr-2" />
                    {loading ? "Procesando..." : report ? "Cargar nuevo reporte" : "Seleccionar archivo .htm"}
                  </span>
                </Button>
              </label>
            </div>

            {history.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                <Label className="text-xs whitespace-nowrap">Historial:</Label>
                <Select value={activeReportId || ""} onValueChange={loadReport}>
                  <SelectTrigger className="w-[300px] h-8 text-xs">
                    <SelectValue placeholder="Seleccionar reporte..." />
                  </SelectTrigger>
                  <SelectContent>
                    {history.map(h => (
                      <SelectItem key={h.id} value={h.id} className="text-xs">
                        {h.reportDate} · {h.fileName || "reporte"} · {h.uploadedBy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{history.length} reportes guardados</span>
                <Label className="text-xs whitespace-nowrap ml-2">Comparar con:</Label>
                <Select value={compareReportId || "none"} onValueChange={changeComparison}>
                  <SelectTrigger className="w-[260px] h-8 text-xs">
                    <SelectValue placeholder="Sin comparación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Sin comparación</SelectItem>
                    {history.filter(h => h.id !== activeReportId).map(h => (
                      <SelectItem key={h.id} value={h.id} className="text-xs">
                        {h.reportDate} · {h.fileName || "reporte"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {report && meta && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">{report.clients.length} clientes</Badge>
                <Badge variant="outline">{report.rawRowCount} punches</Badge>
                <span className="text-muted-foreground">
                  {report.reportPeriod || (report.reportDate ? `Reporte del ${new Date(report.reportDate).toLocaleString("es-DO")}` : "")}
                </span>
                <span className="text-muted-foreground">
                  · Cargado por <strong>{meta.uploadedBy}</strong> el {new Date(meta.uploadedAt).toLocaleString("es-DO")}
                </span>
                <Button size="sm" variant="ghost" className="h-6 ml-auto"
                  onClick={() => { setRawReport(null); setActiveReportId(null); setMeta(null); }}>
                  <X className="h-3 w-3 mr-1" /> Cerrar vista
                </Button>
              </div>
            )}

            {report && kronosActiveTrack.length > 0 && (
              <div className="flex items-start gap-2 pt-2 border-t border-border/50 text-xs text-amber-500">
                <Footprints className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Se agregaron <strong>{kronosActiveTrack.length}</strong> cuentas Active Track detectadas en
                  Actividad Kronos{kronosMeta ? ` (reporte del ${kronosMeta.reportDate})` : ""} que aún no tienen punches.
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {report && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KpiCard label="Total clientes" value={stats.total} color="text-foreground" active={filter === "all"} onClick={() => setFilter("all")} />
            <KpiCard label="✅ Cumplió" value={stats.ok} color="text-emerald-400" active={filter === "ok"} onClick={() => setFilter("ok")} />
            <KpiCard label="⚠️ Parcial" value={stats.partial} color="text-amber-400" active={filter === "partial"} onClick={() => setFilter("partial")} />
            <KpiCard label="❌ Incumplió" value={stats.missed} color="text-red-400" active={filter === "missed"} onClick={() => setFilter("missed")} />
            <KpiCard label="Sin regla" value={stats.noRules} color="text-muted-foreground" active={filter === "no-rules"} onClick={() => setFilter("no-rules")} />
            <KpiCard label="🛰️ Active Track" value={stats.baton} color="text-cyan-400" active={filter === "baton"} onClick={() => setFilter("baton")} />
          </div>

          {/* Media de tiempos de rondas (Active Track) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="h-4 w-4 text-cyan-400" /> Media de tiempos de rondas (Active Track)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-0">
              <MiniStat label="Punches / cuenta (media)" value={`${timing.avgPunchesPerClient}`} />
              <MiniStat label="Intervalo medio entre punches" value={fmtMinutes(timing.avgIntervalMin)} />
              <MiniStat label="Hora media de los punches" value={timing.avgTimeOfDay || "—"} />
              <MiniStat label="Total punches / cuentas activas" value={`${timing.totalPunches} / ${timing.totalClients}`} />
            </CardContent>
          </Card>

          {/* Comparación con reporte anterior */}
          {diff.hasPrev && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="↑ Mejoraron" value={diff.better.length} color="text-emerald-400" active={false} onClick={() => {}} />
              <KpiCard label="↓ Empeoraron" value={diff.worse.length} color="text-red-400" active={false} onClick={() => {}} />
              <KpiCard label="● Nuevas cuentas" value={diff.added.length} color="text-cyan-400" active={false} onClick={() => {}} />
              <KpiCard label="Dejaron de aparecer" value={diff.gone.length} color="text-muted-foreground" active={false} onClick={() => {}} />
            </div>
          )}


          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Cliente / Active Track</TableHead>
                    <TableHead className="text-center">Punches</TableHead>
                    {diff.hasPrev && <TableHead className="text-center">Δ</TableHead>}
                    <TableHead className="text-center">Puntos</TableHead>
                    <TableHead>Primer / Último</TableHead>
                    <TableHead>Rondas esperadas</TableHead>
                    <TableHead>Cumplimiento</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={diff.hasPrev ? 9 : 8} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                  ) : filtered.map(c => {
                    const badge = COMPLIANCE_BADGE[c.compliance];
                    const Icon = badge.icon;
                    const isOpen = expanded.has(c.accountName);
                    return (
                      <Fragment key={c.accountName}>
                        <TableRow>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpand(c.accountName)}>
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{c.accountName}</span>
                              {batonCodes.has(c.accountCode) && (
                                <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 text-[10px]">🛰️ Active Track</Badge>
                              )}
                              {c.source === "kronos" && (
                                <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
                                  desde Kronos · sin punches{typeof c.kronosDaysSince === "number" ? ` · ${c.kronosDaysSince}d s/señal` : ""}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{c.accountCode}</div>
                            {c.ruleLabel && <div className="text-[10px] text-primary mt-0.5">{c.ruleLabel}</div>}
                          </TableCell>
                          <TableCell className="text-center">{c.punches.length}</TableCell>
                          {diff.hasPrev && (
                            <TableCell className="text-center">
                              <DeltaBadge change={diff.byCode.get((c.accountCode || c.accountName).trim())} />
                            </TableCell>
                          )}
                          <TableCell className="text-center">{c.uniquePoints.length}</TableCell>
                          <TableCell className="text-xs">
                            <div>{fmtDateTime(c.firstPunch)}</div>
                            <div className="text-muted-foreground">{fmtDateTime(c.lastPunch)}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {c.expectedRounds.length === 0 ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => { setRulesOpen(true); }}>
                                <Plus className="h-3 w-3 mr-1" /> Definir regla
                              </Button>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {c.expectedRounds.map(r => <RoundBadge key={r.time} r={r} />)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badge.className}>
                              <Icon className="h-3 w-3 mr-1" /> {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/20">
                              <div className="text-xs space-y-1 p-2 max-h-64 overflow-y-auto">
                                <p className="font-semibold mb-2">{c.punches.length} punches registrados:</p>
                                {c.punches.map((p, i) => (
                                  <div key={i} className="grid grid-cols-[160px_1fr_120px] gap-2">
                                    <span className="font-mono text-muted-foreground">{fmtDateTime(p.receivedAt)}</span>
                                    <span>{p.pointDescription}</span>
                                    <span className="text-muted-foreground font-mono">{p.hardware}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground p-3 border-t">
                {filtered.length} de {report.clients.length} clientes ·
                ✓ preciso (±{rules[0]?.rounds[0]?.precisionMin ?? 10}min) ·
                ≈ con desviación ·
                ✗ no se hizo
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <RulesManager open={rulesOpen} onOpenChange={setRulesOpen} rules={rules} reload={loadRules} />
    </div>
  );
}

// ───────────────── Rules manager dialog ─────────────────

function emptyRound(): PunchRoundConfig { return { time: "03:30", toleranceMin: 60, precisionMin: 10 }; }

function RulesManager({ open, onOpenChange, rules, reload }: {
  open: boolean; onOpenChange: (b: boolean) => void; rules: PunchRule[]; reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<PunchRule | null>(null);
  const [draft, setDraft] = useState<{ id?: string; clientPattern: string; label: string; rounds: PunchRoundConfig[]; active: boolean }>({
    clientPattern: "", label: "", rounds: [emptyRound()], active: true,
  });
  const isNew = !draft.id;

  const startNew = () => { setEditing(null); setDraft({ clientPattern: "", label: "", rounds: [emptyRound()], active: true }); };
  const startEdit = (r: PunchRule) => {
    setEditing(r);
    setDraft({ id: r.id, clientPattern: r.clientPattern, label: r.label, rounds: r.rounds.map(x => ({ ...x })), active: r.active });
  };

  const save = async () => {
    if (!draft.clientPattern.trim() || draft.rounds.length === 0) {
      toast.error("Patrón y al menos una ronda son obligatorios");
      return;
    }
    try {
      if (draft.id) {
        await punchRulesApi.update(draft.id, draft);
        toast.success("Regla actualizada");
      } else {
        await punchRulesApi.create(draft);
        toast.success("Regla creada");
      }
      await reload();
      startNew();
    } catch (e: any) {
      if (e.message === "API_NOT_CONFIGURED") toast.error("Backend no configurado");
      else toast.error(`Error: ${e.message}`);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    try { await punchRulesApi.remove(id); await reload(); toast.success("Regla eliminada"); }
    catch (e: any) { toast.error(`Error: ${e.message}`); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Reglas de rondas (Punches)
          </DialogTitle>
          <DialogDescription>
            Cada regla aplica a los clientes cuyo nombre contenga el patrón.
            Una ronda se considera <strong>cumplida</strong> si hay un punch dentro de la
            tolerancia, y <strong>precisa</strong> si está dentro de la precisión.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de reglas */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patrón / Etiqueta</TableHead>
                <TableHead>Rondas</TableHead>
                <TableHead className="text-center w-[80px]">Activa</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-xs">Sin reglas</TableCell></TableRow>
              ) : rules.map(r => (
                <TableRow key={r.id} className={editing?.id === r.id ? "bg-primary/5" : ""}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">contiene: "{r.clientPattern}"</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.rounds.map(rd => `${rd.time} (±${rd.toleranceMin}m, ✓±${rd.precisionMin}m)`).join(" · ")}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.active ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Sí</Badge>
                              : <Badge variant="outline" className="text-muted-foreground">No</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => remove(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Editor */}
        <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{isNew ? "Nueva regla" : `Editando: ${editing?.label}`}</h4>
            {!isNew && <Button size="sm" variant="ghost" onClick={startNew}>+ Nueva</Button>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Patrón (texto a buscar en el nombre)</Label>
              <Input value={draft.clientPattern} placeholder="Ej: SPIRIT, PLAZA AMERICAS, NAVE B6"
                onChange={e => setDraft(d => ({ ...d, clientPattern: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Etiqueta</Label>
              <Input value={draft.label} placeholder="Ej: Spirit Apparel — naves B6/A18/A3"
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Rondas esperadas</Label>
              <Button size="sm" variant="outline" className="h-7"
                onClick={() => setDraft(d => ({ ...d, rounds: [...d.rounds, emptyRound()] }))}>
                <Plus className="h-3 w-3 mr-1" /> Añadir ronda
              </Button>
            </div>
            <div className="space-y-2">
              {draft.rounds.map((rd, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Hora</Label>
                    <Input type="time" value={rd.time}
                      onChange={e => setDraft(d => { const r = [...d.rounds]; r[i] = { ...r[i], time: e.target.value }; return { ...d, rounds: r }; })} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Tolerancia ±min</Label>
                    <Input type="number" min={1} value={rd.toleranceMin}
                      onChange={e => setDraft(d => { const r = [...d.rounds]; r[i] = { ...r[i], toleranceMin: +e.target.value }; return { ...d, rounds: r }; })} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Precisión ±min</Label>
                    <Input type="number" min={1} value={rd.precisionMin}
                      onChange={e => setDraft(d => { const r = [...d.rounds]; r[i] = { ...r[i], precisionMin: +e.target.value }; return { ...d, rounds: r }; })} />
                  </div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400"
                    onClick={() => setDraft(d => ({ ...d, rounds: d.rounds.filter((_, j) => j !== i) }))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={draft.active} onCheckedChange={v => setDraft(d => ({ ...d, active: v }))} />
            <Label className="text-xs">Activa</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={save}>{isNew ? "Crear regla" : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ label, value, color, active, onClick }: {
  label: string; value: number; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <Card className={`cursor-pointer transition ${active ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={onClick}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function DeltaBadge({ change }: { change?: PunchChange }) {
  if (!change) return <span className="text-muted-foreground text-xs">—</span>;
  if (change.direction === "new")
    return <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 text-[10px]">● nueva</Badge>;
  if (change.direction === "gone")
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">✗ no aparece</Badge>;
  const d = change.deltaCount;
  const deltaTxt = d !== null && d !== 0 ? ` ${d > 0 ? "+" : ""}${d}` : "";
  if (change.direction === "worse")
    return <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]"><TrendingDown className="h-3 w-3 mr-1" />peor{deltaTxt}</Badge>;
  if (change.direction === "better")
    return <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]"><TrendingUp className="h-3 w-3 mr-1" />mejor{deltaTxt}</Badge>;
  return <span className="text-muted-foreground text-xs">=</span>;
}

