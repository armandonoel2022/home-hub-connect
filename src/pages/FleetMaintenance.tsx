import { useState, useMemo, useEffect } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bike, Car, Wrench, DollarSign, Search, ShieldAlert,
  TrendingUp, Calendar, Filter, X, Plus, Edit2, Trash2, Link2, Cloud, CloudOff,
} from "lucide-react";
import {
  getFleet, getAnnualCost, getMaintenanceEntries, getTotals, formatRD,
  addMaintenanceEntry, updateMaintenanceEntry, deleteMaintenanceEntry,
  addFleetUnit, updateFleetUnit, deleteFleetUnit,
  refreshFromServer, isServerMode,
} from "@/lib/fleetMaintenanceData";
import type { MaintenanceEntry, FleetUnit } from "@/lib/fleetMaintenanceTypes";
import { getAssetsByPlaca, type LinkedAsset } from "@/lib/fleetAssetLink";
import { isApiConfigured } from "@/lib/api";

const MONTH_LABELS: Record<string, string> = {
  enero: "Ene", febrero: "Feb", marzo: "Mar", abril: "Abr",
  mayo: "May", junio: "Jun", julio: "Jul", agosto: "Ago",
  septiembre: "Sep", octubre: "Oct", noviembre: "Nov", diciembre: "Dic",
};
const MONTHS = Object.keys(MONTH_LABELS);

const ALLOWED_USER_IDS = new Set(["USR-001", "USR-100", "USR-101"]);
const ALLOWED_DEPARTMENTS = new Set(["Administración", "Gerencia General", "Tecnología y Monitoreo"]);

function emptyEntry(): MaintenanceEntry & { id?: string } {
  return {
    kind: "vehiculo", unit: null, placa: "", mes: null, asignacion: null,
    fecha: new Date().toISOString().slice(0, 10),
    tipoMant: "Mantenimiento", taller: "", kilometraje: null, costo: 0, detalle: "",
  };
}

function emptyUnit(): FleetUnit {
  return { no: 0, tipo: "VEHÍCULO", marca: "", modelo: "", anio: new Date().getFullYear(), color: "", chasis: "", placa: "", aseguradora: "" };
}

export default function FleetMaintenance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [refresh, setRefresh] = useState(0);
  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (isApiConfigured()) {
        const ok = await refreshFromServer();
        setServerOnline(ok);
      }
      setLoading(false);
      setRefresh(r => r + 1);
    })();
  }, []);

  const fleet = useMemo(() => getFleet(), [refresh]);
  const annual = useMemo(() => getAnnualCost(), [refresh]);
  const entries = useMemo(() => getMaintenanceEntries(), [refresh]);
  const totals = useMemo(() => getTotals(), [refresh]);

  const [tab, setTab] = useState<"dashboard" | "log" | "annual" | "fleet">("dashboard");
  const [search, setSearch] = useState("");
  const [filterPlaca, setFilterPlaca] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<"all" | "motocicleta" | "vehiculo">("all");
  const [filterMes, setFilterMes] = useState<string>("all");

  // CRUD dialogs
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; data: (MaintenanceEntry & { id?: string }) | null; mode: "create" | "edit" }>({
    open: false, data: null, mode: "create",
  });
  const [unitDialog, setUnitDialog] = useState<{ open: boolean; data: FleetUnit | null; mode: "create" | "edit" }>({
    open: false, data: null, mode: "create",
  });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "entry" | "unit"; id: string; label: string } | null>(null);

  // Asset linkage popover state
  const [assetCache, setAssetCache] = useState<Record<string, LinkedAsset[]>>({});
  const fetchAssetsForPlaca = async (placa: string) => {
    if (assetCache[placa] !== undefined) return;
    const found = await getAssetsByPlaca(placa);
    setAssetCache(prev => ({ ...prev, [placa]: found }));
  };

  const hasAccess = !!user && (user.isAdmin || ALLOWED_USER_IDS.has(user.id) || ALLOWED_DEPARTMENTS.has(user.department));

  // Filtering
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

  const filteredTotal = useMemo(() => filteredEntries.reduce((s, e) => s + e.costo, 0), [filteredEntries]);
  const hasActiveFilter = filterKind !== "all" || filterPlaca !== "all" || filterMes !== "all" || !!search.trim();

  const clearFilters = () => { setFilterKind("all"); setFilterPlaca("all"); setFilterMes("all"); setSearch(""); };

  const goToLog = (filters: Partial<{ placa: string; kind: "motocicleta" | "vehiculo"; mes: string; }>) => {
    if (filters.placa) setFilterPlaca(filters.placa);
    if (filters.kind) setFilterKind(filters.kind);
    if (filters.mes) setFilterMes(filters.mes);
    setTab("log");
  };

  // ── CRUD handlers ──
  const openCreateEntry = () => setEntryDialog({ open: true, data: emptyEntry(), mode: "create" });
  const openEditEntry = (e: MaintenanceEntry & { id?: string }) => setEntryDialog({ open: true, data: { ...e }, mode: "edit" });
  const saveEntry = async () => {
    if (!entryDialog.data) return;
    const d = entryDialog.data;
    if (!d.placa || !d.fecha || !d.costo) {
      toast({ title: "Datos incompletos", description: "Placa, fecha y costo son requeridos.", variant: "destructive" });
      return;
    }
    // derive mes from fecha
    const monthIdx = new Date(d.fecha + "T00:00:00").getMonth();
    const mes = MONTHS[monthIdx];
    const payload = { ...d, mes, costo: Number(d.costo) };
    try {
      if (entryDialog.mode === "create") {
        await addMaintenanceEntry(payload);
        toast({ title: "Registro creado", description: `${d.placa} — ${formatRD(payload.costo)}` });
      } else {
        await updateMaintenanceEntry((d as any).id, payload);
        toast({ title: "Registro actualizado" });
      }
      if (isApiConfigured()) await refreshFromServer();
      setEntryDialog({ open: false, data: null, mode: "create" });
      setRefresh(r => r + 1);
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  const openCreateUnit = () => setUnitDialog({ open: true, data: emptyUnit(), mode: "create" });
  const openEditUnit = (u: FleetUnit) => setUnitDialog({ open: true, data: { ...u }, mode: "edit" });
  const saveUnit = async () => {
    if (!unitDialog.data) return;
    const u = unitDialog.data;
    if (!u.placa || !u.marca) {
      toast({ title: "Datos incompletos", description: "Placa y marca son requeridos.", variant: "destructive" });
      return;
    }
    try {
      if (unitDialog.mode === "create") {
        await addFleetUnit(u);
        toast({ title: "Unidad agregada", description: `${u.marca} ${u.modelo} — ${u.placa}` });
      } else {
        await updateFleetUnit(String(u.placa), u);
        toast({ title: "Unidad actualizada" });
      }
      if (isApiConfigured()) await refreshFromServer();
      setUnitDialog({ open: false, data: null, mode: "create" });
      setRefresh(r => r + 1);
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === "entry") {
        await deleteMaintenanceEntry(confirmDelete.id);
      } else {
        await deleteFleetUnit(confirmDelete.id);
      }
      if (isApiConfigured()) await refreshFromServer();
      toast({ title: "Eliminado", description: confirmDelete.label });
      setConfirmDelete(null);
      setRefresh(r => r + 1);
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    }
  };

  // Aggregations for dashboard
  const motoCount = fleet.filter((u) => u.tipo.toUpperCase().includes("MOTO")).length;
  const vehCount = fleet.length - motoCount;
  const topUnits = useMemo(() => Object.entries(totals.byPlaca).sort((a, b) => b[1] - a[1]).slice(0, 8), [totals]);
  const monthBreakdown = useMemo(() => Object.entries(totals.byMes).sort((a, b) => b[1] - a[1]), [totals]);
  const topTalleres = useMemo(() => Object.entries(totals.byTaller).sort((a, b) => b[1] - a[1]).slice(0, 6), [totals]);

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

  // Reusable placa cell with asset-link popover
  const PlacaCell = ({ placa }: { placa: string }) => {
    const linked = assetCache[placa];
    return (
      <Popover onOpenChange={(o) => o && fetchAssetsForPlaca(placa)}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 hover:opacity-80">
            <Badge variant="outline" className="font-mono text-[11px] cursor-pointer">{placa}</Badge>
            <Link2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" side="right">
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Activo Fijo vinculado
            </p>
            {linked === undefined && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {linked && linked.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sin coincidencia en Activo Fijo. Verifica que la placa <strong>{placa}</strong> aparezca en el serial o descripción del activo.
              </p>
            )}
            {linked && linked.map(({ asset, matchedBy }) => (
              <div key={asset.id} className="border rounded-md p-2 bg-muted/30 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-primary">{asset.id}</span>
                  <Badge variant="secondary" className="text-[10px]">{asset.tipo}</Badge>
                </div>
                <p className="font-medium">{asset.descripcion}</p>
                <p className="text-muted-foreground">{asset.marca} {asset.modelo}</p>
                {asset.serial && <p className="text-[10px] text-muted-foreground">Serial: {asset.serial}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">Estado: {asset.estado}</span>
                  <span className="text-[10px] text-muted-foreground">📍 {asset.ubicacion}</span>
                </div>
                <p className="text-[10px] text-muted-foreground italic">Coincidencia por: {matchedBy}</p>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

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
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                Control de gastos por unidad. Responsable: Chrisnel Fabián
                {loading ? null : serverOnline ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                    <Cloud className="h-3 w-3" /> Sincronizado con servidor
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CloudOff className="h-3 w-3" /> Modo local (sin servidor)
                  </span>
                )}
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

            {/* DASHBOARD */}
            <TabsContent value="dashboard" className="space-y-6 mt-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => { clearFilters(); setTab("log"); }}
                  className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-all hover:border-primary/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <DollarSign className="h-4 w-4" /> Gasto total
                  </div>
                  <p className="text-2xl font-bold">{formatRD(totals.total)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{totals.entriesCount} entradas</p>
                </button>
                <button onClick={() => goToLog({ kind: "motocicleta" })}
                  className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-all hover:border-primary/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Bike className="h-4 w-4" /> Motocicletas
                  </div>
                  <p className="text-2xl font-bold">{formatRD(totals.byKind.motocicleta || 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{motoCount} unidades</p>
                </button>
                <button onClick={() => goToLog({ kind: "vehiculo" })}
                  className="text-left border rounded-xl p-4 bg-card hover:shadow-md transition-all hover:border-primary/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Car className="h-4 w-4" /> Vehículos
                  </div>
                  <p className="text-2xl font-bold">{formatRD(totals.byKind.vehiculo || 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{vehCount} unidades</p>
                </button>
                <div className="border rounded-xl p-4 bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-4 w-4" /> Promedio / unidad
                  </div>
                  <p className="text-2xl font-bold">{formatRD(fleet.length ? totals.total / fleet.length : 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{fleet.length} unidades</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Top unidades por gasto</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {topUnits.map(([placa, value]) => {
                      const max = topUnits[0][1] || 1;
                      const pct = (value / max) * 100;
                      return (
                        <button key={placa} onClick={() => goToLog({ placa })} className="w-full text-left group">
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
                        <button key={mes} onClick={() => goToLog({ mes: mes.toLowerCase() })} className="w-full text-left group">
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

              <Card>
                <CardHeader><CardTitle className="text-base">Talleres más utilizados</CardTitle></CardHeader>
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

            {/* LOG */}
            <TabsContent value="log" className="space-y-4 mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por placa, taller, tipo o detalle..." value={search}
                    onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <select value={filterKind} onChange={(e) => setFilterKind(e.target.value as any)}
                  className="border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="all">Todas las categorías</option>
                  <option value="motocicleta">Motocicletas</option>
                  <option value="vehiculo">Vehículos</option>
                </select>
                <select value={filterPlaca} onChange={(e) => setFilterPlaca(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="all">Todas las placas</option>
                  {Object.keys(totals.byPlaca).sort().map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
                <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="all">Todos los meses</option>
                  {Object.keys(totals.byMes).map((m) => (<option key={m} value={m.toLowerCase()}>{m}</option>))}
                </select>
                {hasActiveFilter && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-3 w-3" /> Limpiar
                  </Button>
                )}
                <Button size="sm" onClick={openCreateEntry} className="gap-1 ml-auto">
                  <Plus className="h-4 w-4" /> Nuevo gasto
                </Button>
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
                      <TableHead className="min-w-[240px]">Detalle</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Sin registros que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((e: any, i) => (
                        <TableRow key={e.id || i}>
                          <TableCell className="whitespace-nowrap text-xs">{e.fecha}</TableCell>
                          <TableCell><PlacaCell placa={e.placa} /></TableCell>
                          <TableCell className="text-xs capitalize">{e.mes || "—"}</TableCell>
                          <TableCell className="text-xs">{e.tipoMant || "—"}</TableCell>
                          <TableCell className="text-xs">{e.taller || "—"}</TableCell>
                          <TableCell className="text-xs">{e.detalle || "—"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatRD(e.costo)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEntry(e)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setConfirmDelete({ kind: "entry", id: e.id || `${e.placa}|${e.fecha}|${e.costo}|${e.detalle ?? ""}`, label: `${e.placa} — ${formatRD(e.costo)}` })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ANNUAL */}
            <TabsContent value="annual" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Costo de mantenimiento anual {new Date().getFullYear()}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Acumulado al {new Date().toLocaleDateString("es-DO")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total año en curso</p>
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {formatRD(annual.reduce((s, r) => s + r.total, 0))}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[260px]">Descripción</TableHead>
                          <TableHead>Placa</TableHead>
                          {Object.values(MONTH_LABELS).map((m) => (<TableHead key={m} className="text-right text-xs">{m}</TableHead>))}
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {annual.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{row.descripcion}</TableCell>
                            <TableCell>{row.placa ? <PlacaCell placa={row.placa} /> : <Badge variant="outline" className="font-mono text-[11px]">—</Badge>}</TableCell>
                            {Object.keys(MONTH_LABELS).map((m) => {
                              const v = row.monthly[m as keyof typeof row.monthly] || 0;
                              return (<TableCell key={m} className="text-right text-xs tabular-nums">{v ? v.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}</TableCell>);
                            })}
                            <TableCell className="text-right font-semibold tabular-nums">{formatRD(row.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/60 border-t-2 border-primary/40 font-bold">
                          <TableCell className="text-sm font-bold">TOTAL GENERAL {new Date().getFullYear()}</TableCell>
                          <TableCell />
                          {Object.keys(MONTH_LABELS).map((m) => {
                            const monthTotal = annual.reduce((s, r) => s + (r.monthly[m as keyof typeof r.monthly] || 0), 0);
                            return (<TableCell key={m} className="text-right text-xs tabular-nums font-bold text-primary">{monthTotal ? monthTotal.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}</TableCell>);
                          })}
                          <TableCell className="text-right text-sm font-bold text-primary tabular-nums">{formatRD(annual.reduce((s, r) => s + r.total, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FLEET */}
            <TabsContent value="fleet" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Listado de Flotilla — {fleet.length} unidades</CardTitle>
                  <Button size="sm" onClick={openCreateUnit} className="gap-1">
                    <Plus className="h-4 w-4" /> Nueva unidad
                  </Button>
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
                          <TableHead className="text-right w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fleet.map((u) => {
                          const placaStr = String(u.placa);
                          const spend = totals.byPlaca[placaStr] || 0;
                          return (
                            <TableRow key={`${u.no}-${placaStr}`}>
                              <TableCell className="text-xs">{u.no}</TableCell>
                              <TableCell className="text-xs">{u.tipo}</TableCell>
                              <TableCell className="text-xs">{u.marca}</TableCell>
                              <TableCell className="text-xs">{u.modelo}</TableCell>
                              <TableCell className="text-xs">{u.anio}</TableCell>
                              <TableCell className="text-xs">{u.color}</TableCell>
                              <TableCell className="text-[11px] font-mono">{u.chasis}</TableCell>
                              <TableCell><PlacaCell placa={placaStr} /></TableCell>
                              <TableCell className="text-xs">{u.aseguradora}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums font-medium cursor-pointer hover:text-primary"
                                onClick={() => spend > 0 && goToLog({ placa: placaStr })}>
                                {spend > 0 ? formatRD(spend) : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUnit(u)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setConfirmDelete({ kind: "unit", id: placaStr, label: `${u.marca} ${u.modelo} — ${placaStr}` })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
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

      {/* ENTRY DIALOG */}
      <Dialog open={entryDialog.open} onOpenChange={(o) => !o && setEntryDialog({ open: false, data: null, mode: "create" })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entryDialog.mode === "create" ? "Nuevo gasto de mantenimiento" : "Editar gasto"}</DialogTitle>
            <DialogDescription>Los datos se guardan {serverOnline ? "en el servidor SafeOne" : "localmente"}.</DialogDescription>
          </DialogHeader>
          {entryDialog.data && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoría</Label>
                <select value={entryDialog.data.kind}
                  onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, kind: e.target.value as any } }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="vehiculo">Vehículo</option>
                  <option value="motocicleta">Motocicleta</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Placa *</Label>
                <Input value={entryDialog.data.placa} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, placa: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={entryDialog.data.fecha} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, fecha: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Costo (RD$) *</Label>
                <Input type="number" step="0.01" value={entryDialog.data.costo} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, costo: Number(e.target.value) } }))} />
              </div>
              <div>
                <Label className="text-xs">Tipo de mantenimiento</Label>
                <select value={entryDialog.data.tipoMant || ""} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, tipoMant: e.target.value } }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Reparación">Reparación</option>
                  <option value="Compra de piezas">Compra de piezas</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Taller</Label>
                <Input value={entryDialog.data.taller || ""} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, taller: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Kilometraje</Label>
                <Input type="number" value={entryDialog.data.kilometraje || ""} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, kilometraje: e.target.value ? Number(e.target.value) : null } }))} />
              </div>
              <div>
                <Label className="text-xs">Asignación</Label>
                <Input value={entryDialog.data.asignacion || ""} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, asignacion: e.target.value } }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Detalle</Label>
                <Textarea rows={2} value={entryDialog.data.detalle || ""} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, detalle: e.target.value } }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialog({ open: false, data: null, mode: "create" })}>Cancelar</Button>
            <Button onClick={saveEntry}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UNIT DIALOG */}
      <Dialog open={unitDialog.open} onOpenChange={(o) => !o && setUnitDialog({ open: false, data: null, mode: "create" })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{unitDialog.mode === "create" ? "Nueva unidad de flotilla" : "Editar unidad"}</DialogTitle>
          </DialogHeader>
          {unitDialog.data && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Input value={unitDialog.data.tipo} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, tipo: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Placa *</Label>
                <Input value={String(unitDialog.data.placa)} disabled={unitDialog.mode === "edit"}
                  onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, placa: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Marca *</Label>
                <Input value={unitDialog.data.marca} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, marca: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Modelo</Label>
                <Input value={unitDialog.data.modelo} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, modelo: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Año</Label>
                <Input type="number" value={unitDialog.data.anio as any} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, anio: Number(e.target.value) } }))} />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <Input value={unitDialog.data.color} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, color: e.target.value } }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Chasis</Label>
                <Input value={unitDialog.data.chasis} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, chasis: e.target.value } }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Aseguradora</Label>
                <Input value={unitDialog.data.aseguradora} onChange={(e) => setUnitDialog(s => ({ ...s, data: { ...s.data!, aseguradora: e.target.value } }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialog({ open: false, data: null, mode: "create" })}>Cancelar</Button>
            <Button onClick={saveUnit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará: <strong>{confirmDelete?.label}</strong>. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </AppLayout>
  );
}
