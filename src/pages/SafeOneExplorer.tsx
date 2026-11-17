import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, Database, Download, GitCompareArrows, KeyRound, Link2, Loader2, RefreshCw, Search, ShieldAlert, Table2,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  isApiConfigured, safeOneExplorerApi,
  type SafeOneRow, type SafeOneSnapshot, type SafeOneSnapshotCompare, type SafeOneTable, type SafeOneTableDetail,
} from "@/lib/api";
import { canExploreSafeOne } from "@/lib/safeoneExplorerAccess";
import { cn } from "@/lib/utils";

const ACCESOS: { tabla: string; label: string }[] = [
  { tabla: "CargosCP", label: "Facturas Suplidores" },
  { tabla: "CargosCP606", label: "Facturas · 606" },
  { tabla: "CajaChica", label: "Caja Chica" },
  { tabla: "CajaChicaD", label: "Caja Chica · líneas" },
  { tabla: "Trans", label: "Asientos (Trans)" },
  { tabla: "Documento", label: "Documentos" },
  { tabla: "TipoNCF", label: "Tipos NCF" },
  { tabla: "Suplidor", label: "Suplidores" },
];

const fmtNum = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("es-DO"));
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" }) : "—");
const cell = (v: unknown) => (v == null ? "" : typeof v === "boolean" ? (v ? "Sí" : "No") : String(v));

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function toCsv(rows: SafeOneRow[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${cell(v).replace(/"/g, '""')}"`;
  return [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function RowsTable({ rows, empty = "Sin registros." }: { rows: SafeOneRow[]; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="max-h-[520px] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted">
          <TableRow>{cols.map((c) => <TableHead key={c} className="whitespace-nowrap text-xs">{c}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c} className="max-w-[260px] truncate whitespace-nowrap py-1.5 font-mono text-xs" title={cell(r[c])}>{cell(r[c])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SafeOneExplorer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const allowed = canExploreSafeOne(user);

  const [status, setStatus] = useState<{ connected: boolean; message?: string; database?: string; host?: string } | null>(null);
  const [tables, setTables] = useState<SafeOneTable[]>([]);
  const [search, setSearch] = useState("");
  const [onlyWithData, setOnlyWithData] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SafeOneTableDetail | null>(null);
  const [limit, setLimit] = useState(25);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SafeOneSnapshot[]>([]);
  const [snapNote, setSnapNote] = useState("");
  const [comparison, setComparison] = useState<SafeOneSnapshotCompare | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true); setError(null);
    try {
      const st = await safeOneExplorerApi.status();
      setStatus(st);
      if (st.connected) setTables(await safeOneExplorerApi.tables());
      setSnapshots(await safeOneExplorerApi.snapshots().catch(() => []));
    } catch (e) {
      setError(e instanceof Error && e.message !== "API_NOT_CONFIGURED" ? e.message : "El servidor de la intranet no está disponible desde aquí.");
    } finally { setLoadingList(false); }
  }, []);
  useEffect(() => { if (allowed && isApiConfigured()) loadList(); else setLoadingList(false); }, [allowed, loadList]);

  const openTable = useCallback(async (name: string, n = limit) => {
    setSelected(name); setLoadingDetail(true); setDetail(null);
    try { setDetail(await safeOneExplorerApi.table(name, n)); }
    catch (e) { toast({ title: "No se pudo abrir la tabla", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setLoadingDetail(false); }
  }, [limit, toast]);

  const visibleTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => (!onlyWithData || t.registros > 0) && (!q || t.tabla.toLowerCase().includes(q)));
  }, [tables, search, onlyWithData]);
  const known = useMemo(() => new Set(tables.map((t) => t.tabla.toLowerCase())), [tables]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e) { toast({ title: "No se pudo completar", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setBusy(null); }
  };
  const downloadDiagnostic = () => run("diag", async () => {
    const data = await safeOneExplorerApi.fleetDiagnostic();
    download(`diagnostico-safeone-flotilla-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
    toast({ title: "Diagnóstico descargado", description: "Adjunta ese archivo en el chat para preparar el registro." });
  });
  const takeSnapshot = () => run("snap", async () => {
    const s = await safeOneExplorerApi.takeSnapshot(snapNote.trim());
    setSnapNote("");
    setSnapshots(await safeOneExplorerApi.snapshots());
    toast({ title: "Foto tomada", description: `${s.tablas} tablas guardadas. Ahora registra el documento en Adonis y luego pulsa "Comparar".` });
  });
  const compare = (id: string) => run(`cmp-${id}`, async () => setComparison(await safeOneExplorerApi.compareSnapshot(id)));

  if (!allowed) {
    return (
      <AppLayout>
        <Navbar />
        <main className="min-h-screen flex-1 bg-background">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> Acceso restringido</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">El Explorador SafeOne es exclusivo de Tecnología y de Chrisnel Fabián.</CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Navbar />
      <main className="min-h-screen flex-1 bg-background">
        <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2"><ArrowLeft className="h-4 w-4" /> Volver</Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Database className="h-6 w-6 text-primary" /> Explorador SafeOne</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Consulta de solo lectura de la base que usa Adonis. Aquí nada se modifica: solo se ven tablas, columnas, relaciones y registros.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadList} disabled={loadingList} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin")} /> Actualizar
              </Button>
              <Button onClick={downloadDiagnostic} disabled={!status?.connected || busy === "diag"} className="gap-2">
                {busy === "diag" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Diagnóstico para Flotilla
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <Badge variant={status?.connected ? "default" : "destructive"}>{status?.connected ? "Conectado" : "Sin conexión"}</Badge>
              <span className="text-muted-foreground">
                {loadingList ? "Consultando…" : error ? error : status?.connected
                  ? `${status.database || "SafeOne"} en ${status.host || "servidor"} · ${fmtNum(tables.length)} tablas`
                  : status?.message || "No se pudo conectar con SafeOne."}
              </span>
            </CardContent>
          </Card>

          {status?.connected && (
            <Tabs defaultValue="tablas">
              <TabsList>
                <TabsTrigger value="tablas" className="gap-2"><Table2 className="h-4 w-4" /> Tablas</TabsTrigger>
                <TabsTrigger value="fotos" className="gap-2"><Camera className="h-4 w-4" /> Fotos antes / después</TabsTrigger>
              </TabsList>

              {/* TABLAS */}
              <TabsContent value="tablas" className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {ACCESOS.filter((a) => known.has(a.tabla.toLowerCase())).map((a) => (
                    <Button key={a.tabla} size="sm" variant={selected?.toLowerCase() === a.tabla.toLowerCase() ? "default" : "outline"} onClick={() => openTable(a.tabla)}>
                      {a.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                  <Card className="h-fit">
                    <CardHeader className="space-y-2 pb-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tabla…" className="pl-8" />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={onlyWithData} onChange={(e) => setOnlyWithData(e.target.checked)} /> Solo tablas con registros
                      </label>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[560px]">
                        <ul className="px-2 pb-2">
                          {visibleTables.map((t) => (
                            <li key={t.tabla}>
                              <button type="button" onClick={() => openTable(t.tabla)}
                                className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                                  selected === t.tabla && "bg-primary/10 font-semibold text-primary")}>
                                <span className="truncate">{t.tabla}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{fmtNum(t.registros)}</span>
                              </button>
                            </li>
                          ))}
                          {!visibleTables.length && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados.</li>}
                        </ul>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    {!selected ? (
                      <CardContent className="py-16 text-center text-sm text-muted-foreground">Elige una tabla para ver sus columnas, relaciones y últimos registros.</CardContent>
                    ) : loadingDetail || !detail ? (
                      <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Abriendo {selected}…</CardContent>
                    ) : (
                      <>
                        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
                          <CardTitle className="flex-1 text-lg">{detail.tabla}</CardTitle>
                          <span className="text-xs text-muted-foreground">
                            {fmtNum(tables.find((t) => t.tabla === detail.tabla)?.registros)} registros · último número {fmtNum(tables.find((t) => t.tabla === detail.tabla)?.ultimoNumero)}
                          </span>
                        </CardHeader>
                        <CardContent>
                          <Tabs defaultValue="registros">
                            <TabsList>
                              <TabsTrigger value="registros">Últimos registros ({detail.registros.length})</TabsTrigger>
                              <TabsTrigger value="columnas">Columnas ({detail.columnas.length})</TabsTrigger>
                              <TabsTrigger value="relaciones">Relaciones ({detail.relaciones.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="registros" className="mt-3 space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Mostrar</span>
                                {[25, 100, 200].map((n) => (
                                  <Button key={n} size="sm" variant={limit === n ? "default" : "outline"} onClick={() => { setLimit(n); openTable(detail.tabla, n); }}>{n}</Button>
                                ))}
                                <span className="text-xs text-muted-foreground">{detail.ordenadoPor ? `más recientes primero (por ${detail.ordenadoPor})` : "sin orden"}</span>
                                <Button size="sm" variant="outline" className="ml-auto gap-2" disabled={!detail.registros.length}
                                  onClick={() => download(`${detail.tabla}.csv`, toCsv(detail.registros), "text/csv;charset=utf-8")}>
                                  <Download className="h-4 w-4" /> CSV
                                </Button>
                              </div>
                              <RowsTable rows={detail.registros} />
                            </TabsContent>
                            <TabsContent value="columnas" className="mt-3">
                              <div className="max-h-[520px] overflow-auto rounded-md border">
                                <Table>
                                  <TableHeader className="sticky top-0 bg-muted">
                                    <TableRow><TableHead>#</TableHead><TableHead>Columna</TableHead><TableHead>Tipo</TableHead><TableHead>Obligatoria</TableHead><TableHead>Por defecto</TableHead></TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {detail.columnas.map((c) => (
                                      <TableRow key={c.columna}>
                                        <TableCell className="text-xs text-muted-foreground">{c.orden}</TableCell>
                                        <TableCell className="font-mono text-xs">
                                          {c.columna} {c.autonumerico && <Badge variant="secondary" className="ml-1 gap-1"><KeyRound className="h-3 w-3" /> autonumérico</Badge>}
                                        </TableCell>
                                        <TableCell className="text-xs">{c.tipo}{["nvarchar", "varchar", "char", "nchar"].includes(c.tipo) ? ` (${c.largo === -1 ? "máx" : c.tipo.startsWith("n") ? c.largo / 2 : c.largo})` : ""}</TableCell>
                                        <TableCell className="text-xs">{c.permiteVacio ? "No" : <span className="font-semibold text-foreground">Sí</span>}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{c.porDefecto || ""}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TabsContent>
                            <TabsContent value="relaciones" className="mt-3">
                              {!detail.relaciones.length ? <p className="py-6 text-center text-sm text-muted-foreground">Esta tabla no declara relaciones en la base de datos.</p> : (
                                <ul className="space-y-1.5 text-sm">
                                  {detail.relaciones.map((r, i) => {
                                    const other = r.tablaOrigen === detail.tabla ? r.tablaDestino : r.tablaOrigen;
                                    return (
                                      <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                                        <Link2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-mono text-xs">{r.tablaOrigen}.{r.columnaOrigen} → {r.tablaDestino}.{r.columnaDestino}</span>
                                        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => openTable(other)}>Abrir {other}</Button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </>
                    )}
                  </Card>
                </div>
              </TabsContent>

              {/* FOTOS */}
              <TabsContent value="fotos" className="mt-4 space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Cómo saber qué tablas llena Adonis</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                      <li>Toma una foto ahora.</li>
                      <li>Contabilidad registra en Adonis una factura real de taller (o una caja chica).</li>
                      <li>Pulsa "Comparar" en esa foto: verás qué tablas cambiaron y los registros nuevos.</li>
                    </ol>
                    <p className="text-xs text-muted-foreground">Si alguien más registra otra cosa en Adonis al mismo tiempo, también aparecerá; lo ideal es hacerlo cuando haya poco movimiento.</p>
                    <div className="flex flex-wrap gap-2">
                      <Input value={snapNote} onChange={(e) => setSnapNote(e.target.value)} placeholder="Nota (ej.: antes de factura La Chercha)" className="max-w-sm" />
                      <Button onClick={takeSnapshot} disabled={busy === "snap"} className="gap-2">
                        {busy === "snap" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Tomar foto
                      </Button>
                    </div>
                    {snapshots.length > 0 && (
                      <ul className="divide-y rounded-md border">
                        {snapshots.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                            <Camera className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-[200px] flex-1">
                              <p className="font-medium">{s.nota || s.id}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(s.at)} · {s.by || "—"} · {s.tablas} tablas</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => compare(s.id)} disabled={busy === `cmp-${s.id}`} className="gap-2">
                              {busy === `cmp-${s.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />} Comparar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {comparison && (
                  <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
                      <CardTitle className="flex-1 text-base">
                        Cambios desde "{comparison.foto.nota || comparison.foto.id}" ({fmtDate(comparison.foto.at)} → {fmtDate(comparison.comparadoEn)})
                      </CardTitle>
                      <Button size="sm" variant="outline" className="gap-2"
                        onClick={() => download(`comparacion-${comparison.foto.id}.json`, JSON.stringify(comparison, null, 2), "application/json")}>
                        <Download className="h-4 w-4" /> Descargar
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {!comparison.cambios.length && <p className="text-sm text-muted-foreground">Ninguna tabla cambió todavía. Registra el documento en Adonis y compara de nuevo.</p>}
                      {comparison.cambios.map((c) => (
                        <div key={c.tabla} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{c.tabla}</Badge>
                            <span className="text-sm text-muted-foreground">{c.nuevos == null ? "tabla nueva" : `${c.nuevos} registro(s) nuevo(s)`} · {fmtNum(c.antes)} → {fmtNum(c.actual)}</span>
                          </div>
                          {c.error ? <p className="text-sm text-destructive">{c.error}</p> : c.registros && <RowsTable rows={c.registros} />}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
      <Footer />
    </AppLayout>
  );
}
