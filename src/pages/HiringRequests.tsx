import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import type { HiringRequest, HiringRequestStatus } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import { Plus, X, Users, Check, XCircle, Eye, Calendar, ArrowRight } from "lucide-react";

const statusColors: Record<string, string> = {
  Borrador: "bg-gray-100 text-gray-600",
  "Pendiente Gerente Área": "bg-amber-50 text-amber-700",
  "Aprobada Gerente Área": "bg-blue-50 text-blue-700",
  "Pendiente Gerencia General": "bg-amber-50 text-amber-700",
  "Aprobada Gerencia General": "bg-emerald-50 text-emerald-700",
  Rechazada: "bg-red-50 text-red-700",
  "En Proceso RRHH": "bg-purple-50 text-purple-700",
  "Entrevista Programada": "bg-cyan-50 text-cyan-700",
  Completada: "bg-emerald-50 text-emerald-700",
};

const statusSteps: HiringRequestStatus[] = [
  "Pendiente Gerente Área",
  "Aprobada Gerente Área",
  "Pendiente Gerencia General",
  "Aprobada Gerencia General",
  "En Proceso RRHH",
  "Entrevista Programada",
  "Completada",
];

const mockHiringRequests: HiringRequest[] = [
  {
    id: "HR-001",
    positionTitle: "Ejecutivo de Ventas",
    department: "Gerencia Comercial",
    justification: "Crecimiento de cartera de clientes requiere personal adicional para zona Este",
    salaryRange: "RD$35,000 - RD$45,000",
    contractType: "Indefinido",
    urgency: "Normal",
    requirements: "Experiencia en ventas B2B, licencia de conducir, disponibilidad para viajar",
    requestedBy: "Carlos Méndez",
    requestedAt: "2026-03-02T09:00:00",
    status: "Pendiente Gerencia General",
    managerApproval: { by: "Gerente Comercial", at: "2026-03-02T14:00:00", approved: true },
    gmApproval: null,
    rejectionReason: null,
    interviewDate: null,
    interviewNotes: "",
    notes: "",
  },
  {
    id: "HR-002",
    positionTitle: "Oficial de Seguridad",
    department: "Operaciones",
    justification: "Nuevo contrato con cliente requiere 3 oficiales adicionales",
    salaryRange: "RD$20,000 - RD$25,000",
    contractType: "Indefinido",
    urgency: "Urgente",
    requirements: "Porte de armas vigente, experiencia mínima 2 años en seguridad privada",
    requestedBy: "Remit",
    requestedAt: "2026-03-04T08:00:00",
    status: "Pendiente Gerente Área",
    managerApproval: null,
    gmApproval: null,
    rejectionReason: null,
    interviewDate: null,
    interviewNotes: "",
    notes: "",
  },
];

const HiringRequestsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [requests, setRequests] = useState<HiringRequest[]>(mockHiringRequests);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<HiringRequest | null>(null);
  const [showAction, setShowAction] = useState<HiringRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [interviewDate, setInterviewDate] = useState("");

  const [form, setForm] = useState({
    positionTitle: "",
    department: user?.department || "",
    justification: "",
    salaryRange: "",
    contractType: "Indefinido" as HiringRequest["contractType"],
    urgency: "Normal" as HiringRequest["urgency"],
    requirements: "",
  });

  const handleSubmit = () => {
    if (!form.positionTitle || !form.justification) return;
    const newReq: HiringRequest = {
      id: `HR-${String(requests.length + 1).padStart(3, "0")}`,
      ...form,
      requestedBy: user?.fullName || "",
      requestedAt: new Date().toISOString(),
      status: "Pendiente Gerente Área",
      managerApproval: null,
      gmApproval: null,
      rejectionReason: null,
      interviewDate: null,
      interviewNotes: "",
      notes: "",
    };
    setRequests([newReq, ...requests]);
    addNotification({
      type: "hiring",
      title: "Nueva Solicitud de Contratación",
      message: `${user?.fullName} solicita contratar: ${form.positionTitle} para ${form.department}`,
      relatedId: newReq.id,
      forUserId: "USR-001",
      actionUrl: "/solicitudes-personal",
    });
    setShowForm(false);
    setForm({ positionTitle: "", department: user?.department || "", justification: "", salaryRange: "", contractType: "Indefinido", urgency: "Normal", requirements: "" });
  };

  const advanceStatus = (req: HiringRequest, approved: boolean) => {
    let newStatus: HiringRequestStatus = req.status;
    let updates: Partial<HiringRequest> = {};

    if (!approved) {
      newStatus = "Rechazada";
      updates.rejectionReason = rejectionReason;
      addNotification({
        type: "hiring",
        title: "Solicitud de Contratación Rechazada ❌",
        message: `La solicitud para "${req.positionTitle}" fue rechazada: ${rejectionReason}`,
        relatedId: req.id,
        forUserId: "USR-005",
        actionUrl: "/solicitudes-personal",
      });
    } else {
      switch (req.status) {
        case "Pendiente Gerente Área":
          newStatus = "Pendiente Gerencia General";
          updates.managerApproval = { by: user?.fullName || "", at: new Date().toISOString(), approved: true };
          addNotification({ type: "hiring", title: "Aprobación de Gerente ✅", message: `Solicitud "${req.positionTitle}" aprobada por gerente de área, pendiente Gerencia General`, relatedId: req.id, forUserId: "USR-001", actionUrl: "/solicitudes-personal" });
          break;
        case "Pendiente Gerencia General":
          newStatus = "En Proceso RRHH";
          updates.gmApproval = { by: user?.fullName || "", at: new Date().toISOString(), approved: true };
          addNotification({ type: "hiring", title: "Aprobación Gerencia General ✅", message: `Solicitud "${req.positionTitle}" aprobada — pasa a RRHH para gestión`, relatedId: req.id, forUserId: "USR-005", actionUrl: "/solicitudes-personal" });
          break;
        case "En Proceso RRHH":
          if (interviewDate) {
            newStatus = "Entrevista Programada";
            updates.interviewDate = interviewDate;
            addNotification({ type: "hiring", title: "Entrevista Programada 📅", message: `Entrevista para "${req.positionTitle}" agendada: ${new Date(interviewDate).toLocaleDateString()}`, relatedId: req.id, forUserId: "USR-005", actionUrl: "/solicitudes-personal" });
          }
          break;
        case "Entrevista Programada":
          newStatus = "Completada";
          addNotification({ type: "hiring", title: "Proceso Completado ✅", message: `El proceso de contratación para "${req.positionTitle}" ha sido completado`, relatedId: req.id, forUserId: "USR-005", actionUrl: "/solicitudes-personal" });
          break;
      }
    }

    setRequests(requests.map((r) => r.id === req.id ? { ...r, ...updates, status: newStatus } : r));
    setShowAction(null);
    setRejectionReason("");
    setInterviewDate("");
  };

  const getStepIndex = (status: HiringRequestStatus) => statusSteps.indexOf(status);

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Users className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Solicitudes de <span className="gold-accent-text">Personal</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Contratación con flujo de aprobación: Gerente → Gerencia General → RRHH</p>
                </div>
              </div>
              <button onClick={() => setShowForm(true)} className="btn-gold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva Solicitud
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: requests.length },
            { label: "Pendientes", value: requests.filter((r) => r.status.startsWith("Pendiente")).length },
            { label: "En Proceso", value: requests.filter((r) => ["En Proceso RRHH", "Entrevista Programada"].includes(r.status)).length },
            { label: "Completadas", value: requests.filter((r) => r.status === "Completada").length },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="px-6 pb-8 space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1 w-full bg-secondary" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{req.id}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[req.status]}`}>{req.status}</span>
                      {req.urgency === "Urgente" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">Urgente</span>}
                    </div>
                    <h3 className="font-heading font-bold text-card-foreground">{req.positionTitle}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{req.department} · {req.requestedBy} · {new Date(req.requestedAt).toLocaleDateString()}</p>
                    {req.salaryRange && <p className="text-sm gold-accent-text font-medium mt-1">{req.salaryRange}</p>}

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-1">
                      {statusSteps.map((step, i) => {
                        const current = getStepIndex(req.status);
                        const isReached = req.status !== "Rechazada" && i <= current;
                        return (
                          <div key={step} className="flex items-center gap-1 flex-1">
                            <div className={`h-1.5 flex-1 rounded-full ${isReached ? "bg-gold" : "bg-border"}`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setSelected(req)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </button>
                    {req.status !== "Rechazada" && req.status !== "Completada" && user?.isAdmin && (
                      <button onClick={() => setShowAction(req)} className="p-2 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors" title="Gestionar">
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.positionTitle}</h2>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Departamento", selected.department],
                    ["Solicitado por", selected.requestedBy],
                    ["Fecha", new Date(selected.requestedAt).toLocaleDateString()],
                    ["Estado", selected.status],
                    ["Rango Salarial", selected.salaryRange || "—"],
                    ["Tipo Contrato", selected.contractType],
                    ["Urgencia", selected.urgency],
                    ...(selected.managerApproval ? [["Aprobado Gerente", `${selected.managerApproval.by} — ${new Date(selected.managerApproval.at).toLocaleDateString()}`]] : []),
                    ...(selected.gmApproval ? [["Aprobado GG", `${selected.gmApproval.by} — ${new Date(selected.gmApproval.at).toLocaleDateString()}`]] : []),
                    ...(selected.interviewDate ? [["Entrevista", new Date(selected.interviewDate).toLocaleDateString()]] : []),
                    ...(selected.rejectionReason ? [["Motivo Rechazo", selected.rejectionReason]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <span className="text-xs text-muted-foreground block">{label}</span>
                      <span className="font-medium text-card-foreground">{val}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-card-foreground mb-2">Justificación</h4>
                  <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">{selected.justification}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-card-foreground mb-2">Requisitos</h4>
                  <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">{selected.requirements || "—"}</p>
                </div>
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setSelected(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Action Modal */}
        {showAction && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Gestionar Solicitud</h2>
                <button onClick={() => { setShowAction(null); setRejectionReason(""); setInterviewDate(""); }} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-heading font-bold text-card-foreground">{showAction.positionTitle}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{showAction.department} · {showAction.requestedBy}</p>
                  <p className="text-sm font-medium mt-2">
                    Estado actual: <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[showAction.status]}`}>{showAction.status}</span>
                  </p>
                </div>

                {showAction.status === "En Proceso RRHH" && (
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha de Entrevista</label>
                    <input type="datetime-local" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                )}

                {(showAction.status.startsWith("Pendiente") || showAction.status === "En Proceso RRHH") && (
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Motivo de rechazo (si aplica)</label>
                    <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" placeholder="Solo requerido si rechaza..." />
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                {showAction.status !== "Entrevista Programada" && (
                  <button onClick={() => advanceStatus(showAction, false)} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Rechazar
                  </button>
                )}
                <button onClick={() => advanceStatus(showAction, true)} className="btn-gold text-sm flex items-center gap-2">
                  {showAction.status === "En Proceso RRHH" ? <><Calendar className="h-4 w-4" /> Agendar Entrevista</> :
                   showAction.status === "Entrevista Programada" ? <><Check className="h-4 w-4" /> Completar Proceso</> :
                   <><Check className="h-4 w-4" /> Aprobar</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Request Form */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nueva Solicitud de Contratación</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título del Puesto *</label>
                  <input type="text" value={form.positionTitle} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Justificación *</label>
                  <textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Rango Salarial</label>
                    <input type="text" placeholder="Ej: RD$30,000 - RD$40,000" value={form.salaryRange} onChange={(e) => setForm({ ...form, salaryRange: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Urgencia</label>
                    <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as any })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option>Normal</option>
                      <option>Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo de Contrato</label>
                  <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as any })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option>Indefinido</option>
                    <option>Temporal</option>
                    <option>Proyecto</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Requisitos del Puesto</label>
                  <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" placeholder="Experiencia, habilidades, certificaciones..." />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleSubmit} className="btn-gold text-sm">Enviar Solicitud</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HiringRequestsPage;
