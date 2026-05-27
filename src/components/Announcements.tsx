import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import { Megaphone, ArrowRight, Plus, X, Send, Trash2 } from "lucide-react";
import { announcementsApi, isApiConfigured, type AnnouncementApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { displayDept } from "@/lib/displayNames";

/**
 * Comunicados — persistidos en backend cuando hay API configurada.
 * Si se marcan con `showAsOverlay` (por defecto sí), el AnnouncementOverlay los
 * muestra automáticamente a los destinatarios. Si traen `eventDate`, se crea
 * además un evento en el calendario corporativo.
 */
const FALLBACK: AnnouncementApi[] = [
  { id: "ANN-001", date: "05 Mar 2026", title: "Actualización de políticas de seguridad", excerpt: "Se han actualizado los protocolos de seguridad para todos los turnos. Revisar el documento adjunto.", priority: true, createdBy: "Aurelio Pérez", audienceType: "todos" },
  { id: "ANN-002", date: "03 Mar 2026", title: "Mantenimiento programado del servidor", excerpt: "El servidor estará en mantenimiento el sábado 8 de marzo de 22:00 a 02:00.", priority: false, createdBy: "Armando Noel", audienceType: "departamento", audienceDept: "Tecnología y Monitoreo" },
];

const Announcements = () => {
  const { user, allUsers } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementApi[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    priority: false,
    audienceType: "todos" as AnnouncementApi["audienceType"],
    audienceDept: "",
    audienceUsers: [] as string[],
    showAsOverlay: true,
    eventDate: "",
    eventStartTime: "09:00",
    eventEndTime: "10:00",
    eventLocation: "",
  });

  const reload = async () => {
    if (!isApiConfigured()) {
      setAnnouncements(FALLBACK);
      return;
    }
    try {
      const list = await announcementsApi.getAll();
      setAnnouncements(list);
    } catch {
      setAnnouncements(FALLBACK);
    }
  };

  useEffect(() => {
    reload();
  }, [user?.id]);

  const handleCreate = async () => {
    if (!form.title || !user) return;
    const payload: Partial<AnnouncementApi> = {
      title: form.title,
      excerpt: form.excerpt,
      priority: form.priority,
      createdBy: user.fullName,
      audienceType: form.audienceType,
      audienceDept: form.audienceType === "departamento" ? form.audienceDept : undefined,
      audienceUserIds: form.audienceType === "personas" ? form.audienceUsers : undefined,
      showAsOverlay: form.showAsOverlay,
      eventDate: form.eventDate || undefined,
      eventStartTime: form.eventDate ? form.eventStartTime : undefined,
      eventEndTime: form.eventDate ? form.eventEndTime : undefined,
      eventLocation: form.eventDate ? form.eventLocation : undefined,
    };
    try {
      if (isApiConfigured()) {
        await announcementsApi.create(payload);
        toast({ title: "Comunicado publicado", description: form.showAsOverlay ? "Aparecerá como overlay en las pantallas de los destinatarios." : "Visible en el dashboard." });
      } else {
        setAnnouncements([{ ...payload, id: `ANN-${Date.now()}`, date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) } as AnnouncementApi, ...announcements]);
      }
      setShowCreate(false);
      setForm({ title: "", excerpt: "", priority: false, audienceType: "todos", audienceDept: "", audienceUsers: [], showAsOverlay: true, eventDate: "", eventStartTime: "09:00", eventEndTime: "10:00", eventLocation: "" });
      reload();
    } catch {
      toast({ title: "Error", description: "No se pudo publicar el comunicado.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este comunicado?")) return;
    try {
      if (isApiConfigured()) await announcementsApi.remove(id);
      setAnnouncements((list) => list.filter((a) => a.id !== id));
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const toggleUser = (userId: string) => {
    setForm((f) => ({
      ...f,
      audienceUsers: f.audienceUsers.includes(userId) ? f.audienceUsers.filter((id) => id !== userId) : [...f.audienceUsers, userId],
    }));
  };

  const isLeader = user?.isDepartmentLeader || user?.isAdmin;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
          <h2 className="section-title text-foreground">Comunicados</h2>
        </div>
        {isLeader && (
          <button onClick={() => setShowCreate(true)} className="btn-gold text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        )}
      </div>
      <div className="grid gap-4">
        {announcements.map((a) => (
          <div key={a.id} className="card-department p-5 flex gap-4 items-start">
            <div className={`p-2 rounded-lg shrink-0 ${a.priority ? "bg-primary/15" : "bg-muted"}`}>
              <Megaphone className={`h-5 w-5 ${a.priority ? "text-gold" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-muted-foreground">{a.date}</span>
                {a.priority && <span className="text-xs font-bold gold-accent-text uppercase tracking-wider">Importante</span>}
                {a.audienceType !== "todos" && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {a.audienceType === "departamento" ? displayDept(a.audienceDept) : "Seleccionados"}
                  </span>
                )}
                {a.showAsOverlay && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gold/15 gold-accent-text px-2 py-0.5 rounded-full">Overlay</span>
                )}
                {a.eventDate && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-full">Evento {a.eventDate}</span>
                )}
              </div>
              <h3 className="font-heading font-bold text-card-foreground text-sm">{a.title}</h3>
              <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{a.excerpt}</p>
            </div>
            {(user?.isAdmin || a.createdByUserId === user?.id) && (
              <button onClick={() => handleDelete(a.id)} className="shrink-0 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-heading font-bold text-lg text-card-foreground">Nuevo Comunicado</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Contenido</label>
                <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.checked })} className="rounded accent-gold" />
                  <span className="text-sm text-card-foreground">Importante</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.showAsOverlay} onChange={(e) => setForm({ ...form, showAsOverlay: e.target.checked })} className="rounded accent-gold" />
                  <span className="text-sm text-card-foreground">Mostrar como overlay global</span>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Dirigido a</label>
                <div className="flex gap-2">
                  {(["todos", "departamento", "personas"] as const).map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, audienceType: t })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.audienceType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>
                      {t === "todos" ? "Todos" : t === "departamento" ? "Departamento" : "Personas"}
                    </button>
                  ))}
                </div>
              </div>
              {form.audienceType === "departamento" && (
                <select value={form.audienceDept} onChange={(e) => setForm({ ...form, audienceDept: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                  <option value="">Seleccionar departamento...</option>
                  {DEPARTMENTS.map((d) => (<option key={d} value={d}>{displayDept(d)}</option>))}
                </select>
              )}
              {form.audienceType === "personas" && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <input type="checkbox" checked={form.audienceUsers.includes(u.id)} onChange={() => toggleUser(u.id)} className="rounded accent-gold" />
                      <span className="text-card-foreground">{u.fullName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{displayDept(u.department)}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="border-t border-border pt-4">
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Programar evento (opcional)</label>
                <p className="text-xs text-muted-foreground mb-2">Si llenas la fecha, se creará automáticamente un evento en el calendario corporativo.</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  <input type="text" placeholder="Lugar" value={form.eventLocation} onChange={(e) => setForm({ ...form, eventLocation: e.target.value })} className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  <input type="time" value={form.eventStartTime} onChange={(e) => setForm({ ...form, eventStartTime: e.target.value })} className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  <input type="time" value={form.eventEndTime} onChange={(e) => setForm({ ...form, eventEndTime: e.target.value })} className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={handleCreate} className="btn-gold text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Publicar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Announcements;
