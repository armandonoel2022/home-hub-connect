import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  generalSqlApi, expedienteOverlayApi,
  type GeneralExpediente, type GeneralExpedienteCliente, type GeneralExpedientePuesto,
  type PostScheduleEntry, type DiaSemana, type Holiday,
} from "@/lib/api";
import { exportToExcel } from "@/lib/exportUtils";
import { loadHolidays, getHolidayName, dayClassification, DIA_LABELS, DIAS_ORDEN } from "@/lib/holidays";
import { displayCaliber } from "@/lib/expedienteHelpers";
import {
  Building2, Users, Crosshair, RefreshCw, Download, CalendarDays, AlertTriangle,
  ShieldCheck, CalendarClock, Pencil, Plus, Trash2, CircleCheck, CircleX, Sparkles,
} from "lucide-react";

// Clave estable del puesto para la plantilla de horario (cliente|puesto).
function postKey(cli: GeneralExpedienteCliente, p: GeneralExpedientePuesto): string {
  const n = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const c = cli.codigo != null ? `c${cli.codigo}` : n(cli.nombre);
  return `${c}|${n(p.puesto)}`;
}

interface FlatRow {
  cliente: GeneralExpedienteCliente;
  puesto: GeneralExpedientePuesto;
  key: string;
}

const ExpedienteDashboard = () => {
  const { toast } = useToast();
  const [exp, setExp] = useState<GeneralExpediente | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [fecha, setFecha] = useState<string>("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [schedules, setSchedules] = useState<Record<string, PostScheduleEntry>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");
  const [editing, setEditing] = useState<FlatRow | null>(null);

  const load = async (f?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [e, ds, sc, ce] = await Promise.all([
        generalSqlApi.expediente(f),
        generalSqlApi.expedienteDates().catch(() => [] as string[]),
        expedienteOverlayApi.schedules().catch(() => ({} as Record<string, PostScheduleEntry>)),
        expedienteOverlayApi.canEdit ? expedienteOverlayApi.canEdit().then((r) => r.canEdit).catch(() => false) : Promise.resolve(false),
      ]);
      setExp(e);
      setDates(ds);
      setSchedules(sc || {});
      setCanEdit(ce);
      const usedDate = e.fecha || f || "";
      setFecha(usedDate);
      if (usedDate) {
        const year = Number(usedDate.slice(0, 4)) || new Date().getFullYear();
        setHolidays(await loadHolidays(year));
      }
    } catch (err) {
      setError((err as Error)?.message || "No se pudo cargar el expediente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const onDateChange = (v: string) => { setFecha(v); load(v); };

  const rows = useMemo<FlatRow[]>(() => {
    if (!exp) return [];
    const out: FlatRow[] = [];
    const q = filterClient.toLowerCase().trim();
    exp.clientes.forEach((cli) => {
      if (q && !cli.nombre.toLowerCase().includes(q)) return;
      cli.puestos.forEach((p) => out.push({ cliente: cli, puesto: p, key: postKey(cli, p) }));
    });
    return out;
  }, [exp, filterClient]);

  const dayClass: DiaSemana | null = useMemo(
    () => (fecha ? dayClassification(fecha, holidays) : null),
    [fecha, holidays],
  );
  const holidayName = fecha ? getHolidayName(fecha, holidays) : null;

  // KPIs
  const kpis = useMemo(() => {
    const puestos = rows.length;
    const conArma = rows.filter((r) => r.puesto.requiereArma).length;
    const vigilantes = new Set(rows.map((r) => (r.puesto.vigilante || "").trim()).filter(Boolean)).size;
    const sinCobertura = rows.filter((r) => !(r.puesto.vigilante || "").trim()).length;
    const sinArma = rows.filter((r) => r.puesto.requiereArma && !(r.puesto.armaSerial || "").trim()).length;
    return { puestos, conArma, vigilantes, sinCobertura, sinArma };
  }, [rows]);

  // Comparación plantilla vs real para el día seleccionado
  const comparisons = useMemo(() => {
    return rows.map((r) => {
      const sched = schedules[r.key];
      const expected = (sched && dayClass && sched.semana?.[dayClass]) || [];
      const realVig = (r.puesto.vigilante || "").trim();
      const realTanda = (r.puesto.tanda || "").trim();
      let estado: "ok" | "cambio" | "ausente" | "sin-plantilla" = "sin-plantilla";
      let detalle = "";
      if (expected.length > 0) {
        if (!realVig) {
          estado = "ausente";
          detalle = "No reportó vigilante";
        } else {
          const matchVig = expected.some((s) => !s.vigilante || s.vigilante.trim().toLowerCase() === realVig.toLowerCase());
          const matchTanda = expected.some((s) => !s.tanda || s.tanda.trim().toLowerCase() === realTanda.toLowerCase());
          if (matchVig && matchTanda) { estado = "ok"; detalle = "Coincide con la plantilla"; }
          else {
            estado = "cambio";
            const exp0 = expected.map((s) => `${s.tanda || "?"}${s.vigilante ? ` · ${s.vigilante}` : ""}`).join(", ");
            detalle = `Esperado: ${exp0}`;
          }
        }
      }
      return { ...r, estado, detalle, expectedCount: expected.length };
    });
  }, [rows, schedules, dayClass]);

  const changes = comparisons.filter((c) => c.estado === "cambio" || c.estado === "ausente");

  // Armas: duplicados (mismo serial en varios puestos)
  const dupSerials = useMemo(() => {
    const m = new Map<string, FlatRow[]>();
    rows.forEach((r) => {
      const s = (r.puesto.armaSerial || "").trim();
      if (!s) return;
      m.set(s, [...(m.get(s) || []), r]);
    });
    return Array.from(m.entries()).filter(([, v]) => v.length > 1);
  }, [rows]);

  const armasSinAsignar = comparisons.filter((c) => c.puesto.requiereArma && !(c.puesto.armaSerial || "").trim());

  const exportExcel = () => {
    exportToExcel({
      title: `Expediente Clientes ${fecha}`,
      filename: `expediente-dashboard-${fecha}`,
      columns: ["Cliente", "Localidad", "Puesto", "Tanda", "Vigilante", "Arma", "Calibre", "Estado vs plantilla"],
      data: comparisons.map((c) => [
        c.cliente.nombre, c.puesto.localidad || "", c.puesto.puesto, c.puesto.tanda || "",
        c.puesto.vigilante || "—", c.puesto.armaSerial || "—",
        displayCaliber(c.puesto.arma?.calibre), c.detalle || c.estado,
      ]),
    });
  };

  if (loading) {
    return <Card className="p-10 text-center text-sm text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" /> Cargando dashboard…</Card>;
  }
  if (error) {
    return (
      <Card className="p-6 text-center space-y-3">
        <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button size="sm" onClick={() => load(fecha)}><RefreshCw className="h-4 w-4 mr-1" /> Reintentar</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Fecha</Label>
          <Input type="date" list="dash-dates" value={fecha} max={dates[0] || undefined}
            onChange={(e) => onDateChange(e.target.value)} className="h-9 w-44" />
          <datalist id="dash-dates">{dates.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">Cliente</Label>
          <Input placeholder="Filtrar cliente…" value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="h-9" />
        </div>
        <div className="flex items-center gap-2">
          {dayClass && (
            <Badge variant={dayClass === "feriado" ? "default" : "outline"} className="h-9 px-3 gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {DIA_LABELS[dayClass]}{holidayName ? `: ${holidayName}` : ""}
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-9" onClick={() => load(fecha)}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
          <Button variant="outline" size="sm" className="h-9" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Excel</Button>
        </div>
      </div>

      {holidayName && (
        <Card className="p-3 bg-primary/5 border-primary/30 flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span><strong>{holidayName}</strong> — los vigilantes que trabajen este día se pagan a <strong>sueldo/26 ×2</strong> (doble) en el volante de RRHH.</span>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Building2 className="h-4 w-4" />} label="Puestos" value={kpis.puestos} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Vigilantes" value={kpis.vigilantes} />
        <KpiCard icon={<Crosshair className="h-4 w-4" />} label="Con arma" value={kpis.conArma} />
        <KpiCard icon={<CircleX className="h-4 w-4" />} label="Sin cobertura" value={kpis.sinCobertura} tone={kpis.sinCobertura ? "warn" : undefined} />
        <KpiCard icon={<ShieldCheck className="h-4 w-4" />} label="Arma faltante" value={kpis.sinArma} tone={kpis.sinArma ? "warn" : undefined} />
      </div>

      {/* Cambios de turno por día */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Cambios de turno · {dayClass ? DIA_LABELS[dayClass] : "—"}</h3>
          <Badge variant="outline" className="text-[10px]">{changes.length} con diferencia</Badge>
        </div>
        {changes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin diferencias respecto a la plantilla (o aún no hay plantillas definidas).</p>
        ) : (
          <div className="space-y-1.5">
            {changes.map((c) => (
              <div key={c.key + c.puesto.lineaOID} className="flex items-center gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0">
                {c.estado === "ausente"
                  ? <CircleX className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{c.cliente.nombre}</span> · {c.puesto.puesto}
                  <span className="text-muted-foreground"> — {c.detalle}</span>
                </div>
                <span className="shrink-0 text-muted-foreground">{c.puesto.vigilante || "sin vigilante"}{c.puesto.tanda ? ` · ${c.puesto.tanda}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Armas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Asignación de armas</h3>
          </div>
          {armasSinAsignar.length === 0 && dupSerials.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Todas las armas están asignadas y sin duplicados.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {armasSinAsignar.map((c) => (
                <div key={"sa" + c.key + c.puesto.lineaOID} className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                  <span><strong>{c.puesto.puesto}</strong> ({c.cliente.nombre}) requiere arma y no reportó serial.</span>
                </div>
              ))}
              {dupSerials.map(([serie, list]) => (
                <div key={"dup" + serie} className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span>Serial <strong>{serie}</strong> aparece en {list.length} puestos: {list.map((l) => l.puesto.puesto).join(", ")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vigilantes por puesto */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Vigilantes por puesto</h3>
          </div>
          <div className="space-y-1 text-xs max-h-64 overflow-auto">
            {rows.map((r) => (
              <div key={"vp" + r.key + r.puesto.lineaOID} className="flex items-center gap-2 border-b border-border/40 pb-1 last:border-0">
                <span className="min-w-0 flex-1 truncate"><strong>{r.puesto.puesto}</strong> <span className="text-muted-foreground">· {r.cliente.nombre}</span></span>
                <span className="shrink-0">{r.puesto.vigilante || <span className="text-red-500">sin asignar</span>}</span>
                {canEdit && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Editar plantilla de horario" onClick={() => setEditing(r)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {editing && (
        <ScheduleDialog
          row={editing}
          current={schedules[editing.key] || null}
          onClose={() => setEditing(null)}
          onSaved={(entry) => {
            setSchedules((prev) => ({ ...prev, [editing.key]: entry }));
            setEditing(null);
            toast({ title: "Plantilla de horario guardada" });
          }}
        />
      )}
    </div>
  );
};

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "warn" }) {
  return (
    <Card className={`p-3 ${tone === "warn" ? "border-amber-300 bg-amber-50/50" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

// ─── Editor de plantilla semanal ───
function ScheduleDialog({ row, current, onClose, onSaved }: {
  row: FlatRow;
  current: PostScheduleEntry | null;
  onClose: () => void;
  onSaved: (e: PostScheduleEntry) => void;
}) {
  const { toast } = useToast();
  const empty = () => DIAS_ORDEN.reduce((acc, d) => ({ ...acc, [d]: [] }), {} as Record<DiaSemana, { tanda: string; vigilante?: string; arma?: string }[]>);
  const [semana, setSemana] = useState<Record<DiaSemana, { tanda: string; vigilante?: string; arma?: string }[]>>(
    () => ({ ...empty(), ...(current?.semana || {}) }),
  );
  const [saving, setSaving] = useState(false);

  const addSlot = (d: DiaSemana) => setSemana((s) => ({ ...s, [d]: [...(s[d] || []), { tanda: "", vigilante: "", arma: "" }] }));
  const removeSlot = (d: DiaSemana, i: number) => setSemana((s) => ({ ...s, [d]: s[d].filter((_, idx) => idx !== i) }));
  const setSlot = (d: DiaSemana, i: number, patch: Partial<{ tanda: string; vigilante: string; arma: string }>) =>
    setSemana((s) => ({ ...s, [d]: s[d].map((x, idx) => idx === i ? { ...x, ...patch } : x) }));

  const prefill = () => {
    // Sembrar la plantilla con lo reportado hoy en todos los días laborables.
    const slot = { tanda: row.puesto.tanda || "", vigilante: row.puesto.vigilante || "", arma: row.puesto.armaSerial || "" };
    setSemana(() => DIAS_ORDEN.reduce((acc, d) => ({ ...acc, [d]: d === "feriado" ? [] : [{ ...slot }] }), {} as Record<DiaSemana, { tanda: string; vigilante?: string; arma?: string }[]>));
  };

  const save = async () => {
    setSaving(true);
    try {
      const entry = await expedienteOverlayApi.saveSchedule(row.key, {
        cliente: row.cliente.nombre,
        puesto: row.puesto.puesto,
        requiereArma: row.puesto.requiereArma,
        semana,
      });
      onSaved(entry);
    } catch (e) {
      toast({ title: "No se pudo guardar", description: String((e as Error)?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Horario semanal — {row.puesto.puesto}</DialogTitle>
          <p className="text-xs text-muted-foreground">{row.cliente.nombre} · {row.puesto.localidad || "sin localidad"}</p>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={prefill}><Sparkles className="h-3.5 w-3.5 mr-1" /> Usar lo reportado hoy</Button>
        </div>
        <div className="space-y-3">
          {DIAS_ORDEN.map((d) => (
            <div key={d} className={`rounded-lg border p-2 ${d === "feriado" ? "border-primary/40 bg-primary/5" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold">{DIA_LABELS[d]}</span>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => addSlot(d)}><Plus className="h-3.5 w-3.5 mr-1" /> Tanda</Button>
              </div>
              {(semana[d] || []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Sin servicio.</p>
              ) : (
                <div className="space-y-1.5">
                  {semana[d].map((slot, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                      <Input placeholder="Tanda" value={slot.tanda} onChange={(e) => setSlot(d, i, { tanda: e.target.value })} className="h-8 text-xs" />
                      <Input placeholder="Vigilante (opcional)" value={slot.vigilante || ""} onChange={(e) => setSlot(d, i, { vigilante: e.target.value })} className="h-8 text-xs" />
                      <Input placeholder="Arma (opcional)" value={slot.arma || ""} onChange={(e) => setSlot(d, i, { arma: e.target.value })} className="h-8 text-xs" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSlot(d, i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar plantilla"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExpedienteDashboard;
