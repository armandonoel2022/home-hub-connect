/**
 * Seguimiento por PUNTO (puesto) de Active Track.
 *
 * A diferencia de la tabla principal (que compara reportes completos), aquí el
 * usuario elige un cliente y un punto específico, y vemos la evolución de ESE
 * punto consigo mismo a lo largo de todas las fechas cargadas. Así se detecta
 * mejoría, consistencia o caídas sin mezclar puntos distintos.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import { monitoringReportsApi, type MonitoringReportMeta } from "@/lib/api";
import type { PunchParsedReport } from "@/lib/punchHtmParser";
import {
  PUNCH_CLIENTS, ALL_PUNCH_POINTS, buildPointSeries, fmtMinutes as _unused,
} from "@/lib/punchPoints";
import { fmtMinutes } from "@/lib/punchAnalytics";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
}

export default function PunchPointTracker({ history }: { history: MonitoringReportMeta[] }) {
  const [clientKey, setClientKey] = useState<string>(PUNCH_CLIENTS[0]?.key || "");
  const client = useMemo(() => PUNCH_CLIENTS.find(c => c.key === clientKey), [clientKey]);
  const [pointId, setPointId] = useState<string>("");
  const [reports, setReports] = useState<{ id: string; reportDate: string; report: PunchParsedReport }[]>([]);
  const [loading, setLoading] = useState(false);

  // Al cambiar de cliente, seleccionar su primer punto por defecto.
  useEffect(() => {
    const first = ALL_PUNCH_POINTS.find(p => p.clientKey === clientKey);
    setPointId(first?.id || "");
  }, [clientKey]);

  // Cargar todos los payloads del historial (una sola vez por lista).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (history.length === 0) { setReports([]); return; }
      setLoading(true);
      try {
        const docs = await Promise.all(
          history.map(h => monitoringReportsApi.get<PunchParsedReport>(h.id).catch(() => null)),
        );
        if (cancelled) return;
        const loaded = docs
          .filter((d): d is NonNullable<typeof d> => !!d && !!d.payload)
          .map(d => ({ id: d.id, reportDate: d.reportDate || "", report: d.payload }));
        setReports(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [history]);

  const series = useMemo(
    () => (pointId ? buildPointSeries(reports, pointId) : []),
    [reports, pointId],
  );

  const chartData = series.map(s => ({ date: s.reportDate.slice(5), punches: s.count }));
  const withData = series.filter(s => s.count > 0);
  const avgCount = withData.length
    ? Math.round((withData.reduce((a, s) => a + s.count, 0) / withData.length) * 10) / 10
    : 0;

  const pointRef = ALL_PUNCH_POINTS.find(p => p.id === pointId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-violet-400" /> Seguimiento por punto (mismo puesto en el tiempo)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={clientKey} onValueChange={setClientKey}>
              <SelectTrigger className="h-8 text-xs w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PUNCH_CLIENTS.map(c => (
                  <SelectItem key={c.key} value={c.key} className="text-xs">
                    {c.name} · {c.clientCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Punto / puesto</Label>
            <Select value={pointId} onValueChange={setPointId}>
              <SelectTrigger className="h-8 text-xs w-[240px]"><SelectValue placeholder="Seleccionar punto" /></SelectTrigger>
              <SelectContent>
                {(client?.points || []).map(p => {
                  const id = `${clientKey}::${p}`;
                  return <SelectItem key={id} value={id} className="text-xs">{p}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          {client && (
            <div className="text-[11px] text-muted-foreground pb-1">
              RNC {client.rnc} · {client.contact}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground py-4">Cargando historial…</p>
        ) : series.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Sin reportes cargados para comparar.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Fechas con datos" value={`${withData.length} / ${series.length}`} />
              <MiniStat label="Punches / día (media)" value={`${avgCount}`} />
              <MiniStat label="Último día" value={`${series[series.length - 1]?.count ?? 0} punches`} />
              <MiniStat label="Punto" value={pointRef?.point || "—"} />
            </div>

            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                  <Bar dataKey="punches" radius={[4, 4, 0, 0]} fill="#a78bfa" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Punches</TableHead>
                    <TableHead className="text-center">Δ vs día previo</TableHead>
                    <TableHead className="text-center">Bastones</TableHead>
                    <TableHead>Primer / Último</TableHead>
                    <TableHead className="text-center">Intervalo medio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((s, i) => {
                    const prev = i > 0 ? series[i - 1] : null;
                    const delta = prev ? s.count - prev.count : null;
                    return (
                      <TableRow key={s.reportId}>
                        <TableCell className="text-xs font-medium">{s.reportDate}</TableCell>
                        <TableCell className="text-center text-sm font-semibold">{s.count}</TableCell>
                        <TableCell className="text-center">
                          {delta === null ? <span className="text-muted-foreground text-xs">—</span>
                            : delta > 0 ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]"><TrendingUp className="h-3 w-3 mr-1" />+{delta}</Badge>
                            : delta < 0 ? <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]"><TrendingDown className="h-3 w-3 mr-1" />{delta}</Badge>
                            : <Badge variant="outline" className="text-muted-foreground text-[10px]"><Minus className="h-3 w-3 mr-1" />=</Badge>}
                        </TableCell>
                        <TableCell className="text-center text-xs">{s.uniqueHardware || "—"}</TableCell>
                        <TableCell className="text-xs">{fmtTime(s.firstPunch)} → {fmtTime(s.lastPunch)}</TableCell>
                        <TableCell className="text-center text-xs">{fmtMinutes(s.avgIntervalMin)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground truncate">{value}</p>
    </div>
  );
}
