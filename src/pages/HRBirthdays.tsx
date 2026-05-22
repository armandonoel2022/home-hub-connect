import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useChatContextSafe } from "@/contexts/ChatContext";
import { employeesApi, isApiConfigured, usersApi, getFileUrl, type Employee } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Cake, CalendarDays, Eye, ChevronDown, ChevronRight } from "lucide-react";
import type { IntranetUser } from "@/lib/types";

function resolvePhoto(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/photos") || url.startsWith("/uploads")) return getFileUrl(url);
  return url;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface BirthdayItem {
  id: string;
  fullName: string;
  department: string;
  position: string;
  mmdd: string;
  day: number;
  month: number;
  photoUrl?: string;
}

function parseBirthday(raw: string): { month: number; day: number } | null {
  const v = (raw || "").trim();
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { month: +iso[2], day: +iso[3] };
  const mmddOnly = v.match(/^(\d{2})-(\d{2})$/);
  if (mmddOnly) return { month: +mmddOnly[1], day: +mmddOnly[2] };
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) return { month: +dmy[2], day: +dmy[1] };
  return null;
}

function toIntranetUser(item: BirthdayItem): IntranetUser {
  return {
    id: `EMP-${item.id}`,
    fullName: item.fullName,
    email: "",
    department: item.department,
    position: item.position,
    birthday: item.mmdd,
    photoUrl: resolvePhoto(item.photoUrl),
    allowedDepartments: [],
    isAdmin: false,
    extension: "",
  } as IntranetUser;
}

const HRBirthdaysPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chatCtx = useChatContextSafe();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUsers, setPreviewUsers] = useState<IntranetUser[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [filterMonth, setFilterMonth] = useState<number | "all">("all");
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(
    () => new Set([new Date().getMonth() + 1])
  );

  const toggleMonth = (m: number) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };
  const expandAll = () => setExpandedMonths(new Set(MONTHS.map((_, i) => i + 1)));
  const collapseAll = () => setExpandedMonths(new Set());
  const [autoTime, setAutoTime] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("safeone_bday_auto_time")) || "08:00"
  );

  const saveAutoTime = (value: string) => {
    setAutoTime(value);
    localStorage.setItem("safeone_bday_auto_time", value);
    toast({ title: "Hora actualizada", description: `El overlay automático aparecerá a partir de las ${value}.` });
  };

  const resetTodayDismissed = () => {
    const d = new Date();
    const key = `safeone_bday_dismissed_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.removeItem(key);
    toast({ title: "Listo", description: "Los overlays de hoy volverán a aparecer." });
  };

  const isAuthorized =
    user?.isAdmin || user?.department === "Recursos Humanos";

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    const loadSeed = async () => {
      try {
        const res = await fetch("/data/employees_seed.json");
        if (!res.ok) throw new Error("Seed no disponible");
        const seed = await res.json();
        if (!cancelled) setEmployees(seed.filter((e: any) => e.status === "Activo"));
      } catch (e: any) {
        if (!cancelled) toast({ title: "Error cargando empleados", description: String(e?.message || e), variant: "destructive" });
      }
    };
    const mergeIntranetUsers = async (base: Employee[]): Promise<Employee[]> => {
      if (!isApiConfigured()) return base;
      try {
        const users = await usersApi.getAll();
        const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const byName = new Map(base.map(e => [norm(e.fullName), e]));
        const merged = [...base];
        users.forEach((u: any) => {
          if (u.employeeStatus === "Inactivo") return;
          const existing = byName.get(norm(u.fullName));
          if (existing) {
            if (!existing.photoUrl && u.photoUrl) existing.photoUrl = u.photoUrl;
            if (!existing.birthday && !existing.birthDate && !existing.birthdayMMDD && u.birthday) existing.birthday = u.birthday;
          } else if (u.birthday) {
            merged.push({
              employeeCode: u.id,
              fullName: u.fullName,
              status: "Activo",
              payrollType: "Administrativo",
              category: "Administrativo",
              department: u.department || "—",
              position: u.position || "",
              bank: "", salary: 0, hourlyRate: 0,
              birthday: u.birthday,
              photoUrl: u.photoUrl,
            } as Employee);
          }
        });
        return merged;
      } catch {
        return base;
      }
    };
    const load = async () => {
      setLoading(true);
      let base: Employee[] = [];
      if (!isApiConfigured()) {
        await loadSeed();
        base = []; // se setea dentro de loadSeed
      } else {
        try {
          const data = await employeesApi.getAll({ status: "Activo" });
          if (!data || data.length === 0) {
            await loadSeed();
          } else if (!cancelled) {
            base = data;
          }
        } catch {
          await loadSeed();
        }
      }
      if (base.length > 0 && !cancelled) {
        const merged = await mergeIntranetUsers(base);
        if (!cancelled) setEmployees(merged);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [isAuthorized]);

  const { grouped, total, todayItems } = useMemo(() => {
    const grouped: Record<number, BirthdayItem[]> = {};
    const today = new Date();
    const tmm = today.getMonth() + 1;
    const tdd = today.getDate();
    const todayItems: BirthdayItem[] = [];
    employees.forEach((e: any) => {
      const parsed = parseBirthday(e.birthDate || e.birthdayMMDD || e.birthday || "");
      if (!parsed) return;
      const { month, day } = parsed;
      if (month < 1 || month > 12 || day < 1 || day > 31) return;
      const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const item: BirthdayItem = {
        id: e.employeeCode,
        fullName: e.fullName,
        department: e.department || "—",
        position: e.position || "",
        mmdd,
        day,
        month,
        photoUrl: e.photoUrl,
      };
      (grouped[month] ||= []).push(item);
      if (month === tmm && day === tdd) todayItems.push(item);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.day - b.day));
    const total = Object.values(grouped).reduce((s, a) => s + a.length, 0);
    return { grouped, total, todayItems };
  }, [employees]);

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const todayMMDD = `${String(currentMonth).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const previewMonth = (month: number) => {
    const items = grouped[month] || [];
    if (items.length === 0) return;
    setPreviewUsers(items.map(toIntranetUser));
    setShowPreview(true);
  };

  const previewSingle = (item: BirthdayItem) => {
    setPreviewUsers([toIntranetUser(item)]);
    setShowPreview(true);
  };

  const previewToday = () => {
    if (todayItems.length === 0) {
      toast({ title: "Sin cumpleaños hoy", description: "No hay empleados cumpliendo años hoy." });
      return;
    }
    setPreviewUsers(todayItems.map(toIntranetUser));
    setShowPreview(true);
  };

  const monthsToRender =
    filterMonth === "all" ? MONTHS.map((_, i) => i + 1) : [filterMonth as number];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="px-6 pt-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
        </div>
        <div className="px-6 pt-4 pb-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center">
              <Cake className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl text-foreground">Cumpleaños de Empleados</h1>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Cargando empleados…"
                  : `${total} de ${employees.length} empleados activos con fecha registrada`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
            >
              <option value="all">Todos los meses</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <button
              onClick={previewToday}
              className="btn-gold text-sm flex items-center gap-2"
            >
              <Cake className="h-4 w-4" />
              Previsualizar cumpleaños de hoy
              {todayItems.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-background/30 text-[10px] font-bold">
                  {todayItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Configuración del overlay automático */}
        <div className="px-6 pb-2">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium text-card-foreground">Overlay automático diario</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Aparece a partir de:
              <input
                type="time"
                value={autoTime}
                onChange={(e) => saveAutoTime(e.target.value)}
                className="px-2 py-1 rounded-md bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
              />
            </label>
            <button
              onClick={resetTodayDismissed}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-card-foreground transition-colors"
              title="Vuelve a mostrar los overlays de hoy aunque ya hayan sido cerrados"
            >
              Reiniciar overlays de hoy
            </button>
            <span className="text-[11px] text-muted-foreground ml-auto">
              Si hay varios cumpleaños, se muestran uno por uno. No se repiten en el mismo día.
            </span>
          </div>
        </div>

        <div className="px-6 pb-2 flex items-center gap-2 text-xs">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-card-foreground transition-colors"
          >
            Expandir todos
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-card-foreground transition-colors"
          >
            Colapsar todos
          </button>
        </div>

        <div className="px-6 pb-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {monthsToRender.map((m) => {
            const items = grouped[m] || [];
            const isCurrentMonth = m === currentMonth;
            const isOpen = expandedMonths.has(m) || filterMonth === m;
            return (
              <div
                key={m}
                className={`rounded-xl border overflow-hidden ${isCurrentMonth ? "border-gold bg-gold/5" : "border-border bg-card"}`}
              >
                <button
                  onClick={() => toggleMonth(m)}
                  className="w-full flex items-center justify-between gap-2 p-4 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? (
                      <ChevronDown className={`h-4 w-4 shrink-0 ${isCurrentMonth ? "text-gold" : "text-muted-foreground"}`} />
                    ) : (
                      <ChevronRight className={`h-4 w-4 shrink-0 ${isCurrentMonth ? "text-gold" : "text-muted-foreground"}`} />
                    )}
                    <CalendarDays className={`h-4 w-4 shrink-0 ${isCurrentMonth ? "text-gold" : "text-muted-foreground"}`} />
                    <h3 className="font-heading font-bold text-sm text-card-foreground truncate">{MONTHS[m - 1]}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${items.length > 0 ? (isCurrentMonth ? "bg-gold/30 text-card-foreground font-semibold" : "bg-muted text-card-foreground") : "text-muted-foreground"}`}>
                    {items.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    {items.length > 0 && (
                      <button
                        onClick={() => previewMonth(m)}
                        className="mb-3 text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted transition-colors"
                        title="Previsualizar overlay con todos los cumpleaños del mes"
                      >
                        <Eye className="h-3 w-3" />
                        Overlay del mes
                      </button>
                    )}
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin cumpleaños</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((item) => {
                          const isToday = item.mmdd === todayMMDD;
                          return (
                            <li
                              key={item.id}
                              onClick={() => previewSingle(item)}
                              className={`text-xs flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isToday ? "bg-gold/20 font-semibold hover:bg-gold/30" : "hover:bg-muted"}`}
                              title="Click para ver y descargar el overlay"
                            >
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border text-[11px] font-bold shrink-0">
                                {item.day}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-card-foreground truncate hover:text-gold transition-colors">
                                  {item.fullName} {isToday && "🎂"}
                                </p>
                                <p className="text-muted-foreground truncate text-[10px]">
                                  {item.department}
                                  {item.position ? ` — ${item.position}` : ""}
                                </p>
                              </div>
                              <Eye className="h-3.5 w-3.5 text-gold opacity-60" />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showPreview && previewUsers.length > 0 && (
        <BirthdayOverlay
          birthdayUsers={previewUsers}
          isTest
          onDismissTest={() => {
            setShowPreview(false);
            setPreviewUsers([]);
          }}
          onSendCongrats={(bdayUser) => {
            if (chatCtx) {
              chatCtx.startIndividualChat(bdayUser.id);
              setTimeout(() => {
                chatCtx.sendMessage(
                  `🎂🎉 ¡Feliz Cumpleaños, ${bdayUser.fullName}! De parte de SafeOne Security Company te deseamos un maravilloso día lleno de éxitos y bendiciones. 🥳`
                );
              }, 500);
            }
          }}
        />
      )}
    </AppLayout>
  );
};

export default HRBirthdaysPage;
