import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import FleetDbSyncPanel from "@/components/fleet/FleetDbSyncPanel";
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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bike, Car, Wrench, DollarSign, Search, ShieldAlert,
  TrendingUp, Calendar, Filter, X, Plus, Edit2, Trash2, Link2, Cloud, CloudOff,
  Check, ChevronsUpDown, RefreshCw, AlertTriangle, Upload, Unlink, Camera, UserCheck, Loader2,
} from "lucide-react";
import {
  getFleet, getSheetAnnualCost, getMaintenanceEntries, getTotals, formatRD,
  addMaintenanceEntry, updateMaintenanceEntry, deleteMaintenanceEntry,
  addFleetUnit, updateFleetUnit, deleteFleetUnit,
  refreshFromServer, getRegisteredUnits, getTalleres, addTaller,
  getLocalOnlyEntries, uploadLocalEntries, getLastSync,
} from "@/lib/fleetMaintenanceData";
import {
  buildAnnualMatrix, availableYears, reconcileWithSheet, monthLabel, monthKeyOf,
  normalizePlaca, findUnitByPlaca, validateExpensePlaca, unitKind, TIPOS_MANT, MONTH_KEYS, tallerKey,
} from "@/lib/fleetMaintenanceRules";
import type { MaintenanceEntry, FleetUnit } from "@/lib/fleetMaintenanceTypes";
import VehicleAvatar from "@/components/fleet/VehicleAvatar";
import VehicleMaintenanceDossier from "@/components/fleet/VehicleMaintenanceDossier";
import { listVehicles, createVehicle, updateVehicle, makeHistory, compressImage, isVehicleServerMode } from "@/lib/vehicleFleetData";
import type { Vehiculo } from "@/lib/vehicleTypes";
import { buildVehicleIndex, matchVehicle, linkageStats, toVehicleType, unitToVehicleDraft, vehicleAssignee } from "@/lib/fleetVehicleLink";
import { canAccessFleetMaintenance } from "@/lib/fleetMaintenanceAccess";
import { isApiConfigured, fleetDbSyncApi } from "@/lib/api";

const MONTH_LABELS: Record<string, string> = {
  enero: "Ene", febrero: "Feb", marzo: "Mar", abril: "Abr",
  mayo: "May", junio: "Jun", julio: "Jul", agosto: "Ago",
  septiembre: "Sep", octubre: "Oct", noviembre: "Nov", diciembre: "Dic",
};
const SHEET_YEAR = 2026; // año de la hoja Excel original (Control_gastos_...xlsx)
const AUTO_REFRESH_MS = 60_000;


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
  const [searchParams, setSearchParams] = useSearchParams();
  const userName = user?.fullName || "Sistema";

  const [refresh, setRefresh] = useState(0);
  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [vehicles, setVehicles] = useState<Vehiculo[]>([]);
  const loadVehicles = useCallback(async () => {
    try { setVehicles(await listVehicles()); } catch { /* Flotilla Vehicular no disponible */ }
  }, []);
  const sync = useCallback(async () => {
    loadVehicles();
    if (!isApiConfigured()) { setServerOnline(false); setRefresh(r => r + 1); return; }
    setSyncing(true);
    const ok = await refreshFromServer();
    setServerOnline(ok);
    setSyncing(false);
    setRefresh(r => r + 1);
  }, []);

  useEffect(() => {
    (async () => {
      await sync();
      setLoading(false);
    })();
  }, [sync]);

  // Mantener el tablero al día: refresca cada minuto y al volver a la pestaña.
  useEffect(() => {
    if (!isApiConfigured()) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") sync(); }, AUTO_REFRESH_MS);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [sync]);

  // ── Vínculo con Flotilla Vehicular (fotos, asignación, historial) ──
  const vehicleIndex = useMemo(() => buildVehicleIndex(vehicles), [vehicles]);

  const fleet = useMemo(() => getFleet(), [refresh]);
  const registeredUnits = useMemo(() => getRegisteredUnits(), [refresh]);
  const talleres = useMemo(() => getTalleres(), [refresh]);
  const entries = useMemo(() => getMaintenanceEntries(), [refresh]);
  const totals = useMemo(() => getTotals(entries), [entries]);
  const unitByPlaca = useMemo(() => {
    const m = new Map<string, FleetUnit>();
    for (const u of registeredUnits) { const k = normalizePlaca(u.placa); if (k && !m.has(k)) m.set(k, u); }
    return m;
  }, [registeredUnits]);
  const matchFor = useCallback((placa: string) => {
    const k = normalizePlaca(placa);
    return matchVehicle(vehicleIndex, k, unitByPlaca.get(k)?.chasis);
  }, [vehicleIndex, unitByPlaca]);
  const linkStats = useMemo(() => linkageStats(fleet, vehicleIndex), [fleet, vehicleIndex]);
  const [dossierPlaca, setDossierPlaca] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const localOnly = useMemo(() => (serverOnline ? getLocalOnlyEntries() : []), [refresh, serverOnline]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => availableYears(entries, currentYear), [entries, currentYear]);
  const [annualYear, setAnnualYear] = useState<number>(currentYear);
  const annual = useMemo(() => buildAnnualMatrix(entries, fleet, annualYear), [entries, fleet, annualYear]);
  const annualTotal = useMemo(() => annual.reduce((s, r) => s + r.total, 0), [annual]);
  const sheetDiffs = useMemo(
    () => (annualYear === SHEET_YEAR ? reconcileWithSheet(getSheetAnnualCost(), buildAnnualMatrix(entries, fleet, SHEET_YEAR)) : []),
    [entries, fleet, annualYear, refresh],
  );
  const [showDiffs, setShowDiffs] = useState(false);

  // Entry dialog helpers
  const [placaOpen, setPlacaOpen] = useState(false);
  const [newTaller, setNewTaller] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [originalPlaca, setOriginalPlaca] = useState<string | undefined>(undefined);

  const [tab, setTab] = useState<"dashboard" | "log" | "annual" | "fleet" | "db">("dashboard");
  // Llevar gastos a la base SafeOne: solo Chrisnel Fabián y quien ella designe (lo decide el servidor).
  const [dbAccess, setDbAccess] = useState<{ canSync: boolean; isOwner: boolean; delegates: string[] } | null>(null);
  useEffect(() => {
    if (!isApiConfigured()) return;
    fleetDbSyncApi.access().then(setDbAccess).catch(() => setDbAccess(null));
  }, [user?.email]);
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

  const hasAccess = canAccessFleetMaintenance(user);

  // ?placa=XXX abre la ficha de la unidad (enlaces desde Flotilla Vehicular)
  useEffect(() => {
    const p = searchParams.get("placa");
    if (p) setDossierPlaca(normalizePlaca(p));
  }, [searchParams]);
  const closeDossier = () => {
    setDossierPlaca(null);
    if (searchParams.get("placa")) { searchParams.delete("placa"); setSearchParams(searchParams, { replace: true }); }
  };

  // Filtering
  const filteredEntries = useMemo(() => {
    let list = entries;
    if (filterKind !== "all") list = list.filter((e) => e.kind === filterKind);
    if (filterPlaca !== "all") list = list.filter((e) => e.placa === filterPlaca);
    if (filterMes !== "all") list = list.filter((e) => monthKeyOf(e.fecha) === filterMes);
    if (search.trim()) {
      const t = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.placa.toLowerCase().includes(t.replace(/[\s\-.]/g, "")) ||
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
  const resetEntryHelpers = (placa?: string) => {
    setEntryError(null); setNewTaller(null); setPlacaOpen(false); setOriginalPlaca(placa);
  };
  const applyUnitToEntry = (d: MaintenanceEntry, u: FleetUnit) => {
    const pk = normalizePlaca(u.placa);
    d.placa = pk; d.kind = unitKind(u);
    const v = matchFor(pk)?.vehicle;
    if (!d.asignacion && v) d.asignacion = vehicleAssignee(v);
    return d;
  };
  const openCreateEntry = (forPlaca?: string) => {
    resetEntryHelpers();
    const d = emptyEntry();
    const target = typeof forPlaca === "string" ? forPlaca : filterPlaca !== "all" ? filterPlaca : null;
    if (target) {
      const u = findUnitByPlaca(registeredUnits, target);
      if (u) applyUnitToEntry(d, u);
    }
    setEntryDialog({ open: true, data: d, mode: "create" });
  };
  const openEditEntry = (e: MaintenanceEntry & { id?: string }) => {
    resetEntryHelpers(e.placa);
    setEntryDialog({ open: true, data: { ...e }, mode: "edit" });
  };
  const entryKeyOf = (e: MaintenanceEntry) => `${e.placa}|${e.fecha}|${e.costo}|${e.detalle ?? ""}`;
  const selectedUnit = entryDialog.data ? findUnitByPlaca(registeredUnits, entryDialog.data.placa) : undefined;
  const selectedVehicle = selectedUnit ? matchFor(selectedUnit.placa)?.vehicle : undefined;
  const placaIsLegacy = !!entryDialog.data?.placa && !selectedUnit && entryDialog.mode === "edit"
    && normalizePlaca(entryDialog.data.placa) === normalizePlaca(originalPlaca);

  const saveEntry = async () => {
    if (!entryDialog.data) return;
    const d = { ...entryDialog.data };
    // Taller nuevo escrito en el formulario → se agrega al catálogo estandarizado
    if (newTaller !== null) {
      if (!newTaller.trim()) { setEntryError("Escriba el nombre del nuevo taller o elija uno de la lista."); return; }
      try { d.taller = await addTaller(newTaller); } catch (err: any) { setEntryError(err.message); return; }
    }
    const placaCheck = validateExpensePlaca(registeredUnits, d.placa);
    if (!placaCheck.ok && !placaIsLegacy) { setEntryError(placaCheck.error); return; }
    if (!d.fecha) { setEntryError("La fecha es obligatoria."); return; }
    if (!(Number(d.costo) > 0)) { setEntryError("El costo debe ser mayor que cero."); return; }
    if (!d.taller) { setEntryError("Debe seleccionar el taller."); return; }
    const payload = { ...d, costo: Number(d.costo) };
    try {
      if (entryDialog.mode === "create") {
        await addMaintenanceEntry(payload);
        toast({ title: "Registro creado", description: `${normalizePlaca(d.placa)} — ${formatRD(payload.costo)}` });
      } else {
        await updateMaintenanceEntry((d as any).id || entryKeyOf(entryDialog.data), payload, originalPlaca);
        toast({ title: "Registro actualizado" });
      }
      // Sin servidor, la trazabilidad en Flotilla Vehicular se anota aquí (con servidor la hace el backend).
      if (!serverOnline && !isVehicleServerMode()) {
        const v = matchFor(d.placa)?.vehicle;
        if (v) {
          const km = Number(payload.kilometraje) || 0;
          await updateVehicle(v.id, {
            ultimoMantenimiento: !v.ultimoMantenimiento || v.ultimoMantenimiento < payload.fecha ? payload.fecha : v.ultimoMantenimiento,
            kilometraje: Math.max(Number(v.kilometraje) || 0, km),
          }, [makeHistory("mantenimiento", `Gasto ${entryDialog.mode === "create" ? "registrado" : "actualizado"}: ${payload.tipoMant || "Gasto"} en ${payload.taller} — ${formatRD(payload.costo)} (${payload.fecha})`, userName)]).catch(() => {});
        }
      }
      setEntryDialog({ open: false, data: null, mode: "create" });
      resetEntryHelpers();
      await sync();
    } catch (err: any) {
      setEntryError(err.message);
    }
  };

  const doUploadLocal = async () => {
    try {
      const r = await uploadLocalEntries();
      toast({
        title: `${r.uploaded} registro(s) subidos al servidor`,
        description: r.failed.length ? `${r.failed.length} no se pudieron subir: ${r.failed[0].error}` : undefined,
        variant: r.failed.length ? "destructive" : undefined,
      });
      setRefresh(x => x + 1);
    } catch (err: any) {
      toast({ title: "No se pudo subir", description: err.message, variant: "destructive" });
    }
  };

  const registerInFleet = async (u: FleetUnit) => {
    try {
      const v = await createVehicle({ ...unitToVehicleDraft(u), creadoPor: userName }, userName);
      toast({ title: "Registrada en Flotilla Vehicular", description: `${v.id} — ${v.placa}. Ya puede agregarle foto y asignación.` });
      await loadVehicles();
    } catch (err: any) {
      toast({ title: "No se pudo registrar", description: err.message, variant: "destructive" });
    }
  };
  const registerAllMissing = async () => {
    setBulkBusy(true);
    let ok = 0; const errors: string[] = [];
    for (const u of linkStats.unlinked) {
      try { await createVehicle({ ...unitToVehicleDraft(u), creadoPor: userName }, userName); ok++; }
      catch (err: any) { errors.push(`${normalizePlaca(u.placa)}: ${err.message}`); }
    }
    await loadVehicles();
    setBulkBusy(false);
    toast({
      title: `${ok} unidad(es) registradas en Flotilla Vehicular`,
      description: errors.length ? `${errors.length} con error. ${errors[0]}` : "Ahora puede cargar sus fotos y asignaciones.",
      variant: errors.length ? "destructive" : undefined,
    });
  };
  const savePhoto = async (v: Vehiculo, file: File) => {
    try {
      const dataUrl = await compressImage(file);
      await updateVehicle(v.id, { documentos: { ...(v.documentos || {}), fotoVehiculo: dataUrl } },
        [makeHistory("documento", "Foto del vehículo actualizada desde Flotilla — Mantenimiento", userName)]);
      toast({ title: "Foto guardada", description: `${v.placa} — visible también en Flotilla Vehicular.` });
      await loadVehicles();
    } catch (err: any) {
      toast({ title: "No se pudo guardar la foto", description: err.message, variant: "destructive" });
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
      setUnitDialog({ open: false, data: null, mode: "create" });
      await sync();
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
      toast({ title: "Eliminado", description: confirmDelete.label });
      setConfirmDelete(null);
      await sync();
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    }
  };

  // Aggregations for dashboard
  const motoCount = fleet.filter((u) => u.tipo.toUpperCase().includes("MOTO")).length;
  const vehCount = fleet.length - motoCount;
  const topUnits = useMemo(() => Object.entries(totals.byPlaca).sort((a, b) => b[1] - a[1]).slice(0, 8), [totals]);
  // Últimos 12 meses con gasto, en orden cronológico
  const monthBreakdown = useMemo(() => totals.byMonth.slice(-12), [totals]);
  const monthMax = useMemo(() => Math.max(1, ...monthBreakdown.map(m => m.total)), [monthBreakdown]);
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

  // Placa con miniatura del vehículo: abre la ficha de trazabilidad
  const PlacaCell = ({ placa, showThumb = true }: { placa: string; showThumb?: boolean }) => {
    const m = matchFor(placa);
    const u = unitByPlaca.get(normalizePlaca(placa));
    return (
      <button type="button" onClick={() => setDossierPlaca(normalizePlaca(placa))}
        className="inline-flex items-center gap-2 hover:opacity-80 text-left" title="Ver ficha del vehículo">
        {showThumb && <VehicleAvatar tipo={m?.vehicle.tipo || toVehicleType(u?.tipo)} photo={m?.vehicle.documentos?.fotoVehiculo} size="sm" />}
        <Badge variant="outline" className="font-mono text-[11px] cursor-pointer">{placa}</Badge>
        {m ? <Link2 className="h-3 w-3 text-primary" aria-label="Vinculada con Flotilla Vehicular" />
          : <Unlink className="h-3 w-3 text-muted-foreground" aria-label="Sin ficha en Flotilla Vehicular" />}
      </button>
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
                {serverOnline && getLastSync() && (
                  <span className="text-[11px] text-muted-foreground">
                    · Actualizado {new Date(getLastSync()!).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {isApiConfigured() && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-[11px]" onClick={sync} disabled={syncing}>
                    <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} /> Actualizar
                  </Button>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Gasto total acumulado</p>
              <p className="text-2xl font-bold text-primary">{formatRD(totals.total)}</p>
              <p className="text-[11px] text-muted-foreground">{totals.entriesCount} registros</p>
            </div>
          </div>

          {!loading && !serverOnline && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-accent/50 bg-accent/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-accent-foreground shrink-0" />
              <p className="text-foreground">
                <strong>Sin conexión con el servidor.</strong>{" "}
                Los gastos que registre ahora se guardan solo en este navegador y no los verán otros equipos.
                Cuando vuelva la conexión podrá subirlos desde aquí.
              </p>
            </div>
          )}
          {serverOnline && localOnly.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <Upload className="h-4 w-4 text-primary shrink-0" />
              <p className="flex-1 min-w-[240px] text-foreground">
                Hay <strong>{localOnly.length}</strong> gasto(s) guardado(s) solo en este navegador
                ({formatRD(localOnly.reduce((s, e) => s + (Number(e.costo) || 0), 0))}). Súbalos para que aparezcan en el tablero de todos.
              </p>
              <Button size="sm" onClick={doUploadLocal} className="gap-1">
                <Upload className="h-4 w-4" /> Subir al servidor
              </Button>
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className={`grid w-full ${dbAccess?.canSync ? "grid-cols-5 max-w-3xl" : "grid-cols-4 max-w-2xl"}`}>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="log">Registro de Gastos</TabsTrigger>
              <TabsTrigger value="annual">Costo Anual</TabsTrigger>
              <TabsTrigger value="fleet">Flotilla</TabsTrigger>
              {dbAccess?.canSync && <TabsTrigger value="db">Adonis</TabsTrigger>}
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

              <Card>
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className="flex -space-x-2">
                    {fleet.slice(0, 6).map((u) => {
                      const m = matchFor(String(u.placa));
                      return (
                        <span key={`${u.no}-${u.placa}`} className="rounded-lg ring-2 ring-background">
                          <VehicleAvatar tipo={m?.vehicle.tipo || toVehicleType(u.tipo)} photo={m?.vehicle.documentos?.fotoVehiculo} size="sm" />
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-sm font-semibold flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Vínculo con Flotilla Vehicular</p>
                    <p className="text-xs text-muted-foreground">
                      {linkStats.linked} de {linkStats.total} unidades vinculadas · {linkStats.withPhoto} con foto
                      {linkStats.unlinked.length > 0 && <> · <span className="text-destructive">{linkStats.unlinked.length} sin ficha</span></>}
                    </p>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2 max-w-md">
                      <div className="h-full bg-primary" style={{ width: `${linkStats.total ? (linkStats.linked / linkStats.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTab("fleet")}>Ver unidades</Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Top unidades por gasto</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {topUnits.map(([placa, value]) => {
                      const max = topUnits[0][1] || 1;
                      const pct = (value / max) * 100;
                      const m = matchFor(placa);
                      const u = unitByPlaca.get(placa);
                      return (
                        <button key={placa} onClick={() => setDossierPlaca(placa)} className="w-full text-left group flex items-center gap-3">
                          <VehicleAvatar tipo={m?.vehicle.tipo || toVehicleType(u?.tipo)} photo={m?.vehicle.documentos?.fotoVehiculo} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-1 gap-2">
                              <span className="font-medium group-hover:text-primary truncate">
                                {placa} <span className="text-muted-foreground font-normal">{u ? `· ${u.marca} ${u.modelo}` : ""}</span>
                              </span>
                              <span className="text-muted-foreground shrink-0">{formatRD(value)}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary group-hover:bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
                            </div>
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
                    {monthBreakdown.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sin gastos registrados todavía.</p>
                    )}
                    {monthBreakdown.map((m) => {
                      const pct = (m.total / monthMax) * 100;
                      return (
                        <button key={m.key} onClick={() => goToLog({ mes: m.key })} className="w-full text-left group">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium group-hover:text-primary">
                              {m.label} <span className="text-muted-foreground font-normal">· {m.count} reg.</span>
                            </span>
                            <span className="text-muted-foreground tabular-nums">{formatRD(m.total)}</span>
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
                  {[...totals.byMonth].reverse().map((m) => (<option key={m.key} value={m.key}>{m.label}</option>))}
                </select>
                {hasActiveFilter && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-3 w-3" /> Limpiar
                  </Button>
                )}
                <Button size="sm" onClick={() => openCreateEntry()} className="gap-1 ml-auto">
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
                          <TableCell className="text-xs whitespace-nowrap">{(() => { const k = monthKeyOf(e.fecha); return k ? monthLabel(k) : "—"; })()}</TableCell>
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
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      Costo de mantenimiento anual
                      <select value={annualYear} onChange={(e) => setAnnualYear(Number(e.target.value))}
                        aria-label="Año" className="border rounded-md px-2 py-1 text-sm bg-background font-semibold">
                        {years.map((y) => (<option key={y} value={y}>{y}</option>))}
                      </select>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculado a partir de los gastos registrados
                      {annualYear === currentYear ? ` · acumulado al ${new Date().toLocaleDateString("es-DO")}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total {annualYear}</p>
                    <p className="text-2xl font-bold text-primary tabular-nums">{formatRD(annualTotal)}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sheetDiffs.length > 0 && (
                    <div className="rounded-lg border border-accent/50 bg-accent/10 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-accent-foreground shrink-0" />
                        <p className="flex-1 min-w-[240px]">
                          La hoja Excel original tiene <strong>{sheetDiffs.length}</strong> diferencia(s) con los gastos registrados
                          (neto {formatRD(sheetDiffs.reduce((s, d) => s + d.diferencia, 0))}). Registre los gastos faltantes para que el total coincida.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => setShowDiffs(v => !v)}>
                          {showDiffs ? "Ocultar detalle" : "Ver detalle"}
                        </Button>
                      </div>
                      {showDiffs && (
                        <div className="mt-3 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Placa</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Mes</TableHead>
                                <TableHead className="text-right">Hoja Excel</TableHead>
                                <TableHead className="text-right">Registrado</TableHead>
                                <TableHead className="text-right">Falta registrar</TableHead>
                                <TableHead />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sheetDiffs.map((d, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-xs">{d.placa}</TableCell>
                                  <TableCell className="text-xs">{d.descripcion}</TableCell>
                                  <TableCell className="text-xs">{MONTH_LABELS[d.mes]}</TableCell>
                                  <TableCell className="text-right text-xs tabular-nums">{formatRD(d.hoja)}</TableCell>
                                  <TableCell className="text-right text-xs tabular-nums">{formatRD(d.registros)}</TableCell>
                                  <TableCell className={`text-right text-xs tabular-nums font-semibold ${d.diferencia < 0 ? "text-destructive" : "text-primary"}`}>
                                    {formatRD(d.diferencia)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                      onClick={() => goToLog({ placa: d.placa, mes: `${SHEET_YEAR}-${String(MONTH_KEYS.indexOf(d.mes) + 1).padStart(2, "0")}` })}>
                                      Ver gastos
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
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
                          <TableRow key={i} className={row.registered ? undefined : "bg-destructive/5"}>
                            <TableCell className="text-xs">
                              {row.descripcion}
                              {!row.registered && (
                                <Badge variant="outline" className="ml-2 text-[10px] border-destructive/50 text-destructive">No registrada en Flotilla</Badge>
                              )}
                            </TableCell>
                            <TableCell>{row.placa ? <PlacaCell placa={row.placa} showThumb={false} /> : <Badge variant="outline" className="font-mono text-[11px]">—</Badge>}</TableCell>
                            {Object.keys(MONTH_LABELS).map((m) => {
                              const v = row.monthly[m as keyof typeof row.monthly] || 0;
                              return (<TableCell key={m} className="text-right text-xs tabular-nums">{v ? v.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}</TableCell>);
                            })}
                            <TableCell className="text-right font-semibold tabular-nums">{formatRD(row.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/60 border-t-2 border-primary/40 font-bold">
                          <TableCell className="text-sm font-bold">TOTAL GENERAL {annualYear}</TableCell>
                          <TableCell />
                          {Object.keys(MONTH_LABELS).map((m) => {
                            const monthTotal = annual.reduce((s, r) => s + (r.monthly[m as keyof typeof r.monthly] || 0), 0);
                            return (<TableCell key={m} className="text-right text-xs tabular-nums font-bold text-primary">{monthTotal ? monthTotal.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}</TableCell>);
                          })}
                          <TableCell className="text-right text-sm font-bold text-primary tabular-nums">{formatRD(annualTotal)}</TableCell>
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
                <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Listado de Flotilla — {fleet.length} unidades</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {linkStats.linked} vinculadas con Flotilla Vehicular · {linkStats.withPhoto} con foto
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {linkStats.unlinked.length > 0 && (
                      <Button size="sm" variant="outline" onClick={registerAllMissing} disabled={bulkBusy} className="gap-1">
                        {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        Registrar {linkStats.unlinked.length} sin ficha en Flotilla Vehicular
                      </Button>
                    )}
                    <Button size="sm" onClick={openCreateUnit} className="gap-1">
                      <Plus className="h-4 w-4" /> Nueva unidad
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Año</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Chasis</TableHead>
                          <TableHead>Asignado a</TableHead>
                          <TableHead>Aseguradora</TableHead>
                          <TableHead className="text-right">Gasto Mant.</TableHead>
                          <TableHead className="text-right w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fleet.map((u) => {
                          const placaStr = String(u.placa);
                          const spend = totals.byPlaca[normalizePlaca(placaStr)] || 0;
                          const vm = matchVehicle(vehicleIndex, placaStr, u.chasis);
                          return (
                            <TableRow key={`${u.no}-${placaStr}`}>
                              <TableCell className="text-xs">{u.no}</TableCell>
                              <TableCell><PlacaCell placa={placaStr} /></TableCell>
                              <TableCell className="text-xs">{u.tipo}</TableCell>
                              <TableCell className="text-xs">{u.marca}</TableCell>
                              <TableCell className="text-xs">{u.modelo}</TableCell>
                              <TableCell className="text-xs">{u.anio}</TableCell>
                              <TableCell className="text-xs">{u.color}</TableCell>
                              <TableCell className="text-[11px] font-mono">{u.chasis}</TableCell>
                              <TableCell className="text-xs">
                                {vm ? (vehicleAssignee(vm.vehicle) || <span className="text-muted-foreground">Disponible</span>)
                                  : <button type="button" className="text-destructive hover:underline inline-flex items-center gap-1 whitespace-nowrap" onClick={() => registerInFleet(u)}>
                                      <Unlink className="h-3 w-3" /> Registrar ficha
                                    </button>}
                              </TableCell>
                              <TableCell className="text-xs">{u.aseguradora}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums font-medium cursor-pointer hover:text-primary"
                                onClick={() => spend > 0 && goToLog({ placa: normalizePlaca(placaStr) })}>
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

            {dbAccess?.canSync && (
              <TabsContent value="db" className="mt-6">
                <FleetDbSyncPanel isOwner={dbAccess.isOwner} initialDelegates={dbAccess.delegates} onRegistered={sync} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* ENTRY DIALOG */}
      <Dialog open={entryDialog.open} onOpenChange={(o) => !o && setEntryDialog({ open: false, data: null, mode: "create" })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entryDialog.mode === "create" ? "Nuevo gasto de mantenimiento" : "Editar gasto"}</DialogTitle>
            <DialogDescription>
              {serverOnline ? "Se guarda en el servidor de la intranet." : "Sin servidor: se guardará solo en este navegador."}
              {" "}Solo se aceptan placas registradas en la Flotilla.
            </DialogDescription>
          </DialogHeader>
          {entryDialog.data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Unidad (placa) *</Label>
                <Popover open={placaOpen} onOpenChange={setPlacaOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={placaOpen} aria-label="Placa"
                      className="w-full justify-between font-normal h-auto min-h-10 py-2">
                      {selectedUnit ? (
                        <span className="flex items-center gap-2 text-left min-w-0">
                          <VehicleAvatar tipo={selectedVehicle?.tipo || toVehicleType(selectedUnit.tipo)} photo={selectedVehicle?.documentos?.fotoVehiculo} size="sm" />
                          <span className="font-mono font-semibold">{normalizePlaca(selectedUnit.placa)}</span>
                          <span className="text-muted-foreground text-xs truncate">{selectedUnit.marca} {selectedUnit.modelo} {selectedUnit.color}</span>
                        </span>
                      ) : placaIsLegacy ? (
                        <span className="font-mono">{normalizePlaca(entryDialog.data.placa)}</span>
                      ) : (
                        <span className="text-muted-foreground">Seleccione una unidad registrada…</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar placa, marca o modelo…" />
                      <CommandList>
                        <CommandEmpty>
                          Esa placa no está registrada. Agréguela primero en la pestaña Flotilla.
                        </CommandEmpty>
                        <CommandGroup>
                          {registeredUnits.map((u) => {
                            const pk = normalizePlaca(u.placa);
                            const vm = matchFor(pk);
                            return (
                              <CommandItem key={`${u.fuente}-${pk}`} value={`${pk} ${u.marca} ${u.modelo} ${u.tipo} ${vehicleAssignee(vm?.vehicle) || ""}`}
                                onSelect={() => {
                                  setEntryDialog(s => ({ ...s, data: applyUnitToEntry({ ...s.data!, asignacion: s.mode === "create" ? null : s.data!.asignacion }, u) }));
                                  setEntryError(null);
                                  setPlacaOpen(false);
                                }}>
                                <Check className={`h-4 w-4 mr-2 shrink-0 ${selectedUnit && normalizePlaca(selectedUnit.placa) === pk ? "opacity-100" : "opacity-0"}`} />
                                <span className="mr-2 shrink-0"><VehicleAvatar tipo={vm?.vehicle.tipo || toVehicleType(u.tipo)} photo={vm?.vehicle.documentos?.fotoVehiculo} size="sm" /></span>
                                <span className="font-mono font-semibold mr-2">{pk}</span>
                                <span className="text-xs text-muted-foreground truncate flex-1">{u.tipo} {u.marca} {u.modelo}</span>
                                {u.fuente && u.fuente !== "Flotilla" && (
                                  <Badge variant="secondary" className="text-[10px] ml-2">{u.fuente}</Badge>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {placaIsLegacy && (
                  <p className="text-[11px] text-destructive mt-1">
                    Este gasto antiguo usa una placa que no está en la Flotilla. Puede guardarlo así o elegir una unidad registrada.
                  </p>
                )}
                {selectedUnit && (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2 text-[11px]">
                    <VehicleAvatar tipo={selectedVehicle?.tipo || toVehicleType(selectedUnit.tipo)} photo={selectedVehicle?.documentos?.fotoVehiculo} size="md" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-medium">{unitKind(selectedUnit) === "motocicleta" ? "Motocicleta" : "Vehículo"} · {selectedUnit.marca} {selectedUnit.modelo} {selectedUnit.anio}</p>
                      {selectedVehicle ? (
                        <p className="text-muted-foreground flex items-center gap-1 flex-wrap">
                          <UserCheck className="h-3 w-3" /> {vehicleAssignee(selectedVehicle) || "Disponible"}
                          {selectedVehicle.kilometraje ? <> · Último km: {Number(selectedVehicle.kilometraje).toLocaleString("es-DO")}</> : null}
                          <> · {selectedVehicle.id}</>
                        </p>
                      ) : (
                        <p className="text-destructive flex items-center gap-1"><Unlink className="h-3 w-3" /> Sin ficha en Flotilla Vehicular (sin foto ni asignación)</p>
                      )}
                    </div>
                  </div>
                )}
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
                  {TIPOS_MANT.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Taller *</Label>
                {newTaller === null ? (
                  <select aria-label="Taller" value={entryDialog.data.taller || ""}
                    onChange={(e) => {
                      if (e.target.value === "__new__") { setNewTaller(""); return; }
                      setEntryDialog(s => ({ ...s, data: { ...s.data!, taller: e.target.value } }));
                    }}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                    <option value="" disabled>Seleccione el taller…</option>
                    {entryDialog.data.taller && !talleres.includes(entryDialog.data.taller) && (
                      <option value={entryDialog.data.taller}>{entryDialog.data.taller}</option>
                    )}
                    {talleres.map((t) => (<option key={t} value={t}>{t}</option>))}
                    <option value="__new__">+ Agregar taller nuevo…</option>
                  </select>
                ) : (
                  <div className="flex gap-1">
                    <Input autoFocus aria-label="Nombre del taller nuevo" placeholder="Nombre del taller nuevo" value={newTaller}
                      onChange={(e) => setNewTaller(e.target.value)} />
                    <Button variant="ghost" size="icon" aria-label="Cancelar taller nuevo" onClick={() => setNewTaller(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {newTaller !== null && newTaller.trim() && (() => {
                  const match = talleres.find((t) => tallerKey(t) === tallerKey(newTaller));
                  return match ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Ya existe como «{match}»; se usará ese nombre.</p>
                  ) : null;
                })()}
              </div>
              <div>
                <Label className="text-xs">Kilometraje</Label>
                <Input type="number" value={entryDialog.data.kilometraje || ""} onChange={(e) => setEntryDialog(s => ({ ...s, data: { ...s.data!, kilometraje: e.target.value ? Number(e.target.value) : null } }))} />
                {selectedVehicle && Number(entryDialog.data.kilometraje) > 0 && Number(entryDialog.data.kilometraje) < Number(selectedVehicle.kilometraje || 0) && (
                  <p className="text-[11px] text-destructive mt-1">Es menor al último registrado en Flotilla Vehicular ({Number(selectedVehicle.kilometraje).toLocaleString("es-DO")} km).</p>
                )}
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
          {entryError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {entryError}
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

      <VehicleMaintenanceDossier
        placa={dossierPlaca}
        onOpenChange={(o) => !o && closeDossier()}
        unit={dossierPlaca ? unitByPlaca.get(dossierPlaca) : undefined}
        match={dossierPlaca ? matchFor(dossierPlaca) : null}
        entries={entries}
        canManageVehicles={!!user}
        onRegisterInFleet={registerInFleet}
        onPhotoSelected={savePhoto}
        onNewExpense={(p) => { closeDossier(); openCreateEntry(p); }}
        onViewLog={(p) => { closeDossier(); clearFilters(); goToLog({ placa: p }); }}
        onOpenFleet={(p) => navigate(`/flotilla?placa=${encodeURIComponent(p)}`)}
      />

      <Footer />
    </AppLayout>
  );
}
