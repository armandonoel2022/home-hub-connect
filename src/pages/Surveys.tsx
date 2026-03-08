import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import { ClipboardList, Plus, X, BarChart3, Eye, Send, Check, Users } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["hsl(42,100%,50%)", "hsl(200,70%,50%)", "hsl(160,60%,40%)", "hsl(0,60%,50%)", "hsl(280,50%,50%)"];

interface SurveyQuestion {
  id: string;
  text: string;
  type: "rating" | "multiple" | "text";
  options?: string[];
}

interface SurveyResponse {
  surveyId: string;
  userId: string;
  userName: string;
  department: string;
  answers: Record<string, string | number>;
  submittedAt: string;
}

interface Survey {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  createdBy: string;
  createdAt: string;
  targetType: "todos" | "departamento";
  targetDept?: string;
  status: "activa" | "cerrada";
  responses: SurveyResponse[];
}

const INITIAL_SURVEYS: Survey[] = [
  {
    id: "SRV-001",
    title: "Encuesta de Clima Laboral Q1 2026",
    description: "Evaluación trimestral del ambiente de trabajo",
    questions: [
      { id: "q1", text: "¿Cómo califica su satisfacción general?", type: "rating" },
      { id: "q2", text: "¿Se siente valorado en su equipo?", type: "multiple", options: ["Siempre", "Casi siempre", "A veces", "Nunca"] },
      { id: "q3", text: "¿Qué mejoraría de su entorno laboral?", type: "text" },
    ],
    createdBy: "Dilia Aguasvivas",
    createdAt: "2026-03-01",
    targetType: "todos",
    status: "activa",
    responses: [
      { surveyId: "SRV-001", userId: "USR-002", userName: "Armando Noel", department: "Tecnología y Monitoreo", answers: { q1: 4, q2: "Siempre", q3: "Más capacitaciones" }, submittedAt: "2026-03-03" },
      { surveyId: "SRV-001", userId: "USR-005", userName: "Remit López", department: "Operaciones", answers: { q1: 3, q2: "Casi siempre", q3: "Mejor comunicación inter-departamental" }, submittedAt: "2026-03-04" },
      { surveyId: "SRV-001", userId: "USR-112", userName: "Perla González", department: "Servicio al Cliente", answers: { q1: 5, q2: "Siempre", q3: "Todo bien" }, submittedAt: "2026-03-05" },
    ],
  },
];

const SurveysPage = () => {
  const { user, allUsers } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>(INITIAL_SURVEYS);
  const [showCreate, setShowCreate] = useState(false);
  const [showResults, setShowResults] = useState<Survey | null>(null);
  const [showRespond, setShowRespond] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    targetType: "todos" as Survey["targetType"],
    targetDept: "",
    questions: [{ id: "nq1", text: "", type: "rating" as SurveyQuestion["type"], options: [""] }],
  });

  const isHR = user?.department === "Recursos Humanos" || user?.isAdmin;

  const visibleSurveys = surveys.filter((s) => {
    if (!user) return false;
    if (isHR) return true;
    if (s.targetType === "todos") return true;
    if (s.targetType === "departamento" && s.targetDept === user.department) return true;
    return false;
  });

  const hasResponded = (survey: Survey) => survey.responses.some((r) => r.userId === user?.id);

  const handleCreate = () => {
    if (!form.title || form.questions.some((q) => !q.text)) return;
    const newSurvey: Survey = {
      id: `SRV-${String(surveys.length + 1).padStart(3, "0")}`,
      title: form.title,
      description: form.description,
      questions: form.questions.map((q, i) => ({ ...q, id: `q${i + 1}`, options: q.type === "multiple" ? q.options?.filter(Boolean) : undefined })),
      createdBy: user?.fullName || "",
      createdAt: new Date().toISOString().split("T")[0],
      targetType: form.targetType,
      targetDept: form.targetType === "departamento" ? form.targetDept : undefined,
      status: "activa",
      responses: [],
    };
    setSurveys([newSurvey, ...surveys]);
    setShowCreate(false);
    setForm({ title: "", description: "", targetType: "todos", targetDept: "", questions: [{ id: "nq1", text: "", type: "rating", options: [""] }] });
  };

  const handleRespond = (survey: Survey) => {
    if (!user) return;
    const response: SurveyResponse = {
      surveyId: survey.id,
      userId: user.id,
      userName: user.fullName,
      department: user.department,
      answers,
      submittedAt: new Date().toISOString().split("T")[0],
    };
    setSurveys(surveys.map((s) => s.id === survey.id ? { ...s, responses: [...s.responses, response] } : s));
    setShowRespond(null);
    setAnswers({});
  };

  const addQuestion = () => {
    setForm({ ...form, questions: [...form.questions, { id: `nq${form.questions.length + 1}`, text: "", type: "rating", options: [""] }] });
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const qs = [...form.questions];
    (qs[idx] as any)[field] = value;
    setForm({ ...form, questions: qs });
  };

  // Results calculations
  const getResultsData = (survey: Survey, questionId: string) => {
    const q = survey.questions.find((q) => q.id === questionId);
    if (!q) return [];
    if (q.type === "rating") {
      const counts = [1, 2, 3, 4, 5].map((r) => ({ name: `${r}⭐`, value: survey.responses.filter((resp) => Number(resp.answers[questionId]) === r).length }));
      return counts;
    }
    if (q.type === "multiple" && q.options) {
      return q.options.map((opt) => ({ name: opt, value: survey.responses.filter((resp) => resp.answers[questionId] === opt).length }));
    }
    return [];
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Encuestas <span className="gold-accent-text">Internas</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Encuestas de clima laboral y satisfacción</p>
                </div>
              </div>
              {isHR && (
                <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Nueva Encuesta
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-4 mt-4">
          {visibleSurveys.map((s) => (
            <div key={s.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1 w-full bg-secondary" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{s.id}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status === "activa" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{s.status === "activa" ? "Activa" : "Cerrada"}</span>
                      {s.targetType !== "todos" && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{s.targetDept}</span>
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-card-foreground">{s.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{s.createdBy} · {s.createdAt}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {s.responses.length} respuestas</span>
                      <span>{s.questions.length} preguntas</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isHR && (
                      <button onClick={() => setShowResults(s)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Ver resultados">
                        <BarChart3 className="h-4 w-4" />
                      </button>
                    )}
                    {s.status === "activa" && !hasResponded(s) && !isHR && (
                      <button onClick={() => { setShowRespond(s); setAnswers({}); }} className="btn-gold text-xs flex items-center gap-1">
                        <Send className="h-3 w-3" /> Responder
                      </button>
                    )}
                    {hasResponded(s) && !isHR && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Respondida</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {visibleSurveys.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No hay encuestas disponibles</p>
            </div>
          )}
        </div>

        {/* Respond Modal */}
        {showRespond && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{showRespond.title}</h2>
                <button onClick={() => setShowRespond(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-5">
                {showRespond.questions.map((q) => (
                  <div key={q.id}>
                    <label className="text-sm font-medium text-card-foreground block mb-2">{q.text}</label>
                    {q.type === "rating" && (
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button key={r} onClick={() => setAnswers({ ...answers, [q.id]: r })} className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${answers[q.id] === r ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground hover:bg-border"}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === "multiple" && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer">
                            <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} />
                            <span className="text-sm text-card-foreground">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === "text" && (
                      <textarea value={(answers[q.id] as string) || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                    )}
                  </div>
                ))}
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowRespond(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={() => handleRespond(showRespond)} className="btn-gold text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Enviar</button>
              </div>
            </div>
          </div>
        )}

        {/* Results Modal */}
        {showResults && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Resultados: {showResults.title}</h2>
                  <p className="text-xs text-muted-foreground">{showResults.responses.length} respuestas</p>
                </div>
                <button onClick={() => setShowResults(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-6">
                {showResults.questions.map((q) => {
                  const data = getResultsData(showResults, q.id);
                  return (
                    <div key={q.id} className="bg-muted rounded-xl p-4">
                      <h4 className="font-medium text-card-foreground mb-3">{q.text}</h4>
                      {(q.type === "rating" || q.type === "multiple") && data.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
                            <Bar dataKey="value" name="Respuestas" radius={[4, 4, 0, 0]}>
                              {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : q.type === "text" ? (
                        <div className="space-y-2">
                          {showResults.responses.map((r) => r.answers[q.id] ? (
                            <div key={r.userId} className="bg-card rounded-lg p-3 text-sm">
                              <span className="text-xs text-muted-foreground">{r.userName} · {r.department}</span>
                              <p className="text-card-foreground mt-1">{String(r.answers[q.id])}</p>
                            </div>
                          ) : null)}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin datos</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowResults(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nueva Encuesta</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Dirigido a</label>
                  <div className="flex gap-2">
                    {(["todos", "departamento"] as const).map((t) => (
                      <button key={t} onClick={() => setForm({ ...form, targetType: t })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.targetType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>
                        {t === "todos" ? "Todos" : "Departamento"}
                      </button>
                    ))}
                  </div>
                </div>
                {form.targetType === "departamento" && (
                  <select value={form.targetDept} onChange={(e) => setForm({ ...form, targetDept: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-card-foreground">Preguntas</label>
                    <button onClick={addQuestion} className="text-xs gold-accent-text hover:underline">+ Agregar pregunta</button>
                  </div>
                  <div className="space-y-3">
                    {form.questions.map((q, i) => (
                      <div key={q.id} className="bg-muted rounded-lg p-3 space-y-2">
                        <input type="text" value={q.text} onChange={(e) => updateQuestion(i, "text", e.target.value)} placeholder={`Pregunta ${i + 1}...`} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                        <select value={q.type} onChange={(e) => updateQuestion(i, "type", e.target.value)} className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-gold outline-none">
                          <option value="rating">Calificación (1-5)</option>
                          <option value="multiple">Opción múltiple</option>
                          <option value="text">Texto libre</option>
                        </select>
                        {q.type === "multiple" && (
                          <div className="space-y-1">
                            {(q.options || [""]).map((opt, oi) => (
                              <input key={oi} type="text" value={opt} onChange={(e) => { const opts = [...(q.options || [""])]; opts[oi] = e.target.value; updateQuestion(i, "options", opts); }} placeholder={`Opción ${oi + 1}`} className="w-full px-2 py-1.5 rounded bg-background border border-border text-foreground text-xs outline-none" />
                            ))}
                            <button onClick={() => updateQuestion(i, "options", [...(q.options || [""]), ""])} className="text-xs gold-accent-text hover:underline">+ Opción</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleCreate} className="btn-gold text-sm">Crear Encuesta</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SurveysPage;
