/**
 * Pestaña "Actividad Kronos" para el módulo Seguimiento Clientes Monitoreo.
 *
 * Carga UN único archivo .htm exportado del Kronos NET (las señales de apertura
 * y cierre vienen mezcladas en el mismo reporte). Calcula la criticidad por cuenta
 * tomando la última señal disponible y la cruza con el catálogo OSM para alertar
 * discrepancias.
 *
 * Persistencia por cuenta (`monitoringAccountSettingsApi`):
 *   - kind: "regular" | "panic" → si es botón de pánico no aplican apertura/cierre
 *   - manualStatus: estado fijo seteado por un humano (Activo, Inactivo, Sin
 *     notificaciones, Dado de baja, Cancelado, Suspendido por falta de pago).
 *     Cuando hay manualStatus distinto de "Activo" no se levanta alerta de inactividad.
 *   - expectedOpen / expectedClose / notes (horario esperado).
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileUp, AlertTriangle, Phone, Download, Search, X, ShieldAlert, Pencil, Settings2, Siren,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseKronosHtmFile, type KronosParsedReport, type CriticidadInactividad,
} from "@/lib/kronosHtmParser";
import type { OSMClient } from "@/lib/osmClientData";
import {
  monitoringReportsApi, monitoringAccountSettingsApi,
  type MonitoringReportMeta, type MonitoringAccountSetting, type MonitoringManualStatus,
} from "@/lib/api";

const MANUAL_STATUSES: MonitoringManualStatus[] = [
  "Activo", "Inactivo", "Sin notificaciones",
  "Dado de baja", "Cancelado", "Suspendido por falta de pago",
];
const STATUS_COLOR: Record<MonitoringManualStatus, string> = {
  "Activo": "text-emerald-400 border-emerald-500/30",
  "Inactivo": "text-muted-foreground border-border",
  "Sin notificaciones": "text-blue-400 border-blue-500/30",
  "Dado de baja": "text-red-400 border-red-500/30",
  "Cancelado": "text-red-400 border-red-500/30",
  "Suspendido por falta de pago": "text-amber-400 border-amber-500/30",
};

const CRIT_LABEL: Record<CriticidadInactividad, string> = {
  baja: "Baja (1 día)",
  media: "Media (2 días)",
  alta: "Alta (3+ días / sin señal)",
};
const CRIT_COLOR: Record<CriticidadInactividad, string> = {
  baja: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  media: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  alta: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface CombinedRow {
  accountCode: string;
  accountName: string;
  estado: string;
  lastSignal: string | null;
  lastOpen: string | null;
  lastClose: string | null;
  sameDayCycle: boolean;
  daysSince: number | null;
  criticidad: CriticidadInactividad | "ok";
  osm?: OSMClient;
  setting?: MonitoringAccountSetting;
  isPanic: boolean;
  isMuted: boolean; // manualStatus que silencia alertas
  discrepancia?: string;
}

type FilterKey = "all" | "ok" | CriticidadInactividad | "discrepancia" | "panic" | "muted";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  clients: OSMClient[];
}

const PANIC_MUTING_STATUSES = new Set<MonitoringManualStatus>([
  "Inactivo", "Sin notificaciones", "Dado de baja", "Cancelado", "Suspendido por falta de pago",
]);

export default function KronosActivityTab({ clients }: Props) {
  const [report, setReport] = useState<KronosParsedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCrit, setFilterCrit] = useState<FilterKey>("all");
  const [settings, setSettings] = useState<Record<string, MonitoringAccountSetting>>({});
  const [editing, setEditing] = useState<{ code: string; name: string } | null>(null);
  const [draft, setDraft] = useState<Partial<MonitoringAccountSetting>>({});
  const [history, setHistory] = useState<MonitoringReportMeta[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<MonitoringReportMeta | null>(null);

  const loadSettings = async () => {
    try {
      const list = await monitoringAccountSettingsApi.list();
      const m: Record<string, MonitoringAccountSetting> = {};
      list.forEach(s => { m[s.accountCode] = s; });
      setSettings(m);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") console.warn("Settings:", e.message);
    }
  };

  const loadHistory = async () => {
    try {
      const list = await monitoringReportsApi.list("kronos");
      setHistory(list);
      if (!activeReportId && list.length > 0) await loadReport(list[0].id);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") console.warn("Historial Kronos:", e.message);
    }
  };

  const loadReport = async (id: string) => {
    setLoading(true);
    try {
      const doc = await monitoringReportsApi.get<KronosParsedReport>(id);
      setReport(doc.payload);
      setActiveReportId(doc.id);
      setReportMeta({ id: doc.id, kind: doc.kind, reportDate: doc.reportDate, fileName: doc.fileName, uploadedAt: doc.uploadedAt, uploadedBy: doc.uploadedBy });
    } catch (e: any) {
      toast.error(`Error al cargar reporte: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); loadHistory(); /* eslint-disable-next-line */ }, []);

  const openEdit = (code: string, name: string) => {
    setEditing({ code, name });
    const cur = settings[code];
    setDraft(cur ? { ...cur } : {
      accountCode: code, accountName: name, kind: "regular", manualStatus: null,
      expectedOpen: null, expectedClose: null, notes: "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const saved = await monitoringAccountSettingsApi.upsert(editing.code, {
        accountName: editing.name,
        kind: (draft.kind === "panic" ? "panic" : "regular"),
        manualStatus: draft.manualStatus || null,
        expectedOpen: draft.expectedOpen || null,
        expectedClose: draft.expectedClose || null,
        notes: draft.notes || "",
      });
      setSettings(prev => ({ ...prev, [editing.code]: saved }));
      toast.success(`Configuración guardada para ${editing.name}`);
      setEditing(null);
    } catch (e: any) {
      if (e.message === "API_NOT_CONFIGURED") {
        toast.error("Backend no configurado: no se pudo persistir");
      } else toast.error(`No se pudo guardar: ${e.message}`);
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const parsed = await parseKronosHtmFile(file);
      if (parsed.rows.length === 0) {
        toast.error("No se detectaron cuentas. Verifica que el archivo sea el reporte HTM de Kronos NET.");
        return;
      }
      setReport(parsed);
      try {
        const dateKey = parsed.reportDate ? parsed.reportDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const saved = await monitoringReportsApi.upsert<KronosParsedReport>({
          kind: "kronos", reportDate: dateKey, fileName: file.name, payload: parsed,
        });
        setActiveReportId(saved.id);
        setReportMeta({ id: saved.id, kind: saved.kind, reportDate: saved.reportDate, fileName: saved.fileName, uploadedAt: saved.uploadedAt, uploadedBy: saved.uploadedBy });
        await loadHistory();
        toast.success(`Reporte guardado (${parsed.rows.length} cuentas) — visible para todo el equipo`);
      } catch (e: any) {
        if (e.message === "API_NOT_CONFIGURED") toast.warning("Backend no configurado: el reporte solo es visible en esta sesión");
        else toast.error(`Reporte cargado pero no se pudo guardar: ${e.message}`);
      }
    } catch (e: any) {
      toast.error(`Error al procesar archivo: ${e.message}`);
    } finally { setLoading(false); }
  };

  const osmByCode = useMemo(() => {
    const m = new Map<string, OSMClient>();
    clients.forEach(c => { if (c.accountCode) m.set(c.accountCode.trim(), c); });
    return m;
  }, [clients]);

  const combined = useMemo<CombinedRow[]>(() => {
    if (!report) return [];
    const list: CombinedRow[] = [];
    const seen = new Set<string>();

    report.rows.forEach(r => {
      seen.add(r.accountCode);
      const osm = osmByCode.get(r.accountCode);
      const setting = settings[r.accountCode];
      const isPanic = setting?.kind === "panic";
      const isMuted = !!(setting?.manualStatus && PANIC_MUTING_STATUSES.has(setting.manualStatus));

      const alertas: string[] = [];
      if (!isPanic && !isMuted) {
        if (osm) {
          if (osm.monitoringStatus === "Activo" && r.criticidad === "alta") {
            alertas.push("Marcado ACTIVO en OSM pero sin señal hace 3+ días");
          }
          if (osm.hasBilling && r.criticidad === "alta") {
            alertas.push("Cliente facturado sin actividad reciente");
          }
          if (osm.systemStatus === "Apagado" || osm.systemStatus === "Suspendido") {
            alertas.push(`Sistema ${osm.systemStatus} en OSM`);
          }
        } else {
          alertas.push("Cuenta no existe en catálogo OSM");
        }
      }

      list.push({
        accountCode: r.accountCode,
        accountName: r.accountName,
        estado: r.estado,
        lastSignal: r.lastSignal,
        lastOpen: isPanic ? null : r.lastOpen,
        lastClose: isPanic ? null : r.lastClose,
        sameDayCycle: !isPanic && r.sameDayCycle,
        daysSince: r.daysSince,
        criticidad: isMuted ? "ok" : r.criticidad,
        osm, setting, isPanic, isMuted,
        discrepancia: alertas.join(" • ") || undefined,
      });
    });

    // Cuentas Activas en OSM que NO aparecieron
    clients.forEach(c => {
      if (!c.accountCode || seen.has(c.accountCode.trim())) return;
      if (c.monitoringStatus !== "Activo") return;
      const setting = settings[c.accountCode];
      const isPanic = setting?.kind === "panic";
      const isMuted = !!(setting?.manualStatus && PANIC_MUTING_STATUSES.has(setting.manualStatus));
      list.push({
        accountCode: c.accountCode, accountName: c.businessName, estado: "",
        lastSignal: null, lastOpen: null, lastClose: null, sameDayCycle: false,
        daysSince: null, criticidad: isMuted ? "ok" : "alta",
        osm: c, setting, isPanic, isMuted,
        discrepancia: isMuted || isPanic ? undefined : "Activo en OSM pero NO aparece en reporte Kronos",
      });
    });

    return list.sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));
  }, [report, clients, osmByCode, settings]);

  const stats = useMemo(() => {
    const operational = combined.filter(r => !r.isPanic && !r.isMuted);
    return {
      total: combined.length,
      alta: operational.filter(r => r.criticidad === "alta").length,
      media: operational.filter(r => r.criticidad === "media").length,
      baja: operational.filter(r => r.criticidad === "baja").length,
      ok: operational.filter(r => r.criticidad === "ok").length,
      panic: combined.filter(r => r.isPanic).length,
      muted: combined.filter(r => r.isMuted && !r.isPanic).length,
      discrepancias: combined.filter(r => r.discrepancia).length,
    };
  }, [combined]);

  const filtered = useMemo(() => {
    return combined.filter(r => {
      if (filterCrit === "panic") { if (!r.isPanic) return false; }
      else if (filterCrit === "muted") { if (!r.isMuted || r.isPanic) return false; }
      else if (filterCrit === "discrepancia") { if (!r.discrepancia) return false; }
      else if (filterCrit !== "all") {
        if (r.isPanic || r.isMuted) return false;
        if (r.criticidad !== filterCrit) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.accountCode.toLowerCase().includes(q)
          && !r.accountName.toLowerCase().includes(q)
          && !(r.osm?.businessName || "").toLowerCase().includes(q)
          && !(r.osm?.contact || "").toLowerCase().includes(q)
          && !(r.osm?.phone || "").includes(q)) return false;
      }
      return true;
    });
  }, [combined, filterCrit, search]);

  const exportCallList = () => {
    const toCall = combined.filter(r => !r.isPanic && !r.isMuted && (r.criticidad === "alta" || r.criticidad === "media"));
    if (toCall.length === 0) { toast.info("No hay cuentas para llamar"); return; }
    const csv = [
      ["Codigo", "Nombre", "Contacto", "Telefono", "Ultima senal", "Dias", "Criticidad", "Discrepancia"].join(","),
      ...toCall.map(r => [
        r.accountCode,
        `"${(r.osm?.businessName || r.accountName).replace(/"/g, '""')}"`,
        `"${(r.osm?.contact || "").replace(/"/g, '""')}"`,
        r.osm?.phone || "", r.lastSignal || "", r.daysSince ?? "",
        CRIT_LABEL[r.criticidad as CriticidadInactividad] || r.criticidad,
        `"${(r.discrepancia || "").replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Kronos_Llamadas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${toCall.length} cuentas exportadas`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" /> Cargar reporte Kronos NET (.htm)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground flex-1 min-w-[260px]">
                Exporta desde Kronos NET → "Resumen de estados de grupos de señales".
                Cada carga se guarda por fecha y queda visible para todo el equipo.
                Marca como <strong>Botón de pánico</strong> las cuentas de 4 dígitos que no
                deben evaluarse por apertura/cierre.
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
                  <SelectTrigger className="w-[280px] h-8 text-xs">
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

            {report && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">{report.rows.length} cuentas</Badge>
                <span className="text-muted-foreground">
                  {report.rawRowCount} señales · Reporte del{" "}
                  {report.reportDate ? new Date(report.reportDate).toLocaleString("es-DO") : "—"}
                </span>
                {reportMeta && (
                  <span className="text-muted-foreground">
                    · Cargado por <strong>{reportMeta.uploadedBy}</strong> el{" "}
                    {new Date(reportMeta.uploadedAt).toLocaleString("es-DO")}
                  </span>
                )}
                <Button size="sm" variant="ghost" className="h-6 ml-auto"
                  onClick={() => { setReport(null); setActiveReportId(null); setReportMeta(null); }}>
                  <X className="h-3 w-3 mr-1" /> Cerrar vista
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <KpiCard label="Total" value={stats.total} color="text-foreground"
              active={filterCrit === "all"} onClick={() => setFilterCrit("all")} />
            <KpiCard label="🟢 Al día" value={stats.ok} color="text-emerald-400"
              active={filterCrit === "ok"} onClick={() => setFilterCrit("ok")} />
            <KpiCard label="🔵 Baja" value={stats.baja} color="text-blue-400"
              active={filterCrit === "baja"} onClick={() => setFilterCrit("baja")} />
            <KpiCard label="🟡 Media" value={stats.media} color="text-amber-400"
              active={filterCrit === "media"} onClick={() => setFilterCrit("media")} />
            <KpiCard label="🔴 Alta" value={stats.alta} color="text-red-400"
              active={filterCrit === "alta"} onClick={() => setFilterCrit("alta")} />
            <KpiCard label="🚨 Pánico" value={stats.panic} color="text-purple-400"
              active={filterCrit === "panic"} onClick={() => setFilterCrit("panic")} />
            <KpiCard label="🔇 Silenciadas" value={stats.muted} color="text-muted-foreground"
              active={filterCrit === "muted"} onClick={() => setFilterCrit("muted")} />
          </div>

          {stats.discrepancias > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="pt-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <span className="text-sm">
                    <strong>{stats.discrepancias}</strong> cuentas con discrepancias entre Kronos y OSM.
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFilterCrit("discrepancia")}>
                  Ver discrepancias
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar cuenta, nombre, contacto, teléfono..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterCrit} onValueChange={(v: any) => setFilterCrit(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="ok">🟢 Al día</SelectItem>
                <SelectItem value="baja">🔵 Baja (1d)</SelectItem>
                <SelectItem value="media">🟡 Media (2d)</SelectItem>
                <SelectItem value="alta">🔴 Alta (3+d)</SelectItem>
                <SelectItem value="panic">🚨 Botón de pánico</SelectItem>
                <SelectItem value="muted">🔇 Silenciadas (estado manual)</SelectItem>
                <SelectItem value="discrepancia">⚠️ Discrepancias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportCallList} variant="default" size="sm">
              <Download className="h-4 w-4 mr-2" /> Exportar lista de llamadas
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Cuenta</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado manual</TableHead>
                    <TableHead className="text-right text-xs">Última señal</TableHead>
                    <TableHead className="text-center text-xs">Días</TableHead>
                    <TableHead className="text-xs">Apertura</TableHead>
                    <TableHead className="text-xs">Cierre</TableHead>
                    <TableHead className="text-xs">Ciclo</TableHead>
                    <TableHead className="text-xs">Horario</TableHead>
                    <TableHead>Criticidad</TableHead>
                    <TableHead className="text-xs">Teléfono</TableHead>
                    <TableHead className="text-xs max-w-[220px]">Alerta</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.accountCode} className={r.isPanic ? "bg-purple-500/5" : r.isMuted ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                      <TableCell className="font-medium text-sm">{r.osm?.businessName || r.accountName}</TableCell>
                      <TableCell>
                        {r.isPanic ? (
                          <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                            <Siren className="h-3 w-3 mr-1" /> Pánico
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">Estándar</span>}
                      </TableCell>
                      <TableCell>
                        {r.setting?.manualStatus ? (
                          <Badge variant="outline" className={STATUS_COLOR[r.setting.manualStatus]}>
                            {r.setting.manualStatus}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs">{fmtDate(r.lastSignal)}</TableCell>
                      <TableCell className="text-center">
                        {r.daysSince === null ? (
                          <Badge variant="outline" className="text-red-400 border-red-500/30">s/señal</Badge>
                        ) : (
                          <span className={`font-bold text-sm ${
                            r.isPanic || r.isMuted ? "text-muted-foreground"
                            : r.daysSince >= 3 ? "text-red-400"
                            : r.daysSince === 2 ? "text-amber-400"
                            : r.daysSince === 1 ? "text-blue-400" : "text-emerald-400"
                          }`}>{r.daysSince}d</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.isPanic ? <span className="text-muted-foreground">N/A</span>
                          : r.lastOpen ? fmtDate(r.lastOpen) : <span className="text-amber-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.isPanic ? <span className="text-muted-foreground">N/A</span>
                          : r.lastClose ? fmtDate(r.lastClose) : <span className="text-amber-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.isPanic ? "—"
                          : r.sameDayCycle ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">A↔C</Badge>
                          : r.lastOpen && !r.lastClose ? <Badge variant="outline" className="text-amber-400 border-amber-500/30">Sin cierre</Badge>
                          : !r.lastOpen && r.lastClose ? <Badge variant="outline" className="text-amber-400 border-amber-500/30">Sin apertura</Badge>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.setting?.expectedOpen || r.setting?.expectedClose ? (
                          <span className="font-mono">
                            {r.setting?.expectedOpen || "--:--"} → {r.setting?.expectedClose || "--:--"}
                          </span>
                        ) : <span className="text-muted-foreground italic">sin definir</span>}
                      </TableCell>
                      <TableCell>
                        {r.isPanic ? <Badge variant="outline" className="text-purple-400 border-purple-500/30">N/A</Badge>
                          : r.isMuted ? <Badge variant="outline" className="text-muted-foreground">Silenciada</Badge>
                          : r.criticidad === "ok" ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Al día</Badge>
                          : <Badge variant="outline" className={CRIT_COLOR[r.criticidad as CriticidadInactividad]}>{CRIT_LABEL[r.criticidad as CriticidadInactividad]}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.osm?.phone ? (
                          <a href={`tel:${r.osm.phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {r.osm.phone}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px]">
                        {r.discrepancia && (
                          <div className="flex items-start gap-1 text-amber-400">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{r.discrepancia}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => openEdit(r.accountCode, r.osm?.businessName || r.accountName)}
                          title="Editar configuración">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground p-3 border-t">
                {filtered.length} de {combined.length} cuentas
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Configuración de cuenta
            </DialogTitle>
            <DialogDescription>
              {editing?.name} <span className="font-mono text-xs">({editing?.code})</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo de cuenta</Label>
              <Select value={draft.kind || "regular"}
                onValueChange={v => setDraft(d => ({ ...d, kind: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Estándar (apertura/cierre)</SelectItem>
                  <SelectItem value="panic">🚨 Botón de pánico (no aplica apertura/cierre)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Estado manual (silencia alertas si no es Activo)</Label>
              <Select value={draft.manualStatus || "__none__"}
                onValueChange={v => setDraft(d => ({ ...d, manualStatus: v === "__none__" ? null : v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin estado manual —</SelectItem>
                  {MANUAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {draft.kind !== "panic" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="open" className="text-xs">Hora apertura</Label>
                  <Input id="open" type="time" value={draft.expectedOpen || ""}
                    onChange={e => setDraft(d => ({ ...d, expectedOpen: e.target.value || null }))} />
                </div>
                <div>
                  <Label htmlFor="close" className="text-xs">Hora cierre</Label>
                  <Input id="close" type="time" value={draft.expectedClose || ""}
                    onChange={e => setDraft(d => ({ ...d, expectedClose: e.target.value || null }))} />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes" className="text-xs">Notas</Label>
              <Input id="notes" placeholder="Ej: cierra domingos, contrato suspendido..."
                value={draft.notes || ""}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>

            {settings[editing?.code || ""] && (
              <p className="text-xs text-muted-foreground">
                Última edición: {settings[editing!.code].updatedBy} ·{" "}
                {new Date(settings[editing!.code].updatedAt).toLocaleString("es-DO")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
