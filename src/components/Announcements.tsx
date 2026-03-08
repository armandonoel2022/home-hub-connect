import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import { Megaphone, ArrowRight, Plus, X, Send } from "lucide-react";

interface Announcement {
  id: string;
  date: string;
  title: string;
  excerpt: string;
  priority: boolean;
  createdBy: string;
  audienceType: "todos" | "departamento" | "personas";
  audienceDept?: string;
  audienceUserIds?: string[];
}

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  { id: "ANN-001", date: "05 Mar 2026", title: "Actualización de políticas de seguridad", excerpt: "Se han actualizado los protocolos de seguridad para todos los turnos. Revisar el documento adjunto.", priority: true, createdBy: "Aurelio Pérez", audienceType: "todos" },
  { id: "ANN-002", date: "03 Mar 2026", title: "Mantenimiento programado del servidor", excerpt: "El servidor estará en mantenimiento el sábado 8 de marzo de 22:00 a 02:00.", priority: false, createdBy: "Armando Noel", audienceType: "departamento", audienceDept: "Tecnología y Monitoreo" },
  { id: "ANN-003", date: "01 Mar 2026", title: "Bienvenida a nuevos colaboradores", excerpt: "Damos la bienvenida al equipo de Operaciones a los nuevos oficiales que se integran este mes.", priority: false, createdBy: "Dilia Aguasvivas", audienceType: "todos" },
];

const Announcements = () => {
  const { user, allUsers } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    priority: false,
    audienceType: "todos" as Announcement["audienceType"],
    audienceDept: "",
    audienceUsers: [] as string[],
  });

  const visible = announcements.filter((a) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (a.createdBy === user.fullName) return true;
    if (a.audienceType === "todos") return true;
    if (a.audienceType === "departamento" && a.audienceDept === user.department) return true;
    if (a.audienceType === "personas" && a.audienceUserIds?.includes(user.id)) return true;
    return false;
  });

  const handleCreate = () => {
    if (!form.title) return;
    const newAnn: Announcement = {
      id: `ANN-${String(announcements.length + 1).padStart(3, "0")}`,
      date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
      title: form.title,
      excerpt: form.excerpt,
      priority: form.priority,
      createdBy: user?.fullName || "",
      audienceType: form.audienceType,
      audienceDept: form.audienceType === "departamento" ? form.audienceDept : undefined,
      audienceUserIds: form.audienceType === "personas" ? form.audienceUsers : undefined,
    };
    setAnnouncements([newAnn, ...announcements]);
    setShowCreate(false);
    setForm({ title: "", excerpt: "", priority: false, audienceType: "todos", audienceDept: "", audienceUsers: [] });
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
        {visible.map((a) => (
          <div key={a.id} className="card-department p-5 flex gap-4 items-start">
            <div className={`p-2 rounded-lg shrink-0 ${a.priority ? "bg-primary/15" : "bg-muted"}`}>
              <Megaphone className={`h-5 w-5 ${a.priority ? "text-gold" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">{a.date}</span>
                {a.priority && (
                  <span className="text-xs font-bold gold-accent-text uppercase tracking-wider">Importante</span>
                )}
                {a.audienceType !== "todos" && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {a.audienceType === "departamento" ? a.audienceDept : "Seleccionados"}
                  </span>
                )}
              </div>
              <h3 className="font-heading font-bold text-card-foreground text-sm">{a.title}</h3>
              <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{a.excerpt}</p>
            </div>
            <button className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {/* Create Modal */}
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.checked })} className="rounded" />
                <span className="text-sm text-card-foreground">Marcar como importante</span>
              </label>
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
                  {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
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
              <button onClick={handleCreate} className="btn-gold text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Publicar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Announcements;
