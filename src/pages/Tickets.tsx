import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTickets } from "@/hooks/useApiHooks";
import { useTicketSettings } from "@/hooks/useTicketSettings";
import MailSyncPanel from "@/components/tickets/MailSyncPanel";
import TicketsDashboard from "@/components/tickets/TicketsDashboard";
import TicketAgentsManager from "@/components/tickets/TicketAgentsManager";
import { CategoryIcon, StatusBadge, StatusStepper } from "@/components/tickets/TicketVisuals";
import { isITSuper } from "@/lib/permissions";
import {
  WORKFLOW_STATUSES, DEFAULT_ASSIGNEE, normalizeStatus, isClosed, statusLabel,
  isTicketAgent, isTicketsOwner, isRequester,
} from "@/lib/ticketWorkflow";
import {
  TICKET_CATEGORIES, DEPARTMENTS, SLA_MAP,
  type Ticket, type TicketPriority, type TicketCategory, type TicketStatus,
} from "@/lib/types";
import {
  Plus, Search, AlertTriangle, Paperclip, ChevronRight, X, Trash2, MessageSquare, Send, User,
  LayoutDashboard, ListChecks, Users,
} from "lucide-react";

const priorityCls: Record<TicketPriority, string> = {
  Baja: "bg-muted text-muted-foreground",
  Media: "bg-accent text-accent-foreground",
  Alta: "bg-primary/20 text-primary",
  Crítica: "bg-destructive/15 text-destructive",
};

const IT_DEPARTMENT = "Tecnología y Monitoreo";
type Tab = "tickets" | "dashboard" | "tecnicos";
const FILTERS = ["Todos", "Abiertos", ...WORKFLOW_STATUSES] as const;

const TicketsPage = () => {
  const { user, allUsers } = useAuth();
  const { data: tickets, create: createTicket, update: updateTicket, remove: removeTicket, isCreating } = useTickets();
  const { settings } = useTicketSettings();
  const [tab, setTab] = useState<Tab>("tickets");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("Abiertos");
  const [newComment, setNewComment] = useState("");
  const [nextStatus, setNextStatus] = useState<TicketStatus | "">("");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", category: "" as TicketCategory | "", priority: "Media" as TicketPriority,
    department: user?.department || "", requestedForId: "",
  });
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");

  const isOwner = isTicketsOwner(user) || isITSuper(user);
  const canManage = !!user?.isAdmin || isOwner || isTicketAgent(user, settings);

  const assignees = [
    DEFAULT_ASSIGNEE,
    ...settings.agents.filter((a) => a.email.toLowerCase() !== DEFAULT_ASSIGNEE.email),
  ];

  const userTickets = (canManage ? tickets : tickets.filter((t) => isRequester(t, user) || t.createdBy === user?.fullName))
    .slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const filteredTickets = userTickets.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.createdBy.toLowerCase().includes(q);
    const s = normalizeStatus(t.status);
    const matchesStatus = filterStatus === "Todos" || (filterStatus === "Abiertos" ? !isClosed(s) : s === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!form.title || !form.category || !form.department) return;
    const external = form.requestedForId === "__external";
    if (external && (!extName.trim() || !/^\S+@\S+\.\S+$/.test(extEmail.trim()))) {
      window.alert("Indica el nombre y un correo válido de la persona.");
      return;
    }
    const now = new Date().toISOString();
    const slaHours = SLA_MAP[form.priority];
    const requestedFor = form.requestedForId && !external ? allUsers.find((u) => u.id === form.requestedForId) : null;
    const requester = external
      ? { fullName: extName.trim(), id: undefined, email: extEmail.trim() }
      : (requestedFor || user);
    try {
      await createTicket({
        title: form.title, description: form.description, category: form.category as TicketCategory,
        priority: form.priority, status: "Recibido por Tecnología",
        createdBy: requester?.fullName || "Usuario", createdById: requester?.id,
        requesterEmail: requester?.email,
        ...(requester?.id !== user?.id ? { openedBy: user?.fullName } : {}),
        assignedTo: DEFAULT_ASSIGNEE.name, assignedToEmail: DEFAULT_ASSIGNEE.email,
        department: form.department, createdAt: now, updatedAt: now, slaHours,
        slaDeadline: new Date(Date.now() + slaHours * 3600000).toISOString(),
        attachments: [], comments: [],
        history: [{ status: "Recibido por Tecnología", at: now, by: user?.fullName || "Intranet" }],
        source: "intranet",
      } as Omit<Ticket, "id">);
      setShowCreate(false);
      setExtName(""); setExtEmail("");
      setForm({ title: "", description: "", category: "", priority: "Media", department: user?.department || "", requestedForId: "" });
    } catch (error) {
      console.error("Error creando ticket:", error);
      window.alert("No se pudo guardar el ticket en el servidor. Verifica que el backend esté corriendo en el puerto 3000.");
    }
  };

  const openTicket = (t: Ticket) => {
    setSelectedTicket(t); setNextStatus(""); setStatusNote(""); setNewComment("");
    setAssigneeEmail(t.assignedToEmail || DEFAULT_ASSIGNEE.email);
  };

  const needsNote = nextStatus === "En Espera" || (nextStatus && isClosed(nextStatus));
  const handleStatusChange = async () => {
    if (!selectedTicket || !nextStatus || !user) return;
    if (needsNote && !statusNote.trim()) return;
    const now = new Date().toISOString();
    const patch: Partial<Ticket> = { status: nextStatus, updatedAt: now };
    if (nextStatus === "Asignado" || nextStatus === "En Progreso") {
      const a = assignees.find((x) => x.email === assigneeEmail) || DEFAULT_ASSIGNEE;
      patch.assignedTo = a.name; patch.assignedToEmail = a.email;
      patch.assignedToId = allUsers.find((u) => u.email?.toLowerCase() === a.email.toLowerCase())?.id;
    }
    if (nextStatus === "En Espera") patch.holdReason = statusNote.trim();
    if (isClosed(nextStatus)) { patch.closingNotes = statusNote.trim(); patch.closedAt = now; }
    patch.history = [...(selectedTicket.history || []), {
      status: nextStatus, at: now, by: user.fullName,
      note: statusNote.trim() || (patch.assignedTo ? `Asignado a ${patch.assignedTo}` : undefined),
    }];
    try {
      await updateTicket(selectedTicket.id, patch);
      setSelectedTicket({ ...selectedTicket, ...patch });
      setNextStatus(""); setStatusNote("");
    } catch (err) {
      console.error("Error actualizando estado:", err);
      window.alert("No se pudo actualizar el ticket.");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket || !user) return;
    const comment = { id: `CMT-${Date.now()}`, userId: user.id, userName: user.fullName, content: newComment.trim(), timestamp: new Date().toISOString() };
    const updatedComments = [...(selectedTicket.comments || []), comment];
    try {
      await updateTicket(selectedTicket.id, { comments: updatedComments, updatedAt: new Date().toISOString() });
      setSelectedTicket({ ...selectedTicket, comments: updatedComments });
      setNewComment("");
    } catch (err) { console.error("Error agregando comentario:", err); }
  };

  const countFor = (f: string) => f === "Todos" ? userTickets.length
    : f === "Abiertos" ? userTickets.filter((t) => !isClosed(t.status)).length
    : userTickets.filter((t) => normalizeStatus(t.status) === f).length;

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none";

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Tickets <span className="gold-accent-text">IT</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Soporte técnico — {IT_DEPARTMENT}</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" /> Nuevo Ticket
              </button>
            </div>

            {isOwner && (
              <div className="flex gap-2 mt-5">
                {([["tickets", "Tickets", ListChecks], ["dashboard", "Dashboard y reportes", LayoutDashboard], ["tecnicos", "Técnicos designados", Users]] as const).map(([k, l, Icon]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === k ? "bg-gold text-charcoal-dark" : "bg-charcoal-light text-muted-foreground hover:text-secondary-foreground"}`}>
                    <Icon className="h-4 w-4" /> {l}
                  </button>
                ))}
              </div>
            )}

            {tab === "tickets" && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {FILTERS.map((label) => (
                  <button key={label} onClick={() => setFilterStatus(label)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === label ? "bg-gold text-charcoal-dark" : "bg-charcoal-light text-muted-foreground hover:text-secondary-foreground"}`}>
                    {label} ({countFor(label)})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {tab === "dashboard" && isOwner && <TicketsDashboard tickets={tickets} />}
        {tab === "tecnicos" && isOwner && <div className="p-6"><TicketAgentsManager /></div>}

        {tab === "tickets" && (
          <>
            {canManage && <div className="px-6 pt-4"><MailSyncPanel /></div>}

            <div className="px-6 py-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Buscar por título, ID o solicitante..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} className={`${inputCls} pl-10`} />
              </div>
            </div>

            <div className="px-6 pb-8 space-y-3">
              {filteredTickets.map((ticket) => (
                <div key={ticket.id} onClick={() => openTicket(ticket)} className="card-department p-4 flex items-center gap-4 cursor-pointer">
                  <CategoryIcon category={ticket.category} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                      <StatusBadge status={ticket.status} label={statusLabel(ticket)} />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityCls[ticket.priority]}`}>{ticket.priority}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{ticket.category}</span>
                    </div>
                    <h3 className="font-heading font-semibold text-card-foreground text-sm truncate">{ticket.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                      <User className="h-3 w-3" />
                      {ticket.createdBy} · {ticket.department} · {new Date(ticket.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
                      {ticket.comments && ticket.comments.length > 0 && (
                        <span className="flex items-center gap-0.5 ml-2"><MessageSquare className="h-3 w-3" /> {ticket.comments.length}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.attachments?.length > 0 && <Paperclip className="h-4 w-4 text-muted-foreground" />}
                    {isOwner && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(`¿Eliminar ticket ${ticket.id}: "${ticket.title}"?`)) {
                            try { await removeTicket(ticket.id); } catch { window.alert("No se pudo eliminar el ticket en el servidor."); }
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {filteredTickets.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No se encontraron tickets</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Crear */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nuevo Ticket</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-2">Tipo de solicitud *</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TICKET_CATEGORIES.map((c) => (
                      <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-[11px] text-center leading-tight transition-colors ${form.category === c ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                        <CategoryIcon category={c} />
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                {canManage && (
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Nuevo ticket para</label>
                    <select value={form.requestedForId} className={inputCls}
                      onChange={(e) => {
                        const su = allUsers.find((u) => u.id === e.target.value);
                        setForm({ ...form, requestedForId: e.target.value, department: su?.department || form.department });
                      }}>
                      <option value="">Yo mismo ({user?.fullName})</option>
                      <option value="__external">Otra persona (no es usuario de la intranet)</option>
                      {allUsers.filter((u) => u.id !== user?.id).map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName} — {u.department}</option>
                      ))}
                    </select>
                    {form.requestedForId === "__external" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <input type="text" placeholder="Nombre completo *" value={extName} onChange={(e) => setExtName(e.target.value)} className={inputCls} />
                        <input type="email" placeholder="Correo *" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} className={inputCls} />
                      </div>
                    )}
                    {form.requestedForId && (
                      <p className="text-xs text-muted-foreground mt-1">Los correos del ticket se enviarán a esta persona.</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls}
                    placeholder={/alta|baja/i.test(form.category) ? "Nombre del colaborador" : "Describe brevemente el problema"} />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder={/alta/i.test(form.category) ? "Cargo, departamento, fecha de ingreso, accesos requeridos (correo, intranet, carpetas)..."
                      : /baja/i.test(form.category) ? "Fecha de salida, equipos a recuperar, cuentas a desactivar..."
                      : /carpeta/i.test(form.category) ? "Ruta de la carpeta y usuarios que necesitan acceso..."
                      : "Detalla el requerimiento..."} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Prioridad</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })} className={inputCls}>
                      {(["Baja", "Media", "Alta", "Crítica"] as TicketPriority[]).map((p) => <option key={p} value={p}>{p} (SLA: {SLA_MAP[p]}h)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento *</label>
                    <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inputCls}>
                      <option value="">Seleccionar...</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleCreate} disabled={isCreating || !form.category || !form.title} className="btn-gold text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                  {isCreating ? "Guardando..." : "Crear Ticket"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detalle */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start gap-4 p-5 border-b border-border">
                <CategoryIcon category={selectedTicket.category} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">{selectedTicket.id}</span>
                    <StatusBadge status={selectedTicket.status} label={statusLabel(selectedTicket)} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityCls[selectedTicket.priority]}`}>{selectedTicket.priority}</span>
                  </div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground mt-1">{selectedTicket.title}</h2>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <StatusStepper status={selectedTicket.status} />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                {normalizeStatus(selectedTicket.status) === "En Espera" && selectedTicket.holdReason && (
                  <div className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm"><b>En espera:</b> {selectedTicket.holdReason}</div>
                )}
                {isClosed(selectedTicket.status) && selectedTicket.closingNotes && (
                  <div className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm"><b>Notas de cierre:</b> {selectedTicket.closingNotes}</div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    ["Categoría", selectedTicket.category],
                    ["Departamento", selectedTicket.department],
                    ["Solicitante", selectedTicket.createdBy],
                    ["Asignado a", selectedTicket.assignedTo || DEFAULT_ASSIGNEE.name],
                    ["SLA", `${selectedTicket.slaHours} horas`],
                    ["Creado", new Date(selectedTicket.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block">{label}</span>
                      <span className="font-medium text-card-foreground">{value}</span>
                    </div>
                  ))}
                </div>

                {canManage && !isClosed(selectedTicket.status) && (
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <label className="text-sm font-medium text-card-foreground block">Cambiar estado</label>
                    <div className="flex gap-2 flex-wrap">
                      {WORKFLOW_STATUSES.filter((s) => s !== normalizeStatus(selectedTicket.status) && s !== "Recibido por Tecnología").map((s) => (
                        <button key={s} onClick={() => setNextStatus(s)}
                          className={`rounded-full ${nextStatus === s ? "ring-2 ring-primary" : ""}`}>
                          <StatusBadge status={s} />
                        </button>
                      ))}
                    </div>
                    {(nextStatus === "Asignado" || nextStatus === "En Progreso") && (
                      <select value={assigneeEmail} onChange={(e) => setAssigneeEmail(e.target.value)} className={inputCls}>
                        {assignees.map((a) => <option key={a.email} value={a.email}>{a.name} — {a.email}</option>)}
                      </select>
                    )}
                    {needsNote && (
                      <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={3} className={`${inputCls} resize-none`}
                        placeholder={nextStatus === "En Espera" ? "Razón de la espera o acción que debe tomar el usuario (obligatorio)" : "Notas de cierre para el usuario (obligatorio)"} />
                    )}
                    {nextStatus && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {nextStatus === "En Espera" || isClosed(nextStatus) ? "Se enviará un correo al solicitante." : "No se envía correo en este paso."}
                        </p>
                        <button onClick={handleStatusChange} disabled={!!needsNote && !statusNote.trim()} className="btn-gold text-sm disabled:opacity-50">
                          Guardar estado
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(selectedTicket.history || []).length > 0 && (
                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-heading font-semibold text-card-foreground mb-2">Historial</h3>
                    <ol className="space-y-1.5 text-xs">
                      {(selectedTicket.history || []).map((h, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground w-28 shrink-0">{new Date(h.at).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</span>
                          <span><b>{normalizeStatus(h.status)}</b> · {h.by}{h.note ? ` — ${h.note}` : ""}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-heading font-semibold text-card-foreground mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Seguimiento ({(selectedTicket.comments || []).length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                    {(selectedTicket.comments || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay comentarios aún.</p>
                    ) : (selectedTicket.comments || []).map((c) => (
                      <div key={c.id} className="bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-card-foreground">{c.userName}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(c.timestamp).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()} placeholder="Agregar comentario..." className={inputCls} />
                    <button onClick={handleAddComment} disabled={!newComment.trim()}
                      className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TicketsPage;
