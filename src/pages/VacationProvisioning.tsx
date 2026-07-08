import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  vacationsApi,
  type VacationDept,
  type VacationEmployee,
  type VacationPolicy,
  type VacationRoster,
  type VacationPeriod,
} from "@/lib/api";
import {
  Palmtree,
  ArrowLeft,
  CalendarCheck,
  MapPin,
  Cake,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Plus,
  Trash2,
  Database,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

const UBIC_COLORS: Record<string, string> = {
  ALNAP: "from-sky-500 to-blue-600",
  "Banco Caribe": "from-amber-500 to-orange-600",
  "Sede Central": "from-emerald-500 to-green-600",
};

const businessDays = (from: Date, to: Date): number => {
  let count = 0;
  const d = new Date(from);
  while (d <= to) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });

const VacationProvisioning = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<VacationDept[]>([]);
  const [policy, setPolicy] = useState<VacationPolicy | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [roster, setRoster] = useState<VacationRoster | null>(null);
  const [loading, setLoading] = useState(false);

  // Diálogo de asignación de días
  const [editEmp, setEditEmp] = useState<VacationEmployee | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();
  const [periods, setPeriods] = useState<VacationPeriod[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    vacationsApi.departments().then(setDepartments).catch(() => {});
    vacationsApi.policy().then(setPolicy).catch(() => {});
  }, []);

  const openDept = async (dept: VacationDept) => {
    if (!dept.available) {
      toast({ title: "Próximamente", description: `El módulo de ${dept.name} estará disponible pronto.` });
      return;
    }
    setSelectedDept(dept.id);
    setLoading(true);
    try {
      setRoster(await vacationsApi.roster(dept.id));
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el personal.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (emp: VacationEmployee) => {
    setEditEmp(emp);
    setPeriods(emp.plan?.periods || []);
    setNotes(emp.plan?.notes || "");
    setRange(undefined);
  };

  const addPeriod = () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Selecciona un rango", description: "Elige fecha de inicio y fin en el calendario.", variant: "destructive" });
      return;
    }
    const days = businessDays(range.from, range.to);
    setPeriods((p) => [...p, { start: iso(range.from!), end: iso(range.to!), days }]);
    setRange(undefined);
  };

  const totalDays = useMemo(() => periods.reduce((a, p) => a + p.days, 0), [periods]);

  const savePlan = async () => {
    if (!editEmp) return;
    setSaving(true);
    try {
      await vacationsApi.savePlan(editEmp.codigo, {
        nombre: editEmp.nombre,
        ubicacion: editEmp.ubicacion,
        notes,
        periods,
      });
      toast({ title: "Guardado", description: `Plan de vacaciones de ${editEmp.nombre} actualizado.` });
      setEditEmp(null);
      if (selectedDept) setRoster(await vacationsApi.roster(selectedDept));
    } catch {
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Vista: selector de departamentos ──
  const DeptSelector = (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
        <h2 className="section-title text-foreground">Selecciona un departamento</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => openDept(d)}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:-translate-y-1 shadow-md ${
              d.available ? "cursor-pointer" : "opacity-70"
            }`}
            style={{
              background: d.available
                ? "linear-gradient(135deg, hsl(210 80% 45%), hsl(210 80% 30%))"
                : "linear-gradient(135deg, hsl(220 10% 55%), hsl(220 10% 40%))",
            }}
          >
            <div className="flex items-center justify-between text-white">
              <Users className="h-8 w-8 opacity-90" />
              {d.available ? (
                <Badge className="bg-white/20 text-white border-0">Disponible</Badge>
              ) : (
                <Badge className="bg-white/15 text-white border-0">Próximamente</Badge>
              )}
            </div>
            <p className="mt-4 font-heading font-bold text-lg text-white">{d.name}</p>
            <p className="text-xs text-white/80 mt-1">
              {d.available ? "Ver personal y planificar vacaciones" : "En preparación"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Vista: roster de Monitoreo ──
  const stats = useMemo(() => {
    if (!roster) return null;
    const emps = roster.employees;
    const withPlan = emps.filter((e) => e.diasTomados > 0).length;
    const byUbic: Record<string, number> = {};
    emps.forEach((e) => (byUbic[e.ubicacion] = (byUbic[e.ubicacion] || 0) + 1));
    return { total: emps.length, withPlan, pending: emps.length - withPlan, byUbic };
  }, [roster]);

  const RosterView = roster && (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => { setSelectedDept(null); setRoster(null); }} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Departamentos
        </Button>
        <Badge variant={roster.sqlConnected ? "default" : "secondary"} className="gap-1.5">
          <Database className="h-3.5 w-3.5" />
          {roster.sqlConnected ? "Datos de gSafeOne" : "Antigüedad estimada (sin conexión SQL)"}
        </Badge>
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Operadores", value: stats.total, icon: Users, grad: "from-blue-500 to-indigo-600" },
            { label: "Con plan definido", value: stats.withPlan, icon: CheckCircle2, grad: "from-emerald-500 to-green-600" },
            { label: "Pendientes", value: stats.pending, icon: AlertTriangle, grad: "from-amber-500 to-orange-600" },
            { label: "Ubicaciones", value: Object.keys(stats.byUbic).length, icon: MapPin, grad: "from-fuchsia-500 to-purple-600" },
          ].map((k) => (
            <Card key={k.label} className={`p-4 text-white bg-gradient-to-br ${k.grad} border-0`}>
              <div className="flex items-center justify-between">
                <k.icon className="h-6 w-6 opacity-90" />
                <span className="text-3xl font-heading font-bold">{k.value}</span>
              </div>
              <p className="text-xs mt-2 opacity-90">{k.label}</p>
            </Card>
          ))}
        </div>
      )}

      {policy && (
        <Card className="p-4 bg-muted/40">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Política de vacaciones:</strong>{" "}
            {policy.under5Days} días hábiles (menos de {policy.tenureThresholdYears} años) ·{" "}
            {policy.from5Days} días hábiles ({policy.tenureThresholdYears}+ años). Las vacaciones se disfrutan (no se pagan): cada operador selecciona sus días en el calendario.
          </p>
        </Card>
      )}

      {/* Employee cards grouped by location */}
      {Object.keys(UBIC_COLORS).map((ubic) => {
        const emps = roster.employees.filter((e) => e.ubicacion === ubic);
        if (emps.length === 0) return null;
        return (
          <div key={ubic}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-3 w-3 rounded-full bg-gradient-to-br ${UBIC_COLORS[ubic]}`} />
              <h3 className="font-heading font-bold text-foreground">{ubic}</h3>
              <span className="text-xs text-muted-foreground">({emps.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emps.map((e) => {
                const complete = e.diasTomados >= e.diasDerecho;
                return (
                  <button
                    key={e.codigo}
                    onClick={() => openEditor(e)}
                    className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-card-foreground leading-tight">{e.nombre}</p>
                        <p className="text-xs text-muted-foreground">Cód. {e.codigo}</p>
                      </div>
                      <Badge
                        className={`border-0 ${complete ? "bg-emerald-500/15 text-emerald-600" : e.diasTomados > 0 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}
                      >
                        {e.diasTomados}/{e.diasDerecho} días
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {e.horario}</p>
                      <p className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> {e.cumpleanos}</p>
                      <p className="flex items-center gap-1.5">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        {e.antiguedadAnios != null ? `${e.antiguedadAnios} años de servicio` : "Antigüedad no disponible"}
                        {e.diasEstimados && " (estimado)"}
                      </p>
                    </div>
                    {/* progress */}
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${complete ? "bg-emerald-500" : "bg-gold"}`}
                        style={{ width: `${Math.min(100, (e.diasTomados / e.diasDerecho) * 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(160 60% 35%), hsl(190 70% 30%))" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex items-center gap-4 text-white">
            <div className="p-3 rounded-2xl bg-white/15">
              <Palmtree className="h-8 w-8" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl">Provisionamiento de Vacaciones</h1>
              <p className="text-sm text-white/85">Planificación de vacaciones por departamento — disfrute de días, no pago.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full py-8">
          {loading ? (
            <p className="text-muted-foreground">Cargando personal…</p>
          ) : selectedDept && roster ? (
            RosterView
          ) : (
            DeptSelector
          )}
        </div>
        <Footer />
      </div>

      {/* Editor de plan */}
      <Dialog open={!!editEmp} onOpenChange={(o) => !o && setEditEmp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEmp?.nombre}</DialogTitle>
          </DialogHeader>
          {editEmp && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{editEmp.ubicacion}</Badge>
                <Badge variant="secondary">Derecho: {editEmp.diasDerecho} días</Badge>
                <Badge className={totalDays >= editEmp.diasDerecho ? "bg-emerald-500/15 text-emerald-600 border-0" : "bg-amber-500/15 text-amber-600 border-0"}>
                  Asignados: {totalDays} días
                </Badge>
                <Badge variant="outline">Restan: {Math.max(0, editEmp.diasDerecho - totalDays)}</Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="rounded-lg border border-border p-2">
                  <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} className="pointer-events-auto" />
                </div>
                <div className="flex-1 space-y-3">
                  <Button onClick={addPeriod} className="w-full gap-2" variant="secondary">
                    <Plus className="h-4 w-4" /> Agregar período seleccionado
                  </Button>
                  <p className="text-[11px] text-muted-foreground">Se cuentan solo días hábiles (lun–vie).</p>
                  <div className="space-y-2">
                    {periods.length === 0 && <p className="text-sm text-muted-foreground">Sin períodos asignados.</p>}
                    {periods.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <span>{fmt(p.start)} → {fmt(p.end)} <strong>({p.days}d)</strong></span>
                        <button onClick={() => setPeriods((arr) => arr.filter((_, j) => j !== i))} className="text-destructive hover:opacity-70">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Textarea placeholder="Notas (compañero que cubre el turno, acuerdos, etc.)" value={notes} onChange={(e) => setNotes(e.target.value)} />

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditEmp(null)}>Cancelar</Button>
                <Button onClick={savePlan} disabled={saving}>{saving ? "Guardando…" : "Guardar plan"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default VacationProvisioning;
