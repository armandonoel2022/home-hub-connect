import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotificationsForUser,
  markNotificationRead,
} from "@/lib/hrRequestService";
import type { HRNotification } from "@/lib/hrRequestTypes";

const SHOWN_KEY = "safeone_hr_overlay_shown";

function getShown(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SHOWN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function rememberShown(id: string) {
  const s = getShown();
  s.add(id);
  sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...s]));
}

const HRNotificationOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<HRNotification | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("safeone:hr-updated", handler);
    window.addEventListener("storage", handler);
    const id = setInterval(handler, 8000);
    return () => {
      window.removeEventListener("safeone:hr-updated", handler);
      window.removeEventListener("storage", handler);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!user || current) return;
    const unread = getNotificationsForUser(user.id).filter((n) => !n.read);
    const shown = getShown();
    const next = unread.find((n) => !shown.has(n.id));
    if (next) {
      setCurrent(next);
      rememberShown(next.id);
    }
  }, [user, tick, current]);

  if (!current) return null;

  const dismiss = () => {
    if (current) markNotificationRead(current.id);
    setCurrent(null);
  };

  const goToRequests = () => {
    dismiss();
    navigate("/rrhh/formularios");
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
        <button
          onClick={dismiss}
          className="absolute top-5 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="p-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs font-heading font-bold tracking-widest uppercase text-emerald-600 text-center mb-2">
            Recursos Humanos
          </p>
          <h2 className="font-heading font-black text-lg text-card-foreground text-center mb-3">
            Nueva notificación de Solicitud
          </h2>
          <div className="rounded-xl p-4 mb-5 bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-sm text-card-foreground text-center leading-relaxed">
              {current.message}
            </p>
          </div>
          <p className="text-xs text-muted-foreground text-center mb-5">
            {new Date(current.createdAt).toLocaleString("es-DO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={goToRequests}>
              <FileText className="h-4 w-4" /> Ver solicitudes
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90" onClick={dismiss}>
              Aceptar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRNotificationOverlay;
