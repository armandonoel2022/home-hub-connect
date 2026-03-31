import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import { Calendar, Plus, X, Clock, MapPin, Users, ChevronLeft, ChevronRight, Megaphone, AlertTriangle } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  createdBy: string;
  department: string;
  type: "reunion" | "evento" | "capacitacion" | "fecha_importante" | "otro";
  invitees: "todos" | "departamento" | string[];
  inviteeDepartment?: string;
}

const eventTypeColors: Record<string, string> = {
  reunion: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  evento: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  capacitacion: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  fecha_importante: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  otro: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700",
};

const eventTypeDotColors: Record<string, string> = {
  reunion: "bg-blue-500",
  evento: "bg-emerald-500",
  capacitacion: "bg-purple-500",
  fecha_importante: "bg-amber-500",
  otro: "bg-gray-400",
};

const eventTypeLabels: Record<string, string> = {
  reunion: "Reunión",
  evento: "Evento",
  capacitacion: "Capacitación",
  fecha_importante: "Fecha Importante",
  otro: "Otro",
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  reunion: <Users className="h-5 w-5" />,
  evento: <Megaphone className="h-5 w-5" />,
  capacitacion: <Calendar className="h-5 w-5" />,
  fecha_importante: <AlertTriangle className="h-5 w-5" />,
  otro: <Calendar className="h-5 w-5" />,
};

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "EVT-001",
    title: "Reunión de Gerencia",
    description: "Revisión mensual de KPIs y objetivos",
    date: "2026-03-10",
    startTime: "09:00",
    endTime: "10:30",
    location: "Sala de Conferencias",
    createdBy: "Aurelio Pérez",
    department: "Gerencia General",
    type: "reunion",
    invitees: "todos",
  },
  {
    id: "EVT-002",
    title: "Capacitación BASC",
    description: "Actualización de procedimientos de seguridad",
    date: "2026-03-12",
    startTime: "14:00",
    endTime: "16:00",
    location: "Sala de Capacitación",
    createdBy: "Bilianny Fernández",
    department: "Calidad",
    type: "capacitacion",
    invitees: "departamento",
    inviteeDepartment: "Operaciones",
  },
];

const CalendarPage = () => {
  const { user, allUsers } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [showCreate, setShowCreate] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    type: "reunion" as CalendarEvent["type"],
    audienceType: "todos" as "todos" | "departamento" | "personas",
    audienceDept: "",
    audienceUsers: [] as string[],
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const visibleEvents = events.filter((e) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (e.createdBy === user.fullName) return true;
    if (e.invitees === "todos") return true;
    if (e.invitees === "departamento" && e.inviteeDepartment === user.department) return true;
    if (Array.isArray(e.invitees) && e.invitees.includes(user.id)) return true;
    return false;
  });

  const getEventsForDate = (dateStr: string) => visibleEvents.filter((e) => e.date === dateStr);

  const dayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const getAudienceLabel = (e: CalendarEvent) => {
    if (e.invitees === "todos") return "Todos los colaboradores";
    if (e.invitees === "departamento") return `Departamento: ${e.inviteeDepartment}`;
    if (Array.isArray(e.invitees)) {
      const names = e.invitees.map((id) => allUsers.find((u) => u.id === id)?.fullName || id);
      return names.join(", ");
    }
    return "";
  };

  const handleCreate = () => {
    if (!form.title || !form.date) return;
    const newEvent: CalendarEvent = {
      id: `EVT-${String(events.length + 1).padStart(3, "0")}`,
      title: form.title,
      description: form.description,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      createdBy: user?.fullName || "",
      department: user?.department || "",
      type: form.type,
      invitees:
        form.audienceType === "todos"
          ? "todos"
          : form.audienceType === "departamento"
          ? "departamento"
          : form.audienceUsers,
      inviteeDepartment: form.audienceType === "departamento" ? form.audienceDept : undefined,
    };
    setEvents([...events, newEvent]);
    setShowCreate(false);
    setForm({ title: "", description: "", date: "", startTime: "09:00", endTime: "10:00", location: "", type: "reunion", audienceType: "todos", audienceDept: "", audienceUsers: [] });
  };

  const toggleUser = (userId: string) => {
    setForm((f) => ({
      ...f,
      audienceUsers: f.audienceUsers.includes(userId) ? f.audienceUsers.filter((id) => id !== userId) : [...f.audienceUsers, userId],
    }));
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Calendario <span className="gold-accent-text">Corporativo</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Eventos, reuniones y capacitaciones</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Evento
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <h2 className="font-heading font-bold text-card-foreground capitalize">{monthName}</h2>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-7">
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2 border-b border-border">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 border-b border-r border-border" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvts = getEventsForDate(dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday =
                  new Date().getFullYear() === year &&
                  new Date().getMonth() === month &&
                  new Date().getDate() === day;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`h-24 border-b border-r border-border p-1.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-gold/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday ? "bg-gold text-charcoal-dark font-bold" : "text-card-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvts.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); }}
                          className={`text-[10px] px-1 py-0.5 rounded truncate border cursor-pointer hover:opacity-80 ${eventTypeColors[e.type]}`}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvts.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{dayEvts.length - 2} más</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-heading font-bold text-card-foreground mb-4">
              {selectedDate
                ? new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
                : "Selecciona un día"}
            </h3>
            {selectedDate && dayEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay eventos programados</p>
            )}
            <div className="space-y-3">
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={() => setSelectedEvent(e)}
                  className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow ${eventTypeColors[e.type]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${eventTypeDotColors[e.type]}`} />
                    <span className="text-xs font-semibold">{eventTypeLabels[e.type]}</span>
                  </div>
                  <h4 className="font-heading font-bold text-sm">{e.title}</h4>
                  {e.description && <p className="text-xs mt-1 opacity-80 line-clamp-2">{e.description}</p>}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3 w-3" /> {e.startTime} - {e.endTime}
                    </div>
                    {e.location && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3" /> {e.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Detail Overlay */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedEvent(null)}>
            <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`p-5 border-b border-border ${eventTypeColors[selectedEvent.type]}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background/50">
                      {eventTypeIcons[selectedEvent.type]}
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider">{eventTypeLabels[selectedEvent.type]}</span>
                      <h2 className="font-heading font-bold text-lg leading-tight">{selectedEvent.title}</h2>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="p-1 rounded-lg hover:bg-background/50 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {selectedEvent.description && (
                  <p className="text-sm text-card-foreground">{selectedEvent.description}</p>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-muted">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="font-medium text-card-foreground">
                        {new Date(selectedEvent.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-muted">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horario</p>
                      <p className="font-medium text-card-foreground">{selectedEvent.startTime} — {selectedEvent.endTime}</p>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="p-2 rounded-lg bg-muted">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ubicación</p>
                        <p className="font-medium text-card-foreground">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-muted">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dirigido a</p>
                      <p className="font-medium text-card-foreground">{getAudienceLabel(selectedEvent)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Creado por <span className="font-medium text-card-foreground">{selectedEvent.createdBy}</span> · {selectedEvent.department}
                  </p>
                </div>
              </div>

              <div className="p-5 border-t border-border">
                <button onClick={() => setSelectedEvent(null)} className="btn-gold text-sm w-full">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nuevo Evento</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha *</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Inicio</label>
                    <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Fin</label>
                    <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Ubicación</label>
                    <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="Sala, oficina..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEvent["type"] })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="reunion">Reunión</option>
                      <option value="evento">Evento</option>
                      <option value="capacitacion">Capacitación</option>
                      <option value="fecha_importante">Fecha Importante</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>

                {/* Audience */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Dirigido a</label>
                  <div className="flex gap-2">
                    {(["todos", "departamento", "personas"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm({ ...form, audienceType: t })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          form.audienceType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground hover:bg-border"
                        }`}
                      >
                        {t === "todos" ? "Todos" : t === "departamento" ? "Departamento" : "Personas Específicas"}
                      </button>
                    ))}
                  </div>
                </div>
                {form.audienceType === "departamento" && (
                  <select value={form.audienceDept} onChange={(e) => setForm({ ...form, audienceDept: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar departamento...</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
                {form.audienceType === "personas" && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                    {allUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <input type="checkbox" checked={form.audienceUsers.includes(u.id)} onChange={() => toggleUser(u.id)} className="rounded" />
                        <span className="text-card-foreground">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.department}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleCreate} className="btn-gold text-sm">Crear Evento</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CalendarPage;
