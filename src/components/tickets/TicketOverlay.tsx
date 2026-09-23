import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTickets } from "@/hooks/useApiHooks";
import { useTicketSettings } from "@/hooks/useTicketSettings";
import { isApiConfigured } from "@/lib/api";
import { isTicketAgent, isAssignedTo, isRequester, normalizeStatus, statusLabel, isTicketsOwner } from "@/lib/ticketWorkflow";
import { CategoryIcon, StatusBadge } from "./TicketVisuals";
import type { Ticket } from "@/lib/types";
import { X } from "lucide-react";

type Seen = Record<string, string>; // ticketId → "rol:estado"
type Item = { ticket: Ticket; role: "soporte" | "usuario"; key: string };

/**
 * Aviso emergente exclusivo:
 *  - Soporte: ticket nuevo o asignado a mí (solo el técnico responsable).
 *  - Usuario: cambios de estado de MIS tickets.
 */
const TicketOverlay = () => {
  const { user } = useAuth();
  const apiMode = isApiConfigured();
  if (!user || !apiMode) return null;
  return <TicketOverlayInner />;
};

const TicketOverlayInner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tickets } = useTickets();
  const { settings } = useTicketSettings();
  const storeKey = `ticket_overlay_seen_${user!.id}`;
  const [seen, setSeen] = useState<Seen | null>(() => {
    try { const s = localStorage.getItem(storeKey); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  const agent = isTicketAgent(user, settings);

  const pending = useMemo<Item[]>(() => {
    if (!tickets?.length) return [];
    const items: Item[] = [];
    for (const t of tickets) {
      const s = normalizeStatus(t.status);
      if (agent && isAssignedTo(t, user) && (s === "Recibido por Tecnología" || s === "Asignado") && !isRequester(t, user)) {
        items.push({ ticket: t, role: "soporte", key: `soporte:${s}:${t.assignedToEmail || ""}` });
      } else if (isRequester(t, user) && s !== "Recibido por Tecnología" && s !== "Asignado") {
        items.push({ ticket: t, role: "usuario", key: `usuario:${s}` });
      } else if (isRequester(t, user) && s === "Recibido por Tecnología" && t.source === "email") {
        items.push({ ticket: t, role: "usuario", key: `usuario:${s}` });
      }
    }
    return items;
  }, [tickets, agent, user, settings]);

  // Primera vez: línea base sin avisos (salvo tickets de soporte de las últimas 24 h).
  useEffect(() => {
    if (seen || !tickets?.length) return;
    const base: Seen = {};
    const dayAgo = Date.now() - 86400000;
    pending.forEach((i) => {
      if (!(i.role === "soporte" && new Date(i.ticket.createdAt).getTime() > dayAgo)) base[i.ticket.id] = i.key;
    });
    setSeen(base);
    localStorage.setItem(storeKey, JSON.stringify(base));
  }, [seen, tickets, pending, storeKey]);

  const queue = seen ? pending.filter((i) => seen[i.ticket.id] !== i.key) : [];
  const current = queue[0];

  const dismiss = (open?: boolean) => {
    if (!current || !seen) return;
    const next = { ...seen, [current.ticket.id]: current.key };
    setSeen(next);
    localStorage.setItem(storeKey, JSON.stringify(next));
    if (open) navigate("/tickets");
  };

  if (!current) return null;
  const t = current.ticket;
  const s = normalizeStatus(t.status);
  const title = current.role === "soporte"
    ? (s === "Asignado" && !isTicketsOwner(user) ? "Se te asignó un ticket" : "Nuevo ticket recibido")
    : s.startsWith("Cerrado") ? "Tu ticket fue cerrado"
    : s === "En Espera" ? "Tu ticket requiere tu atención"
    : s === "Recibido por Tecnología" ? "Tecnología recibió tu solicitud"
    : "Tu ticket está en progreso";

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border">
        <div className="nav-corporate px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold gold-accent-text">
            {current.role === "soporte" ? "Soporte Tecnología" : "Mis tickets IT"}
          </span>
          <button onClick={() => dismiss()} className="text-muted-foreground hover:text-secondary-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <CategoryIcon category={t.category} size="lg" />
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-lg text-card-foreground">{title}</h2>
              <p className="text-xs font-mono text-muted-foreground">{t.id} · {t.category}</p>
            </div>
          </div>
          <p className="font-semibold text-foreground">{t.title}</p>
          <StatusBadge status={t.status} label={statusLabel(t)} />
          {current.role === "soporte" && (
            <p className="text-sm text-muted-foreground">Solicitante: <b className="text-foreground">{t.createdBy}</b> · Prioridad {t.priority} · SLA {t.slaHours}h</p>
          )}
          {s === "En Espera" && t.holdReason && <p className="text-sm rounded-lg bg-muted p-3 border-l-4 border-primary">{t.holdReason}</p>}
          {s.startsWith("Cerrado") && t.closingNotes && <p className="text-sm rounded-lg bg-muted p-3 border-l-4 border-primary">{t.closingNotes}</p>}
          {queue.length > 1 && <p className="text-xs text-muted-foreground">+{queue.length - 1} aviso(s) más</p>}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={() => dismiss()} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Entendido</button>
          <button onClick={() => dismiss(true)} className="btn-gold text-sm">Ver ticket</button>
        </div>
      </div>
    </div>
  );
};

export default TicketOverlay;
