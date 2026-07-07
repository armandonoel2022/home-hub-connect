import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipboardList, Check, Loader2, AlertCircle } from "lucide-react";
import { surveysApi, isApiConfigured, type SurveyApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/** Marca en localStorage que el usuario completó la encuesta (detiene el overlay) */
export function markSurveyDone(id: string) {
  try { localStorage.setItem(`survey_done_${id}`, "1"); } catch { /* noop */ }
}

const SurveyPublic = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [survey, setSurvey] = useState<SurveyApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Al acceder por enlace, marca "visto" para pausar el overlay
    try { localStorage.setItem(`survey_seen_${id}`, String(Date.now())); } catch { /* noop */ }
    if (!isApiConfigured()) {
      setError("La encuesta no está disponible en este entorno.");
      setLoading(false);
      return;
    }
    surveysApi
      .getPublic(id)
      .then((s) => setSurvey(s))
      .catch(() => setError("No se encontró la encuesta o el enlace no es válido."))
      .finally(() => setLoading(false));
  }, [id]);

  const setAnswer = (qid: string, value: string) => setAnswers((a) => ({ ...a, [qid]: value }));

  const requiredMissing = survey
    ? survey.questions.filter((q) => q.type === "multiple" && !answers[q.id])
    : [];

  const handleSubmit = async () => {
    if (!survey || requiredMissing.length > 0) return;
    setSubmitting(true);
    try {
      await surveysApi.respond(survey.id, {
        answers,
        userId: user?.id,
        userName: user?.fullName,
        department: user?.department || (answers.q1 as string) || "",
      });
      markSurveyDone(survey.id);
      setDone(true);
    } catch {
      setError("No se pudo enviar la encuesta. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl">
        {/* Encabezado corporativo */}
        <div className="rounded-t-2xl bg-gradient-to-r from-charcoal-dark to-charcoal text-secondary-foreground overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-gold to-amber-500" />
          <div className="p-6 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-gold" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gold">SafeOne Security Company</p>
              <h1 className="font-heading font-extrabold text-xl">
                {loading ? "Cargando encuesta…" : survey?.title || "Encuesta"}
              </h1>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-b-2xl shadow-xl border border-border border-t-0 p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-card-foreground">{error}</p>
            </div>
          )}

          {!loading && !error && done && (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="font-heading font-bold text-xl text-card-foreground">¡Gracias por tu respuesta!</h2>
              <p className="text-muted-foreground text-sm max-w-md">
                Tu opinión es confidencial y nos ayuda a mejorar el clima laboral en SafeOne.
              </p>
              {user && (
                <button onClick={() => navigate("/")} className="btn-gold text-sm mt-2">
                  Volver a la intranet
                </button>
              )}
            </div>
          )}

          {!loading && !error && survey && !done && (
            <>
              {survey.description && (
                <p className="text-sm text-muted-foreground bg-muted rounded-lg p-4 whitespace-pre-line">
                  {survey.description}
                </p>
              )}

              {survey.questions.map((q, idx) => (
                <div key={q.id} className="space-y-3">
                  <label className="block font-medium text-card-foreground">
                    <span className="text-gold font-bold mr-1">{idx + 1}.</span>
                    {q.text}
                    {q.type === "multiple" && <span className="text-destructive ml-1">*</span>}
                  </label>

                  {q.type === "multiple" && q.options && (
                    <div className="grid gap-2">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(q.id, opt)}
                            className={`text-left px-4 py-2.5 rounded-lg border transition-colors text-sm ${
                              selected
                                ? "border-gold bg-gold/10 text-card-foreground font-medium"
                                : "border-border hover:bg-muted text-card-foreground"
                            }`}
                          >
                            <span className={`inline-block w-3.5 h-3.5 rounded-full border mr-2 align-middle ${selected ? "bg-gold border-gold" : "border-muted-foreground"}`} />
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "text" && (
                    <input
                      type="text"
                      value={(answers[q.id] as string) || ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder="Escribe tu respuesta"
                      maxLength={500}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-card-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  )}
                </div>
              ))}

              <div className="pt-2 border-t border-border">
                {requiredMissing.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Responde las {requiredMissing.length} pregunta(s) obligatoria(s) marcadas con <span className="text-destructive">*</span>.
                  </p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || requiredMissing.length > 0}
                  className="btn-gold w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Enviar respuestas
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Información confidencial · SafeOne Security Company
        </p>
      </div>
    </div>
  );
};

export default SurveyPublic;
