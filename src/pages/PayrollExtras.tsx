import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Moon, CalendarDays, UtensilsCrossed, Trash2, Send, ArrowLeft, TimerOff, Gift, FileSpreadsheet, CalendarCheck } from "lucide-react";
import { payrollExtrasApi, employeesApi, isApiConfigured, type PayrollExtra, type Employee } from "@/lib/api";
import { getCutoffForDate } from "@/lib/payrollPeriods";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const TYPE_META: Record<PayrollExtra["type"], { label: string; icon: any; color: string }> = {
  overtime: { label: "Horas extras", icon: Clock, color: "text-blue-600" },
  night: { label: "Horas nocturnas", icon: Moon, color: "text-purple-600" },
  holiday: { label: "Día feriado trabajado", icon: CalendarDays, color: "text-amber-600" },
  incentive: { label: "Incentivo / bono", icon: Gift, color: "text-emerald-600" },
  meal: { label: "Almuerzo descontable", icon: UtensilsCrossed, color: "text-orange-600" },
  late: { label: "Horas tardías (descuento por retraso de relevo)", icon: TimerOff, color: "text-red-600" },
};

export default function PayrollExtrasPage() {
  const { user, activeUsers } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const isHR = user?.isAdmin || user?.department === "Recursos Humanos";
  const isLeader = !!(user as any)?.isDepartmentLeader || isHR;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [list, setList] = useState<PayrollExtra[]>([]);
  const [form, setForm] = useState({
    employeeCode: "",
    type: "overtime" as PayrollExtra["type"],
    date: new Date().toISOString().slice(0, 10),
    hours: "",
    days: "",
    amount: "",
    description: "",
  });
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    let cancelled = false;
    const loadSeed = async () => {
      try {
        const res = await fetch("/data/employees_seed.json");
        if (!res.ok) return;
        const seed = await res.json();
        if (!cancelled) setEmployees(seed);
      } catch {}
    };
    const run = async () => {
      if (!isApiConfigured()) { await loadSeed(); return; }
      try {
        const data = await employeesApi.getAll();
        if (!data || data.length === 0) await loadSeed();
        else if (!cancelled) setEmployees(data);
      } catch {
        await loadSeed();
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const refresh = () => {
    payrollExtrasApi.list({ period }).then(setList).catch(() => {});
  };
  useEffect(refresh, [period]);

  const myTeam = useMemo(() => {
    if (isHR) return employees.filter((e: any) => e.status === "Activo");
    // Líder: ve empleados de su departamento
    return employees.filter((e: any) => e.status === "Activo" && e.department === user?.department);
  }, [employees, isHR, user]);

  // Corte y fecha de pago calculados a partir de la fecha del registro
  const cutoff = useMemo(() => getCutoffForDate(form.date), [form.date]);

  // Localiza a Dilia Aguasvivas (encargada de cargar la nómina) o, en su defecto, a RRHH
  const findPayrollOwner = () => {
    const dilia = activeUsers.find((u) => (u.fullName || "").toLowerCase().includes("dilia"));
    if (dilia) return [dilia];
    return activeUsers.filter((u) => u.department === "Recursos Humanos");
  };

  const submit = async () => {
    if (!form.employeeCode || !form.type || !form.date) {
      toast({ title: "Faltan datos", description: "Empleado, tipo y fecha son obligatorios.", variant: "destructive" });
      return;
    }
    const emp = employees.find((e: any) => e.employeeCode === form.employeeCode);
    try {
      await payrollExtrasApi.create({
        employeeCode: form.employeeCode,
        employeeName: emp?.fullName || "",
        type: form.type,
        date: form.date,
        hours: form.hours ? Number(form.hours) : 0,
        days: form.days ? Number(form.days) : 0,
        amount: form.amount ? Number(form.amount) : 0,
        description: form.description,
      });

      // Notifica a Dilia (o RRHH) con el corte y la fecha de pago correspondientes
      try {
        const owners = findPayrollOwner();
        owners.forEach((owner) => {
          addNotification({
            type: "info",
            title: "Nómina · Novedad para el próximo corte",
            message: `${user?.fullName || "Un líder"} reportó "${TYPE_META[form.type].label}" para ${emp?.fullName || form.employeeCode}. Corte ${cutoff.label}. A pagar el ${cutoff.payLabel}. Recuerda incluirlo en la próxima nómina.`,
            relatedId: `EXTRA-${form.employeeCode}-${form.date}`,
            forUserId: owner.id,
            actionUrl: "/rrhh/reporte-nomina",
          });
        });
      } catch {}

      toast({ title: "Registrado", description: `Enviado a RRHH. Corte ${cutoff.label} · pago ${cutoff.payLabel}.` });
      setForm({ ...form, hours: "", days: "", amount: "", description: "" });
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo registrar", variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar registro?")) return;
    try {
      await payrollExtrasApi.remove(id);
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const exportExcel = () => {
    const data = list.map((r) => {
      const c = getCutoffForDate(r.date);
      return {
        Fecha: r.date,
        Corte: c.label,
        "Fecha de pago": c.payLabel,
        Codigo: r.employeeCode,
        Empleado: r.employeeName,
        Tipo: TYPE_META[r.type].label,
        Horas: r.type === "overtime" || r.type === "night" || r.type === "late" ? r.hours || 0 : "",
        Dias: r.type === "holiday" ? r.days || 0 : "",
        Monto: r.type === "meal" || r.type === "incentive" ? r.amount || 0 : "",
        Descripcion: r.description || "",
        Estado: r.status,
        "Reportado por": r.registeredBy,
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Novedades nómina");
    XLSX.writeFile(wb, `Novedades_Nomina_${period}.xlsx`);
  };

  if (!isLeader) {
    return (
      <AppLayout>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Solo líderes de área y RRHH pueden registrar horas extras.
          </div>
          <Footer />
        </div>
      </AppLayout>
    );
  }

  const Icon = TYPE_META[form.type].icon;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="mb-6">
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Clock className="h-6 w-6 text-gold" /> Horas extras, feriados, incentivos y descuentos
            </h1>
            <p className="text-sm text-muted-foreground">
              Los registros llegan a RRHH (Dilia Aguasvivas) y se reflejan automáticamente en el volante de pago del corte.
            </p>
          </div>

          {/* Aviso de cortes */}
          <div className="mb-6 rounded-xl border border-gold/30 bg-gold/5 p-4 flex items-start gap-3">
            <CalendarCheck className="h-5 w-5 text-gold mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Cortes de nómina</p>
              <p>Corte 1: del <strong>01 al 15</strong> → se paga el <strong>22</strong> · Corte 2: del <strong>16 al fin de mes</strong> → se paga el <strong>7</strong> del mes siguiente (7 días después del corte).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulario */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-heading font-bold text-card-foreground mb-4 flex items-center gap-2">
                <Icon className={`h-5 w-5 ${TYPE_META[form.type].color}`} />
                Nuevo registro
              </h2>
              <div className="space-y-3">
                <div>
                  <Label>Empleado</Label>
                  <Select value={form.employeeCode} onValueChange={(v) => setForm({ ...form, employeeCode: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {myTeam.map((e: any) => (
                        <SelectItem key={e.employeeCode} value={e.employeeCode}>
                          {e.fullName} — {e.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_META) as PayrollExtra["type"][]).map(k => (
                          <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>

                {/* Corte calculado */}
                <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
                  Corte: <strong className="text-foreground">{cutoff.label}</strong> · Fecha de pago: <strong className="text-foreground">{cutoff.payLabel}</strong>
                </div>

                {(form.type === "overtime" || form.type === "night" || form.type === "late") && (
                  <div>
                    <Label>{form.type === "late" ? "Horas tardías a descontar" : "Horas"}</Label>
                    <Input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                  </div>
                )}
                {form.type === "holiday" && (
                  <div>
                    <Label>Días feriados (se paga 100% adicional del día)</Label>
                    <Input type="number" step="0.5" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
                  </div>
                )}
                {(form.type === "meal" || form.type === "incentive") && (
                  <div>
                    <Label>{form.type === "incentive" ? "Monto del incentivo (RD$)" : "Monto a descontar (RD$)"}</Label>
                    <Input type="number" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>Descripción</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={form.type === "meal" ? "Ej: Plato del día, ensalada, etc." : form.type === "incentive" ? "Ej: Bono por desempeño" : "Motivo, turno cubierto, etc."}
                  />
                </div>
                <Button onClick={submit} className="w-full gap-2">
                  <Send className="h-4 w-4" /> Enviar a RRHH
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Cálculo: agentes de seguridad = salario / 26 / 10h; administrativos = salario / 23.83 / 8h.
                  Recargos: horas extras 35%, nocturnas 15%, feriados 100% adicional. Los incentivos se suman al devengado.
                </p>
              </div>
            </div>

            {/* Listado del período */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="font-heading font-bold text-card-foreground">Registros del período</h2>
                <div className="flex items-center gap-2">
                  <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={exportExcel} disabled={list.length === 0}>
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </Button>
                </div>
              </div>
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5">Fecha</th>
                      <th className="text-left px-2 py-1.5">Empleado</th>
                      <th className="text-left px-2 py-1.5">Tipo</th>
                      <th className="text-right px-2 py-1.5">Cantidad</th>
                      <th className="text-left px-2 py-1.5">Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {list.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sin registros este período</td></tr>
                    ) : list.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-2 py-1.5 font-mono">{r.date}</td>
                        <td className="px-2 py-1.5">{r.employeeName}</td>
                        <td className="px-2 py-1.5">{TYPE_META[r.type].label}</td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {r.type === "meal" || r.type === "incentive" ? `RD$ ${r.amount}` :
                           r.type === "holiday" ? `${r.days} día(s)` :
                           `${r.hours}h`}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${r.status === "Procesada" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          {r.status === "Pendiente RRHH" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isHR && (
                <Button variant="outline" className="mt-3 w-full" onClick={() => navigate("/rrhh/consolidado-nomina")}>
                  Ver consolidado RRHH
                </Button>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
}
