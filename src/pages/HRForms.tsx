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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Printer, CalendarIcon, Palmtree, CalendarOff, UtensilsCrossed,
  UserX, PartyPopper, Clock, Banknote, CheckCircle2, Send, FileText,
  ThumbsUp, ThumbsDown, AlertCircle, Inbox,
} from "lucide-react";
import safeOneLogo from "@/assets/safeone-logo.png";
import safeOneLetterhead from "@/assets/safeone-letterhead.png";
import type { HRRequest, HRFormType } from "@/lib/hrRequestTypes";
import {
  getAllHRRequests, getRequestsByUser,
  createHRRequest, approveBySupervisor, approveByRRHH,
  rejectRequest, generateRequestId, getNotificationsForUser, markAllNotificationsRead,
} from "@/lib/hrRequestService";

type FormType = "vacaciones" | "dias-libres" | "comida" | "ausencias" | "feriados" | "permisos" | "prestamos";
type FormMode = "print" | "virtual";

const formConfig: { key: FormType; label: string; icon: any; color: string }[] = [
  { key: "vacaciones", label: "Vacaciones", icon: Palmtree, color: "hsl(160 60% 40%)" },
  { key: "dias-libres", label: "Días Libres", icon: CalendarOff, color: "hsl(200 70% 50%)" },
  { key: "comida", label: "Comida", icon: UtensilsCrossed, color: "hsl(30 80% 55%)" },
  { key: "ausencias", label: "Ausencias", icon: UserX, color: "hsl(0 60% 50%)" },
  { key: "feriados", label: "Días Feriados", icon: PartyPopper, color: "hsl(280 50% 50%)" },
  { key: "permisos", label: "Permisos", icon: Clock, color: "hsl(42 100% 50%)" },
  { key: "prestamos", label: "Solicitud de Préstamos", icon: Banknote, color: "hsl(220 15% 30%)" },
];

type ActiveView = "forms" | "my-requests" | "approvals";

const HRForms = () => {
  const navigate = useNavigate();
  const { user, allUsers } = useAuth();
  const { toast } = useToast();
  const [activeForm, setActiveForm] = useState<FormType | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [withLetterhead, setWithLetterhead] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("forms");
  const [refreshKey, setRefreshKey] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);
  const virtualFormRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const letterheadBg = withLetterhead
      ? `background-image: url('${new URL(safeOneLetterhead, window.location.origin).href}'); background-size: 100% 100%; background-repeat: no-repeat; background-position: center;`
      : "";

    const headerHtml = withLetterhead
      ? "" // The letterhead image already has the logo/header
      : `<div style="text-align:center;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:24px;">
          <img src="${new URL(safeOneLogo, window.location.origin).href}" style="max-height:56px;display:block;margin:0 auto 8px;" />
          <h2 style="font-size:18px;font-weight:700;">SafeOne Group — Recursos Humanos</h2>
          <p style="font-size:13px;color:#666;margin-top:4px;">${formConfig.find(f => f.key === activeForm)?.label || ""}</p>
          <p style="font-size:11px;color:#999;margin-top:4px;">Fecha: ${format(new Date(), "dd/MM/yyyy")}</p>
         </div>`;

    const footerHtml = withLetterhead
      ? "" // The letterhead image already has the footer
      : `<div style="text-align:center;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:12px;margin-top:24px;">
          <p>Tel: 809.548.3100 • info@safeone.com.do • www.safeone.com.do | RNC: 101526752</p>
          <p>C/ Olof Palme esq. Cul de Sac 2, San Gerónimo, Santo Domingo, D.N.</p>
         </div>`;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Formulario RRHH — SafeOne</title><style>
      @page { size: A4; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }
      .page { 
        width: 210mm; min-height: 297mm; position: relative;
        ${letterheadBg}
        margin: 0 auto;
      }
      .content-area {
        ${withLetterhead ? "padding: 180px 60px 100px 60px;" : "padding: 40px 50px;"}
      }
      .form-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
      .form-date { font-size: 11px; color: #666; text-align: right; margin-bottom: 16px; }
      label { font-size: 12px; font-weight: 600; display: block; margin-bottom: 3px; color: #333; }
      input, textarea, select, [data-radix-select-trigger] { 
        width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; font-size: 12px; background: #fff; 
      }
      textarea { min-height: 50px; resize: vertical; }
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .form-field { margin-bottom: 12px; }
      .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 20px; border-top: 1px solid #ddd; }
      .sig-block div { text-align: center; }
      .sig-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 6px; }
      .sig-label { font-size: 11px; color: #666; }
      button { display: none !important; }
      @media print { 
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { width: 100%; min-height: 100vh; }
      }
    </style></head><body>
    <div class="page">
      <div class="content-area">
        ${headerHtml}
        <div class="form-title">${formConfig.find(f => f.key === activeForm)?.label || ""}</div>
        <div class="form-date">Fecha: ${format(new Date(), "dd/MM/yyyy")}</div>
        ${content.innerHTML}
        ${footerHtml}
      </div>
    </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  // Find supervisor for current user
  const supervisor = allUsers.find((u) => u.id === user?.reportsTo);
  const rrhhLeader = allUsers.find((u) => u.department === "Recursos Humanos" && u.isDepartmentLeader);
  const isRRHH = user?.department === "Recursos Humanos";
  const isSupervisor = user?.isDepartmentLeader === true || user?.isAdmin === true;

  const handleVirtualSubmit = () => {
    if (!user || !activeForm || !virtualFormRef.current) return;
    const formEl = virtualFormRef.current;
    
    // Collect all input/textarea/select values
    const formData: Record<string, string> = {};
    formEl.querySelectorAll("input, textarea").forEach((el) => {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      const label = input.closest(".space-y-1\\.5")?.querySelector("label")?.textContent || "";
      if (label) formData[label] = input.value;
    });
    // Also collect date picker button text
    formEl.querySelectorAll("button[data-state]").forEach((el) => {
      const btn = el as HTMLButtonElement;
      const label = btn.closest(".space-y-1\\.5")?.querySelector("label")?.textContent || "";
      const text = btn.textContent?.trim() || "";
      if (label && text && text !== "Seleccionar fecha") formData[label] = text;
    });

    // Validate required dates for vacation
    if (activeForm === "vacaciones") {
      if (!formData["Fecha de Inicio"] || !formData["Fecha de Fin"]) {
        toast({ title: "Campos requeridos", description: "Debe seleccionar la fecha de inicio y fin de las vacaciones.", variant: "destructive" });
        return;
      }
    }

    if (!supervisor && !user.isAdmin) {
      toast({ title: "Error", description: "No se encontró un supervisor asignado. Contacte a RRHH.", variant: "destructive" });
      return;
    }

    const request: HRRequest = {
      id: generateRequestId(),
      formType: activeForm as HRFormType,
      status: "Pendiente Supervisor",
      requestedBy: user.id,
      requestedByName: user.fullName,
      department: user.department,
      requestedAt: new Date().toISOString(),
      formData,
      supervisorId: supervisor?.id || rrhhLeader?.id || "",
      supervisorName: supervisor?.fullName || rrhhLeader?.fullName || "N/A",
      supervisorApproval: null,
      rrhhApproval: null,
      rejectionReason: null,
      rejectedBy: null,
      rejectedAt: null,
    };

    createHRRequest(request);
    setRefreshKey((k) => k + 1);
    toast({
      title: "Solicitud Enviada",
      description: `Tu solicitud de ${formConfig.find(f => f.key === activeForm)?.label} fue enviada a ${request.supervisorName} para aprobación.`,
    });
    setActiveForm(null);
    setFormMode(null);
    setActiveView("my-requests");
  };

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [coverPerson, setCoverPerson] = useState("");
  const [approveId, setApproveId] = useState<string | null>(null);

  const handleApprove = (req: HRRequest) => {
    if (!user) return;
    // For vacaciones, require cover person when supervisor approves
    if (req.formType === "vacaciones" && req.status === "Pendiente Supervisor") {
      if (approveId !== req.id) {
        setApproveId(req.id);
        return;
      }
    }
    let result: HRRequest | null = null;
    if (req.status === "Pendiente Supervisor") {
      result = approveBySupervisor(req.id, user.id, user.fullName, undefined, req.formType === "vacaciones" ? coverPerson : undefined);
    } else if (req.status === "Pendiente RRHH") {
      result = approveByRRHH(req.id, user.id, user.fullName);
    }
    if (result) {
      setApproveId(null);
      setCoverPerson("");
      setRefreshKey((k) => k + 1);
      toast({ title: "Aprobada", description: `Solicitud ${req.id} aprobada exitosamente.` });
    }
  };

  const handleReject = (reqId: string) => {
    if (!user || !rejectReason.trim()) return;
    rejectRequest(reqId, user.id, user.fullName, rejectReason);
    setRejectId(null);
    setRejectReason("");
    setRefreshKey((k) => k + 1);
    toast({ title: "Rechazada", description: `Solicitud ${reqId} fue rechazada.`, variant: "destructive" });
  };

  const handleBack = () => {
    if (formMode) { setFormMode(null); }
    else if (activeForm) { setActiveForm(null); }
    else if (activeView !== "forms") { setActiveView("forms"); }
    else { navigate("/"); }
  };

  // HR Notifications
  const hrNotifications = user ? getNotificationsForUser(user.id) : [];
  const unreadNotifs = hrNotifications.filter((n) => !n.read);

  const handleDismissNotifications = () => {
    if (user) { markAllNotificationsRead(user.id); setRefreshKey((k) => k + 1); }
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
          <div className="flex items-center gap-3 mb-6 no-print">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {activeForm ? formConfig.find(f => f.key === activeForm)?.label : "Recursos Humanos — Formularios"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formMode === "print" ? "Formulario para imprimir y firmar"
                  : formMode === "virtual" ? "Aprobación virtual — completar y enviar"
                  : activeForm ? "Seleccione modalidad"
                  : activeView === "my-requests" ? "Historial de solicitudes"
                  : activeView === "approvals" ? "Solicitudes pendientes de aprobación"
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
                <Send className="h-4 w-4" /> Mis Solicitudes
                {myRequests.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{myRequests.length}</Badge>}
              </Button>
              {(isSupervisor || isRRHH) && (
                <Button variant={activeView === "approvals" ? "default" : "outline"} size="sm" onClick={() => setActiveView("approvals")} className="gap-2">
                  <Inbox className="h-4 w-4" /> Aprobaciones
                  {pendingApprovals.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{pendingApprovals.length}</Badge>}
                </Button>
              )}
            </div>
          )}

          {/* ═══ FORMS VIEW ═══ */}
          {activeView === "forms" && !activeForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {formConfig.map(fc => {
                const Icon = fc.icon;
                return (
                  <button key={fc.key} onClick={() => { setActiveForm(fc.key); setFormMode(null); }}
                    className="group flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary transition-all text-left">
                    <div className="p-3 rounded-xl" style={{ background: fc.color + "22" }}>
                      <Icon className="h-6 w-6" style={{ color: fc.color }} />
                    </div>
                    <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors">{fc.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ═══ MY REQUESTS VIEW ═══ */}
          {activeView === "my-requests" && !activeForm && (
            <div className="space-y-3" key={refreshKey}>
              {myRequests.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No tienes solicitudes enviadas</p>
                  <p className="text-sm">Las solicitudes que envíes por aprobación virtual aparecerán aquí.</p>
                </div>
              ) : myRequests.map((req) => (
                <RequestCard key={req.id} req={req} />
              ))}
            </div>
          )}

          {/* ═══ APPROVALS VIEW ═══ */}
          {activeView === "approvals" && !activeForm && (
            <div className="space-y-3" key={refreshKey}>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No hay solicitudes pendientes</p>
                  <p className="text-sm">Todas las solicitudes han sido procesadas.</p>
                </div>
              ) : pendingApprovals.map((req) => (
                <div key={req.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-card-foreground">{req.id}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formConfig.find(f => f.key === req.formType)?.label} — Solicitado por <strong>{req.requestedByName}</strong> ({req.department})
                      </p>
                      <p className="text-xs text-muted-foreground">{format(new Date(req.requestedAt), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                  </div>
                  {/* Show form data */}
                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    {Object.entries(req.formData).map(([key, val]) => val && (
                      <div key={key}>
                        <span className="text-muted-foreground text-xs">{key}:</span>
                        <span className="ml-1 text-card-foreground font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                  {rejectId === req.id ? (
                    <div className="space-y-2">
                      <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo del rechazo..." rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleReject(req.id)} disabled={!rejectReason.trim()}>Confirmar Rechazo</Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : approveId === req.id && req.formType === "vacaciones" ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-sm font-medium text-card-foreground">¿Quién cubrirá durante las vacaciones?</p>
                      <Input
                        value={coverPerson}
                        onChange={(e) => setCoverPerson(e.target.value)}
                        placeholder="Nombre de la persona que cubrirá..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1" onClick={() => handleApprove(req)}>
                          <ThumbsUp className="h-3.5 w-3.5" /> Confirmar Aprobación
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setApproveId(null); setCoverPerson(""); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1" onClick={() => handleApprove(req)}>
                        <ThumbsUp className="h-3.5 w-3.5" /> Aprobar
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => setRejectId(req.id)}>
                        <ThumbsDown className="h-3.5 w-3.5" /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Mode selection */}
          {activeForm && !formMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
              <button onClick={() => setFormMode("print")}
                className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all">
                <div className="p-4 rounded-xl bg-muted">
                  <Printer className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">Imprimir para Firmar</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Genera el formulario con membrete para firma física</span>
                </div>
              </button>
              <button onClick={() => setFormMode("virtual")}
                className="group flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-border bg-card hover:border-primary transition-all">
                <div className="p-4 rounded-xl bg-muted">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-heading font-bold text-card-foreground group-hover:text-primary transition-colors block">Aprobación Virtual</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Envía para aprobación del supervisor y RRHH</span>
                </div>
              </button>
            </div>
          )}

          {/* Step 3a: Print mode */}
          {activeForm && formMode === "print" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <Switch id="letterhead" checked={withLetterhead} onCheckedChange={setWithLetterhead} />
                  <Label htmlFor="letterhead" className="text-sm font-medium text-foreground cursor-pointer">
                    {withLetterhead ? "Con Membrete" : "Sin Membrete"}
                  </Label>
                </div>
                <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
              </div>
              <div ref={printRef} className="print-area bg-card rounded-xl border border-border p-8">
                <RenderForm formType={activeForm} userName={user?.fullName || ""} department={user?.department || ""} />
              </div>
            </div>
          )}

          {/* Step 3b: Virtual mode — FUNCTIONAL */}
          {activeForm && formMode === "virtual" && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-card rounded-xl border border-border p-8">
                <div className="text-center mb-6 border-b border-border pb-4">
                  <img src={safeOneLogo} alt="SafeOne" className="h-12 mx-auto mb-2" />
                  <h2 className="text-xl font-heading font-bold text-card-foreground">
                    {formConfig.find(f => f.key === activeForm)?.label}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Aprobación Virtual</p>
                  {supervisor && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Será enviada a: <strong>{supervisor.fullName}</strong> ({supervisor.position})
                      {rrhhLeader && <> → luego a <strong>{rrhhLeader.fullName}</strong> (RRHH)</>}
                    </p>
                  )}
                </div>
                <div ref={virtualFormRef}>
                  <RenderForm formType={activeForm} userName={user?.fullName || ""} department={user?.department || ""} showSignature={false} />
                </div>
                <div className="mt-6 pt-4 border-t border-border">
                  <Button className="w-full gap-2" onClick={handleVirtualSubmit}>
                    <Send className="h-4 w-4" /> Enviar para Aprobación
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </div>
    </AppLayout>
  );
};

// ── Status badge ──
function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Pendiente Supervisor": "bg-amber-100 text-amber-800 border-amber-200",
    "Aprobada Supervisor": "bg-blue-100 text-blue-800 border-blue-200",
    "Pendiente RRHH": "bg-orange-100 text-orange-800 border-orange-200",
    "Aprobada": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Rechazada": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", colorMap[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

// ── Request card for "Mis Solicitudes" ──
function RequestCard({ req }: { req: HRRequest }) {
  const fc = formConfig.find(f => f.key === req.formType);
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-card-foreground text-sm">{req.id}</span>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-sm font-medium text-card-foreground mt-1">{fc?.label}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(req.requestedAt), "dd/MM/yyyy HH:mm")}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
        {Object.entries(req.formData).filter(([, v]) => v).slice(0, 6).map(([key, val]) => (
          <div key={key}>
            <span className="text-muted-foreground">{key}: </span>
            <span className="text-card-foreground">{val}</span>
          </div>
        ))}
      </div>
      {/* Approval timeline */}
      <div className="mt-3 pt-3 border-t border-border flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {req.supervisorApproval ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5" />}
          Supervisor: {req.supervisorApproval ? `${req.supervisorApproval.byName} ✓` : req.supervisorName}
        </div>
        <div className="flex items-center gap-1">
          {req.rrhhApproval ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5" />}
          RRHH: {req.rrhhApproval ? `${req.rrhhApproval.byName} ✓` : "Pendiente"}
        </div>
      </div>
      {req.supervisorApproval?.coverPerson && (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Persona que cubre:</span> {req.supervisorApproval.coverPerson}
        </div>
      )}
      {req.status === "Rechazada" && req.rejectionReason && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Rechazada: {req.rejectionReason}</span>
        </div>
      )}
    </div>
  );
}


function PrintHeader({ title }: { title: string }) {
  return (
    <div className="text-center mb-6 border-b border-border pb-4 print-header">
      <img src={safeOneLogo} alt="SafeOne" className="h-14 mx-auto mb-2" />
      <h2 className="text-xl font-heading font-bold text-card-foreground">SafeOne Group — Recursos Humanos</h2>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">Fecha de generación: {format(new Date(), "dd/MM/yyyy")}</p>
    </div>
  );
}

// ── Print footer with company info ──
function PrintFooter() {
  return (
    <div className="hidden print-footer-block text-center text-xs text-muted-foreground border-t border-border pt-3 mt-6">
      <p>Tel: 809.548.3100 • info@safeone.com.do • www.safeone.com.do &nbsp;|&nbsp; RNC: 101526752</p>
      <p>C/ Olof Palme esq. Cul de Sac 2, San Gerónimo, Santo Domingo, D.N.</p>
    </div>
  );
}

// ── Form router ──
function RenderForm({ formType, userName, department, showSignature = true }: { formType: FormType; userName: string; department: string; showSignature?: boolean }) {
  switch (formType) {
    case "vacaciones": return <VacationForm userName={userName} department={department} showSignature={showSignature} />;
    case "dias-libres": return <DaysOffForm userName={userName} department={department} showSignature={showSignature} />;
    case "comida": return <MealForm userName={userName} department={department} showSignature={showSignature} />;
    case "ausencias": return <AbsenceForm userName={userName} department={department} showSignature={showSignature} />;
    case "feriados": return <HolidaysForm />;
    case "permisos": return <PermissionsForm userName={userName} department={department} showSignature={showSignature} />;
    case "prestamos": return <LoanForm userName={userName} department={department} showSignature={showSignature} />;
    default: return null;
  }
}

// ── Helpers ──
function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-semibold text-card-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DatePickerField({ label, date, setDate }: { label: string; date: Date | undefined; setDate: (d: Date | undefined) => void }) {
  return (
    <FormField label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy") : "Seleccionar fecha"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </FormField>
  );
}

function SignatureBlock() {
  return (
    <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-border">
      <div className="text-center">
        <div className="border-b border-foreground w-full mb-2 h-16" />
        <p className="text-sm text-muted-foreground">Firma del Solicitante</p>
      </div>
      <div className="text-center">
        <div className="border-b border-foreground w-full mb-2 h-16" />
        <p className="text-sm text-muted-foreground">Firma del Supervisor / RRHH</p>
      </div>
    </div>
  );
}

// ── Vacation form ──
function VacationForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Auto-calculate business days
  const calcDays = (start?: Date, end?: Date): number => {
    if (!start || !end || end <= start) return 0;
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };
  const daysRequested = calcDays(startDate, endDate);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} readOnly /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} readOnly /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha de Inicio" date={startDate} setDate={setStartDate} />
        <DatePickerField label="Fecha de Fin" date={endDate} setDate={setEndDate} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Días Solicitados">
          <Input type="number" value={daysRequested} readOnly className="font-bold" />
          {daysRequested > 0 && <p className="text-xs text-muted-foreground mt-1">Días laborables calculados automáticamente</p>}
        </FormField>
        <FormField label="Días Disponibles">
          <Input type="number" placeholder="A completar por RRHH" readOnly className="bg-muted" />
          <p className="text-xs text-muted-foreground mt-1">RRHH indicará los días restantes</p>
        </FormField>
      </div>
      <FormField label="Motivo / Observaciones"><Textarea placeholder="Describa el motivo de sus vacaciones..." rows={3} /></FormField>
      <FormField label="Contacto durante Vacaciones"><Input placeholder="Teléfono o email de contacto" /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Days off form ──
function DaysOffForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [date, setDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha del Día Libre" date={date} setDate={setDate} />
        <FormField label="Tipo de Día Libre">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compensatorio">Compensatorio</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Justificación"><Textarea placeholder="Motivo del día libre..." rows={3} /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Meal form ──
function MealForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [date, setDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha" date={date} setDate={setDate} />
        <FormField label="Tipo de Comida">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="almuerzo">Almuerzo</SelectItem>
              <SelectItem value="cena">Cena</SelectItem>
              <SelectItem value="merienda">Merienda</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Cantidad de Personas"><Input type="number" min={1} defaultValue={1} /></FormField>
      <FormField label="Observaciones"><Textarea placeholder="Preferencias alimentarias, alergias, etc." rows={3} /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Absence form ──
function AbsenceForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha de Inicio" date={startDate} setDate={setStartDate} />
        <DatePickerField label="Fecha de Fin" date={endDate} setDate={setEndDate} />
      </div>
      <FormField label="Motivo de Ausencia">
        <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="enfermedad">Enfermedad</SelectItem>
            <SelectItem value="emergencia-familiar">Emergencia Familiar</SelectItem>
            <SelectItem value="cita-medica">Cita Médica</SelectItem>
            <SelectItem value="duelo">Duelo</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Descripción"><Textarea placeholder="Detalle de la ausencia..." rows={3} /></FormField>
      <FormField label="¿Tiene soporte médico o documental?">
        <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="pendiente">Pendiente de entrega</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Holidays form ──
function HolidaysForm() {
  const holidays = [
    { date: "01 de Enero", name: "Año Nuevo" },
    { date: "06 de Enero", name: "Día de los Santos Reyes" },
    { date: "21 de Enero", name: "Día de la Altagracia" },
    { date: "26 de Enero", name: "Día de Duarte" },
    { date: "27 de Febrero", name: "Día de la Independencia" },
    { date: "Marzo/Abril", name: "Viernes Santo" },
    { date: "01 de Mayo", name: "Día del Trabajo" },
    { date: "Junio", name: "Corpus Christi" },
    { date: "16 de Agosto", name: "Día de la Restauración" },
    { date: "24 de Septiembre", name: "Día de la Virgen de las Mercedes" },
    { date: "06 de Noviembre", name: "Día de la Constitución" },
    { date: "25 de Diciembre", name: "Navidad" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Calendario oficial de días feriados no laborables — República Dominicana {new Date().getFullYear()}
      </p>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left px-4 py-3 font-semibold text-card-foreground">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-card-foreground">Día Feriado</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2.5 text-muted-foreground">{h.date}</td>
                <td className="px-4 py-2.5 text-card-foreground font-medium">{h.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Permissions form ──
function PermissionsForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  const [date, setDate] = useState<Date>();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DatePickerField label="Fecha del Permiso" date={date} setDate={setDate} />
        <FormField label="Tipo de Permiso">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="llegada-tarde">Llegada Tarde</SelectItem>
              <SelectItem value="salida-temprano">Salida Temprano</SelectItem>
              <SelectItem value="ausencia-parcial">Ausencia Parcial</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Hora de Salida"><Input type="time" /></FormField>
        <FormField label="Hora de Regreso (estimada)"><Input type="time" /></FormField>
      </div>
      <FormField label="Motivo"><Textarea placeholder="Describa el motivo del permiso..." rows={3} /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

// ── Loan form ──
function LoanForm({ userName, department, showSignature }: { userName: string; department: string; showSignature: boolean }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre del Empleado"><Input defaultValue={userName} /></FormField>
        <FormField label="Departamento"><Input defaultValue={department} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Monto Solicitado (RD$)"><Input type="number" min={0} placeholder="Ej: 15,000" /></FormField>
        <FormField label="Plazo de Pago">
          <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Mes</SelectItem>
              <SelectItem value="2">2 Meses</SelectItem>
              <SelectItem value="3">3 Meses</SelectItem>
              <SelectItem value="6">6 Meses</SelectItem>
              <SelectItem value="12">12 Meses</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Modalidad de Descuento">
        <Select><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="quincenal">Quincenal</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Motivo del Préstamo"><Textarea placeholder="Describa para qué necesita el préstamo..." rows={3} /></FormField>
      <FormField label="Antigüedad en la Empresa"><Input placeholder="Ej: 2 años y 3 meses" /></FormField>
      {showSignature && <SignatureBlock />}
    </div>
  );
}

export default HRForms;
