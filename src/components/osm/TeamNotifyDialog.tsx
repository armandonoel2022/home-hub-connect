/**
 * Diálogo de notificación al equipo para Seguimiento Clientes Monitoreo.
 *
 * - Permite enviar una notificación interna (vía notificationsApi) a uno o varios
 *   miembros preseleccionados (Armando Noel, Luis Ovalle, Perla González) y/o
 *   a usuarios adicionales de la intranet.
 * - Siempre encola un correo a tecnologia@safeone.com.do (+ destinatarios elegidos)
 *   con el resumen del cambio/nota, vía queueEmail.
 * - Reutilizable: úsalo cuando guardes una nota o cambio sobre un cliente/LX.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Mail, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { isApiConfigured, notificationsApi, usersApi } from "@/lib/api";
import type { IntranetUser } from "@/lib/types";
import { queueEmail } from "@/lib/emailService";

export interface NotifyRecipient {
  name: string;
  email: string;
  userId?: string;
  role?: string;
}

export const PRESET_RECIPIENTS: NotifyRecipient[] = [
  { name: "Armando Noel (Gerente Tecnología)", email: "anoel@safeone.com.do", role: "tech" },
  { name: "Luis Ovalle (Coord. Seg. Electrónica)", email: "lovalle@safeone.com.do", role: "electronic-security" },
  { name: "Perla González (Servicio al Cliente)", email: "pgonzalez@safeone.com.do", role: "cs" },
];

export const TECH_MAILBOX = "tecnologia@safeone.com.do";

interface TeamNotifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexto: cliente/LX afectado (aparece en el subject) */
  subjectContext: string;
  /** Resumen breve del cambio/nota (prellena el body) */
  defaultMessage?: string;
  /** Tipo de evento, para historial */
  eventType?: "lx_change" | "note" | "incident" | "general";
  /** Usuario que origina (para firma) */
  fromUser?: { name: string; email: string } | null;
  /** Si se pasa, se preseleccionan estos correos */
  defaultSelectedEmails?: string[];
  /** Callback cuando se envía exitosamente */
  onSent?: () => void;
}

export default function TeamNotifyDialog({
  open, onOpenChange, subjectContext, defaultMessage = "",
  eventType = "general", fromUser, defaultSelectedEmails, onSent,
}: TeamNotifyDialogProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraEmail, setExtraEmail] = useState("");
  const [users, setUsers] = useState<IntranetUser[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage(defaultMessage);
    const init = new Set<string>(defaultSelectedEmails || []);
    if (init.size === 0) PRESET_RECIPIENTS.forEach(r => init.add(r.email));
    setSelected(init);
    setExtraEmail("");
    setShowAllUsers(false);
    if (isApiConfigured()) {
      usersApi.getAll().then(setUsers).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMessage]);

  const presetByEmail = useMemo(() => {
    const m = new Map<string, NotifyRecipient>();
    PRESET_RECIPIENTS.forEach(r => m.set(r.email.toLowerCase(), r));
    return m;
  }, []);

  const userByEmail = useMemo(() => {
    const m = new Map<string, IntranetUser>();
    users.forEach(u => { if (u.email) m.set(u.email.toLowerCase(), u); });
    return m;
  }, [users]);

  const toggle = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = email.toLowerCase();
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addExtra = () => {
    const v = extraEmail.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("Correo inválido");
      return;
    }
    setSelected(prev => new Set(prev).add(v));
    setExtraEmail("");
  };

  const send = async () => {
    if (!message.trim()) {
      toast.error("Escribe un mensaje");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecciona al menos un destinatario");
      return;
    }
    setSending(true);
    try {
      const subject = `[Monitoreo] ${subjectContext}`;
      const signature = fromUser ? `\n\n— ${fromUser.name} (${fromUser.email})` : "";
      const fullBody = `${message}${signature}`;

      // 1) Notificación interna por cada destinatario que sea usuario de la intranet
      if (isApiConfigured()) {
        const promises: Promise<any>[] = [];
        selected.forEach(email => {
          const u = userByEmail.get(email);
          if (u) {
            promises.push(notificationsApi.create({
              type: "info",
              title: `📡 Monitoreo: ${subjectContext}`,
              message: message.length > 200 ? message.slice(0, 200) + "…" : message,
              relatedId: subjectContext,
              forUserId: u.id,
              actionUrl: "/seguimiento-clientes",
            }).catch(() => {}));
          }
        });
        await Promise.all(promises);
      }

      // 2) Email a tecnologia@ + cada destinatario seleccionado
      const allEmails = new Set<string>([...selected, TECH_MAILBOX]);
      allEmails.forEach(to => {
        queueEmail(to, subject, fullBody, "general");
      });

      toast.success(`Notificación enviada a ${selected.size} persona(s) · correo a tecnologia@`);
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`No se pudo notificar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const extraSelected = Array.from(selected).filter(e => !presetByEmail.has(e));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notificar al equipo
          </DialogTitle>
          <DialogDescription>
            {subjectContext} · se enviará notificación dentro de la intranet y correo
            a <span className="font-mono">{TECH_MAILBOX}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block flex items-center gap-1">
              <Users className="h-3 w-3" /> Destinatarios sugeridos
            </Label>
            <div className="space-y-2">
              {PRESET_RECIPIENTS.map(r => {
                const checked = selected.has(r.email.toLowerCase());
                return (
                  <label key={r.email}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition ${
                      checked ? "border-primary bg-primary/5" : "border-border bg-muted/20"
                    }`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggle(r.email)} />
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{r.email}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {extraSelected.length > 0 && (
            <div>
              <Label className="text-xs mb-1.5 block">Adicionales</Label>
              <div className="flex flex-wrap gap-1.5">
                {extraSelected.map(e => (
                  <Badge key={e} variant="secondary" className="gap-1">
                    {e}
                    <button onClick={() => toggle(e)} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs mb-1.5 block">Agregar otra persona</Label>
            <div className="flex gap-2">
              <Input
                placeholder="correo@safeone.com.do"
                value={extraEmail}
                onChange={e => setExtraEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }}
              />
              <Button type="button" variant="outline" onClick={addExtra}>Añadir</Button>
            </div>
            {users.length > 0 && (
              <>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 mt-1 text-xs"
                  onClick={() => setShowAllUsers(s => !s)}>
                  {showAllUsers ? "Ocultar" : "Ver"} usuarios de la intranet ({users.length})
                </Button>
                {showAllUsers && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                    {users
                      .filter(u => u.email && !presetByEmail.has(u.email.toLowerCase()))
                      .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
                      .map(u => {
                        const checked = selected.has(u.email.toLowerCase());
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1 rounded">
                            <Checkbox checked={checked} onCheckedChange={() => toggle(u.email)} />
                            <span className="flex-1">{u.fullName}</span>
                            <span className="text-muted-foreground font-mono text-[10px]">{u.email}</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Mensaje</Label>
            <Textarea rows={5} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Describe el cambio o nota..." />
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Mail className="h-3 w-3" /> Se enviará automáticamente copia a {TECH_MAILBOX}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={sending} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : `Notificar (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
