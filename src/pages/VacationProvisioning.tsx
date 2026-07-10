import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  vacationsApi,
  type VacationDept,
  type VacationEmployee,
  type VacationPolicy,
  type VacationRoster,
  type VacationPeriod,
  type VacationRequest,
  type OnVacationResult,
} from "@/lib/api";
import {
  Palmtree,
  ArrowLeft,
  CalendarCheck,
  Cake,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Plus,
  Trash2,
  Database,
  Clock,
  ShieldCheck,
  UserCircle2,
  CalendarDays,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

const DEPT_GRADIENTS = [
  "linear-gradient(135deg, hsl(210 80% 45%), hsl(210 80% 30%))",
  "linear-gradient(135deg, hsl(160 60% 38%), hsl(190 70% 30%))",
  "linear-gradient(135deg, hsl(275 55% 50%), hsl(300 55% 38%))",
  "linear-gradient(135deg, hsl(20 85% 52%), hsl(12 80% 42%))",
  "linear-gradient(135deg, hsl(340 70% 50%), hsl(355 70% 40%))",
  "linear-gradient(135deg, hsl(45 90% 48%), hsl(35 85% 42%))",
  "linear-gradient(135deg, hsl(190 70% 42%), hsl(210 75% 34%))",
];

const slugify = (str: string) =>
  (str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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

const STATUS_STYLE: Record<string, string> = {
  pendiente: "bg-amber-500/15 text-amber-600",
  "pendiente-gerencia": "bg-purple-500/15 text-purple-600",
  aprobada: "bg-emerald-500/15 text-emerald-600",
  rechazada: "bg-red-500/15 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente", "pendiente-gerencia": "Pendiente Gerencia Comercial", aprobada: "Aprobada", rechazada: "Rechazada",
};

// Departamentos que forman parte de Operaciones (se agrupan bajo un solo botón).
const OPERATIONS_DEPT_SLUGS = [
  "safeone",
  "macrotech",
  "asoc-nacional",
  "asociacion-nacional",
  "galeria-360",
  "juancito-sport",
  "supervisores",
  "superintendencia-de-bancos",
  "operadores-interior",
];
const isOperationsDept = (id: string) =>
  OPERATIONS_DEPT_SLUGS.some((s) => id === s || id.startsWith(s));

// Tiempo de servicio legible: "2 años, 5 meses, 3 días".
const formatServiceTime = (t?: { years: number; months: number; days: number } | null) => {
  if (!t) return "Antigüedad no disponible";
  const parts: string[] = [];
  if (t.years) parts.push(`${t.years} año${t.years !== 1 ? "s" : ""}`);
  if (t.months) parts.push(`${t.months} mes${t.months !== 1 ? "es" : ""}`);
  parts.push(`${t.days} día${t.days !== 1 ? "s" : ""}`);
  return parts.join(", ");
};

type Tab = "departamentos" | "en-vacaciones";

const VacationProvisioning = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = !!user?.isAdmin;
  const isLeader = !!user?.isDepartmentLeader;

  const [tab, setTab] = useState<Tab>("departamentos");
  const [departments, setDepartments] = useState<VacationDept[]>([]);
  const [policy, setPolicy] = useState<VacationPolicy | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [roster, setRoster] = useState<VacationRoster | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOps, setShowOps] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  // On-vacation view
  const [onVacDate, setOnVacDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [onVac, setOnVac] = useState<OnVacationResult | null>(null);

  // Editor
  const [editEmp, setEditEmp] = useState<VacationEmployee | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [draftPeriods, setDraftPeriods] = useState<VacationPeriod[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canManageDept = (deptId: string) =>
    isAdmin || (isLeader && slugify(user?.department || "") === deptId);

  useEffect(() => {
    vacationsApi.departments().then(setDepartments).catch(() => {});
    vacationsApi.policy().then(setPolicy).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "en-vacaciones") {
      vacationsApi.onVacation(onVacDate, onVacDate).then(setOnVac).catch(() => {});
    }
  }, [tab, onVacDate]);

  const openDept = async (dept: VacationDept) => {
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

  const reloadRoster = async () => {
    if (selectedDept) setRoster(await vacationsApi.roster(selectedDept));
    vacationsApi.departments().then(setDepartments).catch(() => {});
  };

  const openEditor = (emp: VacationEmployee, deptName: string) => {
    setEditEmp(emp);
    setEditDeptName(deptName);
    setDraftPeriods([]);
    setNotes("");
    setRange(undefined);
  };

  // Self-service: open editor for the logged-in user.
  const requestForMyself = async () => {
    if (!user?.employeeCode) {
      toast({ title: "Sin código de empleado", description: "Tu usuario no tiene un código asociado. Contacta a RRHH.", variant: "destructive" });
      return;
    }
    const deptSlug = slugify(user.department || "");
    try {
      const r = await vacationsApi.roster(deptSlug);
      const me = r.employees.find((e) => String(e.codigo) === String(user.employeeCode));
      if (!me) {
        toast({ title: "No encontrado", description: "No apareces en el roster de tu departamento.", variant: "destructive" });
        return;
      }
      openEditor(me, r.name || user.department || "");
    } catch {
      toast({ title: "Error", description: "No se pudo cargar tu información.", variant: "destructive" });
    }
  };

  const draftTotal = useMemo(() => draftPeriods.reduce((a, p) => a + p.days, 0), [draftPeriods]);

  // Días ya comprometidos (aprobados + pendientes) y restantes en vivo.
  const alreadyUsed = editEmp ? editEmp.diasAprobados + editEmp.diasPendientes : 0;
  const remainingDays = editEmp ? Math.max(0, editEmp.diasDerecho - alreadyUsed - draftTotal) : 0;
  // Períodos vigentes existentes (no rechazados) + los del borrador.
  const existingPeriodCount = editEmp
    ? editEmp.requests.filter((r) => r.status !== "rechazada").reduce((a, r) => a + r.periods.length, 0)
    : 0;
  const totalPeriodCount = existingPeriodCount + draftPeriods.length;
  const willNeedManagement = totalPeriodCount > 2;

  const addPeriod = () => {
    if (!range?.from || !range?.to) {
      toast({ title: "Selecciona un rango", description: "Elige fecha de inicio y fin en el calendario.", variant: "destructive" });
      return;
    }
    if (!editEmp) return;
    const days = businessDays(range.from, range.to);
    // Restricción: no exceder los días a los que tiene derecho.
    if (days > remainingDays) {
      toast({
        title: "Excede tus días de vacaciones",
        description: `Solo te quedan ${remainingDays} día(s) disponibles de ${editEmp.diasDerecho}. Según la Política de Gestión de Vacaciones de SafeOne no puedes solicitar más de lo que te corresponde.`,
        variant: "destructive",
      });
      return;
    }
    // Aviso de fraccionamiento en más de dos períodos (requiere Gerencia Comercial).
    if (existingPeriodCount + draftPeriods.length + 1 > 2) {
      toast({
        title: "Fraccionamiento en más de dos períodos",
        description: "Dividir las vacaciones en más de dos cortes requiere la aprobación de la Gerencia Comercial (Samuel Aurelio Pérez o Leonela Báez). La solicitud será escalada automáticamente.",
      });
    }
    setDraftPeriods((p) => [...p, { start: iso(range.from!), end: iso(range.to!), days }]);
    setRange(undefined);
  };

  const submitRequest = async () => {
    if (!editEmp || !draftPeriods.length) {
      toast({ title: "Sin fechas", description: "Agrega al menos un período.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await vacationsApi.createRequest({
        codigo: editEmp.codigo,
        nombre: editEmp.nombre,
        department: editDeptName,
        periods: draftPeriods,
        notes,
        requestedByName: user?.fullName || user?.email,
      });
      toast({
        title: "Solicitud enviada",
        description: willNeedManagement
          ? "Se notificó a RRHH y se escalará a la Gerencia Comercial por el fraccionamiento en más de dos períodos."
          : "Se notificó a RRHH para su aprobación.",
      });
      setEditEmp(null);
      await reloadRoster();
    } catch (e) {
      toast({ title: "No se pudo enviar", description: e instanceof Error ? e.message : "Error al enviar la solicitud.", variant: "destructive" });
    } finally {
      setSaving(false);
    }

  };

  const decide = async (req: VacationRequest, decision: "aprobada" | "rechazada") => {
    try {
      await vacationsApi.decide(req.id, { decision, approverName: user?.fullName || user?.email });
      toast({
        title: decision === "aprobada" ? "Vacaciones aprobadas" : "Solicitud rechazada",
        description: decision === "aprobada" ? "Se notificó a todo el equipo de RRHH." : "Se notificó al solicitante.",
      });
      await reloadRoster();
    } catch {
      toast({ title: "Error", description: "No se pudo procesar.", variant: "destructive" });
    }
  };

  const removePeriodFromRequest = async (req: VacationRequest, idx: number) => {
    const periods = req.periods.filter((_, i) => i !== idx);
    try {
      await vacationsApi.updateRequest(req.id, { periods, actorName: user?.fullName || user?.email });
      toast({ title: "Día eliminado", description: "El cambio quedó registrado y se notificó." });
      await reloadRoster();
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    }
  };

  const deleteRequest = async (req: VacationRequest) => {
    try {
      await vacationsApi.deleteRequest(req.id);
      toast({ title: "Solicitud eliminada" });
      await reloadRoster();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  // ── Vista: selector de departamentos ──
  const visibleDepts = isAdmin || isLeader
    ? departments
    : departments.filter((d) => slugify(user?.department || "") === d.id);

  const DeptSelector = (
    <div className="space-y-6">
      {/* Self-service CTA */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border-teal-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-600"><UserCircle2 className="h-6 w-6" /></div>
          <div>
            <p className="font-heading font-semibold text-foreground">Solicita tus vacaciones</p>
            <p className="text-xs text-muted-foreground">Elige tus fechas y envíalas a tu líder para aprobación.</p>
          </div>
        </div>
        <Button onClick={requestForMyself} className="gap-2"><Plus className="h-4 w-4" /> Solicitar mis vacaciones</Button>
      </Card>

      <div className="flex items-center gap-3">
        <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
        <h2 className="section-title text-foreground">
          {isAdmin || isLeader ? "Selecciona un departamento" : "Mi departamento"}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleDepts.map((d, i) => (
          <button
            key={d.id}
            onClick={() => openDept(d)}
            className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:-translate-y-1 shadow-md cursor-pointer"
            style={{ background: DEPT_GRADIENTS[i % DEPT_GRADIENTS.length] }}
          >
            <div className="flex items-center justify-between text-white">
              <Users className="h-8 w-8 opacity-90" />
              <div className="flex gap-1.5">
                {!!d.pendingCount && <Badge className="bg-white/25 text-white border-0">{d.pendingCount} pend.</Badge>}
                {!!d.approvedCount && <Badge className="bg-white/15 text-white border-0">{d.approvedCount} aprob.</Badge>}
              </div>
            </div>
            <p className="mt-4 font-heading font-bold text-lg text-white leading-tight">{d.name}</p>
            <p className="text-xs text-white/85 mt-1">{d.count ?? 0} colaboradores</p>
            {d.leaderName && (
              <p className="text-[11px] text-white/80 mt-2 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Aprueba: {d.leaderName}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Vista: en vacaciones ──
  const OnVacationView = (
    <div className="space-y-5">
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <CalendarDays className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-foreground font-medium">Personal de vacaciones el:</span>
        <Input type="date" value={onVacDate} onChange={(e) => setOnVacDate(e.target.value)} className="w-auto" />
        <Badge variant="secondary">{onVac?.employees.length ?? 0} en vacaciones</Badge>
      </Card>
      {onVac && onVac.employees.length === 0 && (
        <p className="text-muted-foreground text-sm">Nadie está de vacaciones en la fecha seleccionada.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {onVac?.employees.map((e) => (
          <Card key={e.requestId} className="p-4">
            <div className="flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-emerald-600" />
              <p className="font-semibold text-card-foreground">{e.nombre}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{e.department} · Cód. {e.codigo}</p>
            <div className="mt-2 space-y-1">
              {e.periods.map((p, i) => (
                <p key={i} className="text-xs flex items-center gap-1.5 text-foreground">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" /> {fmt(p.start)} → {fmt(p.end)}
                </p>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  // ── Vista: roster de un departamento ──
  const stats = useMemo(() => {
    if (!roster) return null;
    const emps = roster.employees;
    const pend = emps.filter((e) => e.diasPendientes > 0).length;
    const withVac = emps.filter((e) => e.diasAprobados > 0).length;
    return { total: emps.length, pend, withVac };
  }, [roster]);

  const RosterView = roster && (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => { setSelectedDept(null); setRoster(null); }} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Departamentos
        </Button>
        <div className="flex items-center gap-2">
          {roster.leaderName && (
            <Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Aprueba: {roster.leaderName}</Badge>
          )}
          <Badge variant={roster.sqlConnected ? "default" : "secondary"} className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            {roster.sqlConnected ? "Datos de gSafeOne" : "Antigüedad del registro"}
          </Badge>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Colaboradores", value: stats.total, icon: Users, grad: "from-blue-500 to-indigo-600" },
            { label: "Con vacaciones aprobadas", value: stats.withVac, icon: CheckCircle2, grad: "from-emerald-500 to-green-600" },
            { label: "Solicitudes pendientes", value: stats.pend, icon: AlertTriangle, grad: "from-amber-500 to-orange-600" },
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
            <strong className="text-foreground">Política:</strong> {policy.under5Days} días hábiles (&lt; {policy.tenureThresholdYears} años) ·{" "}
            {policy.from5Days} días hábiles ({policy.tenureThresholdYears}+ años). Cada colaborador selecciona sus días en el calendario.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roster.employees.map((e) => {
          const complete = e.diasAprobados >= e.diasDerecho;
          const pct = Math.min(100, ((e.diasAprobados + e.diasPendientes) / e.diasDerecho) * 100);
          return (
            <button
              key={e.codigo}
              onClick={() => openEditor(e, roster.name || "")}
              className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground leading-tight truncate">{e.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.position || `Cód. ${e.codigo}`}</p>
                </div>
                <Badge className={`border-0 shrink-0 ${complete ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {e.diasAprobados}/{e.diasDerecho}
                </Badge>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  {e.antiguedadAnios != null ? `${e.antiguedadAnios} años de servicio` : "Antigüedad no disponible"}
                  {e.diasEstimados && " (estimado)"}
                </p>
                {e.cumpleanos && <p className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> {e.cumpleanos}</p>}
                {e.diasPendientes > 0 && (
                  <p className="flex items-center gap-1.5 text-amber-600"><Clock className="h-3.5 w-3.5" /> {e.diasPendientes} día(s) pendiente(s)</p>
                )}
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${complete ? "bg-emerald-500" : "bg-gold"}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const canApprove = editEmp && selectedDept ? canManageDept(selectedDept) : (isAdmin || isLeader);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(160 60% 35%), hsl(190 70% 30%))" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex items-center gap-4 text-white">
            <div className="p-3 rounded-2xl bg-white/15"><Palmtree className="h-8 w-8" /></div>
            <div>
              <h1 className="font-heading font-bold text-2xl">Provisionamiento de Vacaciones</h1>
              <p className="text-sm text-white/85">Solicita, aprueba y da seguimiento a las vacaciones por departamento.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 w-full py-8 space-y-6">
          {/* Tabs */}
          {!selectedDept && (
            <div className="flex gap-2">
              <Button variant={tab === "departamentos" ? "default" : "outline"} onClick={() => setTab("departamentos")} className="gap-2">
                <Users className="h-4 w-4" /> Departamentos
              </Button>
              <Button variant={tab === "en-vacaciones" ? "default" : "outline"} onClick={() => setTab("en-vacaciones")} className="gap-2">
                <Palmtree className="h-4 w-4" /> En vacaciones
              </Button>
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground">Cargando personal…</p>
          ) : selectedDept && roster ? (
            RosterView
          ) : tab === "en-vacaciones" ? (
            OnVacationView
          ) : (
            DeptSelector
          )}
        </div>
        <Footer />
      </div>

      {/* Editor */}
      <Dialog open={!!editEmp} onOpenChange={(o) => !o && setEditEmp(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEmp?.nombre}</DialogTitle>
          </DialogHeader>
          {editEmp && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Cód. {editEmp.codigo}</Badge>
                <Badge variant="secondary">Derecho: {editEmp.diasDerecho} días</Badge>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-0">Aprobados: {editEmp.diasAprobados}</Badge>
                {editEmp.diasPendientes > 0 && <Badge className="bg-amber-500/15 text-amber-600 border-0">Pendientes: {editEmp.diasPendientes}</Badge>}
                <Badge variant="outline">Restan: {Math.max(0, editEmp.diasDerecho - editEmp.diasAprobados - editEmp.diasPendientes)}</Badge>
              </div>

              {/* Solicitudes existentes */}
              {editEmp.requests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Solicitudes</p>
                  {editEmp.requests.map((req) => (
                    <div key={req.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className={`border-0 ${STATUS_STYLE[req.status]}`}>{STATUS_LABEL[req.status]}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          por {req.requestedByName} · {new Date(req.requestedAt).toLocaleDateString("es-DO")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {req.periods.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>{fmt(p.start)} → {fmt(p.end)} <strong>({p.days}d)</strong></span>
                            {canApprove && req.periods.length > 1 && (
                              <button onClick={() => removePeriodFromRequest(req, i)} className="text-destructive hover:opacity-70" title="Eliminar día">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {req.notes && <p className="text-xs text-muted-foreground italic">"{req.notes}"</p>}
                      {req.approverName && (
                        <p className="text-[11px] text-muted-foreground">
                          {req.status === "aprobada" ? "Aprobada" : "Rechazada"} por {req.approverName}
                        </p>
                      )}
                      {req.history && req.history.length > 1 && (
                        <details className="text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer">Historial de cambios</summary>
                          <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                            {req.history.map((h, i) => (
                              <li key={i}>{new Date(h.at).toLocaleDateString("es-DO")} — {h.action}: {h.detail} ({h.by})</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {canApprove && req.status === "pendiente" && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(req, "aprobada")}>
                            <CheckCircle2 className="h-4 w-4" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive" onClick={() => decide(req, "rechazada")}>
                            <XCircle className="h-4 w-4" /> Rechazar
                          </Button>
                        </div>
                      )}
                      {canApprove && (
                        <button onClick={() => deleteRequest(req)} className="text-[11px] text-destructive hover:underline">Eliminar solicitud</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Nueva solicitud */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">Nueva solicitud</p>
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
                      {draftPeriods.length === 0 && <p className="text-sm text-muted-foreground">Sin períodos agregados.</p>}
                      {draftPeriods.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                          <span>{fmt(p.start)} → {fmt(p.end)} <strong>({p.days}d)</strong></span>
                          <button onClick={() => setDraftPeriods((arr) => arr.filter((_, j) => j !== i))} className="text-destructive hover:opacity-70">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {draftPeriods.length > 0 && <p className="text-sm font-medium text-foreground">Total: {draftTotal} día(s)</p>}
                  </div>
                </div>
                <Textarea placeholder="Notas (compañero que cubre el turno, acuerdos, etc.)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditEmp(null)}>Cerrar</Button>
                  <Button onClick={submitRequest} disabled={saving || !draftPeriods.length}>
                    {saving ? "Enviando…" : "Enviar solicitud"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default VacationProvisioning;
