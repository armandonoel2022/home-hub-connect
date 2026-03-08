import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import { ClipboardList, Plus, X, BarChart3, Eye, Send, Check, Users, Lock, EyeOff, Trash2, UserCog, Archive, ShieldCheck } from "lucide-react";
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

interface DeleteRecord {
  surveyId: string;
  surveyTitle: string;
  deletedBy: string;
  deletedAt: string;
  reason: string;
  responsesCount: number;
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
  resultsVisibleTo: string[];
  // Soft delete
  deleted: boolean;
  deletedBy?: string;
  deletedAt?: string;
  deleteReason?: string;
}

// HR leader is determined by isDepartmentLeader flag — inheritable when role changes

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
    resultsVisibleTo: [],
    deleted: false,
  },
];

const SurveysPage = () => {
  const { user, allUsers } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>(INITIAL_SURVEYS);
  const [deletionLog, setDeletionLog] = useState<DeleteRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showResults, setShowResults] = useState<Survey | null>(null);
  const [showRespond, setShowRespond] = useState<Survey | null>(null);
  const [showVisibility, setShowVisibility] = useState<Survey | null>(null);
  const [showDelegation, setShowDelegation] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Survey | null>(null);
  const [showDeletionLog, setShowDeletionLog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  // Delegated users who can create/delete (managed by HR Manager)
  const [delegatedUsers, setDelegatedUsers] = useState<string[]>([]); // user IDs

  const [form, setForm] = useState({
    title: "",
    description: "",
    targetType: "todos" as Survey["targetType"],
    targetDept: "",
    questions: [{ id: "nq1", text: "", type: "rating" as SurveyQuestion["type"], options: [""] }],
  });

  const isHRManager = user?.email === HR_MANAGER_EMAIL || user?.isAdmin === true;
  // Can manage (create/delete): HR Manager, admins, or delegated users
  const canManage = isHRManager || (user ? delegatedUsers.includes(user.id) : false);
  const isHR = user?.department === "Recursos Humanos" || user?.isAdmin;

  const canSeeResults = (survey: Survey) => {
    if (!user) return false;
    if (isHRManager) return true;
    return survey.resultsVisibleTo.includes(user.id);
  };

  // Only show non-deleted surveys
  const activeSurveys = surveys.filter((s) => !s.deleted);

  const visibleSurveys = activeSurveys.filter((s) => {
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
      resultsVisibleTo: [],
      deleted: false,
    };
    setSurveys([newSurvey, ...surveys]);
    setShowCreate(false);
    setForm({ title: "", description: "", targetType: "todos", targetDept: "", questions: [{ id: "nq1", text: "", type: "rating", options: [""] }] });
  };

  const handleSoftDelete = (survey: Survey) => {
    if (!deleteReason.trim()) return;
    const now = new Date().toISOString().split("T")[0];
    // Log the deletion
    setDeletionLog([
      {
        surveyId: survey.id,
        surveyTitle: survey.title,
        deletedBy: user?.fullName || "Desconocido",
        deletedAt: now,
        reason: deleteReason,
        responsesCount: survey.responses.length,
      },
      ...deletionLog,
    ]);
    // Soft delete
    setSurveys(surveys.map((s) =>
      s.id === survey.id
        ? { ...s, deleted: true, deletedBy: user?.fullName, deletedAt: now, deleteReason: deleteReason }
        : s
    ));
    setShowDeleteConfirm(null);
    setDeleteReason("");
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

  const toggleResultsVisibility = (surveyId: string, userId: string) => {
    setSurveys(surveys.map((s) => {
      if (s.id !== surveyId) return s;
      const visible = s.resultsVisibleTo.includes(userId)
        ? s.resultsVisibleTo.filter((id) => id !== userId)
        : [...s.resultsVisibleTo, userId];
      return { ...s, resultsVisibleTo: visible };
    }));
  };

  const toggleDelegation = (userId: string) => {
    setDelegatedUsers(delegatedUsers.includes(userId)
      ? delegatedUsers.filter((id) => id !== userId)
      : [...delegatedUsers, userId]);
  };

  const addQuestion = () => {
    setForm({ ...form, questions: [...form.questions, { id: `nq${form.questions.length + 1}`, text: "", type: "rating", options: [""] }] });
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const qs = [...form.questions];
    (qs[idx] as any)[field] = value;
    setForm({ ...form, questions: qs });
  };

  const getResultsData = (survey: Survey, questionId: string) => {
    const q = survey.questions.find((q) => q.id === questionId);
    if (!q) return [];
    if (q.type === "rating") {
      return [1, 2, 3, 4, 5].map((r) => ({ name: `${r}⭐`, value: survey.responses.filter((resp) => Number(resp.answers[questionId]) === r).length }));
    }
    if (q.type === "multiple" && q.options) {
      return q.options.map((opt) => ({ name: opt, value: survey.responses.filter((resp) => resp.answers[questionId] === opt).length }));
    }
    return [];
  };

  const hrUsers = allUsers.filter((u) => u.department === "Recursos Humanos" && u.email !== HR_MANAGER_EMAIL);
  const deletedCount = surveys.filter((s) => s.deleted).length;

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
              <div className="flex items-center gap-2">
                {/* Delegation management - Only HR Manager */}
                {isHRManager && (
                  <button onClick={() => setShowDelegation(true)} className="p-2.5 rounded-lg border border-border text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors" title="Gestionar delegados">
                    <UserCog className="h-4 w-4" />
                  </button>
                )}
                {/* Deletion log - Only HR Manager */}
                {isHRManager && (
                  <button onClick={() => setShowDeletionLog(true)} className="p-2.5 rounded-lg border border-border text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors relative" title="Registro de eliminaciones">
                    <Archive className="h-4 w-4" />
                    {deletedCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{deletedCount}</span>
                    )}
                  </button>
                )}
                {canManage && (
                  <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Nueva Encuesta
                  </button>
                )}
              </div>
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
                    {canSeeResults(s) && (
                      <button onClick={() => setShowResults(s)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Ver resultados">
                        <BarChart3 className="h-4 w-4" />
                      </button>
                    )}
                    {isHRManager && (
                      <button onClick={() => setShowVisibility(s)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Gestionar visibilidad">
                        <Lock className="h-4 w-4" />
                      </button>
                    )}
                    {/* Delete - only canManage */}
                    {canManage && (
                      <button onClick={() => { setShowDeleteConfirm(s); setDeleteReason(""); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Eliminar encuesta">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {s.status === "activa" && !hasResponded(s) && (
                      <button onClick={() => { setShowRespond(s); setAnswers({}); }} className="btn-gold text-xs flex items-center gap-1">
                        <Send className="h-3 w-3" /> Responder
                      </button>
                    )}
                    {hasResponded(s) && (
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

        {/* ══════ Delete Confirmation Modal ══════ */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-destructive">Eliminar Encuesta</h2>
                <button onClick={() => setShowDeleteConfirm(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-card-foreground">¿Está seguro de eliminar esta encuesta?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{showDeleteConfirm.title}</strong> — {showDeleteConfirm.responses.length} respuestas registradas
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Archive className="h-3 w-3" /> La encuesta será archivada y quedará un registro permanente de esta eliminación.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Motivo de eliminación *</label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={2}
                    placeholder="Indique por qué se elimina esta encuesta..."
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-destructive outline-none resize-none"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={() => handleSoftDelete(showDeleteConfirm)}
                  disabled={!deleteReason.trim()}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Deletion Log Modal — HR Manager Only ══════ */}
        {showDeletionLog && isHRManager && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2"><Archive className="h-5 w-5" /> Registro de Eliminaciones</h2>
                  <p className="text-xs text-muted-foreground">{deletionLog.length} registros · {deletedCount} encuestas archivadas</p>
                </div>
                <button onClick={() => setShowDeletionLog(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5">
                {deletionLog.length === 0 && surveys.filter((s) => s.deleted).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay eliminaciones registradas</p>
                ) : (
                  <div className="space-y-3">
                    {/* Show from deletionLog + any soft-deleted surveys from initial data */}
                    {surveys.filter((s) => s.deleted).map((s) => {
                      const logEntry = deletionLog.find((l) => l.surveyId === s.id);
                      return (
                        <div key={s.id} className="bg-muted rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{s.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{s.id} · {s.responses.length} respuestas · Creada por {s.createdBy}</p>
                            </div>
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full shrink-0">Eliminada</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground"><strong>Eliminada por:</strong> {s.deletedBy || "—"}</p>
                            <p className="text-xs text-muted-foreground"><strong>Fecha:</strong> {s.deletedAt || "—"}</p>
                            <p className="text-xs text-muted-foreground"><strong>Motivo:</strong> {s.deleteReason || logEntry?.reason || "—"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowDeletionLog(false)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Delegation Modal — HR Manager Only ══════ */}
        {showDelegation && isHRManager && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2"><UserCog className="h-5 w-5" /> Delegar Gestión</h2>
                  <p className="text-xs text-muted-foreground">Otorgue permiso para crear y eliminar encuestas</p>
                </div>
                <button onClick={() => setShowDelegation(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground mb-4">
                  <ShieldCheck className="h-4 w-4 inline mr-1" />
                  Usted siempre tiene control total. Seleccione a quién delegar la capacidad de crear y eliminar encuestas:
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2 mb-1">Personal de RRHH</p>
                  {hrUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={delegatedUsers.includes(u.id)}
                        onChange={() => toggleDelegation(u.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-card-foreground">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.position}</p>
                      </div>
                      {delegatedUsers.includes(u.id) ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </label>
                  ))}
                  {hrUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No hay otros miembros en RRHH registrados.</p>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowDelegation(false)} className="btn-gold text-sm">Listo</button>
              </div>
            </div>
          </div>
        )}

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
        {showResults && canSeeResults(showResults) && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Resultados: {showResults.title}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    {showResults.responses.length} respuestas
                    <span className="flex items-center gap-1 text-amber-600"><Lock className="h-3 w-3" /> Solo visible para personal autorizado</span>
                  </p>
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

        {/* Visibility Management Modal */}
        {showVisibility && isHRManager && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Visibilidad de Resultados</h2>
                  <p className="text-xs text-muted-foreground">{showVisibility.title}</p>
                </div>
                <button onClick={() => setShowVisibility(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground mb-4">
                  <Lock className="h-4 w-4 inline mr-1" />
                  Usted siempre tiene acceso. Seleccione a quién más desea otorgar visibilidad de los resultados:
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2 mb-1">Personal de RRHH</p>
                  {hrUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={showVisibility.resultsVisibleTo.includes(u.id)}
                        onChange={() => toggleResultsVisibility(showVisibility.id, u.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-card-foreground">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.position}</p>
                      </div>
                      {showVisibility.resultsVisibleTo.includes(u.id) ? (
                        <Eye className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </label>
                  ))}
                  {hrUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No hay otros miembros en RRHH registrados.</p>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowVisibility(null)} className="btn-gold text-sm">Listo</button>
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
