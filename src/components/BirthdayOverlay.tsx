import { useState, useEffect, useRef, useCallback } from "react";
import { X, PartyPopper, Cake, Download, Send } from "lucide-react";
import html2canvas from "html2canvas";
import type { IntranetUser } from "@/lib/types";

interface BirthdayOverlayProps {
  birthdayUsers: IntranetUser[];
  isTest?: boolean;
  onDismissTest?: () => void;
  onSendCongrats?: (user: IntranetUser) => void;
}

const BirthdayOverlay = ({ birthdayUsers, isTest, onDismissTest, onSendCongrats }: BirthdayOverlayProps) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sent, setSent] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTest) {
      setVisible(true);
      setDismissed(false);
      setSent(false);
      return;
    }
    if (birthdayUsers.length > 0 && !dismissed) {
      const dismissedToday = sessionStorage.getItem("safeone_bday_dismissed");
      if (!dismissedToday) {
        setVisible(true);
      }
    }
  }, [birthdayUsers, dismissed, isTest]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    if (isTest) {
      onDismissTest?.();
    } else {
      sessionStorage.setItem("safeone_bday_dismissed", "true");
    }
  };

  const handleSendCongrats = () => {
    if (birthdayUsers.length === 1 && onSendCongrats) {
      onSendCongrats(birthdayUsers[0]);
      setSent(true);
    } else if (onSendCongrats) {
      birthdayUsers.forEach((u) => onSendCongrats(u));
      setSent(true);
    }
    handleDismiss();
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
      const name = birthdayUsers.length === 1
        ? `cumpleanos-${birthdayUsers[0].fullName.replace(/\s+/g, "-").toLowerCase()}`
        : "cumpleanos-safeone";
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
  }, [birthdayUsers]);

  if (!visible || birthdayUsers.length === 0) return null;

  const isSingle = birthdayUsers.length === 1;
  const person = isSingle ? birthdayUsers[0] : null;

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
        {/* Top action buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Descargar imagen"
          >
            <Download className={`h-4 w-4 text-muted-foreground ${downloading ? "animate-pulse" : ""}`} />
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Capturable card area */}
        <div ref={cardRef} className="bg-card overflow-y-auto flex-1">
          <div className="h-1.5 w-full" style={{ background: "var(--gradient-gold)" }} />

          <div className="px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <PartyPopper className="h-6 w-6 text-gold animate-bounce" />
              <Cake className="h-8 w-8 text-gold" />
              <PartyPopper className="h-6 w-6 text-gold animate-bounce" style={{ animationDelay: "0.3s" }} />
            </div>

            {isSingle && person ? (
              <>
                <h2 className="font-heading font-black text-xl text-card-foreground mb-1">
                  ¡Feliz Cumpleaños! 🎉
                </h2>
                <p className="text-muted-foreground text-xs mb-4">Hoy es un día muy especial</p>

                <div className="bg-muted rounded-xl p-4 mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                      {person.photoUrl ? (
                        <img src={person.photoUrl} alt={person.fullName} className="w-full h-full rounded-full object-cover" />
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
                <h2 className="font-heading font-black text-xl text-card-foreground mb-1">
                  ¡Feliz Cumpleaños! 🎉
                </h2>
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

        {/* Action buttons outside capture area */}
        <div className="px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <button onClick={handleDownload} disabled={downloading} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-xs font-medium text-card-foreground hover:bg-border transition-colors">
            <Download className="h-3.5 w-3.5" />
            {downloading ? "..." : "Descargar"}
          </button>
          <button onClick={handleSendCongrats} disabled={sent} className="flex-1 btn-gold text-xs flex items-center justify-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {sent ? "¡Enviado!" : "¡Felicitar!"}  🥳
          </button>
        </div>
      </div>
    </div>
  );
};

export default BirthdayOverlay;
