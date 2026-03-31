import { useEffect, useMemo, useRef, useState } from "react";
import { useChatContextSafe } from "@/contexts/ChatContext";
import { MessageSquare, Vibrate, X } from "lucide-react";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/windowsNotifications";

const ChatNotificationToast = () => {
  const ctx = useChatContextSafe();
  const notifications = ctx?.notifications ?? [];
  const dismissNotification = ctx?.dismissNotification ?? (() => {});
  const setIsChatOpen = ctx?.setIsChatOpen ?? (() => {});
  const [buzzAnimation, setBuzzAnimation] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [notifications]
  );

  // Request permission on mount and on first user interaction
  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    let active = true;

    const handleInteraction = async () => {
      const permission = await requestNotificationPermission();
      if (active && permission !== "default") {
        events.forEach((eventName) => window.removeEventListener(eventName, handleInteraction));
      }
    };

    void handleInteraction();
    events.forEach((eventName) => window.addEventListener(eventName, handleInteraction, { passive: true }));

    return () => {
      active = false;
      events.forEach((eventName) => window.removeEventListener(eventName, handleInteraction));
    };
  }, []);

  useEffect(() => {
    const buzzNotif = sortedNotifications.find((n) => n.type === "buzz");
    if (buzzNotif) {
      setBuzzAnimation(buzzNotif.id);
      const timer = setTimeout(() => setBuzzAnimation(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [sortedNotifications]);

  // Send browser notification for new chat notifications
  useEffect(() => {
    sortedNotifications.forEach((n) => {
      if (!seenIds.current.has(n.id)) {
        seenIds.current.add(n.id);
        const title = n.type === "buzz" ? `🔔 ${n.senderName}` : `💬 ${n.senderName}`;
        sendBrowserNotification(title, n.message, {
          tag: n.id,
          type: n.type === "buzz" ? "buzz" : "message",
          onClick: () => {
            setIsChatOpen(true);
            dismissNotification(n.id);
          },
        });
      }
    });
  }, [sortedNotifications, setIsChatOpen, dismissNotification]);

  // Auto-dismiss after 4s
  useEffect(() => {
    const timers = sortedNotifications.map((n) => setTimeout(() => dismissNotification(n.id), 4000));
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [sortedNotifications, dismissNotification]);

  const dismissAll = () => {
    notifications.forEach(n => dismissNotification(n.id));
  };

  if (notifications.length === 0) return null;

  // Show max 3 notifications to prevent flooding
  const visibleNotifications = sortedNotifications.slice(0, 3);
  const hiddenCount = sortedNotifications.length - visibleNotifications.length;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.length > 1 && (
        <button
          onClick={dismissAll}
          className="self-end text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
        >
          Cerrar todas ({notifications.length})
        </button>
      )}
      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground text-right">+{hiddenCount} más</p>
      )}
      {visibleNotifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-right-5 ${
            n.type === "buzz"
              ? "bg-primary/95 text-primary-foreground border-primary"
              : "bg-card/95 text-card-foreground border-border"
          } ${buzzAnimation === n.id ? "animate-buzz" : ""}`}
          style={{
            boxShadow: n.type === "buzz"
              ? "0 8px 32px -4px hsla(42, 100%, 50%, 0.4)"
              : "0 8px 32px -4px hsla(220, 15%, 18%, 0.3)",
          }}
        >
          <div className={`p-2 rounded-lg shrink-0 ${
            n.type === "buzz" ? "bg-primary-foreground/20" : "bg-primary/10"
          }`}>
            {n.type === "buzz" ? (
              <Vibrate className="h-5 w-5" />
            ) : (
              <MessageSquare className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-heading font-semibold truncate">{n.senderName}</p>
            <p className="text-xs opacity-80 truncate mt-0.5">{n.message}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                dismissNotification(n.id);
                setIsChatOpen(true);
              }}
              className="p-1 rounded hover:bg-foreground/10 transition-colors"
              title="Abrir chat"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => dismissNotification(n.id)}
              className="p-1 rounded hover:bg-foreground/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatNotificationToast;
