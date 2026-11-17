import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Home, RefreshCw, Loader2, Download, Search, Database, AlertTriangle, ChevronDown, ChevronRight, LibraryBig, Info,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { billingAnalysisApi, isApiConfigured } from "@/lib/api";
import type { BillingAccess, BillingClient, BillingReport } from "@/lib/billingAnalysisTypes";
import { CATEGORY_ORDER, FREQ_LABEL, categoryColor, money, monthLabel, pct } from "@/lib/billingAnalysisTypes";
import { exportBillingWorkbook } from "@/lib/billingExport";
import BillingClientSheet from "@/components/billing/BillingClientSheet";
import BillingAccessCard from "@/components/billing/BillingAccessCard";

const today = () => new Date().toISOString().slice(0, 10);
function preset(p: string): [string, string] {
  const t = new Date();
  const y = t.getFullYear();
  const back = (months: number) => { const d = new Date(t); d.setMonth(d.getMonth() - months); d.setDate(1); return d.toISOString().slice(0, 10); };
  if (p === "anterior") return [`${y - 1}-01-01`, `${y - 1}-12-31`];
  if (p === "12m") return [back(11), today()];
  if (p === "24m") return [back(23), today()];
  return [`${y}-01-01`, today()];
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-2xl font-black">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Range({ d }: { d: { min: number | null; mediana: number | null; max: number | null; n: number } }) {
  if (!d.n) return <span className="text-muted-foreground">—</span>;
  return <span className="whitespace-nowrap">{money(d.min)} · <strong>{money(d.mediana)}</strong> · {money(d.max)}</span>;
}

export default function BillingAnalysis() {
  const [period, setPeriod] = useState("anio");
  const [[desde, hasta], setRange] = useState<[string, string]>(preset("anio"));
  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<BillingAccess | null>(null);
  const [q, setQ] = useState("");
  const [freq, setFreq] = useState("todas");
  const [svc, setSvc] = useState("todos");
  const [selected, setSelected] = useState<BillingClient | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openDesc, setOpenDesc] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!isApiConfigured()) return;
    setLoading(true); setError(null);
    try { setReport(await billingAnalysisApi.report(desde, hasta, refresh)); }
    catch (e: any) { setError(e.message || "No se pudo leer SafeOne."); }
    finally { setLoading(false); }
  }, [desde, hasta]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isApiConfigured()) billingAnalysisApi.access().then(setAccess).catch(() => {}); }, []);

  const labels = report?.categorias || {};
  const clients = useMemo(() => (report?.porCliente || []).filter((c) =>
    (freq === "todas" || c.frecuencia === freq) &&
    (svc === "todos" || (c.categorias[svc] || 0) > 0) &&
    (!q || `${c.nombre} ${c.rnc || ""} ${c.codigo || ""}`.toLowerCase().includes(q.toLowerCase())),
  ), [report, freq, svc, q]);
  const cats = useMemo(() => CATEGORY_ORDER.filter((k) => report?.mensual.some((m) => Number(m[k] || 0) !== 0)), [report]);
  const qualityGroups = useMemo(() => {
    const g: Record<string, BillingReport["calidad"]> = {};
    (report?.calidad || []).forEach((x) => { (g[x.tipo] ||= []).push(x); });
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  }, [report]);

  const r = report;
  return (
    <AppLayout>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <Home className="h-3 w-3" /> Inicio <span>/</span> Servicio al Cliente <span>/</span>
            <span className="font-medium text-foreground">Análisis de Facturación</span>
          </nav>

          <section className="relative overflow-hidden rounded-3xl bg-foreground p-8 text-background">
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Diagnóstico comercial · SafeOne</p>
                <h1 className="mt-3 font-heading text-4xl font-black leading-none">Análisis de<br />Facturación</h1>
                <p className="mt-3 max-w-xl text-sm opacity-75">Lo que se ha facturado a cada cliente, leído directamente de SafeOne (solo lectura). Base para definir los precios del catálogo.</p>
              </div>
              <Button asChild variant="secondary" size="sm"><Link to="/servicio-al-cliente/catalogo"><LibraryBig className="mr-1.5 h-4 w-4" />Ir al catálogo</Link></Button>
            </div>
          </section>

          {!isApiConfigured() && (
            <div className="flex gap-3 rounded-2xl border bg-card p-5 text-sm">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              <p>Este análisis lee la base SafeOne y solo funciona dentro de la intranet (intranet.safeone.com.do). En esta vista previa no hay conexión a la base.</p>
            </div>
          )}

          {access?.puedeEditar && <BillingAccessCard access={access} onChange={setAccess} />}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2">
            <Select value={period} onValueChange={(v) => { setPeriod(v); if (v !== "custom") setRange(preset(v)); }}>
              <SelectTrigger className="w-[170px]" aria-label="Período"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anio">Este año</SelectItem>
                <SelectItem value="anterior">Año anterior</SelectItem>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
                <SelectItem value="24m">Últimos 24 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[150px]" value={desde} aria-label="Desde" onChange={(e) => { setPeriod("custom"); setRange([e.target.value, hasta]); }} />
            <Input type="date" className="w-[150px]" value={hasta} aria-label="Hasta" onChange={(e) => { setPeriod("custom"); setRange([desde, e.target.value]); }} />
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || !isApiConfigured()}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}Actualizar
            </Button>
            <div className="flex-1" />
            {r?.fuente && <span className="hidden text-xs text-muted-foreground md:inline"><Database className="mr-1 inline h-3 w-3" />{r.fuente.tablas.join(", ")}</span>}
            <Button size="sm" disabled={!r} onClick={() => { if (r) { exportBillingWorkbook(r); toast({ title: "Excel generado" }); } }}>
              <Download className="mr-1.5 h-4 w-4" />Excel
            </Button>
          </div>

          {error && (
            <div className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /><div><p className="font-semibold">No se pudo leer la facturación</p><p>{error}</p></div>
            </div>
          )}
          {loading && !r && <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Leyendo facturas de SafeOne…</div>}

          {r && (
            <Tabs defaultValue="resumen">
              <TabsList className="flex-wrap">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="clientes">Clientes ({r.porCliente.length})</TabsTrigger>
                <TabsTrigger value="precios">Precios por servicio</TabsTrigger>
                <TabsTrigger value="calidad">Calidad de datos ({r.calidad.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-6">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="Facturación bruta" value={money(r.resumen.bruto)} hint={`Total con ITBIS ${money(r.resumen.neto)}`} />
                  <Kpi label="Facturas" value={r.resumen.facturas.toLocaleString("es-DO")} hint={`Promedio ${money(r.resumen.promedio)} · Mediana ${money(r.resumen.mediana)}`} />
                  <Kpi label="Clientes facturados" value={r.resumen.clientes} hint={`${r.resumen.clientesRecurrentes} recurrentes · ${r.resumen.clientesOcasionales} ocasionales · ${r.resumen.clientesAislados} aislados`} />
                  <Kpi label="Top 10 clientes" value={pct(r.resumen.top10Participacion)} hint="de la facturación bruta" />
                  <Kpi label="Recurrente (estimado)" value={money(r.resumen.recurrenteEstimado)} hint="Monitoreo, VideoPortero, GPS y vigilancia" />
                  <Kpi label="Extraordinario (estimado)" value={money(r.resumen.extraordinarioEstimado)} hint="Instalaciones, mantenimiento, equipos y otros" />
                  <Kpi label="Monitoreo (estimado)" value={money(r.resumen.monitoreoEstimado)} hint={`${r.resumen.clientesMonitoreo} clientes`} />
                  <Kpi label="Datos por revisar" value={r.resumen.problemasCalidad} hint="ver Calidad de datos" />
                </div>

                <p className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0" />El tipo de servicio se estima por las palabras del concepto de cada factura y está pendiente de validación.
                  {r.excluidos.length > 0 && ` Excluidos de monitoreo: ${r.excluidos.map((e) => e.nombre).join(", ")}.`}
                </p>

                <div className="rounded-2xl border bg-card p-4">
                  <h2 className="mb-3 font-heading text-sm font-bold">Facturación mensual por servicio</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={r.mensual.map((m) => ({ ...m, label: monthLabel(m.mes) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                        <Tooltip formatter={(v: number, k: string) => [money(v), labels[k] || k]} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        {cats.map((k) => <Bar key={k} dataKey={k} stackId="a" fill={categoryColor(k)} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {cats.map((k) => <span key={k} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(k) }} />{labels[k]}</span>)}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border bg-card p-4">
                    <h2 className="mb-3 font-heading text-sm font-bold">Clientes con mayor facturación</h2>
                    <div className="space-y-2">
                      {r.porCliente.slice(0, 10).map((c, i) => (
                        <button key={c.cliente} onClick={() => setSelected(c)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left text-xs hover:bg-muted">
                          <span className="w-5 text-muted-foreground">{i + 1}</span>
                          <span className="flex-1 truncate font-medium">{c.nombre}</span>
                          <div className="hidden h-2 w-24 rounded-full bg-muted sm:block"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (c.participacion / (r.porCliente[0]?.participacion || 1)) * 100)}%` }} /></div>
                          <span className="w-12 text-right text-muted-foreground">{pct(c.participacion)}</span>
                          <span className="w-28 text-right font-semibold">{money(c.bruto)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-card p-4">
                    <h2 className="mb-3 font-heading text-sm font-bold">Por mes</h2>
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="text-left text-muted-foreground"><tr><th className="p-1.5">Mes</th><th className="p-1.5 text-right">Facturas</th><th className="p-1.5 text-right">Clientes</th><th className="p-1.5 text-right">Bruto</th><th className="p-1.5 text-right">Variación</th></tr></thead>
                        <tbody>{r.mensual.map((m) => (
                          <tr key={m.mes} className="border-t"><td className="p-1.5">{monthLabel(m.mes)}</td><td className="p-1.5 text-right">{m.facturas}</td><td className="p-1.5 text-right">{m.clientes}</td><td className="p-1.5 text-right font-medium">{money(m.bruto)}</td>
                            <td className={`p-1.5 text-right ${m.variacion != null && m.variacion < 0 ? "text-destructive" : ""}`}>{m.variacion == null ? "—" : pct(m.variacion)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="clientes" className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, RNC o código…" className="pl-9" />
                  </div>
                  <Select value={freq} onValueChange={setFreq}>
                    <SelectTrigger className="w-[160px]" aria-label="Frecuencia"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="todas">Toda frecuencia</SelectItem>{Object.entries(FREQ_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={svc} onValueChange={setSvc}>
                    <SelectTrigger className="w-[210px]" aria-label="Servicio"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="todos">Todos los servicios</SelectItem>{CATEGORY_ORDER.filter((k) => labels[k]).map((k) => <SelectItem key={k} value={k}>{labels[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="overflow-auto rounded-2xl border bg-card">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-left"><tr>
                      <th className="p-2">Cliente</th><th className="p-2">Servicio principal</th><th className="p-2 text-right">Facturas</th><th className="p-2 text-right">Meses</th>
                      <th className="p-2">Frecuencia</th><th className="p-2 text-right">Tarifa estimada</th><th className="p-2 text-right">Última factura</th><th className="p-2 text-right">Bruto</th><th className="p-2 text-right">%</th>
                    </tr></thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr key={c.cliente} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setSelected(c)}>
                          <td className="p-2"><div className="font-medium">{c.nombre}</div><div className="text-muted-foreground">{[c.codigo, c.rnc].filter(Boolean).join(" · ")}</div></td>
                          <td className="p-2"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: categoryColor(c.categoriaPrincipal) }} />{labels[c.categoriaPrincipal]}{c.excluidoMonitoreo && <Badge variant="outline" className="ml-1">Excluido</Badge>}</td>
                          <td className="p-2 text-right">{c.facturas}</td>
                          <td className="p-2 text-right">{c.meses}</td>
                          <td className="p-2">{FREQ_LABEL[c.frecuencia]}</td>
                          <td className="p-2 text-right">{c.tarifas[0] ? <span title={c.tarifas[0].estado}>{money(c.tarifas[0].importe)}<span className="text-muted-foreground"> ×{c.tarifas[0].meses}m</span></span> : "—"}</td>
                          <td className="p-2 text-right">{c.ultimas[0] ? <><div>{money(c.ultimas[0].bruto)}</div><div className="text-muted-foreground">{c.ultimas[0].fecha}</div></> : "—"}</td>
                          <td className="p-2 text-right font-semibold">{money(c.bruto)}</td>
                          <td className="p-2 text-right text-muted-foreground">{pct(c.participacion)}</td>
                        </tr>
                      ))}
                      {!clients.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Ningún cliente coincide con el filtro.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="precios" className="space-y-6">
                <p className="text-xs text-muted-foreground">Rango entre clientes: mínimo · <strong>mediana</strong> · máximo del importe típico que paga cada cliente por ese servicio. Toque una fila para ver cliente por cliente.</p>
                <div className="overflow-auto rounded-2xl border bg-card">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-left"><tr><th className="p-2">Servicio (estimado)</th><th className="p-2 text-right">Clientes</th><th className="p-2 text-right">Facturas</th><th className="p-2">Rango entre clientes</th><th className="p-2 text-right">Total bruto</th></tr></thead>
                    <tbody>
                      {r.porCategoria.map((g) => (
                        <Fragment key={g.categoria}>
                          <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpenCat(openCat === g.categoria ? null : g.categoria)}>
                            <td className="p-2 font-medium">{openCat === g.categoria ? <ChevronDown className="mr-1 inline h-3 w-3" /> : <ChevronRight className="mr-1 inline h-3 w-3" />}
                              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: categoryColor(g.categoria) }} />{g.label}{g.recurrente && <Badge variant="outline" className="ml-2">Recurrente</Badge>}</td>
                            <td className="p-2 text-right">{g.clientes}</td><td className="p-2 text-right">{g.facturas}</td>
                            <td className="p-2"><Range d={g.entreClientes} /></td><td className="p-2 text-right font-semibold">{money(g.bruto)}</td>
                          </tr>
                          {openCat === g.categoria && g.detalle.map((d) => (
                            <tr key={`${g.categoria}-${d.cliente}`} className="border-t bg-muted/30">
                              <td className="p-2 pl-8">{d.nombre}</td><td className="p-2 text-right text-muted-foreground">{d.meses}m</td><td className="p-2 text-right">{d.facturas}</td>
                              <td className="p-2">Típico <strong>{money(d.tipico)}</strong> · último {money(d.ultimo)}</td><td className="p-2 text-right">{money(d.bruto)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {r.porDescripcion ? (
                  <div className="rounded-2xl border bg-card">
                    <div className="border-b p-3">
                      <h2 className="font-heading text-sm font-bold">Precios por concepto facturado</h2>
                      <p className="text-xs text-muted-foreground">Desde las líneas de las facturas ({r.fuente?.lineas?.tabla}). La dispersión indica cuánto varía el precio del mismo concepto entre clientes.</p>
                    </div>
                    <div className="max-h-[600px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-2">Concepto</th><th className="p-2 text-right">Clientes</th><th className="p-2">Precio mín · mediana · máx</th><th className="p-2 text-right">Dispersión</th><th className="p-2 text-right">Importe</th></tr></thead>
                        <tbody>
                          {r.porDescripcion.slice(0, 150).map((g) => (
                            <Fragment key={g.descripcion}>
                              <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpenDesc(openDesc === g.descripcion ? null : g.descripcion)}>
                                <td className="p-2"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: categoryColor(g.categoria) }} />{g.descripcion}</td>
                                <td className="p-2 text-right">{g.clientes}</td><td className="p-2"><Range d={g.precios} /></td>
                                <td className={`p-2 text-right ${g.dispersion != null && g.dispersion > 50 ? "font-semibold text-destructive" : ""}`}>{g.dispersion == null ? "—" : pct(g.dispersion)}</td>
                                <td className="p-2 text-right">{money(g.importe)}</td>
                              </tr>
                              {openDesc === g.descripcion && g.detalle.map((d) => (
                                <tr key={`${g.descripcion}-${d.cliente}`} className="border-t bg-muted/30">
                                  <td className="p-2 pl-8">{d.nombre}</td><td className="p-2 text-right text-muted-foreground">{d.veces}×</td>
                                  <td className="p-2">Típico <strong>{money(d.precioTipico)}</strong> · último {money(d.ultimo)}</td><td /><td />
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">No se encontró en SafeOne una tabla de líneas de factura con precio; los precios se calculan con el total de cada factura.</p>
                )}
              </TabsContent>

              <TabsContent value="calidad" className="space-y-3">
                {qualityGroups.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin problemas detectados en el período.</p>}
                {qualityGroups.map(([tipo, list]) => (
                  <details key={tipo} className="rounded-2xl border bg-card">
                    <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-semibold">
                      <span>{tipo}</span><Badge variant="secondary">{list.length}</Badge>
                    </summary>
                    <div className="max-h-80 overflow-auto border-t">
                      <table className="w-full text-xs"><tbody>
                        {list.slice(0, 500).map((x, i) => <tr key={i} className="border-t first:border-t-0"><td className="whitespace-nowrap p-2 font-mono">{x.ref || "—"}</td><td className="p-2">{x.detalle}</td></tr>)}
                      </tbody></table>
                    </div>
                  </details>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
      <BillingClientSheet client={selected} labels={labels} onClose={() => setSelected(null)} />
    </AppLayout>
  );
}
