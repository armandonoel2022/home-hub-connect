import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Bike, Car, Wrench, DollarSign, Search, ShieldAlert,
  TrendingUp, Calendar, Filter, X,
} from "lucide-react";
import {
  getFleet, getAnnualCost, getMaintenanceEntries, getTotals, formatRD,
} from "@/lib/fleetMaintenanceData";

const MONTH_LABELS: Record<string, string> = {
  enero: "Ene", febrero: "Feb", marzo: "Mar", abril: "Abr",
  mayo: "May", junio: "Jun", julio: "Jul", agosto: "Ago",
  septiembre: "Sep", octubre: "Oct", noviembre: "Nov", diciembre: "Dic",
};

// Allowed user IDs / departments — Chrisnel + Gerencia General + Admin IT
const ALLOWED_USER_IDS = new Set(["USR-001", "USR-100", "USR-101"]);
const ALLOWED_DEPARTMENTS = new Set(["Administración", "Gerencia General", "Tecnología y Monitoreo"]);

export default function FleetMaintenance() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fleet = useMemo(() => getFleet(), []);
  const annual = useMemo(() => getAnnualCost(), []);
  const [refresh, setRefresh] = useState(0);
  const entries = useMemo(() => getMaintenanceEntries(), [refresh]);
  const totals = useMemo(() => getTotals(), [refresh]);

  const [tab, setTab] = useState<"dashboard" | "log" | "annual" | "fleet">("dashboard");
  const [search, setSearch] = useState("");
  const [filterPlaca, setFilterPlaca] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<"all" | "motocicleta" | "vehiculo">("all");
  const [filterMes, setFilterMes] = useState<string>("all");

  // ── Access gate (computed but checked AFTER all hooks to keep hook order stable) ──
  const hasAccess = !!user && (user.isAdmin || ALLOWED_USER_IDS.has(user.id) || ALLOWED_DEPARTMENTS.has(user.department));

  // ── Filtering for log tab ──
  const filteredEntries = useMemo(() => {
    let list = entries;
    if (filterKind !== "all") list = list.filter((e) => e.kind === filterKind);
    if (filterPlaca !== "all") list = list.filter((e) => e.placa === filterPlaca);
    if (filterMes !== "all") list = list.filter((e) => (e.mes || "").toLowerCase() === filterMes);
    if (search.trim()) {
      const t = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.placa.toLowerCase().includes(t) ||
          (e.taller || "").toLowerCase().includes(t) ||
          (e.detalle || "").toLowerCase().includes(t) ||
          (e.tipoMant || "").toLowerCase().includes(t),
      );
    }
    return list;
  }, [entries, filterKind, filterPlaca, filterMes, search]);

  const filteredTotal = useMemo(
    () => filteredEntries.reduce((s, e) => s + e.costo, 0),
    [filteredEntries],
  );

  const hasActiveFilter = filterKind !== "all" || filterPlaca !== "all" || filterMes !== "all" || !!search.trim();

  const clearFilters = () => {
    setFilterKind("all"); setFilterPlaca("all"); setFilterMes("all"); setSearch("");
  };

  const goToLog = (filters: Partial<{ placa: string; kind: "motocicleta" | "vehiculo"; mes: string; }>) => {
    if (filters.placa) setFilterPlaca(filters.placa);
    if (filters.kind) setFilterKind(filters.kind);
    if (filters.mes) setFilterMes(filters.mes);
    setTab("log");
  };

  // ── Aggregations for dashboard ──
  const motoCount = fleet.filter((u) => u.tipo.toUpperCase().includes("MOTO")).length;
  const vehCount = fleet.length - motoCount;

  const topUnits = useMemo(() => {
    return Object.entries(totals.byPlaca)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [totals]);

  const monthBreakdown = useMemo(() => {
    return Object.entries(totals.byMes).sort((a, b) => b[1] - a[1]);
  }, [totals]);

  const topTalleres = useMemo(() => {
    return Object.entries(totals.byTaller).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [totals]);

  // ── Access gate (after all hooks) ──
  if (!hasAccess) {
    return (
      <AppLayout>
        <Navbar />
        <main className="flex-1 bg-background min-h-screen">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
            <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" /> Acceso restringido
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Este módulo es exclusivo para Administración (Chrisnel Fabián) y Gerencia General.
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </AppLayout>
    );
  }

  // ── Render ──
  return (
    <AppLayout>
      <Navbar />
      <main className="flex-1 bg-background min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Button variant="ghost" onClick={() => navigate("/admin/hub")} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver al Hub de Administración
          </Button>

          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Wrench className="h-6 w-6 text-primary" />
                Flotilla SafeOne — Reparación y Mantenimiento
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Control de gastos de mantenimiento por unidad. Responsable: Chrisnel Fabián
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Gasto total acumulado</p>
              <p className="text-2xl font-bold text-primary">{formatRD(totals.total)}</p>
              <p className="text-[11px] text-muted-foreground">{totals.entriesCount} registros</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="log">Registro de Gastos</TabsTrigger>
              <TabsTrigger value="annual">Costo Anual</TabsTrigger>
              <TabsTrigger value="fleet">Flotilla</TabsTrigger>
            </TabsList>

            {/* ───────── DASHBOARD ───────── */}
            <TabsContent value="dashboard" className="space-y-6 mt-6">
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => { setFilterKind("all"); setFilterPlaca("all"); setFilterMes("all"); setTab("log"); }}
                  className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-all hover:border-primary/50"
                >
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <DollarSign className="h-4 w-4" /> Gasto total
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatRD(totals.total)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{totals.entriesCount} entradas</p>
                </button>

                <button
                  onClick={() => goToLog({ kind: "motocicleta" })}
                  className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-all hover:border-primary/50"
                >
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Bike className="h-4 w-4" /> Motocicletas
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatRD(totals.byKind.motocicleta || 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{motoCount} unidades</p>
                </button>

                <button
                  onClick={() => goToLog({ kind: "vehiculo" })}
                  className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-all hover:border-primary/50"
                >
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Car className="h-4 w-4" /> Vehículos
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatRD(totals.byKind.vehiculo || 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{vehCount} unidades</p>
                </button>

                <div className="border rounded-xl p-4 bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-4 w-4" /> Gasto promedio / unidad
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatRD(fleet.length ? totals.total / fleet.length : 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{fleet.length} unidades en flotilla</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top units */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top unidades por gasto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topUnits.map(([placa, value]) => {
                      const max = topUnits[0][1] || 1;
                      const pct = (value / max) * 100;
                      return (
                        <button
                          key={placa}
                          onClick={() => goToLog({ placa })}
                          className="w-full text-left group"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium group-hover:text-primary">{placa}</span>
                            <span className="text-muted-foreground">{formatRD(value)}</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary group-hover:bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Monthly */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Gasto por mes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {monthBreakdown.map(([mes, value]) => {
                      const max = monthBreakdown[0][1] || 1;
                      const pct = (value / max) * 100;
                      return (
                        <button
                          key={mes}
                          onClick={() => goToLog({ mes: mes.toLowerCase() })}
                          className="w-full text-left group"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium capitalize group-hover:text-primary">{mes}</span>
                            <span className="text-muted-foreground">{formatRD(value)}</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-accent group-hover:opacity-80 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Talleres */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Talleres más utilizados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {topTalleres.map(([name, value]) => (
                      <div key={name} className="border rounded-lg p-3 bg-muted/30">
                        <p className="text-xs font-medium truncate" title={name}>{name}</p>
                        <p className="text-sm font-semibold text-primary mt-1">{formatRD(value)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ───────── LOG ───────── */}
            <TabsContent value="log" className="space-y-4 mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por placa, taller, tipo o detalle..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={filterKind}
                  onChange={(e) => setFilterKind(e.target.value as "all" | "motocicleta" | "vehiculo")}
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="all">Todas las categorías</option>
                  <option value="motocicleta">Motocicletas</option>
                  <option value="vehiculo">Vehículos</option>
                </select>
                <select
                  value={filterPlaca}
                  onChange={(e) => setFilterPlaca(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="all">Todas las placas</option>
                  {Object.keys(totals.byPlaca).sort().map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select
                  value={filterMes}
                  onChange={(e) => setFilterMes(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="all">Todos los meses</option>
                  {Object.keys(totals.byMes).map((m) => (
                    <option key={m} value={m.toLowerCase()}>{m}</option>
                  ))}
                </select>
                {hasActiveFilter && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-3 w-3" /> Limpiar
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {filteredEntries.length} registro{filteredEntries.length !== 1 ? "s" : ""}
                </span>
                <span className="font-semibold text-primary">{formatRD(filteredTotal)}</span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Mes</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Taller</TableHead>
                      <TableHead className="min-w-[280px]">Detalle</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Sin registros que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap text-xs">{e.fecha}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px]">{e.placa}</Badge>
                          </TableCell>
                          <TableCell className="text-xs capitalize">{e.mes || "—"}</TableCell>
                          <TableCell className="text-xs">{e.tipoMant || "—"}</TableCell>
                          <TableCell className="text-xs">{e.taller || "—"}</TableCell>
                          <TableCell className="text-xs">{e.detalle || "—"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatRD(e.costo)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ───────── ANNUAL COST MATRIX ───────── */}
            <TabsContent value="annual" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Costo de mantenimiento anual 2026</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[260px]">Descripción</TableHead>
                          <TableHead>Placa</TableHead>
                          {Object.values(MONTH_LABELS).map((m) => (
                            <TableHead key={m} className="text-right text-xs">{m}</TableHead>
                          ))}
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {annual.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{row.descripcion}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[11px]">
                                {row.placa || "—"}
                              </Badge>
                            </TableCell>
                            {Object.keys(MONTH_LABELS).map((m) => {
                              const v = row.monthly[m as keyof typeof row.monthly] || 0;
                              return (
                                <TableCell key={m} className="text-right text-xs tabular-nums">
                                  {v ? v.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatRD(row.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* ─── Totals row ─── */}
                        <TableRow className="bg-muted/60 border-t-2 border-primary/40 font-bold">
                          <TableCell className="text-sm font-bold">TOTAL GENERAL {new Date().getFullYear()}</TableCell>
                          <TableCell />
                          {Object.keys(MONTH_LABELS).map((m) => {
                            const monthTotal = annual.reduce(
                              (s, r) => s + (r.monthly[m as keyof typeof r.monthly] || 0),
                              0,
                            );
                            return (
                              <TableCell key={m} className="text-right text-xs tabular-nums font-bold text-primary">
                                {monthTotal ? monthTotal.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right text-sm font-bold text-primary tabular-nums">
                            {formatRD(annual.reduce((s, r) => s + r.total, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ───────── FLEET LISTING ───────── */}
            <TabsContent value="fleet" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Listado de Flotilla — {fleet.length} unidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Año</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Chasis</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Aseguradora</TableHead>
                          <TableHead className="text-right">Gasto Mant.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fleet.map((u) => {
                          const placaStr = String(u.placa);
                          const spend = totals.byPlaca[placaStr] || 0;
                          return (
                            <TableRow
                              key={u.no}
                              className="cursor-pointer"
                              onClick={() => spend > 0 && goToLog({ placa: placaStr })}
                            >
                              <TableCell className="text-xs">{u.no}</TableCell>
                              <TableCell className="text-xs">{u.tipo}</TableCell>
                              <TableCell className="text-xs">{u.marca}</TableCell>
                              <TableCell className="text-xs">{u.modelo}</TableCell>
                              <TableCell className="text-xs">{u.anio}</TableCell>
                              <TableCell className="text-xs">{u.color}</TableCell>
                              <TableCell className="text-[11px] font-mono">{u.chasis}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-[11px]">{u.placa}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">{u.aseguradora}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums font-medium">
                                {spend > 0 ? formatRD(spend) : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </AppLayout>
  );
}
