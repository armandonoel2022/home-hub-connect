import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Plus, X, Clock, AlertCircle, CheckCircle2, Circle, Calendar } from "lucide-react";

type TaskPriority = "baja" | "media" | "alta";
type TaskStatus = "pendiente" | "en_progreso" | "completada";

interface UserTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assignedTo: string;
  assignedToUserId: string;
  createdBy: string;
  createdByUserId: string;
  createdAt: string;
  completedAt: string | null;
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  baja: { label: "Baja", color: "text-emerald-600", bg: "bg-emerald-50" },
  media: { label: "Media", color: "text-amber-600", bg: "bg-amber-50" },
  alta: { label: "Alta", color: "text-red-600", bg: "bg-red-50" },
};

const statusConfig: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  pendiente: { label: "Pendiente", icon: Circle, color: "text-muted-foreground" },
  en_progreso: { label: "En Progreso", icon: Clock, color: "text-amber-500" },
  completada: { label: "Completada", icon: CheckCircle2, color: "text-emerald-500" },
};

const INITIAL_TASKS: UserTask[] = [
  { id: "TSK-001", title: "Revisar informe mensual de seguridad", description: "Consolidar datos de incidentes del mes de febrero", priority: "alta", status: "pendiente", dueDate: "2026-03-10", assignedTo: "Armando Noel", assignedToUserId: "USR-002", createdBy: "Aurelio Pérez", createdByUserId: "USR-100", createdAt: "2026-03-05", completedAt: null },
  { id: "TSK-002", title: "Actualizar inventario de equipos", description: "Agregar los nuevos equipos recibidos en marzo", priority: "media", status: "en_progreso", dueDate: "2026-03-12", assignedTo: "Armando Noel", assignedToUserId: "USR-002", createdBy: "Armando Noel", createdByUserId: "USR-002", createdAt: "2026-03-04", completedAt: null },
  { id: "TSK-003", title: "Preparar presentación BASC", description: "Slides para auditoría del 15 de marzo", priority: "alta", status: "pendiente", dueDate: "2026-03-14", assignedTo: "Bilianny Fernández", assignedToUserId: "USR-104", createdBy: "Aurelio Pérez", createdByUserId: "USR-100", createdAt: "2026-03-03", completedAt: null },
];

const TaskInbox = () => {
  const { user, allUsers } = useAuth();
  const [tasks, setTasks] = useState<UserTask[]>(INITIAL_TASKS);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("todas");

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "media" as TaskPriority,
    dueDate: "",
    assignedToUserId: "",
  });

  // Show tasks assigned to user + tasks created by user
  const myTasks = tasks.filter((t) =>
    t.assignedToUserId === user?.id || t.createdByUserId === user?.id
  );

  const filteredTasks = myTasks.filter((t) =>
    filterStatus === "todas" || t.status === filterStatus
  );

  const handleCreate = () => {
    if (!form.title || !form.assignedToUserId) return;
    const assignee = allUsers.find((u) => u.id === form.assignedToUserId);
    const newTask: UserTask = {
      id: `TSK-${String(tasks.length + 1).padStart(3, "0")}`,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: "pendiente",
      dueDate: form.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      assignedTo: assignee?.fullName || "",
      assignedToUserId: form.assignedToUserId,
      createdBy: user?.fullName || "",
      createdByUserId: user?.id || "",
      createdAt: new Date().toISOString().split("T")[0],
      completedAt: null,
    };
    setTasks([newTask, ...tasks]);
    setShowCreate(false);
    setForm({ title: "", description: "", priority: "media", dueDate: "", assignedToUserId: "" });
  };

  const cycleStatus = (task: UserTask) => {
    const order: TaskStatus[] = ["pendiente", "en_progreso", "completada"];
    const nextIdx = (order.indexOf(task.status) + 1) % order.length;
    const newStatus = order[nextIdx];
    setTasks(tasks.map((t) => t.id === task.id ? { ...t, status: newStatus, completedAt: newStatus === "completada" ? new Date().toISOString().split("T")[0] : null } : t));
  };

  const isOverdue = (task: UserTask) => task.status !== "completada" && new Date(task.dueDate) < new Date();

  const stats = {
    total: myTasks.length,
    pendientes: myTasks.filter((t) => t.status === "pendiente").length,
    enProgreso: myTasks.filter((t) => t.status === "en_progreso").length,
    completadas: myTasks.filter((t) => t.status === "completada").length,
    vencidas: myTasks.filter((t) => isOverdue(t)).length,
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Bandeja de <span className="gold-accent-text">Tareas</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Seguimiento de tareas pendientes y asignadas</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Nueva Tarea
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, active: filterStatus === "todas", key: "todas" },
            { label: "Pendientes", value: stats.pendientes, active: filterStatus === "pendiente", key: "pendiente" },
            { label: "En Progreso", value: stats.enProgreso, active: filterStatus === "en_progreso", key: "en_progreso" },
            { label: "Completadas", value: stats.completadas, active: filterStatus === "completada", key: "completada" },
            { label: "Vencidas", value: stats.vencidas, active: false, key: "" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => s.key && setFilterStatus(s.key)}
              className={`bg-card rounded-lg p-4 border transition-all text-left ${s.active ? "border-gold" : "border-border hover:border-gold/30"}`}
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-heading font-bold ${s.label === "Vencidas" && s.value > 0 ? "text-destructive" : "text-card-foreground"}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="px-6 pb-8 space-y-2">
          {filteredTasks.map((task) => {
            const StatusIcon = statusConfig[task.status].icon;
            const overdue = isOverdue(task);

            return (
              <div key={task.id} className={`bg-card rounded-lg border p-4 flex items-center gap-4 hover:shadow-md transition-shadow ${overdue ? "border-destructive/30" : "border-border"}`}>
                <button onClick={() => cycleStatus(task)} className="shrink-0" title="Cambiar estado">
                  <StatusIcon className={`h-6 w-6 ${statusConfig[task.status].color} transition-colors`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityConfig[task.priority].bg} ${priorityConfig[task.priority].color}`}>
                      {priorityConfig[task.priority].label}
                    </span>
                    {overdue && (
                      <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Vencida
                      </span>
                    )}
                    {task.createdByUserId !== user?.id && (
                      <span className="text-xs text-muted-foreground">Asignada por {task.createdBy}</span>
                    )}
                    {task.assignedToUserId !== user?.id && (
                      <span className="text-xs text-muted-foreground">→ {task.assignedTo}</span>
                    )}
                  </div>
                  <h3 className={`font-heading font-semibold text-sm ${task.status === "completada" ? "line-through text-muted-foreground" : "text-card-foreground"}`}>
                    {task.title}
                  </h3>
                  {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className={overdue ? "text-destructive font-semibold" : ""}>{task.dueDate}</span>
                </div>
              </div>
            );
          })}
          {filteredTasks.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No hay tareas en esta vista</p>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nueva Tarea</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Prioridad</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha límite</label>
                    <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Asignar a *</label>
                  <select value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar persona...</option>
                    <option value={user?.id}>{user?.fullName} (yo)</option>
                    {allUsers.filter((u) => u.id !== user?.id).map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName} — {u.department}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleCreate} className="btn-gold text-sm">Crear Tarea</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TaskInbox;
