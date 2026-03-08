import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShieldAlert, Heart, ShoppingCart, UserPlus, Bell, AlertTriangle } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import type { AppNotification } from "@/lib/types";

const typeConfig = {
  security: {
    icon: ShieldAlert,
    gradient: "from-destructive to-red-700",
    bg: "bg-destructive/10",
    iconColor: "text-destructive",
    accentColor: "border-destructive",
    label: "ALERTA DE SEGURIDAD",
    pulse: true,
  },
  medical: {
    icon: Heart,
    gradient: "from-orange-500 to-amber-600",
    bg: "bg-orange-500/10",
    iconColor: "text-orange-500",
    accentColor: "border-orange-500",
    label: "EMERGENCIA MÉDICA",
    pulse: true,
  },
  purchase: {
    icon: ShoppingCart,
    gradient: "from-blue-600 to-indigo-700",
    bg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    accentColor: "border-blue-500",
    label: "SOLICITUD DE COMPRA",
    pulse: false,
  },
  hiring: {
    icon: UserPlus,
    gradient: "from-emerald-600 to-teal-700",
    bg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    accentColor: "border-emerald-500",
    label: "SOLICITUD DE PERSONAL",
    pulse: false,
  },
  info: {
    icon: Bell,
    gradient: "from-primary to-amber-600",
    bg: "bg-primary/10",
    iconColor: "text-primary",
    accentColor: "border-primary",
    label: "NOTIFICACIÓN",
    pulse: false,
  },
};

function getOverlayType(n: AppNotification): keyof typeof typeConfig {
  if (n.title.includes("SEGURIDAD") || n.relatedId?.startsWith("PANIC-")) {
    if (n.title.includes("MÉDICA") || n.message.toLowerCase().includes("médica")) return "medical";
    return "security";
  }
  if (n.title.includes("MÉDICA")) return "medical";
  if (n.type === "purchase") return "purchase";
  if (n.type === "hiring") return "hiring";
  return "info";
}

const NotificationOverlay = () => {
  const navigate = useNavigate();
  const { notifications, markAsRead } = useNotifications();
  const [currentOverlay, setCurrentOverlay] = useState<AppNotification | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unread = notifications.find((n) => !n.read && !shownIds.has(n.id));
    if (unread && !currentOverlay) {
      setCurrentOverlay(unread);
      setShownIds((prev) => new Set(prev).add(unread.id));
    }
  }, [notifications, currentOverlay, shownIds]);

  const handleDismiss = () => {
    if (currentOverlay) {
      markAsRead(currentOverlay.id);
    }
    setCurrentOverlay(null);
  };

  if (!currentOverlay) return null;

  const overlayType = getOverlayType(currentOverlay);
  const config = typeConfig[overlayType];
  const Icon = config.icon;
  const isCritical = overlayType === "security" || overlayType === "medical";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Pulsing background effect for critical alerts */}
      {isCritical && (
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${overlayType === "security" ? "bg-destructive/5" : "bg-orange-500/5"} animate-pulse`} />
          {/* Flashing border */}
          <div className={`absolute inset-0 border-4 ${config.accentColor} opacity-30 animate-pulse`} />
        </div>
      )}

      <div className="relative w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
          {/* Top gradient bar */}
          <div className={`h-2 w-full bg-gradient-to-r ${config.gradient}`} />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-6 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors z-10"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className={`w-20 h-20 rounded-full ${config.bg} flex items-center justify-center ${config.pulse ? "animate-pulse" : ""}`}>
                <Icon className={`w-10 h-10 ${config.iconColor}`} />
              </div>
            </div>

            {/* Label */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {isCritical && <AlertTriangle className={`w-4 h-4 ${config.iconColor}`} />}
              <span className={`text-xs font-heading font-bold tracking-widest uppercase ${config.iconColor}`}>
                {config.label}
              </span>
              {isCritical && <AlertTriangle className={`w-4 h-4 ${config.iconColor}`} />}
            </div>

            {/* Title */}
            <h2 className="font-heading font-black text-xl text-card-foreground text-center mb-3">
              {currentOverlay.title}
            </h2>

            {/* Message */}
            <div className={`rounded-xl p-4 mb-6 ${config.bg} border ${config.accentColor}/20`}>
              <p className="text-sm text-card-foreground text-center leading-relaxed">
                {currentOverlay.message}
              </p>
            </div>

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground text-center mb-6">
              {new Date(currentOverlay.createdAt).toLocaleString("es-DO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              {currentOverlay.actionUrl && currentOverlay.actionUrl !== "/" && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    handleDismiss();
                    navigate(currentOverlay.actionUrl);
                  }}
                >
                  Ver Detalles
                </Button>
              )}
              <Button
                className={`flex-1 bg-gradient-to-r ${config.gradient} text-white hover:opacity-90`}
                onClick={handleDismiss}
              >
                {isCritical ? "Entendido" : "Aceptar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationOverlay;
