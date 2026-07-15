import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, X } from "lucide-react";
import { surveysApi, isApiConfigured, type SurveyApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Overlay recordatorio de encuestas de clima laboral.
 * - Aparece para todos los usuarios con encuestas públicas activas pendientes.
 * - Deja de aparecer cuando el usuario accede a completarla (se marca "visto").
 * - Vuelve a aparecer cada `reappearMinutes` (por defecto 240 min = 4h).
 * - Si `enforced=true` el usuario NO puede posponer: sólo se cierra al completar.
 * - Nunca reaparece una vez completada.
 */
const DEFAULT_REAPPEAR_MS = 4 * 60 * 60 * 1000;

const SurveyOverlay = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<SurveyApi | null>(null);

  useEffect(() => {
    if (!user || !isApiConfigured()) return;
    let cancel = false;

    const shouldShow = (s: SurveyApi) => {
      try {
        if (localStorage.getItem(`survey_done_${s.id}`)) return false;
        if (s.enforced) return true; // forzoso: siempre mostrar
        const seen = localStorage.getItem(`survey_seen_${s.id}`);
        const gap = (s.reappearMinutes || 240) * 60 * 1000 || DEFAULT_REAPPEAR_MS;
        if (seen && Date.now() - Number(seen) < gap) return false;
      } catch { /* noop */ }
      return true;
    };

    const load = async () => {
      try {
        const list = await surveysApi.getActiveOverlay();
        if (cancel) return;
        const pending = list.find(shouldShow);
        setCurrent(pending || null);
      } catch { /* silent */ }
    };

    load();
    const t = setInterval(load, 60 * 1000); // re-evalúa cada 1 min
    return () => { cancel = true; clearInterval(t); };
  }, [user]);

  if (!current) return null;

  const enforced = !!current.enforced;

  const snooze = () => {
    if (enforced) return;
    try { localStorage.setItem(`survey_seen_${current.id}`, String(Date.now())); } catch { /* noop */ }
    setCurrent(null);
  };

  const goComplete = () => {
    try { localStorage.setItem(`survey_seen_${current.id}`, String(Date.now())); } catch { /* noop */ }
    const id = current.id;
    setCurrent(null);
    navigate(`/encuesta/${id}`);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-gold/40">
        <div className="bg-gradient-to-r from-gold to-amber-500 p-5 text-charcoal-dark flex items-center gap-3">
          <ClipboardList className="h-7 w-7" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">
              {enforced ? "Encuesta obligatoria" : "Encuesta SafeOne"}
            </p>
            <p className="font-heading font-extrabold text-lg">{current.title}</p>
          </div>
          {!enforced && (
            <button onClick={snooze} className="p-1 rounded-lg hover:bg-black/10" title="Recordar más tarde">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-3">
          <p className="text-card-foreground text-sm">
            Tu opinión es muy importante. Por favor completa la <b>encuesta de clima laboral</b>.
            Toda la información es <b>confidencial</b>. ¡Gracias!
          </p>
          <p className="text-xs text-muted-foreground">
            {enforced
              ? "Este recordatorio permanecerá activo hasta que completes la encuesta."
              : "Este recordatorio volverá a aparecer hasta que completes la encuesta."}
          </p>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          {!enforced && (
            <button onClick={snooze} className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted">
              Más tarde
            </button>
          )}
          <button onClick={goComplete} className="btn-gold text-sm">
            Completar ahora
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyOverlay;
