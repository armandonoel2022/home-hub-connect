/**
 * Pestaña "Tendencias" — comparativo histórico del servicio.
 *
 * Lee snapshots persistidos en backend (creados al subir reportes Kronos/Punch o
 * al cerrar el día manualmente) y los grafica para identificar mejoras o
 * desmejoras vs ayer, semana anterior, mes anterior, trimestre o año.
 *
 * Métricas: % cumplimiento ciclo (apertura+cierre), # sin señal alta,
 * % rondas Active Track, # incidencias abiertas/resueltas.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Save, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  monitoringSnapshotsApi, type MonitoringSnapshot, type MonitoringSnapshotMetrics,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type PeriodKey = "yesterday" | "week" | "month" | "quarter" | "year";

const PERIOD_LABEL: Record<PeriodKey, string> = {
  yesterday: "vs Ayer",
  week: "vs Semana anterior",
  month: "vs Mes anterior",
  quarter: "vs Trimestre anterior",
  year: "vs Año anterior",
};

type MetricKey = keyof Pick<MonitoringSnapshotMetrics,
  "compliedCyclePct" | "noSignalHigh" | "activeTrackPct" | "incidentsOpen" | "incidentsResolved">;

const METRICS: { key: MetricKey; label: string; suffix?: string; goodWhen: "up" | "down"; color: string }[] = [
  { key: "compliedCyclePct",  label: "% Ciclo cumplido",         suffix: "%", goodWhen: "up",   color: "#10b981" },
  { key: "noSignalHigh",      label: "# LX sin señal (alta)",                 goodWhen: "down", color: "#ef4444" },
  { key: "activeTrackPct",    label: "% Rondas Active Track",    suffix: "%", goodWhen: "up",   color: "#06b6d4" },
  { key: "incidentsOpen",     label: "# Incidencias abiertas",                goodWhen: "down", color: "#f59e0b" },
  { key: "incidentsResolved", label: "# Incidencias resueltas",               goodWhen: "up",   color: "#8b5cf6" },
];

function dateAddDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

function rangeFor(period: PeriodKey): { currFrom: string; prevFrom: string; prevTo: string; days: number } {
  const today = new Date();
  switch (period) {
    case "yesterday": {
      const y = dateAddDays(today, -1);
      const dby = dateAddDays(today, -2);
      return { currFrom: ymd(y), prevFrom: ymd(dby), prevTo: ymd(dby), days: 1 };
    }
    case "week": {
      const days = 7;
      return {
        currFrom: ymd(dateAddDays(today, -days)),
        prevFrom: ymd(dateAddDays(today, -days * 2)),
        prevTo: ymd(dateAddDays(today, -days - 1)),
        days,
      };
    }
    case "month":
      return { currFrom: ymd(dateAddDays(today, -30)), prevFrom: ymd(dateAddDays(today, -60)), prevTo: ymd(dateAddDays(today, -31)), days: 30 };
    case "quarter":
      return { currFrom: ymd(dateAddDays(today, -90)), prevFrom: ymd(dateAddDays(today, -180)), prevTo: ymd(dateAddDays(today, -91)), days: 90 };
    case "year":
      return { currFrom: ymd(dateAddDays(today, -365)), prevFrom: ymd(dateAddDays(today, -730)), prevTo: ymd(dateAddDays(today, -366)), days: 365 };
  }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface TrendsTabProps {
  /** Métricas actuales del día (computadas por IntegratedDashboardTab / Kronos / Punch).
   *  Usadas para el botón "Cerrar día" → guarda snapshot 'manual'. */
  liveMetrics?: MonitoringSnapshotMetrics | null;
}

export default function TrendsTab({ liveMetrics }: TrendsTabProps) {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<MonitoringSnapshot[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await monitoringSnapshotsApi.list();
      setSnapshots(list);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") toast.error(`No se pudo cargar historial: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const closeDay = async () => {
    const today = ymd(new Date());
    // 1) Si nos pasaron métricas en vivo (caso ideal), las usamos.
    // 2) Si no, intentamos consolidar los snapshots automáticos de hoy
    //    (kronos + punch) en un snapshot 'manual'.
    let metrics: MonitoringSnapshotMetrics | null = liveMetrics || null;
    if (!metrics) {
      const todays = snapshots.filter(s => s.date === today);
      if (todays.length === 0) {
        toast.error("No hay snapshots de hoy. Sube un reporte Kronos/Punch primero.");
        return;
      }
      // Combinamos: tomamos máximo por métrica (kronos aporta ciclo/sin señal,
      // punch aporta active track)
      const pick = (k: keyof MonitoringSnapshotMetrics) =>
        Math.max(...todays.map(s => Number(s.metrics[k] ?? 0)));
      metrics = {
        totalLx: pick("totalLx"), activeLx: pick("activeLx"), billableLx: pick("billableLx"),
        compliedCycle: pick("compliedCycle"), compliedCyclePct: pick("compliedCyclePct"),
        noSignalHigh: pick("noSignalHigh"),
        activeTrackTotal: pick("activeTrackTotal"),
        activeTrackComplied: pick("activeTrackComplied"),
        activeTrackPct: pick("activeTrackPct"),
        incidentsOpen: pick("incidentsOpen"), incidentsResolved: pick("incidentsResolved"),
      };
    }
    try {
      await monitoringSnapshotsApi.upsert({ date: today, source: "manual", metrics });
      toast.success(`Día cerrado · snapshot guardado por ${user?.fullName || "operador"}`);
      await load();
    } catch (e: any) {
      toast.error(`No se pudo guardar snapshot: ${e.message}`);
    }
  };

  const { currFrom, prevFrom, prevTo } = rangeFor(period);

  const { current, previous, chartData } = useMemo(() => {
    const inRange = (s: MonitoringSnapshot, from: string, to?: string) =>
      s.date >= from && (!to || s.date <= to);
    // Para el periodo actual: desde currFrom hasta hoy
    const cur = snapshots.filter(s => inRange(s, currFrom, ymd(new Date())));
    const prev = snapshots.filter(s => inRange(s, prevFrom, prevTo));
    // Promedios por métrica
    const metricsAvg = (list: MonitoringSnapshot[]): Partial<MonitoringSnapshotMetrics> => {
      const out: any = {};
      METRICS.forEach(m => { out[m.key] = avg(list.map(x => x.metrics[m.key] ?? 0)); });
      return out;
    };
    // Datos para chart (uno por día, último snapshot del día)
    const byDay = new Map<string, MonitoringSnapshot>();
    snapshots.filter(s => inRange(s, currFrom, ymd(new Date()))).forEach(s => {
      const prevS = byDay.get(s.date);
      if (!prevS || prevS.createdAt < s.createdAt) byDay.set(s.date, s);
    });
    const chart = Array.from(byDay.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({ date: s.date.slice(5), ...s.metrics }));
    return { current: metricsAvg(cur), previous: metricsAvg(prev), chartData: chart };
  }, [snapshots, currFrom, prevFrom, prevTo]);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Tendencias del servicio
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Comparativo entre periodos · {snapshots.length} snapshot(s) en historial
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map(k => (
                    <SelectItem key={k} value={k}>{PERIOD_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refrescar
              </Button>
              <Button size="sm" onClick={closeDay}
                title="Guardar snapshot del día (consolida los reportes subidos hoy)">
                <Save className="h-3.5 w-3.5 mr-1" /> Cerrar día
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {METRICS.map(m => {
          const cur = Number(current[m.key] ?? 0);
          const prev = Number(previous[m.key] ?? 0);
          const diff = cur - prev;
          const pctChange = prev !== 0 ? (diff / prev) * 100 : (cur > 0 ? 100 : 0);
          const improved = m.goodWhen === "up" ? diff > 0 : diff < 0;
          const worsened = m.goodWhen === "up" ? diff < 0 : diff > 0;
          const TrendIcon = diff === 0 ? Minus : (improved ? TrendingUp : TrendingDown);
          const trendColor = diff === 0 ? "text-muted-foreground"
            : improved ? "text-emerald-400" : "text-red-400";
          return (
            <Card key={m.key} className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold" style={{ color: m.color }}>
                    {cur.toFixed(m.key.endsWith("Pct") ? 1 : 0)}{m.suffix || ""}
                  </span>
                  <span className={`text-xs flex items-center gap-0.5 ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" />
                    {diff > 0 ? "+" : ""}{diff.toFixed(m.key.endsWith("Pct") ? 1 : 0)}{m.suffix || ""}
                    {prev !== 0 && (
                      <span className="text-muted-foreground">
                        ({pctChange > 0 ? "+" : ""}{pctChange.toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {PERIOD_LABEL[period]} · promedio anterior: {prev.toFixed(m.key.endsWith("Pct") ? 1 : 0)}{m.suffix || ""}
                </p>
                {worsened && (
                  <Badge variant="outline" className="mt-2 text-[10px] text-red-400 border-red-500/30">
                    Desmejoró
                  </Badge>
                )}
                {improved && diff !== 0 && (
                  <Badge variant="outline" className="mt-2 text-[10px] text-emerald-400 border-emerald-500/30">
                    Mejoró
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evolución por día</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no hay snapshots en este rango. Sube un reporte Kronos/Punch o usa "Cerrar día".
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="compliedCyclePct"  name="% Ciclo"          stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activeTrackPct"    name="% Active Track"   stroke="#06b6d4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="noSignalHigh"      name="Sin señal alta"   stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="incidentsOpen"     name="Incidencias abiertas" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
