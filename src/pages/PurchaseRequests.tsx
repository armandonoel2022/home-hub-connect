import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import type { PurchaseRequest, PurchaseItem } from "@/lib/types";
import { DEPARTMENTS, PURCHASE_APPROVAL_THRESHOLDS } from "@/lib/types";
import { Plus, X, ShoppingCart, Check, XCircle, FileText, Upload, Eye, Clock } from "lucide-react";

const statusColors: Record<string, string> = {
  Pendiente: "bg-amber-50 text-amber-700",
  Aprobada: "bg-emerald-50 text-emerald-700",
  Rechazada: "bg-red-50 text-red-700",
  "En Revisión": "bg-blue-50 text-blue-700",
};

const mockRequests: PurchaseRequest[] = [
  {
    id: "PR-001",
    title: "Radios portátiles para operaciones",
    items: [{ name: "Radio Motorola T480", description: "Radio bidireccional", quantity: 10, estimatedPrice: 8500 }],
    totalAmount: 85000,
    justification: "Equipos actuales en mal estado, necesarios para comunicación en campo",
    department: "Operaciones",
    requestedBy: "Remit",
    requestedAt: "2026-03-04T10:00:00",
    status: "Pendiente",
    approvalLevel: "Gerencia General",
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    quotationFiles: ["cotizacion_motorola.pdf", "cotizacion_kenwood.pdf"],
    notes: "",
  },
  {
    id: "PR-002",
    title: "Tóner para impresoras",
    items: [
      { name: "Tóner HP 26A", description: "Para LaserJet Pro M402", quantity: 5, estimatedPrice: 3200 },
      { name: "Tóner HP 30A", description: "Para LaserJet Pro M203", quantity: 3, estimatedPrice: 2800 },
    ],
    totalAmount: 24400,
    justification: "Reposición mensual de insumos de impresión",
    department: "Administración",
    requestedBy: "María López",
    requestedAt: "2026-03-03T14:00:00",
    status: "Aprobada",
    approvalLevel: "Jefe Directo",
    approvedBy: "Gerente de Administración",
    approvedAt: "2026-03-03T16:00:00",
    rejectionReason: null,
    quotationFiles: ["cotizacion_toner.pdf"],
    notes: "",
  },
];

const PurchaseRequestsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [requests, setRequests] = useState<PurchaseRequest[]>(mockRequests);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<PurchaseRequest | null>(null);
  const [showApproval, setShowApproval] = useState<PurchaseRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Form state
  const [form, setForm] = useState({
    title: "",
    justification: "",
    department: user?.department || "",
    items: [{ name: "", description: "", quantity: 1, estimatedPrice: 0 }] as PurchaseItem[],
    quotationFiles: [] as string[],
  });

  const totalAmount = form.items.reduce((sum, i) => sum + i.quantity * i.estimatedPrice, 0);
  const approvalLevel = totalAmount > PURCHASE_APPROVAL_THRESHOLDS.directManager ? "Gerencia General" : "Jefe Directo";

  const addItem = () => setForm({ ...form, items: [...form.items, { name: "", description: "", quantity: 1, estimatedPrice: 0 }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, field: keyof PurchaseItem, value: any) => {
    const items = [...form.items];
    (items[idx] as any)[field] = value;
    setForm({ ...form, items });
  };

  const handleSubmit = () => {
    if (!form.title || form.items.some((i) => !i.name || i.estimatedPrice <= 0)) return;
    const newReq: PurchaseRequest = {
      id: `PR-${String(requests.length + 1).padStart(3, "0")}`,
      title: form.title,
      items: form.items,
      totalAmount,
      justification: form.justification,
      department: form.department,
      requestedBy: user?.fullName || "",
      requestedAt: new Date().toISOString(),
      status: "Pendiente",
      approvalLevel,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      quotationFiles: form.quotationFiles,
      notes: "",
    };
    setRequests([newReq, ...requests]);
    addNotification({
      type: "purchase",
      title: "Nueva Solicitud de Compra",
      message: `${user?.fullName} solicita compra: ${form.title} por RD$${totalAmount.toLocaleString()}`,
      relatedId: newReq.id,
      forUserId: "USR-001", // Goes to GM
      actionUrl: "/solicitudes-compra",
    });
    setShowForm(false);
    setForm({ title: "", justification: "", department: user?.department || "", items: [{ name: "", description: "", quantity: 1, estimatedPrice: 0 }], quotationFiles: [] });
  };

  const handleApprove = (req: PurchaseRequest) => {
    setRequests(requests.map((r) => r.id === req.id ? { ...r, status: "Aprobada" as const, approvedBy: user?.fullName || "", approvedAt: new Date().toISOString() } : r));
    addNotification({
      type: "purchase",
      title: "Solicitud Aprobada ✅",
      message: `Tu solicitud "${req.title}" ha sido aprobada por ${user?.fullName}`,
      relatedId: req.id,
      forUserId: "USR-005",
      actionUrl: "/solicitudes-compra",
    });
    setShowApproval(null);
  };

  const handleReject = (req: PurchaseRequest) => {
    if (!rejectionReason) return;
    setRequests(requests.map((r) => r.id === req.id ? { ...r, status: "Rechazada" as const, rejectionReason } : r));
    addNotification({
      type: "purchase",
      title: "Solicitud Rechazada ❌",
      message: `Tu solicitud "${req.title}" fue rechazada: ${rejectionReason}`,
      relatedId: req.id,
      forUserId: "USR-005",
      actionUrl: "/solicitudes-compra",
    });
    setShowApproval(null);
    setRejectionReason("");
  };

  const formatCurrency = (n: number) => `RD$${n.toLocaleString()}`;

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Solicitudes de <span className="gold-accent-text">Compra</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Gestión y aprobación de compras con cotizaciones</p>
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
            { label: "Pendientes", value: requests.filter((r) => r.status === "Pendiente").length },
            { label: "Aprobadas", value: requests.filter((r) => r.status === "Aprobada").length },
            { label: "Rechazadas", value: requests.filter((r) => r.status === "Rechazada").length },
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{req.id}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[req.status]}`}>{req.status}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{req.approvalLevel}</span>
                    </div>
                    <h3 className="font-heading font-bold text-card-foreground">{req.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{req.department} · {req.requestedBy} · {new Date(req.requestedAt).toLocaleDateString()}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-lg font-heading font-bold gold-accent-text">{formatCurrency(req.totalAmount)}</span>
                      <span className="text-xs text-muted-foreground">{req.items.length} artículo(s)</span>
                      {req.quotationFiles.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {req.quotationFiles.length} cotización(es)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setSelected(req)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </button>
                    {req.status === "Pendiente" && user?.isAdmin && (
                      <button onClick={() => setShowApproval(req)} className="p-2 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors" title="Aprobar/Rechazar">
                        <Check className="h-4 w-4" />
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
                <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.title}</h2>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Departamento", selected.department],
                    ["Solicitado por", selected.requestedBy],
                    ["Fecha", new Date(selected.requestedAt).toLocaleDateString()],
                    ["Estado", selected.status],
                    ["Nivel Aprobación", selected.approvalLevel],
                    ["Total", formatCurrency(selected.totalAmount)],
                    ...(selected.approvedBy ? [["Aprobado por", selected.approvedBy]] : []),
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
                  <h4 className="text-sm font-medium text-card-foreground mb-2">Artículos</h4>
                  <div className="space-y-2">
                    {selected.items.map((item, i) => (
                      <div key={i} className="bg-muted rounded-lg p-3 flex justify-between text-sm">
                        <div>
                          <span className="font-medium text-card-foreground">{item.name}</span>
                          <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                        </div>
                        <span className="font-medium text-card-foreground">{formatCurrency(item.quantity * item.estimatedPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {selected.quotationFiles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-card-foreground mb-2">Cotizaciones Adjuntas</h4>
                    {selected.quotationFiles.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" /> {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setSelected(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {showApproval && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Aprobar / Rechazar</h2>
                <button onClick={() => { setShowApproval(null); setRejectionReason(""); }} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-heading font-bold text-card-foreground">{showApproval.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{showApproval.department} · {showApproval.requestedBy}</p>
                  <p className="text-xl font-heading font-bold gold-accent-text mt-2">{formatCurrency(showApproval.totalAmount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Motivo de rechazo (si aplica)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none"
                    placeholder="Solo requerido si rechaza la solicitud..."
                  />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => handleReject(showApproval)} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> Rechazar
                </button>
                <button onClick={() => handleApprove(showApproval)} className="btn-gold text-sm flex items-center gap-2">
                  <Check className="h-4 w-4" /> Aprobar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Request Form */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nueva Solicitud de Compra</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título de la solicitud *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Justificación</label>
                  <textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-card-foreground">Artículos *</label>
                    <button onClick={addItem} className="text-xs font-medium gold-accent-text hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar</button>
                  </div>
                  <div className="space-y-3">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="bg-muted rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Artículo {idx + 1}</span>
                          {form.items.length > 1 && (
                            <button onClick={() => removeItem(idx)} className="text-xs text-destructive hover:underline">Eliminar</button>
                          )}
                        </div>
                        <input type="text" placeholder="Nombre del artículo" value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                        <input type="text" placeholder="Descripción" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Cantidad</label>
                            <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Precio Unit. (RD$)</label>
                            <input type="number" min={0} value={item.estimatedPrice} onChange={(e) => updateItem(idx, "estimatedPrice", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quotation upload */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Cotizaciones (adjuntar una o más)</label>
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-gold/50 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Seleccionar archivos PDF</span>
                    <input type="file" accept=".pdf" multiple className="hidden" onChange={(e) => {
                      const files = Array.from(e.target.files || []).map((f) => f.name);
                      setForm({ ...form, quotationFiles: [...form.quotationFiles, ...files] });
                    }} />
                  </label>
                  {form.quotationFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {form.quotationFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
                          <span className="flex items-center gap-2"><FileText className="h-4 w-4" />{f}</span>
                          <button onClick={() => setForm({ ...form, quotationFiles: form.quotationFiles.filter((_, j) => j !== i) })} className="text-destructive hover:underline text-xs">Quitar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Estimado</p>
                    <p className="text-xl font-heading font-bold gold-accent-text">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Nivel de Aprobación</p>
                    <p className="text-sm font-medium text-card-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{approvalLevel}</p>
                  </div>
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

export default PurchaseRequestsPage;
