/**
 * Pestaña "Punches" — analiza reportes Active Track de Kronos NET
 * con la misma mecánica de persistencia que Actividad Kronos:
 *   - se sube un .htm
 *   - se guarda en backend por fecha (kind='punches')
 *   - cualquier usuario ve el historial
 *
 * Para Spirit Apparel (naves B6/A18/A3) se valida que las rondas
 * configuradas (03:30 y 05:00, ±60min) se hayan completado.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileUp, X, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Footprints } from "lucide-react";
import { toast } from "sonner";
import { parsePunchHtmFile, type PunchParsedReport } from "@/lib/punchHtmParser";
import { monitoringReportsApi, type MonitoringReportMeta } from "@/lib/api";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "medium" });
}
function fmtTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
}

const COMPLIANCE_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  ok:        { label: "Cumplió", className: "text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  partial:   { label: "Parcial", className: "text-amber-400 border-amber-500/30", icon: AlertTriangle },
  missed:    { label: "Incumplió", className: "text-red-400 border-red-500/30", icon: XCircle },
  "no-rules":{ label: "Sin regla", className: "text-muted-foreground border-border", icon: Footprints },
};

export default function PunchActivityTab() {
  const [report, setReport] = useState<PunchParsedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MonitoringReportMeta[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [meta, setMeta] = useState<MonitoringReportMeta | null>(null);
  const [filter, setFilter] = useState<"all" | "missed" | "partial" | "ok" | "no-rules">("all");

  const loadHistory = async () => {
    try {
      const list = await monitoringReportsApi.list("punches");
      setHistory(list);
      if (!activeReportId && list.length > 0) await loadReport(list[0].id);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") console.warn("No se pudo cargar historial Punches:", e.message);
    }
  };

  const loadReport = async (id: string) => {
    setLoading(true);
    try {
      const doc = await monitoringReportsApi.get<PunchParsedReport>(id);
      setReport(doc.payload);
      setActiveReportId(doc.id);
      setMeta({ id: doc.id, kind: doc.kind, reportDate: doc.reportDate, fileName: doc.fileName, uploadedAt: doc.uploadedAt, uploadedBy: doc.uploadedBy });
    } catch (e: any) {
      toast.error(`Error al cargar reporte: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, []);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const parsed = await parsePunchHtmFile(file);
      if (parsed.clients.length === 0) {
        toast.error("No se detectaron punches. Verifica que el archivo sea el reporte Active Track de Kronos NET.");
        return;
      }
      setReport(parsed);
      try {
        const dateKey = parsed.reportDate ? parsed.reportDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const saved = await monitoringReportsApi.upsert<PunchParsedReport>({
          kind: "punches", reportDate: dateKey, fileName: file.name, payload: parsed,
        });
        setActiveReportId(saved.id);
        setMeta({ id: saved.id, kind: saved.kind, reportDate: saved.reportDate, fileName: saved.fileName, uploadedAt: saved.uploadedAt, uploadedBy: saved.uploadedBy });
        await loadHistory();
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
  } : null;

  const filtered = report ? report.clients.filter(c => filter === "all" || c.compliance === filter) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Footprints className="h-4 w-4 text-primary" /> Cargar reporte de Punches (.htm)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground flex-1 min-w-[260px]">
                Exporta desde Kronos NET → "Resumen de señales" filtrado por READ (Active Track).
                Spirit Apparel naves B6, A18 y A3 deben tener rondas a las <strong>03:30</strong> y <strong>05:00</strong>.
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
              </div>
            )}

            {report && meta && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                  {report.clients.length} clientes
                </Badge>
                <Badge variant="outline">{report.rawRowCount} punches</Badge>
                <span className="text-muted-foreground">
                  {report.reportPeriod || (report.reportDate ? `Reporte del ${new Date(report.reportDate).toLocaleString("es-DO")}` : "")}
                </span>
                <span className="text-muted-foreground">
                  · Cargado por <strong>{meta.uploadedBy}</strong> el {new Date(meta.uploadedAt).toLocaleString("es-DO")}
                </span>
                <Button size="sm" variant="ghost" className="h-6 ml-auto"
                  onClick={() => { setReport(null); setActiveReportId(null); setMeta(null); }}>
                  <X className="h-3 w-3 mr-1" /> Cerrar vista
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {report && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total clientes" value={stats.total} color="text-foreground" active={filter === "all"} onClick={() => setFilter("all")} />
            <KpiCard label="✅ Cumplió" value={stats.ok} color="text-emerald-400" active={filter === "ok"} onClick={() => setFilter("ok")} />
            <KpiCard label="⚠️ Parcial" value={stats.partial} color="text-amber-400" active={filter === "partial"} onClick={() => setFilter("partial")} />
            <KpiCard label="❌ Incumplió" value={stats.missed} color="text-red-400" active={filter === "missed"} onClick={() => setFilter("missed")} />
            <KpiCard label="Sin regla" value={stats.noRules} color="text-muted-foreground" active={filter === "no-rules"} onClick={() => setFilter("no-rules")} />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Cliente / Bastón</TableHead>
                    <TableHead className="text-center">Punches</TableHead>
                    <TableHead className="text-center">Puntos únicos</TableHead>
                    <TableHead>Primer punch</TableHead>
                    <TableHead>Último punch</TableHead>
                    <TableHead>Rondas esperadas</TableHead>
                    <TableHead>Cumplimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                  ) : filtered.map(c => {
                    const badge = COMPLIANCE_BADGE[c.compliance];
                    const Icon = badge.icon;
                    return (
                      <Collapsible key={c.accountName} asChild>
                        <>
                          <TableRow>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7"><ChevronDown className="h-4 w-4" /></Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {c.accountName}
                              <div className="text-xs text-muted-foreground font-mono">{c.accountCode}</div>
                            </TableCell>
                            <TableCell className="text-center">{c.punches.length}</TableCell>
                            <TableCell className="text-center">{c.uniquePoints.length}</TableCell>
                            <TableCell className="text-xs">{fmtDateTime(c.firstPunch)}</TableCell>
                            <TableCell className="text-xs">{fmtDateTime(c.lastPunch)}</TableCell>
                            <TableCell className="text-xs">
                              {c.expectedRounds.length === 0 ? <span className="text-muted-foreground">—</span> : (
                                <div className="flex flex-wrap gap-1">
                                  {c.expectedRounds.map(r => (
                                    <Badge key={r.time} variant="outline"
                                      className={r.matched ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}>
                                      {r.time} {r.matched ? `✓ ${fmtTime(r.matchedAt)}` : "✗"}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge.className}>
                                <Icon className="h-3 w-3 mr-1" /> {badge.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/20">
                                <div className="text-xs space-y-1 p-2 max-h-64 overflow-y-auto">
                                  <p className="font-semibold mb-2">{c.punches.length} punches registrados:</p>
                                  {c.punches.map((p, i) => (
                                    <div key={i} className="grid grid-cols-[140px_1fr_120px] gap-2">
                                      <span className="font-mono text-muted-foreground">{fmtDateTime(p.receivedAt)}</span>
                                      <span>{p.pointDescription}</span>
                                      <span className="text-muted-foreground font-mono">{p.hardware}</span>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground p-3 border-t">
                {filtered.length} de {report.clients.length} clientes
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
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
