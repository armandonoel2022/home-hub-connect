import { useEffect, useState } from "react";
import { Megaphone, X, Calendar as CalIcon } from "lucide-react";
import { announcementsApi, isApiConfigured, type AnnouncementApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Overlay global de comunicados — aparece automáticamente cuando el
 * superior/líder envía un comunicado con showAsOverlay activo.
 * Igual que BirthdayOverlay: polling cada 60s y se cierra al marcar como leído.
 */
const AnnouncementOverlay = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<AnnouncementApi[]>([]);
  const [current, setCurrent] = useState<AnnouncementApi | null>(null);

  useEffect(() => {
    if (!user || !isApiConfigured()) return;
    let cancel = false;

    const load = async () => {
      try {
        const list = await announcementsApi.getActive();
        if (cancel) return;
        setQueue(list);
      } catch {
        /* silent */
      }
    };

    load();
    const t = setInterval(load, 60000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [user]);

  // Mostrar el primero pendiente
  useEffect(() => {
    if (!current && queue.length > 0) setCurrent(queue[0]);
  }, [queue, current]);

  if (!current) return null;

  const handleDismiss = async () => {
    try {
      await announcementsApi.markRead(current.id);
    } catch {
      /* silent */
    }
    setQueue((q) => q.filter((a) => a.id !== current.id));
    setCurrent(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-gold/40">
        <div className="bg-gradient-to-r from-gold to-amber-500 p-5 text-charcoal-dark flex items-center gap-3">
          <Megaphone className="h-7 w-7" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Comunicado SafeOne</p>
            <p className="font-heading font-extrabold text-lg">{current.title}</p>
          </div>
          <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-black/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {current.priority && (
            <span className="inline-block text-xs font-bold text-destructive uppercase tracking-wider">
              Prioritario
            </span>
          )}
          <p className="text-card-foreground text-sm whitespace-pre-line">{current.excerpt}</p>
          {current.eventDate && (
            <div className="flex items-center gap-2 text-xs bg-muted rounded-lg p-3 text-card-foreground">
              <CalIcon className="h-4 w-4 text-gold" />
              <span>
                Programado para <b>{current.eventDate}</b>
                {current.eventStartTime ? ` · ${current.eventStartTime}` : ""}
                {current.eventLocation ? ` · ${current.eventLocation}` : ""}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            Publicado por <b>{current.createdBy}</b> · {current.date}
          </p>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={handleDismiss} className="btn-gold text-sm">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementOverlay;
