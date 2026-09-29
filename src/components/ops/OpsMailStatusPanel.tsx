import { useEffect, useState } from "react";
import { opsHrRequestsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, AlertTriangle, CheckCircle2, PlugZap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ADMIN = "anoel@safeone.com.do";

/** Estado del buzón de Operaciones → RRHH. Visible solo para anoel@safeone.com.do. */
const OpsMailStatusPanel = () => {
  const { user } = useAuth() as any;
  const isAdmin = String(user?.email || "").toLowerCase() === ADMIN;
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async () => { try { setS(await opsHrRequestsApi.mailAdminStatus()); } catch { setS(null); } };
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);
  if (!isAdmin || !s) return null;

  const ready = s.configured && s.dependencies;
  const test = async () => {
    setTesting(true);
    try {
      const r = await opsHrRequestsApi.mailTest();
      toast({ title: r.ok ? "Conexión correcta" : "Falló la conexión", description: `SMTP ${r.smtp ? "OK" : "falla"} · IMAP ${r.imap ? "OK" : "falla"}${r.message ? ` — ${r.message}` : ""}`, variant: r.ok ? "default" : "destructive" });
    } catch (e) { toast({ title: "Error de prueba", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
    finally { setTesting(false); void load(); }
  };
  const sync = async () => {
    setBusy(true);
    try {
      const r = await opsHrRequestsApi.syncMail();
      toast({ title: r.ok ? "Buzón sincronizado" : "No se pudo sincronizar", description: r.ok ? `${r.added ?? 0} respuestas añadidas como comentarios` : r.message, variant: r.ok ? "default" : "destructive" });
    } catch (e) { toast({ title: "Error de correo", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
    finally { setBusy(false); void load(); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-3">
      <Mail className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-[240px] text-sm">
        <div className="font-semibold text-foreground flex items-center gap-2">
          Buzón de Operaciones · {s.user}
          {ready ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Activo</Badge>
                 : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Inactivo</Badge>}
        </div>
        <p className="text-muted-foreground text-xs">IMAP {s.imap} · SMTP {s.smtp} · {s.polling ? `revisión cada ${s.pollMinutes} min` : "sin revisión automática"}</p>
        {!s.dependencies && <p className="text-xs text-destructive mt-1 font-mono break-all">{s.dependenciesError}</p>}
        {s.dependencies && !s.hasPassword && <p className="text-xs text-destructive mt-1">Falta OPS_MAIL_PASS en backend/.env.</p>}
        {s.dependencies && s.hasPassword && !s.enabled && <p className="text-xs text-destructive mt-1">OPS_MAIL_ENABLED está en false.</p>}
        <p className="text-xs text-muted-foreground mt-1">
          Última sincronización: {s.lastSync?.at ? new Date(s.lastSync.at).toLocaleString("es-DO") : "—"}
          {s.lastSync && ` · ${s.lastSync.ok ? `${s.lastSync.added ?? 0} respuestas` : s.lastSync.message}`}
        </p>
        <p className="text-xs text-muted-foreground">
          Último envío: {s.lastSend?.at ? new Date(s.lastSend.at).toLocaleString("es-DO") : "—"}
          {s.lastSend && ` · ${s.lastSend.ok ? "enviado" : `falló: ${s.lastSend.message}`}`}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={test} disabled={testing}><PlugZap className={`h-4 w-4 mr-1.5 ${testing ? "animate-pulse" : ""}`} />Probar conexión</Button>
      <Button size="sm" variant="outline" onClick={sync} disabled={busy || !ready}><RefreshCw className={`h-4 w-4 mr-1.5 ${busy ? "animate-spin" : ""}`} />Sincronizar correo</Button>
    </div>
  );
};

export default OpsMailStatusPanel;
