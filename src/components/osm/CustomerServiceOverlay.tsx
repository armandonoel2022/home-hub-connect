import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, CheckCircle2, Users, AlertTriangle, PhoneCall, Wrench, ClipboardCheck, PartyPopper } from "lucide-react";
import { CSRequest, BROADCAST_RECIPIENTS, CS_RECIPIENT } from "@/lib/osmIncidentData";
import { toast } from "sonner";

type ActionType = "llamada" | "visita_tecnica" | "seguimiento" | "otro";

const ACTION_LABELS: Record<ActionType, string> = {
  llamada: "Llamada al cliente",
  visita_tecnica: "Visita técnica realizada",
  seguimiento: "Seguimiento interno",
  otro: "Otra gestión",
};

const ACTION_ICONS: Record<ActionType, any> = {
  llamada: PhoneCall,
  visita_tecnica: Wrench,
  seguimiento: ClipboardCheck,
  otro: ClipboardCheck,
};

interface CustomerServiceOverlayProps {
  request: CSRequest | null;
  open: boolean;
  onClose: () => void;
  onComplete: (notes: string, actionType?: string) => void;
  isCSUser: boolean;
  canManage?: boolean; // editors like anoel can also complete
}

export default function CustomerServiceOverlay({ request, open, onClose, onComplete, isCSUser, canManage }: CustomerServiceOverlayProps) {
  const [notes, setNotes] = useState("");
  const [actionType, setActionType] = useState<ActionType>("llamada");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completedAction, setCompletedAction] = useState<{ type: ActionType; notes: string } | null>(null);

  if (!request) return null;

  const canComplete = (isCSUser || canManage) && !request.completed;

  const handleComplete = () => {
    if (!notes.trim()) {
      toast.error("Debe ingresar las notas de la gestión realizada");
      return;
    }
    setCompletedAction({ type: actionType, notes });
    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    if (!completedAction) return;
    onComplete(`[${ACTION_LABELS[completedAction.type]}] ${completedAction.notes}`, completedAction.type);
    setNotes("");
    setActionType("llamada");
    setShowConfirmation(false);
    setCompletedAction(null);
  };

  const handleCloseAll = () => {
    setShowConfirmation(false);
    setCompletedAction(null);
    setNotes("");
    setActionType("llamada");
    onClose();
  };

  // ─── Confirmation overlay after completing ───
  if (showConfirmation && completedAction) {
    const ActionIcon = ACTION_ICONS[completedAction.type];
    return (
      <Dialog open={open} onOpenChange={handleCloseAll}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <PartyPopper className="h-5 w-5 text-emerald-500" />
              Confirmar Gestión Completada
            </DialogTitle>
            <DialogDescription>
              Revise los detalles antes de confirmar. Se notificará al equipo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ActionIcon className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{ACTION_LABELS[completedAction.type]}</p>
                    <p className="text-xs text-muted-foreground">Cliente: {request.clientName} {request.accountCode ? `(#${request.accountCode})` : ""}</p>
                  </div>
                </div>

                <div className="bg-background rounded p-3 border border-border">
                  <p className="text-sm text-foreground">{completedAction.notes}</p>
                </div>
              </CardContent>
            </Card>

            {/* Broadcast preview */}
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-foreground">Se notificará a:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BROADCAST_RECIPIENTS.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-blue-500/10 border-blue-500/20">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirmation(false)}>
                Volver a editar
              </Button>
              <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirm}>
                <CheckCircle2 className="h-4 w-4" /> Confirmar y Notificar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Main overlay ───
  return (
    <Dialog open={open} onOpenChange={handleCloseAll}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-primary" />
            {canComplete ? "Gestión de Contacto con Cliente" : "Estado de Solicitud CS"}
          </DialogTitle>
          <DialogDescription>
            {canComplete
              ? "Registre la gestión realizada con el cliente (llamada, visita técnica, etc.)"
              : "Detalle de la solicitud enviada a Servicio al Cliente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client info */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-foreground">{request.clientName}</p>
                  {request.accountCode && (
                    <p className="text-xs text-muted-foreground">Código: {request.accountCode}</p>
                  )}
                </div>
                <Badge variant={request.completed ? "default" : "secondary"}>
                  {request.completed ? "Completado" : "Pendiente"}
                </Badge>
              </div>
              <div className="bg-background rounded p-3 border border-border">
                <p className="text-sm text-foreground">{request.message}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Solicitado por: {request.requestedBy} • {new Date(request.requestedAt).toLocaleString("es-DO")}
              </p>
            </CardContent>
          </Card>

          {/* If completed, show results */}
          {request.completed && (
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Gestión Completada</span>
                </div>
                <p className="text-sm text-foreground">{request.completionNotes}</p>
                <p className="text-xs text-muted-foreground">
                  Completado por: {request.completedBy} • {request.completedAt ? new Date(request.completedAt).toLocaleString("es-DO") : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action form — for CS user or editors */}
          {canComplete && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Acción requerida</span>
              </div>

              {/* Action type selector */}
              <div>
                <Label className="text-xs mb-1.5 block">Tipo de gestión realizada</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([key, label]) => {
                    const Icon = ACTION_ICONS[key];
                    const selected = actionType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActionType(key)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all text-left ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Notas de la gestión</Label>
                <Textarea
                  placeholder={
                    actionType === "llamada"
                      ? "Describa lo conversado con el cliente, acuerdos, próximos pasos..."
                      : actionType === "visita_tecnica"
                      ? "Describa lo encontrado en la visita, acciones tomadas, estado del equipo..."
                      : "Describa la gestión realizada..."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <Button onClick={handleComplete} className="w-full gap-2">
                <CheckCircle2 className="h-4 w-4" /> Completar Gestión
              </Button>
            </div>
          )}

          {/* Broadcast info on completed */}
          {request.completed && (
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-foreground">Notificación enviada a:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {BROADCAST_RECIPIENTS.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
