import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { requestNotificationPermission } from "@/lib/windowsNotifications";

/**
 * Shows a visible banner asking the user to enable native Windows notifications.
 * Only appears when permission hasn't been granted yet.
 * Dismissible — won't show again in the same session after dismissal.
 */
const NotificationPermissionBanner = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Show banner after a short delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      // Show a test notification
      try {
        new Notification("SafeOne Intranet", {
          body: "¡Notificaciones activadas! Recibirás alertas del chat aquí.",
          icon: "/placeholder.svg",
          tag: "test-notification",
        });
      } catch {}
    }
    setVisible(false);
    setDismissed(true);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  return (
    <div className="fixed top-4 right-4 z-[110] max-w-sm animate-in slide-in-from-top-5 duration-300">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-card shadow-2xl backdrop-blur-sm"
        style={{ boxShadow: "0 8px 32px -4px hsla(42, 100%, 50%, 0.2)" }}
      >
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground">
            Activar notificaciones
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recibe alertas de mensajes del chat directamente en Windows, como WhatsApp o Outlook.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Activar
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="p-1 rounded hover:bg-muted transition-colors shrink-0">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
