import { useState, useEffect } from "react";
import { X, PartyPopper, Cake } from "lucide-react";
import type { IntranetUser } from "@/lib/types";

interface BirthdayOverlayProps {
  birthdayUsers: IntranetUser[];
}

const BirthdayOverlay = ({ birthdayUsers }: BirthdayOverlayProps) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (birthdayUsers.length > 0 && !dismissed) {
      const dismissedToday = sessionStorage.getItem("safeone_bday_dismissed");
      if (!dismissedToday) {
        setVisible(true);
      }
    }
  }, [birthdayUsers, dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("safeone_bday_dismissed", "true");
  };

  if (!visible || birthdayUsers.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
      {/* Confetti-like decorations */}
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

      <div className="relative bg-card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Gold top bar */}
        <div className="h-2 w-full" style={{ background: "var(--gradient-gold)" }} />

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted transition-colors z-10"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="p-8 text-center">
          {/* Icon */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <PartyPopper className="h-8 w-8 text-gold animate-bounce" />
            <Cake className="h-10 w-10 text-gold" />
            <PartyPopper className="h-8 w-8 text-gold animate-bounce" style={{ animationDelay: "0.3s" }} />
          </div>

          <h2 className="font-heading font-black text-2xl text-card-foreground mb-2">
            ¡Feliz Cumpleaños! 🎉
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Hoy celebramos a nuestros compañeros
          </p>

          {/* Birthday people */}
          <div className="space-y-4 mb-6">
            {birthdayUsers.map((u) => (
              <div key={u.id} className="bg-muted rounded-xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                  {u.photoUrl ? (
                    <img src={u.photoUrl} alt={u.fullName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Cake className="h-7 w-7 text-gold" />
                  )}
                </div>
                <div className="text-left">
                  <h3 className="font-heading font-bold text-card-foreground">{u.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{u.position} — {u.department}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground italic mb-6">
            SafeOne Security Company les desea un maravilloso día 🎂
          </p>

          <button onClick={handleDismiss} className="btn-gold text-sm w-full">
            ¡Felicidades! 🥳
          </button>
        </div>
      </div>
    </div>
  );
};

export default BirthdayOverlay;
