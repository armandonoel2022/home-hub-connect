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
  holidaysApi,
  type VacationDept,
  type VacationEmployee,
  type VacationPolicy,
  type VacationRoster,
  type VacationPeriod,
  type VacationRequest,
  type OnVacationResult,
  type Holiday,
} from "@/lib/api";
import { getDirectApprover, isApproverFor, isSamePerson } from "@/lib/vacationHierarchy";
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
  FileText,
  CalendarX,
  Settings2,
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

// Cuenta días laborables entre dos fechas considerando los días laborables
// del colaborador y excluyendo feriados (RD).
const countWorkDays = (
  from: Date,
  to: Date,
  workDays: Set<number>,
  holidays: Set<string>,
): number => {
  let count = 0;
  const d = new Date(from);
  while (d <= to) {
    if (workDays.has(d.getDay())) {
      const iso = d.toISOString().slice(0, 10);
      if (!holidays.has(iso)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];


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
  const [editWorkDays, setEditWorkDays] = useState<number[]>([]);

  // Feriados (RD)
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear());

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const workDaySet = useMemo(() => new Set(editWorkDays), [editWorkDays]);

  const canManageDept = (deptId: string) =>
    isAdmin || (isLeader && slugify(user?.department || "") === deptId);

  const loadHolidays = async (year: number) => {
    try {
      const [cur, next] = await Promise.all([
        holidaysApi.list(year),
        holidaysApi.list(year + 1).catch(() => ({ items: [] as Holiday[] } as any)),
      ]);
      setHolidays([...(cur.items || []), ...(next.items || [])]);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    vacationsApi.departments().then(setDepartments).catch(() => {});
    vacationsApi.policy().then(setPolicy).catch(() => {});
    loadHolidays(new Date().getFullYear());
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
    setEditWorkDays(emp.workDays || [1, 2, 3, 4, 5]);
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
  // Derecho máximo proyectado (según la antigüedad que tendrá al iniciar el
  // período que se está eligiendo). Permite solicitar por adelantado.
  const projectedEntitlement = useMemo(() => {
    if (!editEmp) return 0;
    if (!editEmp.fechaIngreso) return editEmp.diasDerecho;
    const at = range?.from ?? new Date();
    const d = entitledDaysAt(editEmp.fechaIngreso, at, policy);
    return d == null ? editEmp.diasDerecho : d;
  }, [editEmp, range?.from, policy]);
  const remainingDays = editEmp ? Math.max(0, projectedEntitlement - alreadyUsed - draftTotal) : 0;
  const eligibleDate = editEmp ? editEmp.elegibleDesde || eligibleFrom(editEmp.fechaIngreso) : null;
  const upcoming = editEmp ? nextMilestone(editEmp.fechaIngreso, range?.from ?? new Date(), policy) : null;
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
    // Restricción: las vacaciones no pueden iniciar antes de cumplir 6 meses,
    // aunque sí pueden solicitarse por adelantado para fechas posteriores.
    if (eligibleDate && iso(range.from) < eligibleDate) {
      toast({
        title: "Aún no puede disfrutar vacaciones en esa fecha",
        description: `El período debe iniciar a partir del ${eligibleDate}, fecha en que cumple 6 meses de antigüedad. Puedes solicitarlas desde ahora, pero para fechas posteriores a ese día.`,
        variant: "destructive",
      });
      return;
    }
    const days = countWorkDays(range.from, range.to, workDaySet, holidaySet);
    // Restricción: no exceder los días acreditados a la fecha de inicio.
    if (days > remainingDays) {
      toast({
        title: "Excede los días acreditados a esa fecha",
        description: `Al ${iso(range.from)} corresponden ${projectedEntitlement} día(s) y quedan ${remainingDays} disponible(s).${upcoming ? ` A partir del ${upcoming.date} podrá solicitar hasta ${upcoming.days} día(s).` : ""}`,
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

  const opsDepts = visibleDepts.filter((d) => isOperationsDept(d.id));
  const otherDepts = visibleDepts.filter((d) => !isOperationsDept(d.id));
  const opsPending = opsDepts.reduce((a, d) => a + (d.pendingCount || 0), 0);
  const opsApproved = opsDepts.reduce((a, d) => a + (d.approvedCount || 0), 0);
  const opsCount = opsDepts.reduce((a, d) => a + (d.count || 0), 0);

  const renderDeptCard = (d: VacationDept, i: number) => (
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
  );

  const PolicyBanner = (
    <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border-amber-500/20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600"><FileText className="h-5 w-5" /></div>
        <div>
          <p className="font-heading font-semibold text-foreground">Política de Gestión de Vacaciones</p>
          <p className="text-xs text-muted-foreground">SafeOne exige que el personal disfrute sus vacaciones. Máximo dos períodos salvo aprobación de la Gerencia Comercial.</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">
        <Button variant="outline" onClick={() => setPolicyOpen(true)} className="gap-2"><FileText className="h-4 w-4" /> Ver política</Button>
        <Button variant="outline" onClick={() => setHolidaysOpen(true)} className="gap-2"><CalendarX className="h-4 w-4" /> Feriados ({holidays.length})</Button>
      </div>
    </Card>
  );

  const DeptSelector = (
    <div className="space-y-6">
      {PolicyBanner}

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

      {showOps ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setShowOps(false)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Departamentos
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
            <h2 className="section-title text-foreground">Operaciones · áreas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {opsDepts.map((d, i) => renderDeptCard(d, i))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
            <h2 className="section-title text-foreground">
              {isAdmin || isLeader ? "Selecciona un departamento" : "Mi departamento"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {opsDepts.length > 0 && (
              <button
                onClick={() => setShowOps(true)}
                className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:-translate-y-1 shadow-md cursor-pointer"
                style={{ background: "linear-gradient(135deg, hsl(210 80% 45%), hsl(210 80% 30%))" }}
              >
                <div className="flex items-center justify-between text-white">
                  <ShieldCheck className="h-8 w-8 opacity-90" />
                  <div className="flex gap-1.5">
                    {!!opsPending && <Badge className="bg-white/25 text-white border-0">{opsPending} pend.</Badge>}
                    {!!opsApproved && <Badge className="bg-white/15 text-white border-0">{opsApproved} aprob.</Badge>}
                  </div>
                </div>
                <p className="mt-4 font-heading font-bold text-lg text-white leading-tight">Operaciones</p>
                <p className="text-xs text-white/85 mt-1">{opsDepts.length} áreas · {opsCount} colaboradores</p>
                <p className="text-[11px] text-white/80 mt-2">Safeone, Macrotech, Galería 360, Supervisores y más</p>
              </button>
            )}
            {otherDepts.map((d, i) => renderDeptCard(d, i + 1))}
          </div>
        </>
      )}
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
                  Tiempo de servicio: {e.tiempoServicio ? formatServiceTime(e.tiempoServicio) : (e.antiguedadAnios != null ? `${e.antiguedadAnios} años` : "no disponible")}
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

  // Jerarquía: nadie aprueba sus propias vacaciones y los líderes de área
  // requieren la aprobación de su superior (ver bloques de departamento).
  const editSelf = !!editEmp && isSamePerson(
    { name: editEmp.nombre, code: editEmp.codigo },
    { name: user?.fullName, code: user?.employeeCode },
  );
  const editApprover = editEmp ? getDirectApprover(editEmp.nombre) : null;
  const baseCanManage = editEmp && selectedDept ? canManageDept(selectedDept) : (isAdmin || isLeader);
  const canApprove =
    !editSelf &&
    (editApprover
      ? isApproverFor(user?.fullName, editEmp?.nombre)
      : baseCanManage);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(160 60% 35%), hsl(190 70% 30%))" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex items-center gap-4 text-white">
            <div className="p-3 rounded-2xl bg-white/15"><Palmtree className="h-8 w-8" /></div>
            <div>
              <h1 className="font-heading font-bold text-2xl">Vacaciones</h1>
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
                {draftTotal > 0 && <Badge className="bg-sky-500/15 text-sky-600 border-0">En selección: {draftTotal}</Badge>}
                <Badge variant="outline" className={remainingDays === 0 ? "text-destructive border-destructive/40" : ""}>Restan: {remainingDays}</Badge>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Tiempo de servicio: <strong className="text-foreground">{formatServiceTime(editEmp.tiempoServicio)}</strong>
                {editEmp.diasEstimados && " · derecho estimado"}
              </p>
              {willNeedManagement && (
                <div className="flex items-start gap-2 rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Estás dividiendo las vacaciones en más de dos períodos. Según la política, esto requiere la aprobación de la <strong>Gerencia Comercial</strong> (Samuel Aurelio Pérez o Leonela Báez) y será escalado automáticamente.</span>
                </div>
              )}


              {(editApprover || editSelf) && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 text-gold shrink-0" />
                  <span>
                    {editApprover ? (
                      <>Estas vacaciones deben ser aprobadas por su superior inmediato: <strong className="text-foreground">{editApprover.label}</strong>.</>
                    ) : (
                      <>No puedes aprobar tus propias vacaciones; la solicitud será revisada por tu superior.</>
                    )}
                  </span>
                </div>
              )}

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
                      {canApprove && (req.status === "pendiente" || req.status === "pendiente-gerencia") && (
                        <div className="flex flex-col gap-2 pt-1">
                          {req.status === "pendiente-gerencia" && (
                            <p className="text-[11px] text-purple-600">Requiere aprobación final de la Gerencia Comercial (fraccionamiento en más de dos períodos).</p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(req, "aprobada")}>
                              <CheckCircle2 className="h-4 w-4" /> Aprobar
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 text-destructive" onClick={() => decide(req, "rechazada")}>
                              <XCircle className="h-4 w-4" /> Rechazar
                            </Button>
                          </div>
                        </div>
                      )}
                      {canApprove && (
                        <button onClick={() => deleteRequest(req)} className="text-[11px] text-destructive hover:underline">Eliminar solicitud</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Días laborables del colaborador */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Días laborables</p>
                    {editEmp.workDaysCustom && <Badge variant="outline" className="text-[10px]">Personalizado</Badge>}
                  </div>
                  {canApprove && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await vacationsApi.saveEmployeeConfig(editEmp.codigo, {
                            workDays: editWorkDays,
                            actorName: user?.fullName || user?.email,
                          });
                          toast({ title: "Días laborables actualizados" });
                          await reloadRoster();
                        } catch {
                          toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
                        }
                      }}
                    >
                      Guardar
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Se cuentan solo los días marcados. Los feriados nunca cuentan como días de vacaciones.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, idx) => {
                    const active = editWorkDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!canApprove}
                        onClick={() =>
                          setEditWorkDays((prev) =>
                            prev.includes(idx) ? prev.filter((n) => n !== idx) : [...prev, idx].sort(),
                          )
                        }
                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        } ${!canApprove ? "opacity-70 cursor-not-allowed" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nueva solicitud */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">Nueva solicitud</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="rounded-lg border border-border p-2">
                    <Calendar
                      mode="range"
                      selected={range}
                      onSelect={setRange}
                      numberOfMonths={1}
                      className="pointer-events-auto"
                      modifiers={{ holiday: holidays.map((h) => new Date(h.date + "T00:00:00")) }}
                      modifiersClassNames={{ holiday: "bg-red-500/15 text-red-600 font-semibold" }}
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <Button onClick={addPeriod} className="w-full gap-2" variant="secondary">
                      <Plus className="h-4 w-4" /> Agregar período seleccionado
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Días laborables activos: {editWorkDays.map((d) => DAY_LABELS[d]).join(", ") || "—"}. Los feriados (marcados en rojo) se descuentan automáticamente.
                    </p>

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

      {/* Política de Gestión de Vacaciones */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Política de Gestión de Vacaciones — SafeOne (v01, Julio 2026)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-foreground">
            <div>
              <p className="font-semibold">Objetivo</p>
              <p className="text-muted-foreground">Establecer el marco bajo el cual SafeOne gestiona el disfrute de vacaciones, garantizando el derecho al descanso conforme al Código de Trabajo, protegiendo la continuidad operativa.</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="font-semibold text-amber-700">Principio General</p>
              <p className="text-amber-800/90">LA EMPRESA EXIGE QUE EL PERSONAL DISFRUTE SUS VACACIONES. El pago no sustituye el descanso, salvo casos excepcionales definidos en esta política.</p>
            </div>
            <div>
              <p className="font-semibold">Días según antigüedad (Art. 177 CT)</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Menos de 1 año: proporcional a los meses trabajados (6 meses = la mitad, ej. 7 de 14 días).</li>
                <li>De 1 a 4 años: 14 días hábiles.</li>
                <li>5 años o más: 18 días hábiles.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Fraccionamiento (prorrateo)</p>
              <p className="text-muted-foreground">Se permite dividir el período vacacional en un máximo de dos bloques, sujeto a aprobación del líder del área. No se fracciona en más de dos períodos sin la aprobación excepcional de la <strong className="text-foreground">Gerencia Comercial</strong> (Samuel Aurelio Pérez Rodríguez o Leonela Báez).</p>
            </div>
            <div>
              <p className="font-semibold">No exceder los días correspondientes</p>
              <p className="text-muted-foreground">El sistema no permite solicitar más días de los que le corresponden al colaborador. El uso queda registrado de forma persistente para reflejar siempre el saldo real disponible.</p>
            </div>
            <div>
              <p className="font-semibold">Rutas de cobertura</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li><strong className="text-foreground">Ruta 1 — Cobertura interna simple:</strong> otro colaborador del área cubre la función.</li>
                <li><strong className="text-foreground">Ruta 2 — Reemplazo temporal:</strong> se contrata cobertura temporal para puestos críticos.</li>
                <li><strong className="text-foreground">Ruta 3 — Pago excepcional:</strong> solo si es imposible cubrir la ausencia y se alcanza el plazo máximo; requiere solicitud formal del gerente y aprobación de Gerencia.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Responsables</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Gerente del área: solicita la programación y evalúa la cobertura.</li>
                <li>Recursos Humanos (Dilia Aguasvivas): gestiona programación y cobertura.</li>
                <li>Gerencia Comercial: aprueba fraccionamientos y casos fuera del marco estándar.</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feriados RD */}
      <Dialog open={holidaysOpen} onOpenChange={setHolidaysOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarX className="h-5 w-5" /> Feriados oficiales de República Dominicana</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Los feriados nunca se descuentan del saldo de vacaciones. Los administradores y RRHH pueden agregar feriados locales que la fuente oficial no incluya, o eliminar días que no deban aplicar.</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-foreground">Año:</label>
              <Input
                type="number"
                value={holidayYear}
                onChange={(e) => setHolidayYear(Number(e.target.value) || new Date().getFullYear())}
                className="w-28"
              />
              <Button variant="outline" size="sm" onClick={() => loadHolidays(holidayYear)}>Recargar</Button>
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await holidaysApi.refresh(holidayYear);
                      await loadHolidays(holidayYear);
                      toast({ title: "Feriados sincronizados", description: "Se consultó el calendario oficial." });
                    } catch {
                      toast({ title: "Sin conexión", description: "No se pudo consultar el calendario oficial.", variant: "destructive" });
                    }
                  }}
                >
                  Sincronizar con oficial
                </Button>
              )}
            </div>

            {isAdmin && (
              <div className="flex flex-wrap gap-2 items-end border-t border-border pt-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[11px] text-muted-foreground">Fecha</label>
                  <Input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} />
                </div>
                <div className="flex-[2] min-w-[160px]">
                  <label className="text-[11px] text-muted-foreground">Nombre del feriado</label>
                  <Input value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="Ej. Día Nacional del Vigilante" />
                </div>
                <Button
                  onClick={async () => {
                    if (!newHolidayDate || !newHolidayName.trim()) {
                      toast({ title: "Datos incompletos", description: "Ingresa fecha y nombre.", variant: "destructive" });
                      return;
                    }
                    try {
                      await holidaysApi.addManual(newHolidayDate, newHolidayName.trim());
                      setNewHolidayDate(""); setNewHolidayName("");
                      await loadHolidays(holidayYear);
                      toast({ title: "Feriado agregado" });
                    } catch {
                      toast({ title: "Error", description: "No se pudo agregar.", variant: "destructive" });
                    }
                  }}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>
            )}

            <div className="space-y-1 max-h-[45vh] overflow-y-auto">
              {holidays
                .filter((h) => h.date.startsWith(String(holidayYear)))
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => (
                  <div key={h.date} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{h.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmt(h.date)} · {h.origen === "manual" ? "Local (manual)" : "Oficial"}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        className="text-destructive hover:opacity-70"
                        title="Quitar feriado"
                        onClick={async () => {
                          try {
                            await holidaysApi.remove(h.date);
                            await loadHolidays(holidayYear);
                            toast({ title: "Feriado eliminado" });
                          } catch {
                            toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              {holidays.filter((h) => h.date.startsWith(String(holidayYear))).length === 0 && (
                <p className="text-sm text-muted-foreground italic">Sin feriados registrados para {holidayYear}.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>


  );
};

export default VacationProvisioning;
