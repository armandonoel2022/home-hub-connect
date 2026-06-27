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
  Users, MapPin, Link2, Plug, PlugZap, BatteryWarning, Stethoscope, Clock, CheckCircle2, Circle, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseKronosHtmFile, type KronosParsedReport, type CriticidadInactividad,
} from "@/lib/kronosHtmParser";
import type { OSMClient } from "@/lib/osmClientData";
import {
  monitoringReportsApi, monitoringAccountSettingsApi, billingClientsApi, monitoringSnapshotsApi,
  generalSqlApi,
  type MonitoringReportMeta, type MonitoringAccountSetting, type LxStatus, type BillingClient,
  type ServiceType, type CommType, type BrandType, type GeneralClient,
} from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, DatabaseZap } from "lucide-react";
import BillingClientsManager from "./BillingClientsManager";
import TeamNotifyDialog from "./TeamNotifyDialog";
import { queueEmail } from "@/lib/emailService";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";

const LX_STATUSES: LxStatus[] = [
  "Activa", "Prueba", "Cancelada", "Suspendida",
  "Dada de baja", "Sin notificaciones", "Inactiva",
];
const SERVICE_TYPES: ServiceType[] = [
  "Monitoreado sin respuesta", "Monitoreado con Respuesta",
  "Botón de pánico", "Interrupción Energética", "Active Track", "Panel de Incendio",
];
const COMM_TYPES: CommType[] = ["EBS LX-EPX", "Intelbras"];
const BRANDS: BrandType[] = ["Hikvision", "Daiwa"];
const SERVICE_COLOR: Record<ServiceType, string> = {
  "Monitoreado sin respuesta": "text-sky-400 border-sky-500/30",
  "Monitoreado con Respuesta": "text-emerald-400 border-emerald-500/30",
  "Botón de pánico": "text-purple-400 border-purple-500/30",
  "Interrupción Energética": "text-orange-400 border-orange-500/30",
  "Active Track": "text-cyan-400 border-cyan-500/30",
  "Panel de Incendio": "text-red-400 border-red-500/30",
};
/** Tipos de servicio que NO requieren apertura/cierre y silencian alertas operativas. */
const NO_OPEN_CLOSE_SERVICES = new Set<ServiceType>(["Botón de pánico", "Active Track", "Panel de Incendio"]);
const LX_STATUS_COLOR: Record<LxStatus, string> = {
  "Activa": "text-emerald-400 border-emerald-500/30",
  "Prueba": "text-blue-400 border-blue-500/30",
  "Cancelada": "text-red-400 border-red-500/30",
  "Suspendida": "text-amber-400 border-amber-500/30",
  "Dada de baja": "text-red-400 border-red-500/30",
  "Sin notificaciones": "text-purple-400 border-purple-500/30",
  "Inactiva": "text-muted-foreground border-border",
};
/** Estados de LX que silencian alertas (todo menos Activa) */
const MUTING_LX_STATUSES = new Set<LxStatus>([
  "Prueba", "Cancelada", "Suspendida", "Dada de baja", "Sin notificaciones", "Inactiva",
]);

/** Mapea la descripción de servicio de gSafeOne (ClienteServicio.Descripcion) a un ServiceType conocido. */
function matchServiceType(descripcion?: string | null): ServiceType | null {
  const d = (descripcion || "").toLowerCase();
  if (!d) return null;
  if (/p[áa]nico/.test(d)) return "Botón de pánico";
  if (/incendio|fuego|fire/.test(d)) return "Panel de Incendio";
  if (/energ|el[ée]ctric|interrup/.test(d)) return "Interrupción Energética";
  if (/active\s*track|bast[óo]n|gps|ronda/.test(d)) return "Active Track";
  if (/con\s*respuesta|c\/r|reacci[óo]n/.test(d)) return "Monitoreado con Respuesta";
  if (/sin\s*respuesta|s\/r|monitore/.test(d)) return "Monitoreado sin respuesta";
  return null;
}

/** Redondea una hora ISO a la media hora más cercana → "HH:MM" (para sugerir apertura/cierre). */
function roundIsoToHalfHour(iso?: string | null): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  let h = dt.getHours();
  let m = dt.getMinutes();
  const rounded = Math.round(m / 30) * 30;
  if (rounded === 60) { h = (h + 1) % 24; m = 0; } else { m = rounded; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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
  billingClient?: BillingClient;
  isPanic: boolean;
  isBaton: boolean;
  isMuted: boolean; // estado LX que silencia alertas
  noOpenClose: boolean; // panic OR baton: ignora aperturas/cierres
  discrepancia?: string;
  // Conectividad eléctrica
  powerOk: boolean | null;
  lastPowerLoss: string | null;
  lastPowerRestore: string | null;
  lowBattery: boolean;
  // Puntualidad
  openPunt: { status: PuntStatus; diffMin: number | null };
  closePunt: { status: PuntStatus; diffMin: number | null };
}

type FilterKey = "all" | "ok" | CriticidadInactividad | "discrepancia" | "panic" | "baton" | "muted" | "inactive-cancelled" | "deleted" | "unlinked" | "tardio" | "power";

const INACTIVE_CANCELLED = new Set<LxStatus>(["Cancelada", "Inactiva"]);
const DELETED_STATUSES = new Set<LxStatus>(["Dada de baja"]);

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
}

// ─── Puntualidad (semáforo apertura / cierre) ───
type PuntStatus = "ontime" | "late" | "verylate" | "missing" | "none";
const PUNT_TOLERANCE = 15;   // min: dentro de esto = a tiempo
const PUNT_LATE_LIMIT = 45;  // min: hasta esto = tardío; más = muy tardío

function hhmmToMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}
function isoToMin(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
/** Compara la señal real con el horario esperado. diffMin>0 = tarde. */
function punctuality(actualIso: string | null, expected?: string | null): { status: PuntStatus; diffMin: number | null } {
  const exp = hhmmToMin(expected);
  if (exp === null) return { status: "none", diffMin: null };
  if (!actualIso) return { status: "missing", diffMin: null };
  const act = isoToMin(actualIso);
  if (act === null) return { status: "missing", diffMin: null };
  const diff = act - exp;
  if (diff <= PUNT_TOLERANCE) return { status: "ontime", diffMin: diff };
  if (diff <= PUNT_LATE_LIMIT) return { status: "late", diffMin: diff };
  return { status: "verylate", diffMin: diff };
}
const PUNT_DOT: Record<PuntStatus, string> = {
  ontime: "bg-emerald-500",
  late: "bg-amber-500",
  verylate: "bg-red-500",
  missing: "bg-red-500",
  none: "bg-muted-foreground/30",
};
const PUNT_LABEL: Record<PuntStatus, string> = {
  ontime: "A tiempo",
  late: "Tardío",
  verylate: "Muy tardío",
  missing: "Sin señal",
  none: "Sin horario",
};
function fmtDiff(diffMin: number | null): string {
  if (diffMin === null) return "";
  if (diffMin <= 0) return `${Math.abs(diffMin)} min antes`;
  return `+${diffMin} min`;
}

/** Score simple de similitud para auto-sugerir cliente CxC desde el nombre de la LX. */
function simScore(a: string, b: string): number {
  const A = a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ");
  const B = b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ");
  const wA = new Set(A.split(/\s+/).filter(w => w.length >= 3));
  const wB = new Set(B.split(/\s+/).filter(w => w.length >= 3));
  if (wA.size === 0 || wB.size === 0) return 0;
  let common = 0;
  wA.forEach(w => { if (wB.has(w)) common++; });
  return common / Math.max(wA.size, wB.size);
}

interface Props {
  clients: OSMClient[];
}


export default function KronosActivityTab({ clients }: Props) {
  const [report, setReport] = useState<KronosParsedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCrit, setFilterCrit] = useState<FilterKey>("all");
  const [settings, setSettings] = useState<Record<string, MonitoringAccountSetting>>({});
  const [billingClients, setBillingClients] = useState<BillingClient[]>([]);
  const [editing, setEditing] = useState<{ code: string; name: string } | null>(null);
  const [draft, setDraft] = useState<Partial<MonitoringAccountSetting>>({});
  const [history, setHistory] = useState<MonitoringReportMeta[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<MonitoringReportMeta | null>(null);
  const [showBillingMgr, setShowBillingMgr] = useState(false);
  const [notifyCtx, setNotifyCtx] = useState<{ subject: string; message: string } | null>(null);
  const [troubleshoot, setTroubleshoot] = useState<CombinedRow | null>(null);
  const [generalClients, setGeneralClients] = useState<GeneralClient[]>([]);
  const [gcPickerOpen, setGcPickerOpen] = useState(false);
  const [linkingGc, setLinkingGc] = useState(false);
  const { user } = useAuth();

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

  const loadBillingClients = async () => {
    try {
      const list = await billingClientsApi.list();
      setBillingClients(list);
    } catch (e: any) {
      if (e.message !== "API_NOT_CONFIGURED") console.warn("BillingClients:", e.message);
    }
  };

  const loadGeneralClients = async () => {
    try {
      const list = await generalSqlApi.clients();
      setGeneralClients(Array.isArray(list) ? list : []);
    } catch (e: any) {
      // gSafeOne puede no estar disponible: el selector manual sigue funcionando.
      if (e.message !== "API_NOT_CONFIGURED") console.warn("GENERAL clients:", e.message);
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

  useEffect(() => { loadSettings(); loadBillingClients(); loadGeneralClients(); loadHistory(); /* eslint-disable-next-line */ }, []);

  /** Sugerencia automática de cliente CxC para una LX sin vincular, basada en nombres. */
  const suggestClient = (lxName: string): BillingClient | null => {
    if (!lxName || billingClients.length === 0) return null;
    let best: BillingClient | null = null;
    let bestScore = 0;
    billingClients.forEach(c => {
      const s = simScore(lxName, c.name);
      if (s > bestScore) { bestScore = s; best = c; }
    });
    return bestScore >= 0.5 ? best : null;
  };

  const openEdit = (code: string, name: string) => {
    setEditing({ code, name });
    const cur = settings[code];
    if (cur) {
      setDraft({ ...cur });
    } else {
      const suggested = suggestClient(name);
      setDraft({
        accountCode: code, accountName: name, kind: "regular",
        lxStatus: "Activa",
        clientId: suggested?.id || null,
        expectedOpen: null, expectedClose: null, notes: "",
        locationAddress: "", locationMapsUrl: "",
      });
      if (suggested) toast.info(`Cliente sugerido: ${suggested.code} — ${suggested.name}`);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const prev = settings[editing.code];
    try {
      const saved = await monitoringAccountSettingsApi.upsert(editing.code, {
        accountName: editing.name,
        clientId: draft.clientId || null,
        kind: (draft.serviceType === "Botón de pánico" || draft.kind === "panic") ? "panic" : "regular",
        lxStatus: draft.lxStatus || null,
        serviceType: draft.serviceType ?? null,
        commType: draft.commType ?? null,
        brand: draft.brand ?? null,
        expectedOpen: draft.expectedOpen || null,
        expectedClose: draft.expectedClose || null,
        locationAddress: draft.locationAddress || "",
        locationMapsUrl: draft.locationMapsUrl || "",
        notes: draft.notes || "",
      });
      setSettings(p => ({ ...p, [editing.code]: saved }));
      toast.success(`Configuración guardada para ${editing.name}`);

      // Diff humano-leíble
      const changes: string[] = [];
      const cmp = (label: string, a: any, b: any) => {
        const A = a ?? "—", B = b ?? "—";
        if (String(A) !== String(B)) changes.push(`• ${label}: ${A} → ${B}`);
      };
      cmp("Tipo de servicio", prev?.serviceType, saved.serviceType);
      cmp("Estado LX", prev?.lxStatus, saved.lxStatus);
      cmp("Comunicación", prev?.commType, saved.commType);
      cmp("Marca", prev?.brand, saved.brand);
      cmp("Cliente CxC", prev?.clientId, saved.clientId);
      cmp("Horario apertura", prev?.expectedOpen, saved.expectedOpen);
      cmp("Horario cierre", prev?.expectedClose, saved.expectedClose);
      cmp("Ubicación", prev?.locationAddress, saved.locationAddress);
      cmp("Notas", prev?.notes, saved.notes);

      const subject = `LX ${editing.code} — ${editing.name}`;
      const body = changes.length > 0
        ? `Se actualizó la configuración de la LX ${editing.code} (${editing.name}):\n\n${changes.join("\n")}`
        : `Configuración guardada para LX ${editing.code} (${editing.name}) sin cambios detectables.`;

      // Email automático a tecnologia@ (siempre, aunque no se notifique a nadie más)
      queueEmail("tecnologia@safeone.com.do", `[Monitoreo] ${subject}`,
        `${body}\n\n— ${user?.fullName || "Monitoreo"} (${user?.email || ""})`,
        "general");

      setEditing(null);

      // Si hubo cambios, abrir diálogo de notificación al equipo
      if (changes.length > 0) {
        setNotifyCtx({ subject, message: body });
      }
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
        // Snapshot automático para tendencias
        try {
          const total = parsed.rows.length;
          const noSignalHigh = parsed.rows.filter((r: any) => r.criticidad === "alta").length;
          const compliedCycle = parsed.rows.filter((r: any) => r.sameDayCycle).length;
          const compliedCyclePct = total > 0 ? Math.round((compliedCycle / total) * 100) : 0;
          await monitoringSnapshotsApi.upsert({
            date: dateKey, source: "kronos",
            metrics: {
              totalLx: total, activeLx: total, billableLx: 0,
              compliedCycle, compliedCyclePct, noSignalHigh,
              activeTrackTotal: 0, activeTrackComplied: 0, activeTrackPct: 0,
              incidentsOpen: 0, incidentsResolved: 0,
            },
          });
        } catch {}
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

  const billingClientById = useMemo(() => {
    const m = new Map<string, BillingClient>();
    billingClients.forEach(c => m.set(c.id, c));
    return m;
  }, [billingClients]);

  const combined = useMemo<CombinedRow[]>(() => {
    if (!report) return [];
    const list: CombinedRow[] = [];
    const seen = new Set<string>();

    const processSetting = (setting?: MonitoringAccountSetting) => {
      const serviceType = setting?.serviceType || null;
      const isPanic = setting?.kind === "panic" || serviceType === "Botón de pánico";
      const isBaton = serviceType === "Active Track";
      const noOpenClose = isPanic || isBaton;
      const lxStatus = setting?.lxStatus || null;
      const isMuted = !!(lxStatus && MUTING_LX_STATUSES.has(lxStatus));
      const billingClient = setting?.clientId ? billingClientById.get(setting.clientId) : undefined;
      return { isPanic, isBaton, noOpenClose, isMuted, billingClient };
    };

    report.rows.forEach(r => {
      seen.add(r.accountCode);
      const osm = osmByCode.get(r.accountCode);
      const setting = settings[r.accountCode];
      const { isPanic, isBaton, noOpenClose, isMuted, billingClient } = processSetting(setting);

      const alertas: string[] = [];
      if (!noOpenClose && !isMuted) {
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
        if (!billingClient && !setting?.clientId) {
          alertas.push("LX sin cliente CxC asignado");
        }
      }

      // Alerta de puntualidad y de energía
      const evalOpenClose = !noOpenClose && !isMuted;
      const openPunt = evalOpenClose ? punctuality(r.lastOpen, setting?.expectedOpen) : { status: "none" as PuntStatus, diffMin: null };
      const closePunt = evalOpenClose ? punctuality(r.lastClose, setting?.expectedClose) : { status: "none" as PuntStatus, diffMin: null };
      if (evalOpenClose) {
        if (openPunt.status === "late" || openPunt.status === "verylate") alertas.push(`Apertura ${PUNT_LABEL[openPunt.status].toLowerCase()} (${fmtDiff(openPunt.diffMin)})`);
        if (closePunt.status === "late" || closePunt.status === "verylate") alertas.push(`Cierre ${PUNT_LABEL[closePunt.status].toLowerCase()} (${fmtDiff(closePunt.diffMin)})`);
      }
      if (r.powerOk === false) alertas.push("Sin energía eléctrica (falla de CA sin restaurar)");
      if (r.lowBattery) alertas.push("Batería baja");

      list.push({
        accountCode: r.accountCode,
        accountName: r.accountName,
        estado: r.estado,
        lastSignal: r.lastSignal,
        lastOpen: noOpenClose ? null : r.lastOpen,
        lastClose: noOpenClose ? null : r.lastClose,
        sameDayCycle: !noOpenClose && r.sameDayCycle,
        daysSince: r.daysSince,
        criticidad: (isMuted || noOpenClose) ? "ok" : r.criticidad,
        osm, setting, billingClient, isPanic, isBaton, noOpenClose, isMuted,
        discrepancia: alertas.join(" • ") || undefined,
        powerOk: r.powerOk, lastPowerLoss: r.lastPowerLoss, lastPowerRestore: r.lastPowerRestore, lowBattery: r.lowBattery,
        openPunt, closePunt,
      });
    });

    // Cuentas Activas en OSM que NO aparecieron
    clients.forEach(c => {
      if (!c.accountCode || seen.has(c.accountCode.trim())) return;
      if (c.monitoringStatus !== "Activo") return;
      const setting = settings[c.accountCode];
      const { isPanic, isBaton, noOpenClose, isMuted, billingClient } = processSetting(setting);
      list.push({
        accountCode: c.accountCode, accountName: c.businessName, estado: "",
        lastSignal: null, lastOpen: null, lastClose: null, sameDayCycle: false,
        daysSince: null, criticidad: (isMuted || noOpenClose) ? "ok" : "alta",
        osm: c, setting, billingClient, isPanic, isBaton, noOpenClose, isMuted,
        discrepancia: (isMuted || noOpenClose) ? undefined : "Activo en OSM pero NO aparece en reporte Kronos",
        powerOk: null, lastPowerLoss: null, lastPowerRestore: null, lowBattery: false,
        openPunt: { status: "none", diffMin: null }, closePunt: { status: "none", diffMin: null },
      });
    });


    return list.sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));
  }, [report, clients, osmByCode, settings, billingClientById]);

  const stats = useMemo(() => {
    const isInactiveCancelled = (r: CombinedRow) => !!r.setting?.lxStatus && INACTIVE_CANCELLED.has(r.setting.lxStatus);
    const isDeleted = (r: CombinedRow) => !!r.setting?.lxStatus && DELETED_STATUSES.has(r.setting.lxStatus);
    const visible = combined.filter(r => !isInactiveCancelled(r) && !isDeleted(r));
    const operational = visible.filter(r => !r.noOpenClose && !r.isMuted);
    return {
      total: visible.length,
      alta: operational.filter(r => r.criticidad === "alta").length,
      media: operational.filter(r => r.criticidad === "media").length,
      baja: operational.filter(r => r.criticidad === "baja").length,
      ok: operational.filter(r => r.criticidad === "ok").length,
      panic: visible.filter(r => r.isPanic).length,
      baton: visible.filter(r => r.isBaton).length,
      muted: visible.filter(r => r.isMuted && !r.noOpenClose).length,
      inactiveCancelled: combined.filter(isInactiveCancelled).length,
      deleted: combined.filter(isDeleted).length,
      discrepancias: visible.filter(r => r.discrepancia).length,
      tardio: operational.filter(r => ["late", "verylate", "missing"].includes(r.openPunt.status) || ["late", "verylate", "missing"].includes(r.closePunt.status)).length,
      power: visible.filter(r => r.powerOk === false || r.lowBattery).length,
    };
  }, [combined]);

  const filtered = useMemo(() => {
    const isInactiveCancelled = (r: CombinedRow) => !!r.setting?.lxStatus && INACTIVE_CANCELLED.has(r.setting.lxStatus);
    const isDeleted = (r: CombinedRow) => !!r.setting?.lxStatus && DELETED_STATUSES.has(r.setting.lxStatus);

    return combined.filter(r => {
      if (filterCrit === "inactive-cancelled") { if (!isInactiveCancelled(r)) return false; }
      else if (filterCrit === "deleted") { if (!isDeleted(r)) return false; }
      else {
        // Por defecto sacamos las inactivas/canceladas/dadas de baja del resto de vistas
        if (isInactiveCancelled(r) || isDeleted(r)) return false;
        if (filterCrit === "panic") { if (!r.isPanic) return false; }
        else if (filterCrit === "baton") { if (!r.isBaton) return false; }
        else if (filterCrit === "muted") { if (!r.isMuted || r.noOpenClose) return false; }
        else if (filterCrit === "discrepancia") { if (!r.discrepancia) return false; }
        else if (filterCrit === "tardio") { if (r.noOpenClose || r.isMuted) return false; if (!["late", "verylate", "missing"].includes(r.openPunt.status) && !["late", "verylate", "missing"].includes(r.closePunt.status)) return false; }
        else if (filterCrit === "power") { if (r.powerOk !== false && !r.lowBattery) return false; }
        else if (filterCrit === "unlinked") { if (r.setting?.clientId) return false; }
        else if (filterCrit !== "all") {
          if (r.noOpenClose || r.isMuted) return false;
          if (r.criticidad !== filterCrit) return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.accountCode.toLowerCase().includes(q)
          && !r.accountName.toLowerCase().includes(q)
          && !(r.osm?.businessName || "").toLowerCase().includes(q)
          && !(r.billingClient?.name || "").toLowerCase().includes(q)
          && !(r.billingClient?.code || "").toLowerCase().includes(q)
          && !(r.osm?.contact || "").toLowerCase().includes(q)
          && !(r.osm?.phone || "").includes(q)) return false;
      }
      return true;
    });
  }, [combined, filterCrit, search]);


  const exportCallList = () => {
    const toCall = combined.filter(r => !r.noOpenClose && !r.isMuted && (r.criticidad === "alta" || r.criticidad === "media"));
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
          <div className="grid grid-cols-2 md:grid-cols-10 gap-3">
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
            <KpiCard label="⏰ Tardíos" value={stats.tardio} color="text-amber-400"
              active={filterCrit === "tardio"} onClick={() => setFilterCrit("tardio")} />
            <KpiCard label="🔌 Sin energía" value={stats.power} color="text-orange-400"
              active={filterCrit === "power"} onClick={() => setFilterCrit("power")} />
            <KpiCard label="🚨 Pánico" value={stats.panic} color="text-purple-400"
              active={filterCrit === "panic"} onClick={() => setFilterCrit("panic")} />
            <KpiCard label="🛰️ Active Track" value={stats.baton} color="text-cyan-400"
              active={filterCrit === "baton"} onClick={() => setFilterCrit("baton")} />
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
              <Input className="pl-9" placeholder="Buscar cuenta, nombre, cliente CxC, contacto, teléfono..."
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
                <SelectItem value="tardio">⏰ Apertura/Cierre tardío ({stats.tardio})</SelectItem>
                <SelectItem value="power">🔌 Sin energía / batería baja ({stats.power})</SelectItem>
                <SelectItem value="panic">🚨 Botón de pánico</SelectItem>
                <SelectItem value="baton">🛰️ Active Track (Punches)</SelectItem>
                <SelectItem value="muted">🔇 Silenciadas (estado LX)</SelectItem>
                <SelectItem value="inactive-cancelled">⛔ Inactivas y Canceladas ({stats.inactiveCancelled})</SelectItem>
                <SelectItem value="deleted">🗑️ Dadas de baja ({stats.deleted})</SelectItem>
                <SelectItem value="unlinked">🔗 Sin cliente CxC</SelectItem>
                <SelectItem value="discrepancia">⚠️ Discrepancias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowBillingMgr(true)} variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" /> Clientes CxC ({billingClients.length})
            </Button>
            <Button onClick={exportCallList} variant="default" size="sm">
              <Download className="h-4 w-4 mr-2" /> Exportar llamadas
            </Button>
          </div>


          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Cuenta LX</TableHead>
                    <TableHead>Nombre LX</TableHead>
                    <TableHead className="text-xs">Cliente CxC</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado LX</TableHead>
                    <TableHead className="text-right text-xs">Última señal</TableHead>
                    <TableHead className="text-center text-xs">Días</TableHead>
                    <TableHead className="text-xs">Apertura</TableHead>
                    <TableHead className="text-xs">Cierre</TableHead>
                    <TableHead className="text-xs">Ciclo</TableHead>
                    <TableHead className="text-xs">Horario</TableHead>
                    <TableHead className="text-xs text-center">Puntualidad</TableHead>
                    <TableHead className="text-xs text-center">Energía</TableHead>
                    <TableHead>Criticidad</TableHead>
                    <TableHead className="text-xs">Teléfono</TableHead>
                    <TableHead className="text-xs max-w-[220px]">Alerta</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.accountCode} className={
                      r.setting?.lxStatus && (INACTIVE_CANCELLED.has(r.setting.lxStatus) || DELETED_STATUSES.has(r.setting.lxStatus))
                        ? "opacity-40 grayscale bg-muted/30"
                      : r.isPanic ? "bg-purple-500/5"
                      : r.isBaton ? "bg-cyan-500/5"
                      : r.isMuted ? "opacity-60" : ""
                    }>
                      <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                      <TableCell className="font-medium text-sm">{r.osm?.businessName || r.accountName}</TableCell>
                      <TableCell className="text-xs">
                        {r.billingClient ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-[10px] text-muted-foreground">{r.billingClient.code}</span>
                            <span className="font-medium">{r.billingClient.name}</span>
                          </div>
                        ) : r.setting?.clientId ? (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30">Cliente eliminado</Badge>
                        ) : (
                          <span className="text-muted-foreground italic flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> sin vincular
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.setting?.serviceType ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className={SERVICE_COLOR[r.setting.serviceType]}>
                              {r.setting.serviceType === "Botón de pánico" && <Siren className="h-3 w-3 mr-1" />}
                              {r.setting.serviceType}
                            </Badge>
                            {(r.setting.commType || r.setting.brand) && (
                              <span className="text-[10px] text-muted-foreground">
                                {[r.setting.commType, r.setting.brand].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </div>
                        ) : r.isPanic ? (
                          <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                            <Siren className="h-3 w-3 mr-1" /> Pánico
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">Estándar</span>}
                      </TableCell>
                      <TableCell>
                        {r.setting?.lxStatus ? (
                          <Badge variant="outline" className={LX_STATUS_COLOR[r.setting.lxStatus]}>
                            {r.setting.lxStatus}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>

                      <TableCell className="text-right text-xs">{fmtDate(r.lastSignal)}</TableCell>
                      <TableCell className="text-center">
                        {r.daysSince === null ? (
                          <Badge variant="outline" className="text-red-400 border-red-500/30">s/señal</Badge>
                        ) : (
                          <span className={`font-bold text-sm ${
                            r.noOpenClose || r.isMuted ? "text-muted-foreground"
                            : r.daysSince >= 3 ? "text-red-400"
                            : r.daysSince === 2 ? "text-amber-400"
                            : r.daysSince === 1 ? "text-blue-400" : "text-emerald-400"
                          }`}>{r.daysSince}d</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.noOpenClose ? <span className="text-muted-foreground">N/A</span>
                          : r.lastOpen ? fmtDate(r.lastOpen) : <span className="text-amber-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.noOpenClose ? <span className="text-muted-foreground">N/A</span>
                          : r.lastClose ? fmtDate(r.lastClose) : <span className="text-amber-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.noOpenClose ? "—"
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
                      <TableCell className="text-center">
                        {r.noOpenClose || r.isMuted ? <span className="text-xs text-muted-foreground">—</span> : (
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-1" title={`Apertura: ${PUNT_LABEL[r.openPunt.status]} ${fmtDiff(r.openPunt.diffMin)}`}>
                              <span className={`h-2.5 w-2.5 rounded-full ${PUNT_DOT[r.openPunt.status]}`} />
                              <span className="text-[10px] text-muted-foreground">A</span>
                            </span>
                            <span className="inline-flex items-center gap-1" title={`Cierre: ${PUNT_LABEL[r.closePunt.status]} ${fmtDiff(r.closePunt.diffMin)}`}>
                              <span className={`h-2.5 w-2.5 rounded-full ${PUNT_DOT[r.closePunt.status]}`} />
                              <span className="text-[10px] text-muted-foreground">C</span>
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.powerOk === false ? (
                          <Badge variant="outline" className="text-red-400 border-red-500/30 gap-1" title={`Última falla CA: ${fmtDate(r.lastPowerLoss)}`}>
                            <PlugZap className="h-3 w-3" /> Sin energía
                          </Badge>
                        ) : r.lowBattery ? (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30 gap-1"><BatteryWarning className="h-3 w-3" /> Batería</Badge>
                        ) : r.powerOk === true ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 gap-1" title={`Energía restaurada: ${fmtDate(r.lastPowerRestore)}`}><Plug className="h-3 w-3" /> OK</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {r.isPanic ? <Badge variant="outline" className="text-purple-400 border-purple-500/30">N/A</Badge>
                          : r.isBaton ? <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">→ Punches</Badge>
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
                        <div className="flex items-center gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setTroubleshoot(r)}
                            title="Troubleshooting / diagnóstico antes de reportar">
                            <Stethoscope className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => openEdit(r.accountCode, r.osm?.businessName || r.accountName)}
                            title="Editar configuración">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setNotifyCtx({
                              subject: `LX ${r.accountCode} — ${r.osm?.businessName || r.accountName}`,
                              message: `Nota sobre LX ${r.accountCode} (${r.osm?.businessName || r.accountName}).\nEstado actual: ${r.estado}${r.discrepancia ? `\nAlerta: ${r.discrepancia}` : ""}\n\n`,
                            })}
                            title="Notificar al equipo / enviar correo">
                            <Bell className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Configuración de LX
            </DialogTitle>
            <DialogDescription>
              {editing?.name} <span className="font-mono text-xs">(cuenta {editing?.code})</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Cliente CxC */}
            <div>
              <Label className="text-xs flex items-center justify-between">
                <span>Cliente CxC (titular de facturación)</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs"
                  onClick={() => { setEditing(null); setShowBillingMgr(true); }}>
                  + nuevo cliente
                </Button>
              </Label>
              <Select value={draft.clientId || "__none__"}
                onValueChange={v => setDraft(d => ({ ...d, clientId: v === "__none__" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin cliente vinculado" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none__">— Sin cliente vinculado —</SelectItem>
                  {billingClients
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-mono text-xs mr-2">{c.code}</span>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {draft.clientId && billingClientById.get(draft.clientId)?.locationAddress && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  Ubicación del cliente: {billingClientById.get(draft.clientId)?.locationAddress}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de servicio</Label>
                <Select value={draft.serviceType || "__none__"}
                  onValueChange={v => setDraft(d => ({
                    ...d,
                    serviceType: v === "__none__" ? null : v as ServiceType,
                    kind: v === "Botón de pánico" ? "panic" : "regular",
                  }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Estándar (sin definir) —</SelectItem>
                    {SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estado LX</Label>
                <Select value={draft.lxStatus || "__none__"}
                  onValueChange={v => setDraft(d => ({ ...d, lxStatus: v === "__none__" ? null : v as LxStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin definir —</SelectItem>
                    {LX_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de comunicación</Label>
                <Select value={draft.commType || "__none__"}
                  onValueChange={v => setDraft(d => ({ ...d, commType: v === "__none__" ? null : v as CommType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin definir —</SelectItem>
                    {COMM_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Marca</Label>
                <Select value={draft.brand || "__none__"}
                  onValueChange={v => setDraft(d => ({ ...d, brand: v === "__none__" ? null : v as BrandType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin definir —</SelectItem>
                    {BRANDS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {draft.serviceType === "Active Track" && (
              <p className="text-[11px] text-cyan-400 -mt-1">
                🥢 Esta LX se evaluará en la pestaña <strong>Punches</strong> (no requiere apertura/cierre).
              </p>
            )}
            {draft.serviceType === "Botón de pánico" && (
              <p className="text-[11px] text-purple-400 -mt-1">
                🚨 Esta LX queda deshabilitada para apertura/cierre y no genera alertas operativas.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground -mt-1">
              Cualquier estado distinto de <strong>Activa</strong> silencia las alertas de esta LX.
            </p>

            {draft.kind !== "panic" && draft.serviceType !== "Botón de pánico" && draft.serviceType !== "Active Track" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="open" className="text-xs">Hora apertura esperada</Label>
                  <Input id="open" type="time" value={draft.expectedOpen || ""}
                    onChange={e => setDraft(d => ({ ...d, expectedOpen: e.target.value || null }))} />
                </div>
                <div>
                  <Label htmlFor="close" className="text-xs">Hora cierre esperado</Label>
                  <Input id="close" type="time" value={draft.expectedClose || ""}
                    onChange={e => setDraft(d => ({ ...d, expectedClose: e.target.value || null }))} />
                </div>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Ubicación específica de esta LX
              </Label>
              <Input placeholder="Dirección (ej: Nave B6, oficina principal)"
                value={draft.locationAddress || ""}
                onChange={e => setDraft(d => ({ ...d, locationAddress: e.target.value }))} />
              <Input placeholder="Enlace Google Maps (https://maps.app.goo.gl/...)"
                value={draft.locationMapsUrl || ""}
                onChange={e => setDraft(d => ({ ...d, locationMapsUrl: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">
                Déjalo vacío si quieres heredar la ubicación del cliente CxC.
              </p>
            </div>

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

      <BillingClientsManager
        open={showBillingMgr}
        onOpenChange={setShowBillingMgr}
        onChanged={loadBillingClients}
      />

      <TeamNotifyDialog
        open={!!notifyCtx}
        onOpenChange={(o) => !o && setNotifyCtx(null)}
        subjectContext={notifyCtx?.subject || ""}
        defaultMessage={notifyCtx?.message || ""}
        eventType="lx_change"
        fromUser={user ? { name: user.fullName, email: user.email } : null}
      />

      <TroubleshootDialog
        row={troubleshoot}
        onClose={() => setTroubleshoot(null)}
        onNotify={(subject, message) => { setTroubleshoot(null); setNotifyCtx({ subject, message }); }}
      />

    </div>
  );
}

// ─── Diálogo de troubleshooting inicial antes de levantar un reporte ───
function TroubleshootDialog({ row, onClose, onNotify }: {
  row: CombinedRow | null;
  onClose: () => void;
  onNotify: (subject: string, message: string) => void;
}) {
  const CHECKLIST = [
    "Confirmar energía eléctrica en la zona (vecinos / EDE)",
    "Verificar comunicador en línea (Ethernet / GPRS / WiFi)",
    "Revisar batería de respaldo del panel",
    "Validar última señal de prueba / supervisión",
    "Intentar comunicación bidireccional con el sitio",
    "Confirmar con el cliente antes de despachar",
  ];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  useEffect(() => { setChecked(new Set()); }, [row?.accountCode]);
  if (!row) return null;
  const name = row.osm?.businessName || row.accountName;
  const toggle = (i: number) => setChecked(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const powerLine = row.powerOk === false
    ? `⚠️ SIN ENERGÍA — última falla de CA ${fmtDate(row.lastPowerLoss)} sin restauración.`
    : row.powerOk === true
      ? `✅ Energía OK — restaurada ${fmtDate(row.lastPowerRestore)}.`
      : "Sin datos de energía en el reporte.";

  const buildReport = () => {
    const done = CHECKLIST.filter((_, i) => checked.has(i));
    const subject = `Incidente LX ${row.accountCode} — ${name}`;
    const message = [
      `Diagnóstico LX ${row.accountCode} (${name})`,
      `Última señal: ${fmtDate(row.lastSignal)} (${row.daysSince ?? "?"} días)`,
      `Apertura: ${fmtTime(row.lastOpen)} · Cierre: ${fmtTime(row.lastClose)}`,
      `Puntualidad apertura: ${PUNT_LABEL[row.openPunt.status]} ${fmtDiff(row.openPunt.diffMin)}`,
      `Puntualidad cierre: ${PUNT_LABEL[row.closePunt.status]} ${fmtDiff(row.closePunt.diffMin)}`,
      `Energía: ${powerLine}`,
      row.lowBattery ? "Batería baja reportada." : "",
      "",
      "Verificaciones realizadas:",
      ...(done.length ? done.map(d => `✔ ${d}`) : ["(ninguna marcada)"]),
      "",
    ].filter(Boolean).join("\n");
    onNotify(subject, message);
  };

  return (
    <Dialog open={!!row} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" /> Troubleshooting inicial
          </DialogTitle>
          <DialogDescription>
            {name} <span className="font-mono text-xs">(LX {row.accountCode})</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Estado energía */}
          <div className={`rounded-lg border p-3 ${row.powerOk === false ? "border-red-500/40 bg-red-500/5" : row.powerOk === true ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20"}`}>
            <p className="font-semibold flex items-center gap-1.5">
              {row.powerOk === false ? <PlugZap className="h-4 w-4 text-red-400" /> : <Plug className="h-4 w-4 text-emerald-400" />}
              Conectividad eléctrica
            </p>
            <p className="text-xs text-muted-foreground mt-1">{powerLine}</p>
            {row.lowBattery && <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><BatteryWarning className="h-3 w-3" /> Batería baja reportada</p>}
          </div>

          {/* Resumen señales */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border p-2">
              <p className="text-muted-foreground">Última señal</p>
              <p className="font-medium">{fmtDate(row.lastSignal)}</p>
            </div>
            <div className="rounded border border-border p-2">
              <p className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Apertura / Cierre</p>
              <p className="font-medium">{fmtTime(row.lastOpen)} → {fmtTime(row.lastClose)}</p>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <p className="font-semibold text-xs mb-2">Verificaciones previas a levantar incidente</p>
            <div className="space-y-1.5">
              {CHECKLIST.map((item, i) => (
                <button key={i} onClick={() => toggle(i)}
                  className="flex items-start gap-2 w-full text-left text-xs hover:bg-muted/40 rounded px-2 py-1.5 transition">
                  {checked.has(i)
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <span className={checked.has(i) ? "line-through text-muted-foreground" : ""}>{item}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button onClick={buildReport}>
            <MessageSquare className="h-4 w-4 mr-2" /> Levantar incidente / notificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
