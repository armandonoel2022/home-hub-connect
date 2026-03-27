import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Printer, ShoppingCart, FileText, Send, Inbox,
  CheckCircle2, Clock, AlertCircle, ThumbsUp, ThumbsDown,
  Plus, Trash2, ShieldCheck, ShieldX, Ban,
} from "lucide-react";
import safeOneLogo from "@/assets/safeone-logo.png";
import safeOneLetterhead from "@/assets/safeone-letterhead.png";

type FormType = "orden-compra" | "orden-servicio";
type FormMode = "print" | "virtual";

const formConfig: { key: FormType; label: string; icon: any; color: string; desc: string }[] = [
  { key: "orden-compra", label: "Orden de Compra", icon: ShoppingCart, color: "hsl(42 100% 50%)", desc: "Formalizar la adquisición de bienes o servicios de manera previa a la compra." },
  { key: "orden-servicio", label: "Orden de Servicio", icon: FileText, color: "hsl(220 15% 30%)", desc: "Tramitar solicitudes de pago (servicios, derechos adquiridos, prestaciones laborales, facturas de proveedores)." },
];

// ── Simple localStorage persistence for admin requests ──
interface AdminRequest {
  id: string;
  formType: FormType;
  status: string; // "Pendiente" | "Aprobada" | "Rechazada" | "Declinada" | "Sin Aprobación"
  requestedBy: string;
  requestedByName: string;
  department: string;
  requestedAt: string;
  formData: Record<string, string>;
  items: { tipo?: string; descripcion: string; cantidad: number; precio: number; subtotal: number }[];
  subtotal: number;
  itbis: number;
  total: number;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
}

function getAdminRequests(): AdminRequest[] {
  try { return JSON.parse(localStorage.getItem("safeone_admin_requests") || "[]"); } catch { return []; }
}
function saveAdminRequests(reqs: AdminRequest[]) {
  localStorage.setItem("safeone_admin_requests", JSON.stringify(reqs));
}

const AdminForms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeForm, setActiveForm] = useState<FormType | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [withLetterhead, setWithLetterhead] = useState(true);
  const [activeView, setActiveView] = useState<"forms" | "my-requests" | "approvals">("forms");
  const [refreshKey, setRefreshKey] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  // Approval overlay states
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false);
  const [approvalTargetId, setApprovalTargetId] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [showResultOverlay, setShowResultOverlay] = useState<{ type: "approved" | "declined"; id: string } | null>(null);

  // Items state for line items
  const [items, setItems] = useState<{ tipo?: string; descripcion: string; cantidad: number; precio: number }[]>([
    { tipo: "", descripcion: "", cantidad: 1, precio: 0 },
  ]);

  // Service order type checkboxes
  const [serviceType, setServiceType] = useState<string[]>(["Pago"]);

  const addItem = () => setItems([...items, { tipo: "", descripcion: "", cantidad: 1, precio: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const subtotal = items.reduce((sum, it) => sum + it.cantidad * it.precio, 0);
  const itbis = subtotal * 0.18;
  const total = subtotal + itbis;

  const isAdmin = user?.isAdmin || user?.department === "Administración" || user?.department === "Gerencia General" || user?.department === "Gerencia Comercial";

  const myRequests = user ? getAdminRequests().filter(r => r.requestedBy === user.id) : [];
  const pendingApprovals = user && isAdmin ? getAdminRequests().filter(r => r.status === "Pendiente") : [];

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const letterheadBg = withLetterhead
      ? `background-image: url('${new URL(safeOneLetterhead, window.location.origin).href}'); background-size: 100% 100%; background-repeat: no-repeat; background-position: center;`
      : "";

    const headerHtml = withLetterhead ? ""
      : `<div style="text-align:center;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:24px;">
          <img src="${new URL(safeOneLogo, window.location.origin).href}" style="max-height:56px;display:block;margin:0 auto 8px;" />
          <h2 style="font-size:18px;font-weight:700;">SafeOne Group — Administración</h2>
          <p style="font-size:13px;color:#666;margin-top:4px;">${formConfig.find(f => f.key === activeForm)?.label || ""}</p>
          <p style="font-size:11px;color:#999;margin-top:4px;">Fecha: ${format(new Date(), "dd/MM/yyyy")}</p>
         </div>`;

    const footerHtml = withLetterhead ? ""
      : `<div style="text-align:center;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:12px;margin-top:24px;">
          <p>Tel: 809.548.3100 • info@safeone.com.do • www.safeone.com.do | RNC: 101526752</p>
          <p>C/ Olof Palme esq. Cul de Sac 2, San Gerónimo, Santo Domingo, D.N.</p>
         </div>`;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${formConfig.find(f => f.key === activeForm)?.label} — SafeOne</title><style>
      @page { size: A4; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }
      .page { width: 210mm; min-height: 297mm; position: relative; ${letterheadBg} margin: 0 auto; }
      .content-area { ${withLetterhead ? "padding: 180px 60px 100px 60px;" : "padding: 40px 50px;"} }
      .form-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
      .form-date { font-size: 11px; color: #666; text-align: right; margin-bottom: 16px; }
      label { font-size: 12px; font-weight: 600; display: block; margin-bottom: 3px; color: #333; }
      input, textarea, select { width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; font-size: 12px; background: #fff; }
      textarea { min-height: 50px; resize: vertical; }
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .form-field { margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      .totals { text-align: right; margin-top: 8px; }
      .totals div { display: flex; justify-content: flex-end; gap: 16px; margin: 4px 0; font-size: 12px; }
      .totals .total-row { font-weight: 700; font-size: 14px; }
      .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 20px; border-top: 1px solid #ddd; }
      .sig-block div { text-align: center; }
      .sig-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 6px; }
      .sig-label { font-size: 11px; color: #666; }
      button { display: none !important; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { width: 100%; min-height: 100vh; } }
    </style></head><body>
    <div class="page"><div class="content-area">
      ${headerHtml}
      <div class="form-title">${formConfig.find(f => f.key === activeForm)?.label || ""}</div>
      <div class="form-date">Fecha: ${format(new Date(), "dd/MM/yyyy")}</div>
      ${content.innerHTML}
      ${footerHtml}
    </div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  const buildRequest = (status: string): AdminRequest => {
    const formData: Record<string, string> = {};
    const formEl = printRef.current;
    if (formEl) {
      formEl.querySelectorAll("input, textarea").forEach((el) => {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const label = input.closest(".space-y-1\\.5")?.querySelector("label")?.textContent || input.placeholder || "";
        if (label) formData[label] = input.value;
      });
    }

    if (activeForm === "orden-servicio") {
      formData["Tipo de Orden"] = serviceType.join(", ");
    }

    const lineItems = items.filter(it => it.descripcion.trim()).map(it => ({
      tipo: it.tipo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio: it.precio,
      subtotal: it.cantidad * it.precio,
    }));

    return {
      id: `ADM-${Date.now().toString(36).toUpperCase()}`,
      formType: activeForm!,
      status,
      requestedBy: user!.id,
      requestedByName: user!.fullName,
      department: user!.department,
      requestedAt: new Date().toISOString(),
      formData,
      items: lineItems,
      subtotal,
      itbis,
      total,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    };
  };

  const handleVirtualSubmit = () => {
    if (!user || !activeForm) return;
    const req = buildRequest("Pendiente");
    const all = getAdminRequests();
    all.unshift(req);
    saveAdminRequests(all);
    setRefreshKey(k => k + 1);
    toast({ title: "Orden Enviada", description: `${formConfig.find(f => f.key === activeForm)?.label} #${req.id} enviada para aprobación de Aurelio Pérez.` });
    setActiveForm(null);
    setFormMode(null);
    setItems([{ tipo: "", descripcion: "", cantidad: 1, precio: 0 }]);
    setActiveView("my-requests");
  };

  const handleNoApprovalSubmit = () => {
    if (!user || !activeForm) return;
    const req = buildRequest("Sin Aprobación");
    const all = getAdminRequests();
    all.unshift(req);
    saveAdminRequests(all);
    setRefreshKey(k => k + 1);
    toast({ title: "Orden Registrada", description: `${formConfig.find(f => f.key === activeForm)?.label} #${req.id} registrada sin requerir aprobación.` });
    setActiveForm(null);
    setFormMode(null);
    setItems([{ tipo: "", descripcion: "", cantidad: 1, precio: 0 }]);
    setActiveView("my-requests");
  };

  const handleApprove = (reqId: string) => {
    setApprovalTargetId(reqId);
    setShowApprovalOverlay(true);
    setApprovalComment("");
  };

  const confirmApprove = () => {
    if (!approvalTargetId) return;
    const all = getAdminRequests();
    const idx = all.findIndex(r => r.id === approvalTargetId);
    if (idx === -1) return;
    all[idx].status = "Aprobada";
    all[idx].approvedBy = "Aurelio Pérez";
    all[idx].approvedAt = new Date().toISOString();
    if (approvalComment.trim()) {
      all[idx].rejectionReason = approvalComment; // reuse field for comments
    }
    saveAdminRequests(all);
    setShowApprovalOverlay(false);
    setShowResultOverlay({ type: "approved", id: approvalTargetId });
    setApprovalTargetId(null);
    setApprovalComment("");
    setRefreshKey(k => k + 1);
  };

  const handleDecline = (reqId: string) => {
    setApprovalTargetId(reqId);
    setApprovalComment("");
    setRejectId(reqId);
  };

  const confirmDecline = () => {
    if (!user || !approvalTargetId) return;
    const all = getAdminRequests();
    const idx = all.findIndex(r => r.id === approvalTargetId);
    if (idx === -1) return;
    all[idx].status = "Declinada";
    all[idx].rejectedBy = "Aurelio Pérez";
    all[idx].rejectionReason = rejectReason.trim() || null;
    saveAdminRequests(all);
    setRejectId(null);
    setRejectReason("");
    setShowResultOverlay({ type: "declined", id: approvalTargetId });
    setApprovalTargetId(null);
    setRefreshKey(k => k + 1);
  };

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleBack = () => {
    if (formMode) { setFormMode(null); }
    else if (activeForm) { setActiveForm(null); setItems([{ tipo: "", descripcion: "", cantidad: 1, precio: 0 }]); }
    else if (activeView !== "forms") { setActiveView("forms"); }
    else { navigate("/"); }
  };

  const fmtCurrency = (n: number) => `RD$ ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 no-print">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {activeForm ? formConfig.find(f => f.key === activeForm)?.label : "Administración — Formularios"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formMode === "print" ? "Formulario para imprimir y firmar"
                  : formMode === "virtual" ? "Aprobación electrónica — completar y enviar"
                  : activeForm ? "Seleccione modalidad"
                  : activeView === "my-requests" ? "Historial de órdenes"
                  : activeView === "approvals" ? "Órdenes pendientes de aprobación"
                  : "Seleccione un formulario"}
              </p>
            </div>
          </div>

          {/* Tab navigation */}
          {!activeForm && (
            <div className="flex gap-2 mb-6 no-print">
              <Button variant={activeView === "forms" ? "default" : "outline"} size="sm" onClick={() => setActiveView("forms")} className="gap-2">
                <FileText className="h-4 w-4" /> Formularios
              </Button>
              <Button variant={activeView === "my-requests" ? "default" : "outline"} size="sm" onClick={() => setActiveView("my-requests")} className="gap-2">
                <Send className="h-4 w-4" /> Mis Órdenes
                {myRequests.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{myRequests.length}</Badge>}
              </Button>
              {isAdmin && (
                <Button variant={activeView === "approvals" ? "default" : "outline"} size="sm" onClick={() => setActiveView("approvals")} className="gap-2">
                  <Inbox className="h-4 w-4" /> Aprobaciones
                  {pendingApprovals.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{pendingApprovals.length}</Badge>}
                </Button>
              )}
            </div>
          )}

          {/* ═══ FORMS LIST ═══ */}
          {activeView === "forms" && !activeForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formConfig.map(fc => {
                const Icon = fc.icon;
                return (
                  <button key={fc.key} onClick={() => { setActiveForm(fc.key); setFormMode(null); }}
                    className="group flex items-start gap-4 p-6 rounded-xl border-2 border-border bg-card hover:border-primary transition-all text-left">
                    <div className="p-3 rounded-xl" style={{ background: fc.color + "22" }}>
                      <Icon className="h-6 w-6" style={{ color: fc.color }} />
                    </div>
                    <div>
                      <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">{fc.label}</span>
                      <span className="text-xs text-muted-foreground mt-1 block">{fc.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ═══ MODE SELECTION ═══ */}
          {activeForm && !formMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <button onClick={() => setFormMode("print")}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all">
                <Printer className="h-10 w-10 text-muted-foreground" />
                <span className="font-heading font-bold text-card-foreground">Imprimir para Firma</span>
                <span className="text-xs text-muted-foreground text-center">Generar documento para imprimir, firmar manualmente y archivar</span>
              </button>
              <button onClick={() => setFormMode("virtual")}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all">
                <Send className="h-10 w-10 text-muted-foreground" />
                <span className="font-heading font-bold text-card-foreground">Aprobación Electrónica</span>
                <span className="text-xs text-muted-foreground text-center">Completar y enviar para aprobación vía intranet</span>
              </button>
            </div>
          )}

          {/* ═══ FORM CONTENT ═══ */}
          {activeForm && formMode && (
            <div className="space-y-4">
              {/* Print controls */}
              {formMode === "print" && (
                <div className="flex items-center gap-4 no-print mb-4">
                  <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Checkbox checked={withLetterhead} onCheckedChange={(v) => setWithLetterhead(!!v)} />
                    Usar papel timbrado
                  </label>
                </div>
              )}

              <div ref={printRef} className="bg-card rounded-xl border border-border p-8">
                {activeForm === "orden-compra" && (
                  <PurchaseOrderForm
                    items={items}
                    setItems={setItems}
                    addItem={addItem}
                    removeItem={removeItem}
                    updateItem={updateItem}
                    subtotal={subtotal}
                    itbis={itbis}
                    total={total}
                    fmtCurrency={fmtCurrency}
                    showSignature={formMode === "print"}
                  />
                )}
                {activeForm === "orden-servicio" && (
                  <ServiceOrderForm
                    items={items}
                    setItems={setItems}
                    addItem={addItem}
                    removeItem={removeItem}
                    updateItem={updateItem}
                    subtotal={subtotal}
                    itbis={itbis}
                    total={total}
                    fmtCurrency={fmtCurrency}
                    serviceType={serviceType}
                    setServiceType={setServiceType}
                    showSignature={formMode === "print"}
                  />
                )}
              </div>

              {/* Virtual submit */}
              {formMode === "virtual" && (
                <div className="flex justify-end gap-3 no-print">
                  <Button variant="outline" onClick={handleBack}>Cancelar</Button>
                  <Button onClick={handleVirtualSubmit} className="gap-2">
                    <Send className="h-4 w-4" /> Enviar para Aprobación
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ═══ MY REQUESTS ═══ */}
          {activeView === "my-requests" && !activeForm && (
            <div className="space-y-3" key={refreshKey}>
              {myRequests.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No tienes órdenes enviadas</p>
                  <p className="text-sm">Las órdenes que envíes por aprobación electrónica aparecerán aquí.</p>
                </div>
              ) : myRequests.map(req => (
                <div key={req.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-card-foreground text-sm">{req.id}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm font-medium text-card-foreground mt-1">{formConfig.find(f => f.key === req.formType)?.label}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(req.requestedAt), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <span className="font-heading font-bold text-primary">{fmtCurrency(req.total)}</span>
                  </div>
                  {req.items.length > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {req.items.slice(0, 3).map((it, i) => (
                        <div key={i}>{it.cantidad}x {it.descripcion} — {fmtCurrency(it.subtotal)}</div>
                      ))}
                      {req.items.length > 3 && <div>...y {req.items.length - 3} más</div>}
                    </div>
                  )}
                  {req.status === "Aprobada" && req.approvedBy && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprobada por {req.approvedBy}
                    </div>
                  )}
                  {req.status === "Rechazada" && req.rejectionReason && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Rechazada: {req.rejectionReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══ APPROVALS ═══ */}
          {activeView === "approvals" && !activeForm && (
            <div className="space-y-3" key={refreshKey}>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No hay órdenes pendientes</p>
                </div>
              ) : pendingApprovals.map(req => (
                <div key={req.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-card-foreground">{req.id}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-card-foreground mt-1">{formConfig.find(f => f.key === req.formType)?.label}</p>
                      <p className="text-xs text-muted-foreground">Por: {req.requestedByName} • {req.department} • {format(new Date(req.requestedAt), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <span className="font-heading font-bold text-primary">{fmtCurrency(req.total)}</span>
                  </div>
                  {/* Line items */}
                  {req.items.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden mb-3">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-muted">
                          <th className="text-left px-3 py-2 font-semibold text-card-foreground">Descripción</th>
                          <th className="text-right px-3 py-2 font-semibold text-card-foreground">Cant</th>
                          <th className="text-right px-3 py-2 font-semibold text-card-foreground">Precio</th>
                          <th className="text-right px-3 py-2 font-semibold text-card-foreground">Subtotal</th>
                        </tr></thead>
                        <tbody>
                          {req.items.map((it, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-3 py-2 text-card-foreground">{it.descripcion}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{it.cantidad}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{fmtCurrency(it.precio)}</td>
                              <td className="px-3 py-2 text-right text-card-foreground font-medium">{fmtCurrency(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="text-right text-xs space-y-0.5 mb-3">
                    <div className="text-muted-foreground">Subtotal: {fmtCurrency(req.subtotal)}</div>
                    <div className="text-muted-foreground">ITBIS (18%): {fmtCurrency(req.itbis)}</div>
                    <div className="font-bold text-card-foreground">Total: {fmtCurrency(req.total)}</div>
                  </div>
                  {/* Form data */}
                  {Object.entries(req.formData).filter(([, v]) => v).length > 0 && (
                    <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                      {Object.entries(req.formData).filter(([, v]) => v).map(([key, val]) => (
                        <div key={key}><span className="text-muted-foreground">{key}: </span><span className="text-card-foreground">{val}</span></div>
                      ))}
                    </div>
                  )}
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1" onClick={() => handleApprove(req.id)}>
                      <ThumbsUp className="h-3.5 w-3.5" /> Aprobar
                    </Button>
                    {rejectId === req.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input placeholder="Motivo del rechazo..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="text-sm" />
                        <Button size="sm" variant="destructive" onClick={() => handleReject(req.id)} disabled={!rejectReason.trim()}>Confirmar</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason(""); }}>×</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setRejectId(req.id)}>
                        <ThumbsDown className="h-3.5 w-3.5" /> Rechazar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

// ═══ STATUS BADGE ═══
function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Pendiente": "bg-amber-100 text-amber-800 border-amber-200",
    "Aprobada": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Rechazada": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", colorMap[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

// ═══ FORM FIELD HELPER ═══
function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-semibold text-card-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SignatureBlock() {
  return (
    <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-border">
      <div className="text-center">
        <div className="border-b border-foreground w-full mb-2 h-16" />
        <p className="text-sm text-muted-foreground">Solicitado por</p>
      </div>
      <div className="text-center">
        <div className="border-b border-foreground w-full mb-2 h-16" />
        <p className="text-sm text-muted-foreground">Aprobado por</p>
      </div>
    </div>
  );
}

// ═══ PURCHASE ORDER FORM (Orden de Compra) ═══
interface ItemFormProps {
  items: { tipo?: string; descripcion: string; cantidad: number; precio: number }[];
  setItems: (items: any[]) => void;
  addItem: () => void;
  removeItem: (i: number) => void;
  updateItem: (i: number, field: string, value: any) => void;
  subtotal: number;
  itbis: number;
  total: number;
  fmtCurrency: (n: number) => string;
  showSignature: boolean;
}

function PurchaseOrderForm({ items, addItem, removeItem, updateItem, subtotal, itbis, total, fmtCurrency, showSignature }: ItemFormProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="A Favor de"><Input placeholder="Nombre del proveedor" /></FormField>
        <FormField label="Fecha"><Input type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Dirección"><Input placeholder="Dirección del proveedor" /></FormField>
        <FormField label="RNC"><Input placeholder="RNC del proveedor" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Contacto"><Input placeholder="Persona de contacto" /></FormField>
        <FormField label="E-Mail"><Input type="email" placeholder="correo@proveedor.com" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Teléfono"><Input placeholder="809-XXX-XXXX" /></FormField>
        <FormField label="Orden de Compra No."><Input placeholder="OC-001" /></FormField>
      </div>
      <FormField label="Tipo de Servicio"><Input placeholder="Ej: Materiales gastables de oficina" /></FormField>

      {/* Line items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-card-foreground">Artículos</Label>
          <Button type="button" variant="outline" size="sm" className="gap-1 no-print" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-3 py-2 font-semibold text-card-foreground w-12">CANT</th>
                <th className="text-left px-3 py-2 font-semibold text-card-foreground">DESCRIPCIÓN</th>
                <th className="text-right px-3 py-2 font-semibold text-card-foreground w-28">PRECIO</th>
                <th className="text-right px-3 py-2 font-semibold text-card-foreground w-28">SUBTOTAL</th>
                <th className="w-10 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2"><Input type="number" min={1} value={item.cantidad} onChange={e => updateItem(i, "cantidad", parseInt(e.target.value) || 1)} className="w-16 text-center" /></td>
                  <td className="px-3 py-2"><Input value={item.descripcion} onChange={e => updateItem(i, "descripcion", e.target.value)} placeholder="Descripción del artículo" /></td>
                  <td className="px-3 py-2"><Input type="number" min={0} step={0.01} value={item.precio || ""} onChange={e => updateItem(i, "precio", parseFloat(e.target.value) || 0)} className="text-right" placeholder="0.00" /></td>
                  <td className="px-3 py-2 text-right font-medium text-card-foreground">{fmtCurrency(item.cantidad * item.precio)}</td>
                  <td className="px-2 no-print">
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right mt-3 space-y-1">
          <div className="text-sm text-muted-foreground">SUB TOTAL: <span className="font-medium text-card-foreground ml-2">{fmtCurrency(subtotal)}</span></div>
          <div className="text-sm text-muted-foreground">ITBIS (18%): <span className="font-medium text-card-foreground ml-2">{fmtCurrency(itbis)}</span></div>
          <div className="text-base font-bold text-foreground">TOTAL RD$: <span className="ml-2">{fmtCurrency(total)}</span></div>
        </div>
      </div>

      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ═══ SERVICE ORDER FORM (Orden de Servicio) ═══
interface ServiceOrderFormProps extends ItemFormProps {
  serviceType: string[];
  setServiceType: (types: string[]) => void;
}

function ServiceOrderForm({ items, addItem, removeItem, updateItem, subtotal, itbis, total, fmtCurrency, serviceType, setServiceType, showSignature }: ServiceOrderFormProps) {
  const toggleType = (type: string) => {
    setServiceType(serviceType.includes(type) ? serviceType.filter(t => t !== type) : [...serviceType, type]);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="A (Beneficiario)"><Input placeholder="Nombre del beneficiario" /></FormField>
        <FormField label="Fecha"><Input type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} /></FormField>
      </div>

      {/* Type checkboxes */}
      <div>
        <Label className="text-sm font-semibold text-card-foreground block mb-3">Tipo de Orden</Label>
        <div className="grid grid-cols-3 gap-3">
          {["Servicio", "Compra", "Pago", "Orden de Reparación", "Orden de Compra", "Tramitar Expediente"].map(type => (
            <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-card-foreground">
              <Checkbox checked={serviceType.includes(type)} onCheckedChange={() => toggleType(type)} />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* Line items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-card-foreground">Detalle</Label>
          <Button type="button" variant="outline" size="sm" className="gap-1 no-print" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-3 py-2 font-semibold text-card-foreground w-24">TIPO</th>
                <th className="text-left px-3 py-2 font-semibold text-card-foreground">DESCRIPCIÓN</th>
                <th className="text-right px-3 py-2 font-semibold text-card-foreground w-20">CANT</th>
                <th className="text-right px-3 py-2 font-semibold text-card-foreground w-28">PRECIO</th>
                <th className="text-right px-3 py-2 font-semibold text-card-foreground w-28">MONTO</th>
                <th className="w-10 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Select value={item.tipo || ""} onValueChange={v => updateItem(i, "tipo", v)}>
                      <SelectTrigger className="w-24"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="servicio">Servicio</SelectItem>
                        <SelectItem value="producto">Producto</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2"><Input value={item.descripcion} onChange={e => updateItem(i, "descripcion", e.target.value)} placeholder="Descripción" /></td>
                  <td className="px-3 py-2"><Input type="number" min={1} value={item.cantidad} onChange={e => updateItem(i, "cantidad", parseInt(e.target.value) || 1)} className="w-16 text-center" /></td>
                  <td className="px-3 py-2"><Input type="number" min={0} step={0.01} value={item.precio || ""} onChange={e => updateItem(i, "precio", parseFloat(e.target.value) || 0)} className="text-right" placeholder="0.00" /></td>
                  <td className="px-3 py-2 text-right font-medium text-card-foreground">{fmtCurrency(item.cantidad * item.precio)}</td>
                  <td className="px-2 no-print">
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right mt-3 space-y-1">
          <div className="text-sm text-muted-foreground">SUBTOTAL: <span className="font-medium text-card-foreground ml-2">{fmtCurrency(subtotal)}</span></div>
          <div className="text-sm text-muted-foreground">ITBIS (18%): <span className="font-medium text-card-foreground ml-2">{fmtCurrency(itbis)}</span></div>
          <div className="text-base font-bold text-foreground">TOTAL: <span className="ml-2">{fmtCurrency(total)}</span></div>
        </div>
      </div>

      <FormField label="Comentario Adicional"><Textarea placeholder="Observaciones o instrucciones adicionales..." rows={3} /></FormField>

      {showSignature && <SignatureBlock />}
    </div>
  );
}

export default AdminForms;
