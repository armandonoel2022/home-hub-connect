import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTickets } from "@/hooks/useApiHooks";
import {
  TICKET_CATEGORIES,
  DEPARTMENTS,
  SLA_MAP,
  type Ticket,
  type TicketPriority,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/types";
import {
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  XCircle,
  Paperclip,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react";

const priorityConfig: Record<TicketPriority, { color: string; bg: string }> = {
  Baja: { color: "text-emerald-600", bg: "bg-emerald-50" },
  Media: { color: "text-amber-600", bg: "bg-amber-50" },
  Alta: { color: "text-orange-600", bg: "bg-orange-50" },
  Crítica: { color: "text-red-600", bg: "bg-red-50" },
};

const statusConfig: Record<TicketStatus, { icon: typeof Clock; color: string; bg: string }> = {
  Abierto: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  "En Progreso": { icon: Loader2, color: "text-amber-600", bg: "bg-amber-50" },
  "En Espera": { icon: Pause, color: "text-gray-600", bg: "bg-gray-100" },
  Resuelto: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  Cerrado: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-50" },
};

const TicketsPage = () => {
  const { user } = useAuth();
  const { data: tickets, create: createTicket, remove: removeTicket, isCreating } = useTickets();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("Todos");

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "" as TicketCategory | "",
    priority: "Media" as TicketPriority,
    department: "",
  });

  // Non-admins only see their own tickets
  const userTickets = user?.isAdmin ? tickets : tickets.filter((t) => t.createdBy === user?.fullName);

  const filteredTickets = userTickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "Todos" || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!form.title || !form.category || !form.department) return;

    const now = new Date().toISOString();
    const slaHours = SLA_MAP[form.priority];
    const deadline = new Date(Date.now() + slaHours * 3600000).toISOString();

    try {
      await createTicket({
        title: form.title,
        description: form.description,
        category: form.category as TicketCategory,
        priority: form.priority,
        status: "Abierto",
        createdBy: user?.fullName || "Usuario Actual",
        department: form.department,
        createdAt: now,
        updatedAt: now,
        slaHours,
        slaDeadline: deadline,
        attachments: [],
      });

      setShowCreate(false);
      setForm({ title: "", description: "", category: "", priority: "Media", department: "" });
    } catch (error) {
      console.error("Error creando ticket:", error);
      window.alert("No se pudo guardar el ticket en el servidor. Verifica que el backend esté corriendo en el puerto 3000.");
    }
  };

  const statusCounts = {
    Todos: userTickets.length,
    Abierto: userTickets.filter((t) => t.status === "Abierto").length,
    "En Progreso": userTickets.filter((t) => t.status === "En Progreso").length,
    Resuelto: userTickets.filter((t) => t.status === "Resuelto").length,
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                  Tickets <span className="gold-accent-text">IT</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Sistema de soporte técnico con SLA
                </p>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Ticket
              </button>
            </div>

            {/* Stats */}
            <div className="flex gap-3 mt-5 flex-wrap">
              {Object.entries(statusCounts).map(([label, count]) => (
                <button
                  key={label}
                  onClick={() => setFilterStatus(label)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === label
                      ? "bg-gold text-charcoal-dark"
                      : "bg-charcoal-light text-muted-foreground hover:text-secondary-foreground"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por título o ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Ticket list */}
        <div className="px-6 pb-8 space-y-3">
          {filteredTickets.map((ticket) => {
            const StatusIcon = statusConfig[ticket.status].icon;
            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="card-department p-5 flex items-center gap-4 cursor-pointer"
              >
                <div className={`p-2 rounded-lg ${statusConfig[ticket.status].bg}`}>
                  <StatusIcon className={`h-5 w-5 ${statusConfig[ticket.status].color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityConfig[ticket.priority].bg} ${priorityConfig[ticket.priority].color}`}>
                      {ticket.priority}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {ticket.category}
                    </span>
                  </div>
                  <h3 className="font-heading font-semibold text-card-foreground text-sm truncate">
                    {ticket.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.department} · {ticket.createdBy} · SLA: {ticket.slaHours}h
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ticket.attachments.length > 0 && (
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  )}
                  {user?.isAdmin && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`¿Eliminar ticket ${ticket.id}: "${ticket.title}"?`)) {
                          try {
                            await removeTicket(ticket.id);
                          } catch (error) {
                            console.error("Error eliminando ticket:", error);
                            window.alert("No se pudo eliminar el ticket en el servidor.");
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}

          {filteredTickets.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No se encontraron tickets</p>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">
                  Nuevo Ticket
                </h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                    placeholder="Describe brevemente el problema"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none"
                    placeholder="Detalla el requerimiento..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Categoría *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Prioridad</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                    >
                      {(["Baja", "Media", "Alta", "Crítica"] as TicketPriority[]).map((p) => (
                        <option key={p} value={p}>{p} (SLA: {SLA_MAP[p]}h)</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento *</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">
                    Adjuntos (aprobaciones, capturas, etc.)
                  </label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm hover:border-gold transition-colors cursor-pointer">
                    <Paperclip className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    Arrastra archivos aquí o haz clic para seleccionar
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button onClick={handleCreate} className="btn-gold text-sm">
                  Crear Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">{selectedTicket.id}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityConfig[selectedTicket.priority].bg} ${priorityConfig[selectedTicket.priority].color}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{selectedTicket.title}</h2>
                <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Estado", selectedTicket.status],
                    ["Categoría", selectedTicket.category],
                    ["Departamento", selectedTicket.department],
                    ["Creado por", selectedTicket.createdBy],
                    ["SLA", `${selectedTicket.slaHours} horas`],
                    ["Fecha", new Date(selectedTicket.createdAt).toLocaleDateString("es-ES")],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block">{label}</span>
                      <span className="font-medium text-card-foreground">{value}</span>
                    </div>
                  ))}
                </div>
                {selectedTicket.attachments.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-card-foreground block mb-2">Adjuntos</span>
                    {selectedTicket.attachments.map((a) => (
                      <div key={a} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
                        <Paperclip className="h-4 w-4" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setSelectedTicket(null)} className="btn-gold text-sm">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TicketsPage;
