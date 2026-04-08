import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, MessageSquare, CheckCircle2, Send, Users, AlertTriangle } from "lucide-react";
import { CSRequest, BROADCAST_RECIPIENTS, CS_RECIPIENT } from "@/lib/osmIncidentData";
import { toast } from "sonner";

interface CustomerServiceOverlayProps {
  request: CSRequest | null;
  open: boolean;
  onClose: () => void;
  onComplete: (notes: string) => void;
  isCSUser: boolean;
}

export default function CustomerServiceOverlay({ request, open, onClose, onComplete, isCSUser }: CustomerServiceOverlayProps) {
  const [notes, setNotes] = useState("");

  if (!request) return null;

  const handleComplete = () => {
    if (!notes.trim()) {
      toast.error("Debe ingresar las notas de la gestión realizada");
      return;
    }
    onComplete(notes);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-primary" />
            {isCSUser ? "Solicitud de Contacto con Cliente" : "Estado de Solicitud CS"}
          </DialogTitle>
          <DialogDescription>
            {isCSUser
              ? "Se requiere que contacte al siguiente cliente y reporte el resultado."
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

          {/* CS user can complete the task */}
          {isCSUser && !request.completed && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Acción requerida</span>
              </div>
              <Textarea
                placeholder="Describa lo conversado o acordado con el cliente..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <Button onClick={handleComplete} className="w-full gap-2">
                <CheckCircle2 className="h-4 w-4" /> Marcar como Completado
              </Button>
            </div>
          )}

          {/* Broadcast info */}
          {request.completed && !request.broadcastSent && (
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
