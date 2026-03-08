import { useEffect, useState } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { MessageSquare, Vibrate, X } from "lucide-react";

const ChatNotificationToast = () => {
  const { notifications, dismissNotification, setIsChatOpen } = useChatContext();
  const [buzzAnimation, setBuzzAnimation] = useState<string | null>(null);

  useEffect(() => {
    const buzzNotif = notifications.find((n) => n.type === "buzz");
    if (buzzNotif) {
      setBuzzAnimation(buzzNotif.id);
      const timer = setTimeout(() => setBuzzAnimation(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  // Auto-dismiss after 6s
  useEffect(() => {
    notifications.forEach((n) => {
      const timer = setTimeout(() => dismissNotification(n.id), 6000);
      return () => clearTimeout(timer);
    });
  }, [notifications, dismissNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => (
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
