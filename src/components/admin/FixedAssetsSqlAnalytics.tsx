import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, RefreshCw, Database, AlertTriangle, Download, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fixedAssetsSqlApi, isApiConfigured, type FixedAssetsAnalytics } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Props { onBack: () => void }

const COLORS = [
  "hsl(42 100% 50%)", "hsl(220 70% 50%)", "hsl(142 70% 45%)", "hsl(0 70% 55%)",
  "hsl(280 60% 55%)", "hsl(190 70% 45%)", "hsl(25 85% 55%)", "hsl(330 65% 55%)",
];

const money = (n: any) =>
  n == null ? "—" : Number(n).toLocaleString("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 });
const num = (n: any) => (n == null ? "—" : Number(n).toLocaleString("es-DO"));
const date = (s: any) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-DO");
};

const csv = (rows: any[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
};
const downloadCsv = (name: string, rows: any[]) => {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

function Kpi({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "warn" | "good" }) {
  const border = tone === "warn" ? "border-destructive/40" : tone === "good" ? "border-primary/40" : "";
  return (
    <div className={`border rounded-xl p-4 bg-card ${border}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function DataTable({ rows, max = 100, onRowClick }: { rows: any[]; max?: number; onRowClick?: (r: any) => void }) {
  if (!rows?.length) return <p className="p-6 text-sm text-muted-foreground text-center">Sin registros.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-auto max-h-[480px]">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>{cols.map(c => <th key={c} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr
              key={i}
              className={`border-t hover:bg-muted/30 ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {cols.map(c => (
                <td key={c} className="px-3 py-2 whitespace-nowrap">
                  {/Costo|Valor|Total|Monto|Promedio|Invertido/i.test(c)
                    ? money(r[c])
                    : /Fecha|Compra/i.test(c)
                      ? date(r[c])
                      : String(r[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FixedAssetsSqlAnalytics({ onBack }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<FixedAssetsAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<{ title: string; params: Record<string, any> } | null>(null);

  const load = async () => {
    if (!isApiConfigured()) {
      toast({ title: "API no configurada", description: "Configura VITE_API_URL para leer la base SafeOne.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fixedAssetsSqlApi.analytics();
      setData(res);
      const errs = Object.keys(res.errors || {});
      if (errs.length) toast({ title: "Algunas consultas no aplican", description: `Tablas no disponibles: ${errs.join(", ")}` });
    } catch (e: any) {
      toast({ title: "Error al leer SafeOne", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const r = data?.resumen;
  const q = data?.calidad;

  const catChart = useMemo(() => {
    const agg: Record<string, number> = {};
    (data?.categorias || []).forEach((c: any) => {
      agg[c.Categoria] = (agg[c.Categoria] || 0) + Number(c.ValorTotal || 0);
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data]);

  const deptChart = useMemo(() => {
    const agg: Record<string, number> = {};
    (data?.departamentos || []).forEach((d: any) => {
      agg[d.Departamento] = (agg[d.Departamento] || 0) + Number(d.ValorTotal || 0);
    });
    return Object.entries(agg).map(([name, valor]) => ({ name, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [data]);

  const antiguedadChart = useMemo(
    () => [...(data?.antiguedad || [])].reverse().map((a: any) => ({
      anio: a.AnioAdquisicion, valor: Number(a.ValorTotal || 0), cantidad: a.Cantidad,
    })),
    [data]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Button onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar desde SafeOne
        </Button>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" /> Analítica de Activo Fijo (SafeOne)
        </h2>
        <p className="text-sm text-muted-foreground">
          Lectura directa de <code>[SafeOne].[dbo].[ActivoFijo]</code> y sus tablas relacionadas (Suplidor, AFCategoria, AFTipo,
          MovimientoActivo, DepreciacionD). Solo lectura.
          {data && <> · Actualizado {new Date(data.generatedAt).toLocaleString("es-DO")}</>}
        </p>
      </div>

      {!data && !loading && (
        <div className="border rounded-xl p-8 text-center bg-card text-sm text-muted-foreground">
          Sin datos aún. Presiona “Actualizar desde SafeOne”.
        </div>
      )}

      {data && (
        <>
          {/* Resumen ejecutivo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi label="Valor total inventario" value={money(r?.ValorTotalInventario)} hint={`Promedio ${money(r?.ValorPromedioActivo)}`} tone="good" />
            <Kpi label="Activos vigentes" value={num(r?.ActivosActivos)} hint={`${num(r?.ActivosRetirados)} retirados`} />
            <Kpi label="Sin serial" value={num(r?.SinSerial)} hint="Trazabilidad en riesgo" tone="warn" />
            <Kpi label="Sin encargado" value={num(r?.SinEncargado)} hint="Responsabilidad no definida" tone="warn" />
            <Kpi label="Sin fecha de adquisición" value={num(r?.SinFechaAdq)} tone="warn" />
            <Kpi label="Costo simbólico (= 1)" value={num(r?.CostoSimbolico)} hint="Distorsiona la inversión" tone="warn" />
            <Kpi label="Primera compra" value={date(r?.PrimeraCompra)} />
            <Kpi label="Última compra" value={date(r?.UltimaCompra)} />
          </div>

          {/* Calidad de datos */}
          {q && (
            <div className="border rounded-xl p-4 bg-card mb-6">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" /> Calidad de datos
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  ["Serial", q.PorcentajeSerial], ["Fecha adquisición", q.PorcentajeFecha],
                  ["Costo real", q.PorcentajeCosto], ["Suplidor", q.PorcentajeSuplidor],
                  ["Encargado", q.PorcentajeEncargado], ["Ubicación", q.PorcentajeUbicacion],
                ].map(([label, val]: any) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{val == null ? "—" : `${val}%`}</span>
                    </div>
                    <Progress value={Number(val) || 0} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Tabs defaultValue="suplidores">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="suplidores">Suplidores</TabsTrigger>
              <TabsTrigger value="categorias">Categorías</TabsTrigger>
              <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
              <TabsTrigger value="antiguedad">Antigüedad</TabsTrigger>
              <TabsTrigger value="anomalias">
                Anomalías
                <Badge variant="destructive" className="ml-2">
                  {(data.sinSerial?.length || 0) + (data.serialesDuplicados?.length || 0) + (data.sinEncargado?.length || 0)}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="depreciacion">Depreciación</TabsTrigger>
            </TabsList>

            <TabsContent value="suplidores" className="space-y-4">
              <div className="border rounded-xl p-4 bg-card">
                <h3 className="font-semibold text-sm mb-3">Top 10 suplidores por monto invertido</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={(data.suplidores || []).map((s: any) => ({ name: s.Suplidor, valor: Number(s.TotalInvertido || 0) }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: any) => money(v)} />
                    <Bar dataKey="valor" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ExportableTable
                title="Detalle de suplidores"
                hint="Haz clic en una fila para ver los artículos comprados a ese suplidor."
                rows={data.suplidores}
                file="suplidores.csv"
                onRowClick={(r) => setDrill({ title: `Suplidor: ${r.Suplidor}`, params: { suplidor: r.Suplidor, soloConCosto: "true" } })}
              />
            </TabsContent>

            <TabsContent value="categorias" className="space-y-4">
              <div className="border rounded-xl p-4 bg-card">
                <h3 className="font-semibold text-sm mb-3">Valor por categoría</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={catChart} dataKey="value" nameKey="name" outerRadius={110} label={(e: any) => e.name}>
                      {catChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => money(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ExportableTable
                title="Categoría / Tipo"
                hint="Haz clic en una fila para ver los activos que componen ese monto."
                rows={data.categorias}
                file="categorias.csv"
                onRowClick={(r) => setDrill({ title: `${r.Categoria} — ${r.Tipo ?? ""}`, params: { categoria: r.Categoria, tipo: r.Tipo, soloConCosto: "true" } })}
              />
            </TabsContent>

            <TabsContent value="departamentos" className="space-y-4">
              <div className="border rounded-xl p-4 bg-card">
                <h3 className="font-semibold text-sm mb-3">Valor por departamento</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={deptChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => money(v)} />
                    <Bar dataKey="valor" fill={COLORS[1]} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ExportableTable
                title="Departamento / Ubicación"
                hint="Haz clic en una fila para ver el detalle de sus activos."
                rows={data.departamentos}
                file="departamentos.csv"
                onRowClick={(r) => setDrill({ title: `Departamento: ${r.Departamento}`, params: { departamento: r.Departamento, soloConCosto: "true" } })}
              />
            </TabsContent>

            <TabsContent value="antiguedad" className="space-y-4">
              <div className="border rounded-xl p-4 bg-card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Inversión por año de adquisición
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={antiguedadChart}
                    onClick={(e: any) => {
                      const anio = e?.activeLabel;
                      if (anio) setDrill({ title: `Detalle de adquisiciones ${anio}`, params: { anio, soloConCosto: "true" } });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: any, k: any) => (k === "valor" ? money(v) : v)} />
                    <Line type="monotone" dataKey="valor" stroke={COLORS[2]} strokeWidth={2} dot activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ExportableTable
                title="Antigüedad del inventario"
                hint="Haz clic en un año (o en un punto del gráfico) para ver el detalle artículo por artículo."
                rows={data.antiguedad}
                file="antiguedad.csv"
                onRowClick={(r) => setDrill({ title: `Detalle de adquisiciones ${r.AnioAdquisicion}`, params: { anio: r.AnioAdquisicion, soloConCosto: "true" } })}
              />
            </TabsContent>

            <TabsContent value="anomalias" className="space-y-4">
              <ExportableTable title={`Seriales duplicados (${data.serialesDuplicados?.length || 0})`} rows={data.serialesDuplicados} file="seriales-duplicados.csv" />
              <ExportableTable title={`Activos sin serial (${data.sinSerial?.length || 0})`} rows={data.sinSerial} file="sin-serial.csv" />
              <ExportableTable title={`Activos sin encargado (${data.sinEncargado?.length || 0})`} rows={data.sinEncargado} file="sin-encargado.csv" />
            </TabsContent>

            <TabsContent value="movimientos">
              <ExportableTable title="Movimientos de activos (últimos 300)" rows={data.movimientos} file="movimientos.csv" error={data.errors?.movimientos} />
            </TabsContent>

            <TabsContent value="depreciacion">
              <ExportableTable title="Depreciación acumulada por año" rows={data.depreciacion} file="depreciacion.csv" error={data.errors?.depreciacion} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <DrillDownDialog drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function DrillDownDialog({ drill, onClose }: { drill: { title: string; params: Record<string, any> } | null; onClose: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!drill) return;
    setQ("");
    setLoading(true);
    fixedAssetsSqlApi
      .detalle(drill.params)
      .then((res) => { setRows(res.rows || []); setTotal(res.total || 0); })
      .catch((e: any) => toast({ title: "Error al leer el detalle", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(t)));
  }, [rows, q]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.CostoAdq || 0), 0),
    [filtered]
  );

  return (
    <Dialog open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{drill?.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Buscar en el detalle..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Badge variant="secondary">{filtered.length} artículos</Badge>
          <Badge>{money(filteredTotal)}</Badge>
          {filtered.length !== rows.length && <span className="text-xs text-muted-foreground">de {money(total)} total</span>}
          <Button variant="outline" size="sm" className="gap-2 ml-auto" disabled={!filtered.length} onClick={() => downloadCsv("detalle-activo-fijo.csv", filtered)}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Cargando detalle desde SafeOne...</p>
        ) : (
          <DataTable rows={filtered} max={1000} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportableTable({ title, rows, file, error, onRowClick, hint }: { title: string; rows: any[]; file: string; error?: string; onRowClick?: (r: any) => void; hint?: string }) {
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Button variant="outline" size="sm" className="gap-2" disabled={!rows?.length} onClick={() => downloadCsv(file, rows)}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>
      {error ? (
        <p className="p-6 text-sm text-muted-foreground text-center">
          No disponible en el esquema actual: {error}
        </p>
      ) : (
        <DataTable rows={rows || []} onRowClick={onRowClick} />
      )}
    </div>
  );
}
