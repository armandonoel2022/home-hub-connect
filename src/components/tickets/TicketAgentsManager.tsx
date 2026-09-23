import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketSettings } from "@/hooks/useTicketSettings";
import { DEFAULT_ASSIGNEE } from "@/lib/ticketWorkflow";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";

/** anoel@safeone.com.do designa qué usuarios pueden ver y atender tickets. */
const TicketAgentsManager = () => {
  const { allUsers } = useAuth();
  const { settings, save, saving } = useTicketSettings();
  const [pick, setPick] = useState("");

  const persist = async (agents: typeof settings.agents) => {
    try { await save({ agents }); toast({ title: "Técnicos actualizados" }); }
    catch (e) { toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
  };

  const add = () => {
    const u = allUsers.find((x) => x.id === pick);
    if (!u || settings.agents.some((a) => a.email.toLowerCase() === u.email.toLowerCase())) return;
    void persist([...settings.agents, { id: u.id, email: u.email, name: u.fullName }]);
    setPick("");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 max-w-2xl space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-foreground">Técnicos designados</h2>
        <p className="text-sm text-muted-foreground">Estos usuarios pueden ver todos los tickets, recibir avisos de tickets nuevos y atenderlos.</p>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-muted p-3 text-sm">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span><b>{DEFAULT_ASSIGNEE.name}</b> — {DEFAULT_ASSIGNEE.email} (responsable, asignado por defecto)</span>
      </div>
      {settings.agents.map((a) => (
        <div key={a.email} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
          <span className="flex-1"><b>{a.name}</b> — {a.email}</span>
          <button disabled={saving} onClick={() => persist(settings.agents.filter((x) => x.email !== a.email))}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-sm">
          <option value="">Seleccionar usuario de la intranet...</option>
          {allUsers.filter((u) => u.email && u.email.toLowerCase() !== DEFAULT_ASSIGNEE.email && !settings.agents.some((a) => a.email.toLowerCase() === u.email.toLowerCase()))
            .map((u) => <option key={u.id} value={u.id}>{u.fullName} — {u.department}</option>)}
        </select>
        <button onClick={add} disabled={!pick || saving} className="btn-gold text-sm flex items-center gap-2 disabled:opacity-50">
          <UserPlus className="h-4 w-4" /> Agregar
        </button>
      </div>
    </div>
  );
};

export default TicketAgentsManager;
