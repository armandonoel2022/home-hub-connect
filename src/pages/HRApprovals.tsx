import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  getAllHRRequests,
  approveBySupervisor, approveByRRHH, rejectRequest,
  escalateLoanToGerencia, approveLoanByGerencia, applyLoan,
} from "@/lib/hrRequestService";
import { HR_FORM_LABELS, type HRRequest } from "@/lib/hrRequestTypes";
import { CheckCircle2, XCircle, Clock, Printer, Inbox, Filter, ArrowUpRight } from "lucide-react";

const statusColor: Record<string, string> = {
  "Pendiente Supervisor": "bg-amber-500/10 text-amber-700 border-amber-200",
  "Pendiente RRHH": "bg-blue-500/10 text-blue-700 border-blue-200",
  "Pendiente Gerencia General": "bg-purple-500/10 text-purple-700 border-purple-200",
  "Pendiente Aplicación RRHH": "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  "Aprobada": "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  "Rechazada": "bg-red-500/10 text-red-700 border-red-200",
};

const HRApprovals = () => {
  const { user, activeUsers } = useAuth();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [filterType, setFilterType] = useState<string>("");
  const [filterText, setFilterText] = useState("");
  const [tab, setTab] = useState("pendientes");

  const [rejectTarget, setRejectTarget] = useState<HRRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loanTarget, setLoanTarget] = useState<HRRequest | null>(null);
  const [loanAction, setLoanAction] = useState<"escalate-gerencia" | "approve-gerencia" | "apply" | null>(null);
  const [loanComment, setLoanComment] = useState("");
  const [loanApplyDate, setLoanApplyDate] = useState("");

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener("safeone:hr-updated", h);
    return () => window.removeEventListener("safeone:hr-updated", h);
  }, []);

  const rrhhUserIds = activeUsers.filter((u) => u.department === "Recursos Humanos").map((u) => u.id);
  const gerenciaApprover = activeUsers.find((u) => u.fullName === "Aurelio Pérez");
  const isRRHH = user?.department === "Recursos Humanos";
  const isGerenciaApprover = user?.id === gerenciaApprover?.id;

  const myPending = useMemo<HRRequest[]>(() => {
    if (!user) return [];
    return getAllHRRequests().filter((r) => {
      if (r.status === "Pendiente Supervisor" && r.supervisorId === user.id) return true;
      if (r.status === "Pendiente RRHH" && isRRHH) return true;
      if (r.status === "Pendiente Gerencia General" && isGerenciaApprover) return true;
      if (r.status === "Pendiente Aplicación RRHH" && isRRHH) return true;
      return false;
    });
  }, [user, isRRHH, isGerenciaApprover, tick]);

  const myHistory = useMemo<HRRequest[]>(() => {
    if (!user) return [];
    return getAllHRRequests().filter((r) => {
      const involvedSupervisor = r.supervisorId === user.id;
      const involvedRRHH = isRRHH && (r.rrhhApproval?.by === user.id || r.status === "Aprobada" || r.status === "Rechazada");
      const involvedGerencia = isGerenciaApprover && r.formType === "prestamos";
      return (involvedSupervisor || involvedRRHH || involvedGerencia) && (r.status === "Aprobada" || r.status === "Rechazada");
    });
  }, [user, isRRHH, isGerenciaApprover, tick]);

  const applyFilters = (list: HRRequest[]) => {
    const q = filterText.toLowerCase();
    return list.filter((r) =>
      (!filterType || r.formType === filterType) &&
      (!q || `${r.id} ${r.requestedByName} ${HR_FORM_LABELS[r.formType] || ""} ${r.status}`.toLowerCase().includes(q))
    );
  };

  const handleApprove = (req: HRRequest) => {
    if (!user) return;
    let result: HRRequest | null = null;
    if (req.status === "Pendiente Supervisor") {
      result = approveBySupervisor(req.id, user.id, user.fullName);
    } else if (req.status === "Pendiente RRHH" && req.formType !== "prestamos") {
      result = approveByRRHH(req.id, user.id, user.fullName);
    } else if (req.status === "Pendiente RRHH" && req.formType === "prestamos") {
      // RRHH escala a Gerencia
      if (!gerenciaApprover?.id) {
        toast({ title: "Error", description: "No se encontró aprobador de Gerencia.", variant: "destructive" });
        return;
      }
      result = escalateLoanToGerencia(req.id, user.id, user.fullName, gerenciaApprover.id);
    } else if (req.status === "Pendiente Gerencia General") {
      result = approveLoanByGerencia(req.id, user.id, user.fullName, undefined, rrhhUserIds);
    }
    if (result) {
      toast({ title: "Aprobada", description: `Solicitud ${req.id} avanzada.` });
      setTick((t) => t + 1);
    }
  };

  const confirmReject = () => {
    if (!user || !rejectTarget || !rejectReason.trim()) return;
    rejectRequest(rejectTarget.id, user.id, user.fullName, rejectReason);
    toast({ title: "Rechazada", description: `Solicitud ${rejectTarget.id} rechazada.`, variant: "destructive" });
    setRejectTarget(null);
    setRejectReason("");
    setTick((t) => t + 1);
  };

  const openLoanAction = (req: HRRequest, action: "escalate-gerencia" | "approve-gerencia" | "apply") => {
    setLoanTarget(req);
    setLoanAction(action);
    setLoanComment("");
    setLoanApplyDate("");
  };

  const confirmLoanAction = () => {
    if (!user || !loanTarget || !loanAction) return;
    let result: HRRequest | null = null;
    if (loanAction === "escalate-gerencia" && gerenciaApprover?.id) {
      result = escalateLoanToGerencia(loanTarget.id, user.id, user.fullName, gerenciaApprover.id, loanComment);
    } else if (loanAction === "approve-gerencia") {
      result = approveLoanByGerencia(loanTarget.id, user.id, user.fullName, loanComment, rrhhUserIds);
    } else if (loanAction === "apply") {
      if (!loanApplyDate) {
        toast({ title: "Fecha requerida", variant: "destructive" });
        return;
      }
      result = applyLoan(loanTarget.id, user.id, user.fullName, loanApplyDate, loanComment);
    }
    if (result) {
      toast({ title: "Acción registrada", description: `Solicitud ${result.id} actualizada.` });
      setLoanTarget(null);
      setLoanAction(null);
      setTick((t) => t + 1);
    }
  };

  if (!user) return null;

  const renderCard = (r: HRRequest) => (
    <Card key={r.id} className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-[10px]">{r.id}</Badge>
            <span className="font-semibold">{HR_FORM_LABELS[r.formType]}</span>
            <Badge className={`border ${statusColor[r.status] || ""}`}>{r.status}</Badge>
          </div>
          <p className="text-sm mt-1">
            <strong>{r.requestedByName}</strong> · {r.department}
          </p>
          <p className="text-xs text-muted-foreground">
            Enviada el {new Date(r.requestedAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="text-xs text-muted-foreground mt-2 grid grid-cols-1 md:grid-cols-2 gap-1">
            {Object.entries(r.formData).slice(0, 6).map(([k, v]) => (
              <div key={k}><strong>{k}:</strong> {String(v)}</div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {r.status === "Aprobada" && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate(`/rrhh/imprimir/${r.id}`)}>
              <Printer className="h-3 w-3" /> Imprimir
            </Button>
          )}
          {(r.status === "Pendiente Supervisor" || (r.status === "Pendiente RRHH" && r.formType !== "prestamos")) && (
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(r)}>
              <CheckCircle2 className="h-3 w-3" /> Aprobar
            </Button>
          )}
          {r.status === "Pendiente RRHH" && r.formType === "prestamos" && isRRHH && (
            <Button size="sm" className="gap-2" onClick={() => openLoanAction(r, "escalate-gerencia")}>
              <ArrowUpRight className="h-3 w-3" /> Escalar a Gerencia
            </Button>
          )}
          {r.status === "Pendiente Gerencia General" && isGerenciaApprover && (
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => openLoanAction(r, "approve-gerencia")}>
              <CheckCircle2 className="h-3 w-3" /> Aprobar préstamo
            </Button>
          )}
          {r.status === "Pendiente Aplicación RRHH" && isRRHH && (
            <Button size="sm" className="gap-2" onClick={() => openLoanAction(r, "apply")}>
              <CheckCircle2 className="h-3 w-3" /> Aplicar préstamo
            </Button>
          )}
          {r.status.startsWith("Pendiente") && (
            <Button size="sm" variant="destructive" className="gap-2" onClick={() => setRejectTarget(r)}>
              <XCircle className="h-3 w-3" /> Rechazar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" /> Bandeja de Aprobaciones RRHH
          </h1>
          <p className="text-sm text-muted-foreground">
            Solicitudes de tu personal o que necesitan tu aprobación según tu rol.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Pendientes</div><div className="text-2xl font-bold text-amber-600">{myPending.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Histórico aprobadas</div><div className="text-2xl font-bold text-emerald-600">{myHistory.filter((r) => r.status === "Aprobada").length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Histórico rechazadas</div><div className="text-2xl font-bold text-red-600">{myHistory.filter((r) => r.status === "Rechazada").length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Rol</div><div className="text-sm font-semibold">{[isRRHH && "RRHH", isGerenciaApprover && "Gerencia", "Supervisor"].filter(Boolean).join(" · ")}</div></Card>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select className="border rounded px-2 py-1 text-sm bg-background" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(HR_FORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input placeholder="Buscar ID, nombre, estado…" value={filterText} onChange={(e) => setFilterText(e.target.value)} className="max-w-xs" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pendientes">Pendientes ({myPending.length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({myHistory.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pendientes" className="space-y-3 mt-4">
            {applyFilters(myPending).length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No tienes solicitudes pendientes de aprobar.
              </div>
            ) : applyFilters(myPending).map(renderCard)}
          </TabsContent>
          <TabsContent value="historico" className="space-y-3 mt-4">
            {applyFilters(myHistory).length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Aún no hay registros históricos.
              </div>
            ) : applyFilters(myHistory).map(renderCard)}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud {rejectTarget?.id}</DialogTitle>
            <DialogDescription>Explica el motivo del rechazo. Esto se enviará al solicitante.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo del rechazo…" rows={4} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan action dialog */}
      <Dialog open={!!loanTarget} onOpenChange={(o) => !o && (setLoanTarget(null), setLoanAction(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {loanAction === "escalate-gerencia" && "Escalar préstamo a Gerencia General"}
              {loanAction === "approve-gerencia" && "Aprobar préstamo (Gerencia General)"}
              {loanAction === "apply" && "Aplicar préstamo"}
            </DialogTitle>
          </DialogHeader>
          {loanAction === "apply" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold">Fecha de aplicación</label>
              <Input type="date" value={loanApplyDate} onChange={(e) => setLoanApplyDate(e.target.value)} />
            </div>
          )}
          <Textarea value={loanComment} onChange={(e) => setLoanComment(e.target.value)} placeholder="Comentario u observación (opcional)" rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLoanTarget(null); setLoanAction(null); }}>Cancelar</Button>
            <Button onClick={confirmLoanAction}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default HRApprovals;
