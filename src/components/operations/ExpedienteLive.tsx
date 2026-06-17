import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { canEditExpediente } from "@/lib/permissions";
import {
  generalSqlApi, expedienteOverlayApi, getFileUrl, employeesApi,
  type GeneralExpediente, type GeneralExpedienteCliente, type GeneralExpedientePuesto,
  type ExpedienteOverlayMap, type ExpedienteOverlayEntry, type ExpedienteMovement,
  type GeneralWeapon, type Employee,
} from "@/lib/api";
import type { ArmedPersonnel } from "@/lib/types";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { useArmedPersonnel } from "@/hooks/useApiHooks";
import { loadPosts } from "@/lib/postsData";
import { mergeOperacionesIntoExpediente } from "@/lib/opsExpedienteMerge";
import { displayCaliber, lineHideKey, applyWeaponOverride } from "@/lib/expedienteHelpers";
import {
  Building2, MapPin, Crosshair, Users, ChevronDown, ChevronRight, RefreshCw,
  AlertTriangle, FileText, Phone, Mail, ExternalLink, ShieldCheck, ShieldOff, ListChecks,
  Download, Pencil, ArrowRightLeft, Upload, Trash2, IdCard, User, X, Shield,
} from "lucide-react";

type FilterKey = "todos" | "armas" | "sinArma" | "novedad";

function mapsHref(addr: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(addr)}`;
}

// Normaliza una fecha de GENERAL (ISO o Date) a 'YYYY-MM-DD' para <input type=date>.
function toInputDate(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function statusColor(c?: string | null): string {
  const s = (c || "").toLowerCase();
  if (!s) return "bg-muted text-muted-foreground";
  if (s.includes("buena") || s.includes("condicion") || s.includes("operativ")) return "bg-emerald-50 text-emerald-700";
  if (s.includes("mantenim")) return "bg-amber-50 text-amber-700";
  if (s.includes("fiscal")) return "bg-purple-50 text-purple-700";
  return "bg-red-50 text-red-700";
}

function KpiCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${accent || "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      </div>
    </Card>
  );
}

// ─── Contexto compartido vía props sencillas ───
interface EmployeeMatch { photo?: string; emp?: Employee; armed?: ArmedPersonnel; }
interface LiveCtx {
  overlay: ExpedienteOverlayMap;
  canEdit: boolean;
  reportDate: string;
  reloadOverlay: () => void;
  hiddenKeys: Set<string>;
  hideLine: (cliente: GeneralExpedienteCliente, p: GeneralExpedientePuesto) => void;
  matchEmployee: (p: GeneralExpedientePuesto) => EmployeeMatch;
  openWeapon: (p: GeneralExpedientePuesto, cliente: GeneralExpedienteCliente) => void;
  openAgent: (p: GeneralExpedientePuesto, cliente: GeneralExpedienteCliente) => void;
  openPost: (p: GeneralExpedientePuesto, cliente: GeneralExpedienteCliente) => void;
}

const ExpedienteLive = ({ onUnavailable }: { onUnavailable?: () => void }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<GeneralExpediente | null>(null);
  const [sqlWeapons, setSqlWeapons] = useState<GeneralWeapon[]>([]);
  const [overlay, setOverlay] = useState<ExpedienteOverlayMap>({});
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [serverCanEdit, setServerCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterKey>("todos");

  // dialogs
  const [weaponDlg, setWeaponDlg] = useState<{ p: GeneralExpedientePuesto; c: GeneralExpedienteCliente } | null>(null);
  const [agentDlg, setAgentDlg] = useState<{ p: GeneralExpedientePuesto; c: GeneralExpedienteCliente } | null>(null);
  const [postDlg, setPostDlg] = useState<{ p: GeneralExpedientePuesto; c: GeneralExpedienteCliente } | null>(null);

  const canEdit = serverCanEdit && canEditExpediente(user);

  const loadOverlay = async () => {
    try {
      const [ov, ce, hid] = await Promise.all([
        expedienteOverlayApi.list().catch(() => ({} as ExpedienteOverlayMap)),
        expedienteOverlayApi.canEdit().catch(() => ({ canEdit: false })),
        expedienteOverlayApi.hidden().catch(() => [] as string[]),
      ]);
      setOverlay(ov || {});
      setServerCanEdit(!!ce.canEdit);
      setHiddenKeys(new Set(hid || []));
    } catch { /* overlay opcional */ }
  };

  const load = async (fecha?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await generalSqlApi.expediente(fecha || undefined);
      setData(res);
      if (res.fecha) setSelectedDate(toInputDate(res.fecha));
      await loadOverlay();
    } catch (e) {
      const msg = (e as Error)?.message || "No se pudo conectar con GENERAL";
      setError(msg);
      onUnavailable?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    generalSqlApi.expedienteDates()
      .then((d) => setAvailableDates((d || []).map(toInputDate)))
      .catch(() => { /* selector opcional */ });
    generalSqlApi.weapons()
      .then((w) => setSqlWeapons(w || []))
      .catch(() => { /* catálogo opcional */ });
    employeesApi.getAll()
      .then((e) => setEmployees(e || []))
      .catch(() => { /* fotos opcionales */ });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const { data: personnel } = useArmedPersonnel();

  // Índice de empleados (RRHH) por código / cédula / nombre para resolver la
  // foto y los datos en la ficha 360° del vigilante.
  const employeeIndex = useMemo(() => {
    const byCode = new Map<string, Employee>();
    const byCedula = new Map<string, Employee>();
    const byName = new Map<string, Employee>();
    (employees || []).forEach((e) => {
      if (e.employeeCode) byCode.set(String(e.employeeCode).trim().toLowerCase(), e);
      if ((e as any).cedula) byCedula.set(String((e as any).cedula).replace(/\D/g, ""), e);
      if (e.fullName) byName.set(e.fullName.trim().toLowerCase(), e);
    });
    return { byCode, byCedula, byName };
  }, [employees]);

  const armedIndex = useMemo(() => {
    const byName = new Map<string, ArmedPersonnel>();
    const byCode = new Map<string, ArmedPersonnel>();
    (personnel || []).forEach((a) => {
      if (a.name) byName.set(a.name.trim().toLowerCase(), a);
      if (a.employeeCode) byCode.set(String(a.employeeCode).trim().toLowerCase(), a);
    });
    return { byName, byCode };
  }, [personnel]);

  const matchEmployee = (p: GeneralExpedientePuesto): EmployeeMatch => {
    const code = p.vigilanteCodigo != null ? String(p.vigilanteCodigo).trim().toLowerCase() : "";
    const ced = p.vigilanteCedula ? String(p.vigilanteCedula).replace(/\D/g, "") : "";
    const name = (p.vigilante || "").trim().toLowerCase();
    const emp = (code && employeeIndex.byCode.get(code))
      || (ced && employeeIndex.byCedula.get(ced))
      || (name && employeeIndex.byName.get(name)) || undefined;
    const armed = (name && armedIndex.byName.get(name))
      || (code && armedIndex.byCode.get(code)) || undefined;
    const raw = emp?.photoUrl || (emp as any)?.photo || "";
    const photo = raw ? (raw.startsWith("/photos") || raw.startsWith("/uploads") ? getFileUrl(raw) : raw) : undefined;
    return { photo, emp, armed };
  };

  const hideLine = async (cliente: GeneralExpedienteCliente, p: GeneralExpedientePuesto) => {
    const key = lineHideKey(cliente, p);
    try {
      const next = await expedienteOverlayApi.hide(key);
      setHiddenKeys(new Set(next || []));
      toast({ title: "Registro eliminado del expediente" });
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: String((e as Error)?.message || e), variant: "destructive" });
    }
  };

  // Fuente de verdad: gSafeOne (GENERAL). Si GENERAL responde con datos, se
  // usa EXCLUSIVAMENTE esa fuente (solo se enriquecen las armas con el catálogo
  // Armamento de SQL por serial). Operaciones (Personal Armado + Puestos) se usa
  // únicamente como respaldo cuando GENERAL no está disponible.
  const mergedData = useMemo<GeneralExpediente | null>(() => {
    const generalHasData = !!(data && data.clientes && data.clientes.length > 0);
    if (!generalHasData && (!personnel || personnel.length === 0)) return data;
    return mergeOperacionesIntoExpediente(
      data,
      generalHasData ? [] : (personnel || []),
      generalHasData ? [] : loadPosts(),
      sqlWeapons,
    );
  }, [data, personnel, sqlWeapons]);

  const filtered = useMemo<GeneralExpedienteCliente[]>(() => {
    if (!mergedData) return [];
    const q = search.toLowerCase().trim();
    return mergedData.clientes
      .map((c) => {
        let puestos = c.puestos.filter((p) => !hiddenKeys.has(lineHideKey(c, p)));
        if (filter === "armas") puestos = puestos.filter((p) => p.requiereArma);
        else if (filter === "sinArma") puestos = puestos.filter((p) => !p.requiereArma);
        else if (filter === "novedad") puestos = puestos.filter((p) => p.novedad);
        return { ...c, puestos };
      })
      .filter((c) => c.puestos.length > 0)
      .filter((c) =>
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        String(c.codigo ?? "").includes(q) ||
        c.puestos.some((p) => `${p.vigilante} ${p.armaSerial ?? ""}`.toLowerCase().includes(q)),
      );
  }, [mergedData, search, filter, hiddenKeys]);

  const t = mergedData?.totals || {};

  const ctx: LiveCtx = {
    overlay,
    canEdit,
    reportDate: data?.fecha || "",
    reloadOverlay: loadOverlay,
    hiddenKeys,
    hideLine,
    matchEmployee,
    openWeapon: (p, c) => setWeaponDlg({ p, c }),
    openAgent: (p, c) => setAgentDlg({ p, c }),
    openPost: (p, c) => setPostDlg({ p, c }),
  };

  const exportSchema = async () => {
    try {
      toast({ title: "Consultando esquema…" });
      const keys = await generalSqlApi.schemaKeys();
      exportToExcel({
        title: "Esquema de llaves (PK/FK) — gSafeOne",
        columns: [
          { header: "Tabla", key: "tabla", width: 28 },
          { header: "Tipo", key: "tipo", width: 16 },
          { header: "Columna", key: "columna", width: 28 },
          { header: "Restricción", key: "restriccion", width: 36 },
        ],
        data: keys as unknown as Record<string, unknown>[],
        filename: "esquema_llaves_gsafeone",
      });
      toast({ title: "Esquema exportado" });
    } catch (e) {
      toast({ title: "No se pudo exportar el esquema", description: String((e as Error)?.message || e), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Cargando expediente vivo desde GENERAL…
      </Card>
    );
  }

  if (error && (!mergedData || mergedData.clientes.length === 0)) {
    return (
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> GENERAL no disponible
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <p className="text-xs text-muted-foreground">
          El modo vivo lee del último reporte diario de la base de datos gSafeOne. Verifica la conexión o usa el modo Manual.
        </p>
        <Button size="sm" variant="outline" onClick={() => load(selectedDate || undefined)}><RefreshCw className="h-4 w-4 mr-1" /> Reintentar</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="p-3 flex items-start gap-2 border-amber-300 bg-amber-50 text-amber-800 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>GENERAL no está disponible; mostrando datos de Operaciones (Personal Armado y Puestos). <button onClick={() => load(selectedDate || undefined)} className="underline font-medium">Reintentar</button></span>
        </Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiCard icon={<Building2 className="h-4 w-4" />} label="Clientes con cobertura" value={t.clientes ?? 0} />
        <KpiCard icon={<ListChecks className="h-4 w-4" />} label="Puestos cubiertos" value={t.puestosCubiertos ?? 0} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Vigilantes en servicio" value={t.vigilantes ?? 0} />
        <KpiCard icon={<Crosshair className="h-4 w-4" />} label="Armas en uso" value={t.armas ?? 0} accent="bg-gold/15 text-gold" />
        <KpiCard icon={<ShieldOff className="h-4 w-4" />} label="Puestos sin arma" value={t.sinArma ?? 0} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Con novedad" value={t.conNovedad ?? 0} accent="bg-destructive/10 text-destructive" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mr-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Reporte: <span className="font-medium">{data?.fecha ? new Date(data.fecha).toLocaleDateString("es-DO") : "—"}</span>
          {canEdit && <Badge variant="secondary" className="ml-2 text-[10px]">Edición habilitada</Badge>}
        </div>
        <div className="inline-flex items-center gap-1">
          <Input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setSelectedDate(e.target.value); load(e.target.value || undefined); }}
            list="expediente-dates"
            className="h-9 w-[150px]"
            title="Fecha del reporte (por defecto ayer; puedes ir hacia atrás hasta hoy)"
          />
          <datalist id="expediente-dates">
            {availableDates.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            ["todos", "Todos"],
            ["armas", "Con armas"],
            ["sinArma", "Sin arma"],
            ["novedad", "Con novedad"],
          ] as [FilterKey, string][]).map(([k, lbl]) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {lbl}
            </Button>
          ))}
        </div>
        <Input placeholder="Buscar cliente, vigilante o serial…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportSchema}><Download className="h-4 w-4 mr-1" /> Exportar esquema</Button>
          <Button size="sm" variant="outline" onClick={() => load(selectedDate || undefined)}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No hay clientes que coincidan con el filtro seleccionado.
          </Card>
        )}
        {filtered.map((c) => <LiveClientCard key={c.oid} client={c} ctx={ctx} />)}
      </div>

      {weaponDlg && (
        <WeaponDialog
          puesto={weaponDlg.p}
          cliente={weaponDlg.c}
          ctx={ctx}
          onClose={() => setWeaponDlg(null)}
        />
      )}
      {agentDlg && (
        <AgentDialog
          puesto={agentDlg.p}
          cliente={agentDlg.c}
          ctx={ctx}
          onClose={() => setAgentDlg(null)}
        />
      )}
      {postDlg && (
        <PostDialog
          puesto={postDlg.p}
          cliente={postDlg.c}
          ctx={ctx}
          onClose={() => setPostDlg(null)}
        />
      )}
    </div>
  );
};

// ─── Agrupación por Localidad → Puesto (estilo Manual) ───
interface PuestoGroup {
  nombre: string;
  requiereArma: boolean;
  rows: GeneralExpedientePuesto[];
}
interface LocalidadGroup {
  nombre: string;
  puestos: PuestoGroup[];
}

function groupByLocalidad(puestos: GeneralExpedientePuesto[]): LocalidadGroup[] {
  const locs = new Map<string, LocalidadGroup>();
  for (const p of puestos) {
    const locName = (p.localidad || "Sede Principal").trim() || "Sede Principal";
    let loc = locs.get(locName.toLowerCase());
    if (!loc) { loc = { nombre: locName, puestos: [] }; locs.set(locName.toLowerCase(), loc); }
    const puestoName = (p.puesto || "Puesto General").trim() || "Puesto General";
    let pg = loc.puestos.find((x) => x.nombre.toLowerCase() === puestoName.toLowerCase());
    if (!pg) { pg = { nombre: puestoName, requiereArma: false, rows: [] }; loc.puestos.push(pg); }
    pg.rows.push(p);
    if (p.requiereArma) pg.requiereArma = true;
  }
  return [...locs.values()];
}

function LiveClientCard({ client, ctx }: { client: GeneralExpedienteCliente; ctx: LiveCtx }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const armas = client.puestos.filter((p) => p.requiereArma).length;
  const vigilantes = new Set(
    client.puestos
      .map((p) => (p.vigilanteCodigo != null ? `c:${p.vigilanteCodigo}` : (p.vigilante || "").trim().toLowerCase()))
      .filter((x) => x && x !== "c:"),
  ).size;

  const printExpediente = () => {
    try {
      exportToPDF({
        title: `Expediente — ${client.nombre}`,
        subtitle: `${client.direccion || "Sin dirección"}  ·  Reporte: ${ctx.reportDate ? new Date(ctx.reportDate).toLocaleDateString("es-DO") : "—"}  ·  ${client.rnc ? `RNC ${client.rnc}` : client.cedula ? `Céd. ${client.cedula}` : ""}`,
        columns: [
          { header: "Puesto", key: "puesto", width: 45 },
          { header: "Vigilante", key: "vigilante", width: 50 },
          { header: "Horas", key: "horas", width: 16 },
          { header: "Arma (Serial · Licencia)", key: "arma", width: 55 },
          { header: "Estado", key: "estado", width: 30 },
          { header: "Novedad", key: "comentario", width: 45 },
        ],
        data: client.puestos.map((p) => {
          const ov = p.armaSerial ? ctx.overlay[p.armaSerial] : undefined;
          const estatus = ov?.estatus ?? p.arma?.estatus ?? "";
          const lic = ov?.noLicencia ?? p.arma?.noLicencia ?? "";
          return {
            puesto: p.puesto,
            vigilante: p.vigilante,
            horas: p.horas,
            arma: p.requiereArma
              ? [p.arma?.tipo || p.armaModelo, p.armaSerial, lic ? `Lic. ${lic}` : ""].filter(Boolean).join(" · ") || "Armado"
              : "—",
            estado: p.requiereArma ? (estatus || "—") : "—",
            comentario: p.comentario || (p.novedad ? "Con novedad" : ""),
          };
        }),
        filename: `expediente_${(client.codigo ?? client.nombre).toString().replace(/\W+/g, "_")}`,
      });
    } catch (e) {
      toast({ title: "No se pudo generar el expediente", description: String((e as Error)?.message || e), variant: "destructive" });
    }
  };

  const localidades = groupByLocalidad(client.puestos);
  const reporteLabel = ctx.reportDate ? new Date(ctx.reportDate).toLocaleDateString("es-DO") : "—";

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-3 text-left bg-secondary text-secondary-foreground">
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Building2 className="h-5 w-5 text-gold shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-sm truncate">{client.nombre}</p>
          <p className="text-xs opacity-80 truncate">
            {client.codigo ? `#${client.codigo} · ` : ""}{client.puestos.length} puesto(s) · {vigilantes} vigilante(s) · {armas} armado(s)
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {armas > 0 && <Badge className="text-[10px] gap-1"><Crosshair className="h-3 w-3" /> {armas}</Badge>}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); printExpediente(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); printExpediente(); } }}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-white/10"
            title="Imprimir expediente"
          >
            <FileText className="h-4 w-4" />
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {client.direccion && (
              <a href={mapsHref(client.direccion)} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-primary hover:underline">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span className="truncate">{client.direccion}</span> <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
            {client.telefono && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {client.telefono}</span>}
            {client.email && <span className="inline-flex items-center gap-1 text-muted-foreground truncate"><Mail className="h-3.5 w-3.5" /> {client.email}</span>}
            {(client.rnc || client.cedula) && <span className="text-muted-foreground">{client.rnc ? `RNC ${client.rnc}` : `Céd. ${client.cedula}`}</span>}
            {client.contacto && <span className="text-muted-foreground">Contacto: {client.contacto}</span>}
          </div>

          {localidades.map((loc) => (
            <div key={loc.nombre} className="border-l-2 border-gold/40 pl-3 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold shrink-0" />
                <p className="text-sm font-semibold">{loc.nombre}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {loc.puestos.map((pg) => {
                  const head = pg.rows[0];
                  const opsOrigin = pg.rows.some((r) => r.origen === "operaciones" || r.armaOrigen === "operaciones");
                  return (
                    <div key={pg.nombre} className="bg-card border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => ctx.openPost(head, client)}
                          className="min-w-0 flex-1 text-left hover:text-primary"
                          title="Ver ficha del puesto"
                        >
                          <p className="text-sm font-semibold truncate">{pg.nombre}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {pg.requiereArma ? (
                              <Badge className="text-[10px] gap-1"><Crosshair className="h-3 w-3" /> Requiere arma</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Sin arma</Badge>
                            )}
                            {opsOrigin && <Badge variant="secondary" className="text-[10px]">Operaciones</Badge>}
                          </div>
                        </button>
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Reporte: {reporteLabel}
                      </div>

                      <div className="space-y-1">
                        {pg.rows.map((p) => {
                          const ov = p.armaSerial ? ctx.overlay[p.armaSerial] : undefined;
                          const arma = applyWeaponOverride(p.arma, ov);
                          const estatus = arma?.estatus ?? null;
                          const fotos = ov?.fotosArma?.length || 0;
                          return (
                            <div key={p.lineaOID} className="flex flex-wrap items-center gap-2 text-xs border-b border-border/50 pb-1 last:border-0 last:pb-0">
                              <button
                                onClick={() => ctx.openAgent(p, client)}
                                className="flex-1 min-w-[120px] truncate text-left hover:text-primary inline-flex items-center gap-1"
                                title="Ver ficha del vigilante"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.vigilante ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                                <span className="truncate">{p.vigilante || "Sin asignar"}</span>
                              </button>
                              {p.tanda && <Badge variant="outline" className="text-[10px] shrink-0">{p.tanda}</Badge>}
                              {p.horas > 0 && <span className="text-muted-foreground shrink-0">{p.horas}h</span>}
                              {p.requiereArma && (
                                <button
                                  onClick={() => ctx.openWeapon(p, client)}
                                  className="inline-flex items-center gap-1 shrink-0 max-w-[220px] truncate hover:text-primary"
                                  title="Ver / editar arma"
                                >
                                  <span className="truncate">
                                    {[arma?.tipo || p.armaModelo, p.armaSerial].filter(Boolean).join(" · ") || "Armado"}
                                  </span>
                                  {estatus && <span className={`px-1.5 py-0.5 rounded ${statusColor(estatus)}`}>{estatus}</span>}
                                  {fotos > 0 && <Badge variant="outline" className="text-[9px]">{fotos}📷</Badge>}
                                </button>
                              )}
                              {p.novedad && <Badge variant="destructive" className="text-[10px] shrink-0">Novedad</Badge>}
                              {ctx.canEdit && (
                                <button
                                  onClick={() => {
                                    if (confirm(`¿Eliminar este registro del expediente?\n\n${p.vigilante || "Sin asignar"} · ${pg.nombre}\n\nSe ocultará para todos los usuarios (se puede restaurar desde el archivo de auditoría).`)) {
                                      ctx.hideLine(client, p);
                                    }
                                  }}
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  title="Eliminar registro (duplicado/erróneo)"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Dialog de Arma (detalle + edición + fotos + movimientos) ───
function WeaponDialog({ puesto, cliente, ctx, onClose }: {
  puesto: GeneralExpedientePuesto; cliente: GeneralExpedienteCliente; ctx: LiveCtx; onClose: () => void;
}) {
  const { toast } = useToast();
  const serie = puesto.armaSerial || "";
  const ov: ExpedienteOverlayEntry = (serie && ctx.overlay[serie]) || {};
  const [estatus, setEstatus] = useState(ov.estatus ?? puesto.arma?.estatus ?? "");
  const [noLicencia, setNoLicencia] = useState(ov.noLicencia ?? puesto.arma?.noLicencia ?? "");
  const [marca, setMarca] = useState(ov.marca ?? puesto.arma?.marca ?? "");
  const [tipo, setTipo] = useState(ov.tipo ?? puesto.arma?.tipo ?? "");
  const [calibre, setCalibre] = useState(ov.calibre ?? puesto.arma?.calibre ?? "");
  const [categoria, setCategoria] = useState(ov.categoria ?? puesto.arma?.categoria ?? "");
  const [propietario, setPropietario] = useState(ov.propietario ?? puesto.arma?.propietario ?? "");
  const [nota, setNota] = useState(ov.nota ?? "");
  const [saving, setSaving] = useState(false);
  const [movs, setMovs] = useState<ExpedienteMovement[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (serie) expedienteOverlayApi.movements({ serie }).then(setMovs).catch(() => setMovs([]));
  }, [serie]);

  const refreshMovs = () => serie && expedienteOverlayApi.movements({ serie }).then(setMovs).catch(() => {});

  if (!serie) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arma sin serial</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Este puesto está armado pero el arma no tiene serial en GENERAL, por lo que no se puede editar el expediente.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      await expedienteOverlayApi.save(serie, { estatus, noLicencia, nota, marca, tipo, calibre, categoria, propietario });
      ctx.reloadOverlay();
      toast({ title: "Arma actualizada" });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: String((e as Error)?.message || e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const upload = async (file: File, kind: "arma" | "licenciaFrente" | "licenciaDorso") => {
    try {
      const dataUrl = await fileToDataUrl(file);
      await expedienteOverlayApi.uploadPhoto(serie, dataUrl, file.name, kind);
      ctx.reloadOverlay();
      toast({ title: "Imagen subida" });
    } catch (e) {
      toast({ title: "No se pudo subir la imagen", description: String((e as Error)?.message || e), variant: "destructive" });
    }
  };

  const removePhoto = async (url: string, kind: "arma" | "licenciaFrente" | "licenciaDorso") => {
    try {
      await expedienteOverlayApi.deletePhoto(serie, url, kind);
      ctx.reloadOverlay();
    } catch (e) {
      toast({ title: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const fotos = ov.fotosArma || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-gold" /> {puesto.arma?.tipo || "Arma"} · Serial {serie}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Field label="Serie" value={serie} />
            <Field label="Marca" value={puesto.arma?.marca} />
            <Field label="Tipo" value={puesto.arma?.tipo} />
            <Field label="Calibre" value={puesto.arma?.calibre} />
            <Field label="Categoría" value={puesto.arma?.categoria} />
            <Field label="No. Licencia" value={noLicencia || puesto.arma?.noLicencia} />
            <Field label="Propietario" value={puesto.arma?.propietario} />
            <Field label="Ubicación" value={`${cliente.nombre} · ${puesto.puesto}`} />
            <Field label="Custodio" value={puesto.vigilante} />
          </div>

          {ctx.canEdit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs space-y-1">
                <span className="font-medium">Estatus</span>
                <Input value={estatus} onChange={(e) => setEstatus(e.target.value)} placeholder="En condiciones / Falta de mantenimiento…" />
              </label>
              <label className="text-xs space-y-1">
                <span className="font-medium">No. Licencia</span>
                <Input value={noLicencia} onChange={(e) => setNoLicencia(e.target.value)} placeholder="Número de licencia" />
              </label>
              <label className="text-xs space-y-1 sm:col-span-2">
                <span className="font-medium">Nota</span>
                <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Estatus" value={estatus} />
              <Field label="No. Licencia" value={noLicencia} />
              {nota && <Field label="Nota" value={nota} />}
            </div>
          )}

          {/* Fotos del arma */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Fotos del arma ({fotos.length})</p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((u) => (
                <div key={u} className="relative">
                  <img src={getFileUrl(u)} alt="Arma" className="h-20 w-20 object-cover rounded border" />
                  {ctx.canEdit && (
                    <button onClick={() => removePhoto(u, "arma")} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {ctx.canEdit && (
                <label className="h-20 w-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "arma"); e.currentTarget.value = ""; }} />
                </label>
              )}
            </div>
          </div>

          {/* Licencia */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Licencia (frente / dorso)</p>
            <div className="flex flex-wrap gap-3">
              {(["licenciaFrente", "licenciaDorso"] as const).map((kind) => {
                const url = kind === "licenciaFrente" ? ov.fotoLicenciaFrente : ov.fotoLicenciaDorso;
                return (
                  <div key={kind} className="space-y-1">
                    <p className="text-[10px] uppercase text-muted-foreground">{kind === "licenciaFrente" ? "Frente" : "Dorso"}</p>
                    {url ? (
                      <div className="relative">
                        <img src={getFileUrl(url)} alt="Licencia" className="h-24 w-36 object-cover rounded border" />
                        {ctx.canEdit && (
                          <button onClick={() => removePhoto(url, kind)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : ctx.canEdit ? (
                      <label className="h-24 w-36 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50">
                        <IdCard className="h-5 w-5 text-muted-foreground" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, kind); e.currentTarget.value = ""; }} />
                      </label>
                    ) : (
                      <div className="h-24 w-36 border rounded flex items-center justify-center text-[10px] text-muted-foreground">Sin imagen</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Movimientos FROM→TO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5" /> Movimientos del arma</p>
              {ctx.canEdit && <Button size="sm" variant="outline" className="h-7" onClick={() => setShowTransfer((v) => !v)}>Registrar traslado</Button>}
            </div>
            {showTransfer && (
              <TransferForm
                tipo="arma"
                serie={serie}
                armaModelo={puesto.arma?.tipo || puesto.armaModelo || ""}
                defaultFrom={`${cliente.nombre} · ${puesto.puesto}`}
                onDone={() => { setShowTransfer(false); refreshMovs(); }}
              />
            )}
            <MovementsList movs={movs} />
          </div>
        </div>

        <DialogFooter>
          {ctx.canEdit && <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>}
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentDialog({ puesto, cliente, ctx, onClose }: {
  puesto: GeneralExpedientePuesto; cliente: GeneralExpedienteCliente; ctx: LiveCtx; onClose: () => void;
}) {
  const [movs, setMovs] = useState<ExpedienteMovement[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const empId = puesto.vigilanteCodigo ?? puesto.vigilanteOID ?? "";

  useEffect(() => {
    if (empId) expedienteOverlayApi.movements({ empleado: empId }).then(setMovs).catch(() => {});
  }, [empId]);
  const refreshMovs = () => empId && expedienteOverlayApi.movements({ empleado: empId }).then(setMovs).catch(() => {});

  const printFicha = () => printAgentFicha(puesto, cliente);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> {puesto.vigilante}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Código" value={puesto.vigilanteCodigo} />
            <Field label="Cédula" value={puesto.vigilanteCedula} />
            {puesto.vigilanteFechaNacimiento && (
              <Field label="Nacimiento" value={new Date(puesto.vigilanteFechaNacimiento).toLocaleDateString("es-DO")} />
            )}
            {puesto.vigilanteEdad != null && <Field label="Edad" value={`${puesto.vigilanteEdad} años`} />}
            <Field label="Cliente" value={cliente.nombre} />
            <Field label="Puesto" value={puesto.puesto} />
            <Field label="Horas" value={`${puesto.horas}h`} />
            <Field label="Incentivo" value={puesto.incentivo ? `RD$ ${puesto.incentivo}` : "—"} />
            {puesto.requiereArma && <Field label="Arma asignada" value={[puesto.arma?.tipo, puesto.armaSerial].filter(Boolean).join(" · ")} />}
            {puesto.comentario && <Field label="Comentario" value={puesto.comentario} />}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5" /> Traslados del personal</p>
              {ctx.canEdit && <Button size="sm" variant="outline" className="h-7" onClick={() => setShowTransfer((v) => !v)}>Registrar traslado</Button>}
            </div>
            {showTransfer && (
              <TransferForm
                tipo="personal"
                empleado={String(empId)}
                empleadoNombre={puesto.vigilante}
                defaultFrom={`${cliente.nombre} · ${puesto.puesto}`}
                onDone={() => { setShowTransfer(false); refreshMovs(); }}
              />
            )}
            <MovementsList movs={movs} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={printFicha}><FileText className="h-4 w-4 mr-1" /> Imprimir ficha</Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostDialog({ puesto, cliente, ctx, onClose }: {
  puesto: GeneralExpedientePuesto; cliente: GeneralExpedienteCliente; ctx: LiveCtx; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-gold" /> {puesto.puesto}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Field label="Cliente" value={cliente.nombre} />
          <Field label="Código cliente" value={cliente.codigo} />
          <Field label="Dirección" value={cliente.direccion} />
          <Field label="Requiere arma" value={puesto.requiereArma ? "Sí" : "No"} />
          <Field label="Vigilante" value={puesto.vigilante} />
          <Field label="Horas" value={`${puesto.horas}h`} />
          {puesto.requiereArma && <Field label="Arma" value={[puesto.arma?.tipo, puesto.armaSerial].filter(Boolean).join(" · ")} />}
          {puesto.novedad && <Field label="Novedad" value={puesto.comentario || "Sí"} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => printPostFichaLive(puesto, cliente, ctx.reportDate)}><FileText className="h-4 w-4 mr-1" /> Imprimir ficha</Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({ tipo, serie, armaModelo, empleado, empleadoNombre, defaultFrom, onDone }: {
  tipo: "arma" | "personal";
  serie?: string;
  armaModelo?: string;
  empleado?: string;
  empleadoNombre?: string;
  defaultFrom: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [desde, setDesde] = useState(defaultFrom);
  const [hacia, setHacia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!hacia.trim()) { toast({ title: "Indica el destino (TO)", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await expedienteOverlayApi.addMovement({ tipo, serie, armaModelo, empleado, empleadoNombre, desde, hacia, motivo });
      toast({ title: "Traslado registrado" });
      onDone();
    } catch (e) {
      toast({ title: "No se pudo registrar", description: String((e as Error)?.message || e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="border border-border rounded-md p-2.5 space-y-2 bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] space-y-1"><span className="font-medium">Desde (FROM)</span><Input className="h-8" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="text-[11px] space-y-1"><span className="font-medium">Hacia (TO)</span><Input className="h-8" value={hacia} onChange={(e) => setHacia(e.target.value)} placeholder="Almacén / Puesto / Custodio" /></label>
      </div>
      <Input className="h-8 text-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del traslado" />
      <div className="flex justify-end">
        <Button size="sm" className="h-7" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar traslado"}</Button>
      </div>
    </div>
  );
}

function MovementsList({ movs }: { movs: ExpedienteMovement[] }) {
  if (!movs.length) return <p className="text-[11px] text-muted-foreground italic">Sin movimientos registrados.</p>;
  return (
    <div className="space-y-1">
      {movs.map((m) => (
        <div key={m.id} className="text-[11px] border border-border rounded px-2 py-1 flex items-center gap-2">
          <span className="text-muted-foreground shrink-0">{m.fecha ? new Date(m.fecha).toLocaleDateString("es-DO") : ""}</span>
          <span className="font-medium truncate">{m.desde || "—"}</span>
          <ArrowRightLeft className="h-3 w-3 shrink-0 text-gold" />
          <span className="font-medium truncate">{m.hacia || "—"}</span>
          {m.motivo && <span className="text-muted-foreground truncate">· {m.motivo}</span>}
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value ?? "—"}</p>
    </div>
  );
}

// ─── Impresión de fichas (ventana nueva) ───
function openPrint(html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
const escHtml = (v: unknown) => String(v ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const fichaStyles = `body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;padding:32px}h1{font-size:20px;border-bottom:3px solid #b8860b;padding-bottom:8px}.row{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #eee}.lbl{width:160px;color:#6b7280;font-size:12px;text-transform:uppercase}.val{font-weight:600}`;
function rowHtml(l: string, v: unknown) { return `<div class="row"><span class="lbl">${escHtml(l)}</span><span class="val">${escHtml(v)}</span></div>`; }

function printAgentFicha(p: GeneralExpedientePuesto, c: GeneralExpedienteCliente) {
  openPrint(`<html><head><title>Ficha del Vigilante</title><style>${fichaStyles}</style></head><body>
    <h1>Ficha del Vigilante</h1>
    ${rowHtml("Nombre", p.vigilante)}${rowHtml("Código", p.vigilanteCodigo)}${rowHtml("Cédula", p.vigilanteCedula)}
    ${p.vigilanteFechaNacimiento ? rowHtml("Nacimiento", new Date(p.vigilanteFechaNacimiento).toLocaleDateString("es-DO")) : ""}${p.vigilanteEdad != null ? rowHtml("Edad", p.vigilanteEdad + " años") : ""}
    ${rowHtml("Cliente", c.nombre)}${rowHtml("Puesto", p.puesto)}${rowHtml("Horas", p.horas + "h")}
    ${p.requiereArma ? rowHtml("Arma asignada", [p.arma?.tipo, p.armaSerial].filter(Boolean).join(" · ")) : ""}
    ${p.comentario ? rowHtml("Comentario", p.comentario) : ""}
  </body></html>`);
}
function printPostFichaLive(p: GeneralExpedientePuesto, c: GeneralExpedienteCliente, fecha: string) {
  openPrint(`<html><head><title>Ficha del Puesto</title><style>${fichaStyles}</style></head><body>
    <h1>Ficha del Puesto</h1>
    ${rowHtml("Puesto", p.puesto)}${rowHtml("Cliente", c.nombre)}${rowHtml("Dirección", c.direccion)}
    ${rowHtml("Requiere arma", p.requiereArma ? "Sí" : "No")}${rowHtml("Vigilante", p.vigilante)}
    ${p.requiereArma ? rowHtml("Arma", [p.arma?.tipo, p.armaSerial].filter(Boolean).join(" · ")) : ""}
    ${rowHtml("Reporte", fecha ? new Date(fecha).toLocaleDateString("es-DO") : "—")}
    ${p.novedad ? rowHtml("Novedad", p.comentario || "Sí") : ""}
  </body></html>`);
}

export default ExpedienteLive;
