import { useEffect, useState } from "react";
import { ticketsApi, type TicketMailStatus, type TicketMailSyncResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Panel de sincronización del buzón tecnologia@safeone.com.do.
 * Visible sólo para el equipo de Tecnología: permite forzar la lectura del
 * correo y ver el estado de la conexión IMAP/SMTP.
 */
const MailSyncPanel = () => {
  const [status, setStatus] = useState<TicketMailStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<TicketMailSyncResult | null>(null);

  const loadStatus = async () => {
    try {
      const s = await ticketsApi.mailStatus();
      setStatus(s);
      setLast(s.lastSync);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => { void loadStatus(); }, []);

  const sync = async () => {
    setBusy(true);
    try {
      const r = await ticketsApi.mailSync();
      setLast(r);
      toast({
        title: r.ok ? "Buzón sincronizado" : "No se pudo sincronizar",
        description: r.ok
          ? `${r.created?.length || 0} tickets nuevos · ${r.replies?.length || 0} respuestas`
          : r.message,
        variant: r.ok ? "default" : "destructive",
      });
      await loadStatus();
    } catch (e) {
      toast({
        title: "Error de correo",
        description: e instanceof Error ? e.message : "Fallo la conexión IMAP",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  const ready = status.configured && status.dependencies;

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-3">
      <Mail className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-[240px] text-sm">
        <div className="font-semibold text-foreground flex items-center gap-2">
          Buzón de soporte · {status.user}
          {ready ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Activo
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Inactivo
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          IMAP {status.imap} · SMTP {status.smtp} ·{" "}
          {status.polling ? `revisión cada ${status.pollMinutes} min` : "sin revisión automática"}
        </p>
        {!status.dependencies && (
          <p className="text-xs text-destructive mt-1">
            Falta instalar dependencias en el servidor: npm install imapflow mailparser nodemailer
          </p>
        )}
        {!status.configured && status.dependencies && (
          <p className="text-xs text-destructive mt-1">
            Configura IT_MAIL_* en backend/.env (usuario y contraseña del buzón).
          </p>
        )}
        {last && (
          <p className="text-xs text-muted-foreground mt-1">
            Última sincronización:{" "}
            {last.at ? new Date(last.at).toLocaleString("es-DO") : "—"} ·{" "}
            {last.ok ? `${last.count ?? 0} correos procesados` : last.message}
          </p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={sync} disabled={busy || !ready}>
        <RefreshCw className={`h-4 w-4 mr-1.5 ${busy ? "animate-spin" : ""}`} />
        Sincronizar correo
      </Button>
    </div>
  );
};

export default MailSyncPanel;
