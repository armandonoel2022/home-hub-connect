import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, PartyPopper, Cake, Download, Send } from "lucide-react";
import html2canvas from "html2canvas";
import { sendBrowserNotification } from "@/lib/windowsNotifications";
import { getFileUrl } from "@/lib/api";
import type { IntranetUser } from "@/lib/types";

function resolvePhoto(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/photos") || url.startsWith("/uploads")) return getFileUrl(url);
  return url;
}

interface BirthdayOverlayProps {
  birthdayUsers: IntranetUser[];
  isTest?: boolean;
  onDismissTest?: () => void;
  onSendCongrats?: (user: IntranetUser) => void;
}

const DISMISS_KEY_PREFIX = "safeone_bday_dismissed_";

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayKey(): string {
  return `${DISMISS_KEY_PREFIX}${todayStamp()}`;
}

function loadDismissedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(getDayKey());
    if (!raw) return new Set();
    if (raw === "true") return new Set(["__all__"]); // legacy
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissedSet(set: Set<string>) {
  localStorage.setItem(getDayKey(), JSON.stringify([...set]));
}

function cleanOldKeys() {
  const today = getDayKey();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DISMISS_KEY_PREFIX) && key !== today) {
      localStorage.removeItem(key);
    }
  }
}

const BirthdayOverlay = ({ birthdayUsers, isTest, onDismissTest, onSendCongrats }: BirthdayOverlayProps) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [sent, setSent] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const notificationSentRef = useRef(false);

  // En modo test mostramos todos (uno solo o lista pasada por el caller).
  // En modo real, mostramos uno a la vez los que no han sido descartados hoy.
  const queue = useMemo(() => {
    if (isTest) return birthdayUsers;
    return birthdayUsers.filter((u) => !dismissedIds.has(u.id));
  }, [birthdayUsers, dismissedIds, isTest]);

  useEffect(() => {
    if (isTest) {
      setCurrentIdx(0);
      setSent(false);
      return;
    }
    if (birthdayUsers.length === 0) return;
    cleanOldKeys();
    setDismissedIds(loadDismissedSet());
  }, [birthdayUsers, isTest]);

  useEffect(() => {
    if (isTest || queue.length === 0) return;
    if (notificationSentRef.current) return;
    notificationSentRef.current = true;
    const nativeKey = `safeone_bday_notified_${todayStamp()}`;
    if (!localStorage.getItem(nativeKey)) {
      localStorage.setItem(nativeKey, "true");
      const names = birthdayUsers.map((u) => u.fullName);
      const title = birthdayUsers.length === 1
        ? `🎂 ¡Hoy cumple años ${names[0]}!`
        : `🎂 ¡Hoy cumplen años ${names.length} compañeros!`;
      const body = birthdayUsers.length === 1
        ? `${birthdayUsers[0].position} — ${birthdayUsers[0].department}. ¡Envíale una felicitación!`
        : `${names.join(", ")}. ¡Envíales una felicitación!`;
      sendBrowserNotification(title, body, { tag: "birthday-today", type: "message" });
    }
  }, [queue, birthdayUsers, isTest]);

  // En modo test sin lista (preview de mes), tratamos como múltiple y se navega también.
  const isTestGroup = isTest && birthdayUsers.length > 1;
  const visibleList = isTest && !isTestGroup ? birthdayUsers : [queue[currentIdx]].filter(Boolean);
  const groupMode = isTestGroup; // muestra lista completa en una sola tarjeta
  const person = !groupMode ? visibleList[0] : null;

  const handleDismiss = () => {
    if (isTest) {
      onDismissTest?.();
      return;
    }
    const current = queue[currentIdx];
    if (!current) return;
    const next = new Set(dismissedIds);
    next.add(current.id);
    setDismissedIds(next);
    saveDismissedSet(next);
    setSent(false);
    setCurrentIdx(0); // queue se recalcula automáticamente, mostramos el primero restante
  };

  const handleSendCongrats = () => {
    if (onSendCongrats && person) {
      onSendCongrats(person);
      setSent(true);
    } else if (onSendCongrats && groupMode) {
      birthdayUsers.forEach((u) => onSendCongrats(u));
      setSent(true);
    }
    setTimeout(() => handleDismiss(), 400);
  };

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      const link = document.createElement("a");
      const baseName = person
        ? person.fullName
        : (groupMode ? "cumpleanos-safeone" : "cumpleanos");
      const name = `cumpleanos-${baseName.replace(/\s+/g, "-").toLowerCase()}`;
      link.download = `${name}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error al descargar imagen:", err);
    } finally {
      setDownloading(false);
    }
  }, [person, groupMode]);

  const showing = isTest ? birthdayUsers.length > 0 : queue.length > 0;
  if (!showing) return null;

  const remaining = isTest ? 0 : Math.max(0, queue.length - 1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `hsl(${42 + Math.random() * 20}, 100%, ${50 + Math.random() * 20}%)`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1.5 + Math.random() * 2}s`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>

      <div className="relative bg-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          <button onClick={handleDownload} disabled={downloading} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Descargar imagen">
            <Download className={`h-4 w-4 text-muted-foreground ${downloading ? "animate-pulse" : ""}`} />
          </button>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Cerrar">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div ref={cardRef} className="bg-card overflow-y-auto flex-1">
          <div className="h-1.5 w-full" style={{ background: "var(--gradient-gold)" }} />
          <div className="px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper className="h-6 w-6 text-gold animate-bounce" />
              <Cake className="h-8 w-8 text-gold" />
              <PartyPopper className="h-6 w-6 text-gold animate-bounce" style={{ animationDelay: "0.3s" }} />
            </div>

            {person ? (
              <>
                <h2 className="font-heading font-black text-xl text-card-foreground mb-1">¡Feliz Cumpleaños! 🎉</h2>
                <p className="text-muted-foreground text-xs mb-4">Hoy es un día muy especial</p>
                <div className="bg-muted rounded-xl p-4 mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {person.photoUrl ? (
                        <img src={resolvePhoto(person.photoUrl)} alt={person.fullName} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <Cake className="h-8 w-8 text-gold" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-card-foreground">{person.fullName}</h3>
                      <p className="text-xs text-muted-foreground">{person.position} — {person.department}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic mb-2">
                  SafeOne Security Company te desea un maravilloso día lleno de éxitos y bendiciones 🎂
                </p>
              </>
            ) : (
              <>
                <h2 className="font-heading font-black text-xl text-card-foreground mb-1">¡Feliz Cumpleaños! 🎉</h2>
                <p className="text-muted-foreground text-xs mb-4">Hoy celebramos a quienes cumplen años</p>
                <div className="space-y-3 mb-4">
                  {birthdayUsers.map((u) => (
                    <div key={u.id} className="bg-muted rounded-xl p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} alt={u.fullName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Cake className="h-6 w-6 text-gold" />
                        )}
                      </div>
                      <div className="text-left">
                        <h3 className="font-heading font-bold text-sm text-card-foreground">{u.fullName}</h3>
                        <p className="text-xs text-muted-foreground">{u.position} — {u.department}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic mb-2">
                  SafeOne Security Company les desea un maravilloso día lleno de éxitos y bendiciones 🎂
                </p>
              </>
            )}
          </div>
        </div>

        {!isTest && remaining > 0 && (
          <div className="px-6 pt-2 text-[11px] text-center text-muted-foreground">
            Quedan {remaining} cumpleaño{remaining > 1 ? "s" : ""} por mostrar hoy
          </div>
        )}

        <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <button onClick={handleDownload} disabled={downloading} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-xs font-medium text-card-foreground hover:bg-border transition-colors">
            <Download className="h-3.5 w-3.5" />
            {downloading ? "..." : "Descargar"}
          </button>
          <button onClick={handleSendCongrats} disabled={sent} className="flex-1 btn-gold text-xs flex items-center justify-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {sent ? "¡Enviado!" : "¡Felicitar!"} 🥳
          </button>
        </div>
      </div>
    </div>
  );
};

export default BirthdayOverlay;
