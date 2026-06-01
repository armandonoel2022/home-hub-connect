import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  getNotificationsForUser,
  markNotificationRead,
  getHRRequestById,
  escalateLoanToGerencia,
  approveLoanByGerencia,
  rejectRequest,
} from "@/lib/hrRequestService";
import type { HRNotification, HRRequest } from "@/lib/hrRequestTypes";

const SHOWN_KEY = "safeone_hr_overlay_shown";

function getShown(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SHOWN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function rememberShown(id: string) {
  const s = getShown();
  s.add(id);
  sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...s]));
}

const HRNotificationOverlay = () => {
  const { user, activeUsers } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<HRNotification | null>(null);
  const [tick, setTick] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("safeone:hr-updated", handler);
    window.addEventListener("storage", handler);
    const id = setInterval(handler, 8000);
    return () => {
      window.removeEventListener("safeone:hr-updated", handler);
      window.removeEventListener("storage", handler);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!user || current) return;
    const unread = getNotificationsForUser(user.id).filter((n) => !n.read);
    const shown = getShown();
    const next = unread.find((n) => !shown.has(n.id));
    if (next) {
      setCurrent(next);
      rememberShown(next.id);
    }
  }, [user, tick, current]);

  if (!current || !user) return null;

  const req: HRRequest | undefined = current.requestId ? getHRRequestById(current.requestId) : undefined;

  const gerenciaApprover = activeUsers.find((u) => (u.fullName || "").toLowerCase().includes("aurelio"));
  const rrhhUserIds = activeUsers.filter((u) => u.department === "Recursos Humanos").map((u) => u.id);
  const isRRHH = user.department === "Recursos Humanos";
  const isGerencia = !!gerenciaApprover && user.id === gerenciaApprover.id;

  const isLoan = req?.formType === "prestamos";
  const canApproveRRHH = !!req && isLoan && req.status === "Pendiente RRHH" && isRRHH;
  const canApproveGerencia = !!req && isLoan && req.status === "Pendiente Gerencia General" && isGerencia;
  const canAct = canApproveRRHH || canApproveGerencia;

  const dismiss = () => {
    if (current) markNotificationRead(current.id);
    setCurrent(null);
    setRejecting(false);
    setRejectReason("");
  };

  const goToRequests = () => {
    dismiss();
    navigate("/rrhh/aprobaciones");
  };

  const handleApprove = () => {
    if (!req) return;
    let result: HRRequest | null = null;
    if (canApproveRRHH) {
      if (!gerenciaApprover?.id) {
        toast({ title: "Error", description: "No se encontró al aprobador de Gerencia (Aurelio).", variant: "destructive" });
        return;
      }
      result = escalateLoanToGerencia(req.id, user.id, user.fullName, gerenciaApprover.id);
    } else if (canApproveGerencia) {
      result = approveLoanByGerencia(req.id, user.id, user.fullName, undefined, rrhhUserIds);
    }
    if (result) {
      toast({ title: "Aprobado", description: `Préstamo ${req.id} avanzó al siguiente paso.` });
      dismiss();
    }
  };

  const handleReject = () => {
    if (!req || !rejectReason.trim()) {
      toast({ title: "Motivo requerido", description: "Indica el motivo del rechazo.", variant: "destructive" });
      return;
    }
    rejectRequest(req.id, user.id, user.fullName, rejectReason.trim());
    toast({ title: "Rechazado", description: `Préstamo ${req.id} rechazado.`, variant: "destructive" });
    dismiss();
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
        <button
          onClick={dismiss}
          className="absolute top-5 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="p-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs font-heading font-bold tracking-widest uppercase text-emerald-600 text-center mb-2">
            Recursos Humanos
          </p>
          <h2 className="font-heading font-black text-lg text-card-foreground text-center mb-3">
            {canAct ? "Solicitud de Préstamo · Requiere tu aprobación" : "Nueva notificación de Solicitud"}
          </h2>
          <div className="rounded-xl p-4 mb-4 bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-sm text-card-foreground text-center leading-relaxed">
              {current.message}
            </p>
          </div>

          {canAct && req?.loanDetails && (
            <div className="rounded-lg p-3 mb-4 bg-muted/50 border border-border text-xs grid grid-cols-2 gap-1">
              <div><span className="text-muted-foreground">Monto:</span> <strong>RD${(req.loanDetails.amountRequested || 0).toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Frecuencia:</span> <strong>{req.loanDetails.frequency || "mensual"}</strong></div>
              <div><span className="text-muted-foreground">Cuota:</span> <strong>RD${(req.loanDetails.monthlyInstallment || 0).toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Plazo:</span> <strong>{req.loanDetails.termMonths} meses</strong></div>
              {req.loanDetails.tenureExceptionByRRHH && (
                <div className="col-span-2 text-blue-700">⚠ Excepción de antigüedad autorizada por RRHH</div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center mb-4">
            {new Date(current.createdAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
          </p>

          {rejecting ? (
            <div className="space-y-3">
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo del rechazo…" rows={3} />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setRejecting(false)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1" onClick={handleReject}>Confirmar rechazo</Button>
              </div>
            </div>
          ) : canAct ? (
            <div className="space-y-2">
              <div className="flex gap-3">
                <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove}>
                  <CheckCircle2 className="h-4 w-4" /> Aprobar
                </Button>
                <Button variant="destructive" className="flex-1 gap-2" onClick={() => setRejecting(true)}>
                  <XCircle className="h-4 w-4" /> Rechazar
                </Button>
              </div>
              <Button variant="ghost" className="w-full gap-2 text-xs" onClick={goToRequests}>
                <FileText className="h-3.5 w-3.5" /> Ver bandeja de aprobaciones
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={goToRequests}>
                <FileText className="h-4 w-4" /> Ver solicitudes
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90" onClick={dismiss}>
                Aceptar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HRNotificationOverlay;
