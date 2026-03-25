import { useState, useCallback } from "react";
import { ShieldAlert, Heart, X, AlertTriangle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useChatContextSafe } from "@/contexts/ChatContext";
import { toast } from "@/hooks/use-toast";

type PanicType = "security" | "medical";

const PanicButton = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const chatCtx = useChatContextSafe();
  const isChatOpen = chatCtx?.isChatOpen ?? false;
  const [isOpen, setIsOpen] = useState(false);
  const [confirming, setConfirming] = useState<PanicType | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const triggerPanic = useCallback(
    (type: PanicType) => {
      if (!user || cooldown) return;

      const isSecurity = type === "security";
      const title = isSecurity
        ? "🚨 ALERTA DE SEGURIDAD"
        : "🏥 EMERGENCIA MÉDICA";
      const message = isSecurity
        ? `${user.fullName} (${user.department}) ha activado una alerta de seguridad. Situación de peligro reportada.`
        : `${user.fullName} (${user.department}) reporta una emergencia médica. Necesita asistencia inmediata.`;

      addNotification({
        type: "info",
        title,
        message,
        relatedId: `PANIC-${Date.now()}`,
        forUserId: "ALL",
        actionUrl: "/",
      });

      toast({
        title: isSecurity ? "🚨 Alerta Enviada" : "🏥 Alerta Enviada",
        description: isSecurity
          ? "Se ha notificado a todo el personal sobre la situación de seguridad."
          : "Se ha notificado a todo el personal sobre la emergencia médica.",
        variant: "destructive",
      });

      // Play alert sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = isSecurity ? 880 : 660;
        osc.type = "square";
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => {
          osc.frequency.value = isSecurity ? 660 : 880;
        }, 200);
        setTimeout(() => {
          osc.stop();
          ctx.close();
        }, 400);
      } catch {}

      setCooldown(true);
      setConfirming(null);
      setIsOpen(false);
      setTimeout(() => setCooldown(false), 30000); // 30s cooldown
    },
    [user, cooldown, addNotification]
  );

  if (!user) return null;

  return (
    <>
      {/* Floating Panic Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed z-[60] w-14 h-14 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 animate-pulse hover:animate-none ${
          isChatOpen ? "bottom-24 left-6" : "bottom-24 right-6"
        }`}
        aria-label="Botón de Pánico"
        title="Botón de Emergencia"
      >
        <ShieldAlert className="w-7 h-7" />
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div className={`fixed bottom-40 z-[61] w-72 rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 ${
          isChatOpen ? "left-6" : "right-6"
        }`}>
          {/* Header */}
          <div className="bg-destructive px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive-foreground" />
              <span className="font-heading font-bold text-sm text-destructive-foreground tracking-wide">
                EMERGENCIA
              </span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                setConfirming(null);
              }}
              className="text-destructive-foreground/80 hover:text-destructive-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {!confirming ? (
              <>
                <p className="text-xs text-muted-foreground text-center mb-1">
                  Seleccione el tipo de emergencia
                </p>

                {/* Security Threat */}
                <button
                  onClick={() => setConfirming("security")}
                  disabled={cooldown}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-destructive/30 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/60 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <span className="font-heading font-bold text-sm text-foreground block">
                      Amenaza de Seguridad
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Situación de peligro o riesgo
                    </span>
                  </div>
                </button>

                {/* Medical Emergency */}
                <button
                  onClick={() => setConfirming("medical")}
                  disabled={cooldown}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-orange-400/30 bg-orange-400/5 hover:bg-orange-400/10 hover:border-orange-400/60 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-400/15 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <span className="font-heading font-bold text-sm text-foreground block">
                      Emergencia Médica
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Malestar o necesidad de asistencia
                    </span>
                  </div>
                </button>

                {cooldown && (
                  <p className="text-xs text-muted-foreground text-center italic">
                    Alerta enviada. Espere 30 segundos para enviar otra.
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    Emergencias nacionales: <strong>911</strong>
                  </span>
                </div>
              </>
            ) : (
              /* Confirmation step */
              <div className="text-center space-y-3">
                <div
                  className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                    confirming === "security"
                      ? "bg-destructive/15"
                      : "bg-orange-400/15"
                  }`}
                >
                  {confirming === "security" ? (
                    <ShieldAlert className="w-8 h-8 text-destructive" />
                  ) : (
                    <Heart className="w-8 h-8 text-orange-500" />
                  )}
                </div>
                <p className="font-heading font-bold text-sm text-foreground">
                  {confirming === "security"
                    ? "¿Confirmar alerta de seguridad?"
                    : "¿Confirmar emergencia médica?"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Se notificará a <strong>todo el personal</strong> de la
                  empresa inmediatamente.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirming(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 font-bold"
                    onClick={() => triggerPanic(confirming)}
                  >
                    CONFIRMAR
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PanicButton;
