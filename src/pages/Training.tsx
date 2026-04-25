import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { TRAINING_COURSES, getCourseById } from "@/lib/trainingCourses";
import type { TrainingCertificate, TrainingCourse, TrainingEnrollment } from "@/lib/trainingTypes";
import { trainingApi, isApiConfigured } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  GraduationCap, Award, CheckCircle2, Clock, FileText, Printer, Download,
  ChevronLeft, ChevronRight, ShieldCheck, BookOpen, KeyRound, Users as UsersIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadCertificatePdf, printCertificatePdf } from "@/lib/trainingCertificate";

// ─── Local storage fallback (cuando API no está configurada) ──────────────
const LS_KEY = "safeone_training_state_v1";
type LocalState = { enrollments: TrainingEnrollment[]; certificates: TrainingCertificate[] };
const loadLocal = (): LocalState => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "") || { enrollments: [], certificates: [] }; }
  catch { return { enrollments: [], certificates: [] }; }
};
const saveLocal = (s: LocalState) => localStorage.setItem(LS_KEY, JSON.stringify(s));

// ─── Helper: simple **bold** renderer ──────────────────────────────────────
function renderRich(text: string) {
  return text.split(/\n\n+/).map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-sm leading-relaxed text-foreground/90 mb-3 whitespace-pre-line">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="text-foreground">{p.slice(2, -2)}</strong>
          ) : <span key={j}>{p}</span>
        )}
      </p>
    );
  });
}

const Training = () => {
  const { user, allUsers } = useAuth();
  const apiMode = isApiConfigured();

  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [certificates, setCertificates] = useState<TrainingCertificate[]>([]);
  const [activeCourse, setActiveCourse] = useState<TrainingCourse | null>(null);
  const [section, setSection] = useState(0);
  const [readSections, setReadSections] = useState<Set<number>>(new Set());
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalMode, setEvalMode] = useState<"quiz" | "confirm">("quiz");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Admin panel state
  const isAdminOrHR = !!user && (user.isAdmin || user.department === "Recursos Humanos");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<"pins" | "compliance">("pins");
  const [pins, setPins] = useState<Record<string, string>>({});
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});
  const [allEnrollments, setAllEnrollments] = useState<TrainingEnrollment[]>([]);
  const [allCertificates, setAllCertificates] = useState<TrainingCertificate[]>([]);
  const [adminSearch, setAdminSearch] = useState("");

  // Load data
  const refresh = async () => {
    if (!user) return;
    if (apiMode) {
      try {
        const [e, c] = await Promise.all([
          trainingApi.getEnrollments(user.id),
          trainingApi.getCertificates(user.id),
        ]);
        setEnrollments(e); setCertificates(c);
      } catch {
        const local = loadLocal();
        setEnrollments(local.enrollments.filter(x => x.userId === user.id));
        setCertificates(local.certificates.filter(x => x.userId === user.id));
      }
    } else {
      const local = loadLocal();
      setEnrollments(local.enrollments.filter(x => x.userId === user.id));
      setCertificates(local.certificates.filter(x => x.userId === user.id));
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  // ─── Determinar modo de evaluación: agentes en kiosko = confirm; resto = quiz
  // Aquí asumimos que si el usuario es operador de seguridad / monitoreo en puesto
  // (sin email corporativo ó cargo "Operador") usa modo confirm. Por simplicidad,
  // todos los que tienen sesión web usan quiz; el kiosko fuerza confirm desde su ruta.
  const defaultMode: "quiz" | "confirm" = "quiz";

  const enrollmentFor = (cId: string) => enrollments.find(e => e.courseId === cId);
  const certificateFor = (cId: string) => certificates.find(c => c.courseId === cId);

  // Un curso se considera completado si tiene status 'completado' O si existe
  // un certificado emitido para ese curso (recuperación frente a estados perdidos).
  const isCourseCompleted = (cId: string) => {
    const enr = enrollmentFor(cId);
    if (enr?.status === "completado") return true;
    return !!certificateFor(cId);
  };

  // Stats
  const completedCount = TRAINING_COURSES.filter(c => isCourseCompleted(c.id)).length;
  const totalCourses = TRAINING_COURSES.length;
  const completionPct = Math.round((completedCount / totalCourses) * 100);

  // ─── Open course
  const openCourse = (c: TrainingCourse) => {
    setActiveCourse(c);
    const enr = enrollmentFor(c.id);
    setSection(enr?.currentSection ?? 0);
    setReadSections(new Set(enr?.sectionsRead ?? []));
  };

  const closeCourse = async () => {
    if (activeCourse && user) {
      // Persist progress
      await persistProgress();
    }
    setActiveCourse(null);
  };

  const persistProgress = async () => {
    if (!activeCourse || !user) return;
    const existingEnr = enrollmentFor(activeCourse.id);
    const alreadyCompleted = existingEnr?.status === "completado";
    const data = {
      userId: user.id, courseId: activeCourse.id,
      currentSection: section,
      sectionsRead: Array.from(readSections),
      // Preservar 'completado' si el usuario sólo está repasando.
      status: alreadyCompleted ? "completado" : "en-progreso",
    };
    if (apiMode) {
      try { await trainingApi.saveEnrollment(data); } catch {}
    } else {
      const local = loadLocal();
      const existing = local.enrollments.find(e => e.userId === user.id && e.courseId === activeCourse.id);
      const now = new Date().toISOString();
      if (existing) {
        existing.currentSection = section;
        existing.sectionsRead = Array.from(new Set([...(existing.sectionsRead || []), ...readSections]));
        if (existing.status !== "completado") existing.status = "en-progreso";
        existing.updatedAt = now;
      } else {
        local.enrollments.push({
          id: `ENR-${Date.now()}`, userId: user.id, courseId: activeCourse.id,
          startedAt: now, currentSection: section, sectionsRead: Array.from(readSections),
          status: "en-progreso", attempts: [], updatedAt: now,
        });
      }
      saveLocal(local);
    }
  };

  const markSectionRead = (idx: number) => {
    setReadSections(prev => new Set(prev).add(idx));
  };

  const goNext = () => {
    if (!activeCourse) return;
    markSectionRead(section);
    if (section < activeCourse.sections.length - 1) {
      setSection(section + 1);
    } else {
      // Llegamos al final → abrir evaluación
      persistProgress();
      setEvalMode(defaultMode);
      setAnswers({});
      setConfirmChecked(false);
      setEvalOpen(true);
    }
  };

  const goPrev = () => { if (section > 0) setSection(section - 1); };

  // ─── Submit evaluation
  const submitEval = async () => {
    if (!activeCourse || !user) return;
    let passed = false;
    let score: number | null = null;

    if (evalMode === "quiz") {
      const total = activeCourse.quiz.length;
      let correct = 0;
      activeCourse.quiz.forEach(q => {
        if (answers[q.id] === q.correctIndex) correct++;
      });
      score = Math.round((correct / total) * 100);
      passed = score >= 80;
    } else {
      passed = confirmChecked;
      score = null;
    }

    if (!passed) {
      if (evalMode === "quiz") {
        toast.error(`Calificación ${score}%. Necesitas al menos 80% para aprobar. Repasa el material e inténtalo de nuevo.`);
      } else {
        toast.error("Debes confirmar la lectura del material.");
      }
      return;
    }

    const payload = {
      userId: user.id, courseId: activeCourse.id, mode: evalMode,
      answers: evalMode === "quiz" ? activeCourse.quiz.map(q => answers[q.id] ?? -1) : [],
      score, passed: true,
      fullName: user.fullName, position: user.position || "", department: user.department || "",
    };

    let cert: TrainingCertificate | null = null;
    if (apiMode) {
      try {
        const result = await trainingApi.submitAttempt(payload);
        cert = result.certificate;
      } catch (e) {
        toast.error("Error guardando en servidor, usando modo local.");
      }
    }
    if (!cert) {
      // Local fallback
      const local = loadLocal();
      const seq = local.certificates.length + 1;
      const year = new Date().getFullYear();
      cert = {
        id: `CERT-${year}-${String(seq).padStart(5, "0")}`,
        userId: user.id, fullName: user.fullName, position: user.position || "",
        department: user.department || "",
        courseId: activeCourse.id, courseName: activeCourse.title, courseCode: activeCourse.code,
        score, issuedAt: new Date().toISOString(),
        verificationCode: `SSC-${year}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
      };
      local.certificates = local.certificates.filter(c => !(c.userId === user.id && c.courseId === activeCourse.id));
      local.certificates.push(cert);
      const enr = local.enrollments.find(e => e.userId === user.id && e.courseId === activeCourse.id);
      if (enr) { enr.status = "completado"; enr.completedAt = cert.issuedAt; enr.score = score; }
      saveLocal(local);
    }

    toast.success("¡Felicidades! Has aprobado el curso. Tu certificado está listo.");
    setEvalOpen(false);
    setActiveCourse(null);
    await refresh();

    // Auto-descargar certificado
    if (cert) await downloadCertificatePdf(cert);
  };

  // ─── Admin: load PINs + global compliance
  const loadAdminData = async () => {
    if (!isAdminOrHR) return;
    try {
      const [p, allEnrs] = await Promise.all([
        trainingApi.getPins(),
        // Reuse enrollments endpoint without userId → returns all
        trainingApi.getEnrollments(),
      ]);
      setPins(p || {});
      setAllEnrollments(allEnrs || []);
      const allCerts = await trainingApi.getCertificates();
      setAllCertificates(allCerts || []);
    } catch (e: any) {
      toast.error("No se pudieron cargar datos de administración");
    }
  };

  const savePin = async (userId: string) => {
    const pin = pinDrafts[userId];
    if (!/^\d{4}$/.test(pin || "")) { toast.error("PIN debe ser 4 dígitos"); return; }
    try {
      await trainingApi.setPin(userId, pin);
      setPins({ ...pins, [userId]: pin });
      setPinDrafts({ ...pinDrafts, [userId]: "" });
      toast.success("PIN actualizado");
    } catch (e: any) {
      toast.error(e?.message || "Error guardando PIN");
    }
  };

  // ─── Render
  if (!user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-6 flex-1">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
                <GraduationCap className="h-8 w-8 text-gold" />
                Capacitaciones BASC
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Completa los cursos obligatorios para mantener el cumplimiento BASC.
                Recibirás un certificado oficial al aprobar cada uno.
              </p>
            </div>
            {isAdminOrHR && (
              <Button
                variant="outline"
                onClick={() => { setAdminOpen(true); loadAdminData(); }}
                className="shrink-0"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Administración
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cursos completados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{completedCount}/{totalCourses}</div>
                <Progress value={completionPct} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Certificados emitidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gold flex items-center gap-2">
                  <Award className="h-7 w-7" />
                  {certificates.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estado de cumplimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold flex items-center gap-2 ${completedCount === totalCourses ? "text-green-600" : "text-amber-600"}`}>
                  <ShieldCheck className="h-7 w-7" />
                  {completedCount === totalCourses ? "EN COMPLIANCE" : "EN PROGRESO"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Course list */}
          <h2 className="font-heading text-xl font-bold text-foreground mb-3">Mis cursos</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRAINING_COURSES.map((c) => {
              const enr = enrollmentFor(c.id);
              const cert = certificateFor(c.id);
              const completed = enr?.status === "completado" || !!cert;
              const progress = enr ? Math.round(((enr.sectionsRead?.length || 0) / c.sections.length) * 100) : 0;
              return (
                <Card key={c.id} className={`transition-all hover:shadow-lg ${completed ? "border-green-500/40" : ""}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant={c.bascRelated ? "default" : "secondary"} className={c.bascRelated ? "bg-gold text-charcoal" : ""}>
                          {c.code}
                        </Badge>
                        {c.mandatory && <Badge variant="outline" className="ml-2 text-xs">Obligatorio</Badge>}
                      </div>
                      {completed && <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />}
                    </div>
                    <CardTitle className="text-base mt-2">{c.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{c.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.durationMinutes} min</span>
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{c.sections.length} secciones</span>
                    </div>
                    {enr && (
                      <div className="mb-3">
                        <Progress value={completed ? 100 : progress} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {completed ? `Aprobado${enr.score != null ? ` · ${enr.score}%` : ""}` : `${progress}% completado`}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => openCourse(c)} className="flex-1">
                        {completed ? "Repasar" : enr ? "Continuar" : "Iniciar"}
                      </Button>
                      {cert && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => downloadCertificatePdf(cert)} title="Descargar certificado">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => printCertificatePdf(cert)} title="Imprimir">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Certificates list */}
          {certificates.length > 0 && (
            <>
              <h2 className="font-heading text-xl font-bold text-foreground mt-8 mb-3 flex items-center gap-2">
                <Award className="h-5 w-5 text-gold" />
                Mis certificados
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {certificates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                        <div>
                          <p className="font-semibold text-sm">{c.courseName}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.id} · Emitido el {new Date(c.issuedAt).toLocaleDateString("es-DO")}
                            {c.score != null && ` · ${c.score}%`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => downloadCertificatePdf(c)}>
                            <Download className="h-4 w-4 mr-1" /> PDF
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => printCertificatePdf(c)}>
                            <Printer className="h-4 w-4 mr-1" /> Imprimir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ═══ Course Reader Dialog ═══ */}
      <Dialog open={!!activeCourse} onOpenChange={(o) => !o && closeCourse()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {activeCourse && (
            <>
              <DialogHeader>
                <Badge className="w-fit bg-gold text-charcoal">{activeCourse.code}</Badge>
                <DialogTitle className="text-xl">{activeCourse.title}</DialogTitle>
                <Progress
                  value={((section + 1) / activeCourse.sections.length) * 100}
                  className="h-1.5 mt-2"
                />
                <p className="text-xs text-muted-foreground">
                  Sección {section + 1} de {activeCourse.sections.length}: {activeCourse.sections[section].title}
                </p>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 py-2">
                <h3 className="font-heading font-bold text-lg text-foreground mb-3">
                  {activeCourse.sections[section].title}
                </h3>
                {renderRich(activeCourse.sections[section].content)}
              </div>
              <DialogFooter className="flex sm:justify-between gap-2">
                <Button variant="outline" onClick={goPrev} disabled={section === 0}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button onClick={goNext}>
                  {section === activeCourse.sections.length - 1 ? (
                    <>Ir a evaluación <FileText className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Evaluation Dialog ═══ */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          {activeCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gold" />
                  Evaluación: {activeCourse.title}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {evalMode === "quiz"
                    ? `Responde correctamente al menos 80% (${Math.ceil(activeCourse.quiz.length * 0.8)} de ${activeCourse.quiz.length} preguntas).`
                    : "Confirma que has leído y comprendido el material."}
                </p>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 py-2 space-y-4">
                {evalMode === "quiz" ? (
                  activeCourse.quiz.map((q, i) => (
                    <div key={q.id} className="border border-border rounded-lg p-3">
                      <p className="font-medium text-sm mb-2">{i + 1}. {q.question}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, idx) => (
                          <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                            <input
                              type="radio"
                              name={q.id}
                              checked={answers[q.id] === idx}
                              onChange={() => setAnswers({ ...answers, [q.id]: idx })}
                              className="mt-0.5"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-foreground mb-4">{activeCourse.confirmStatement}</p>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="confirm-read"
                        checked={confirmChecked}
                        onCheckedChange={(v) => setConfirmChecked(v === true)}
                      />
                      <Label htmlFor="confirm-read" className="text-sm cursor-pointer leading-tight">
                        Confirmo que he leído y comprendido el material de esta capacitación, y me
                        comprometo a aplicarla en el desempeño de mis funciones.
                      </Label>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEvalOpen(false)}>Cancelar</Button>
                {evalMode === "quiz" && (
                  <Button variant="outline" onClick={() => setEvalMode("confirm")} title="Modo confirmación (kiosko)">
                    Cambiar a confirmación
                  </Button>
                )}
                <Button onClick={submitEval}>
                  Enviar evaluación
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Admin Panel ═══ */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-gold" />
              Administración de Capacitaciones
            </DialogTitle>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant={adminTab === "pins" ? "default" : "outline"} onClick={() => setAdminTab("pins")}>
                <KeyRound className="h-4 w-4 mr-1" /> PINs Kiosko
              </Button>
              <Button size="sm" variant={adminTab === "compliance" ? "default" : "outline"} onClick={() => setAdminTab("compliance")}>
                <ShieldCheck className="h-4 w-4 mr-1" /> Compliance
              </Button>
            </div>
            <Input
              placeholder="Buscar empleado..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              className="mt-2"
            />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            {adminTab === "pins" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Asigna un PIN de 4 dígitos a cada empleado para que pueda acceder al kiosko en su puesto.
                  El acceso es por <strong>código de empleado + PIN</strong> en <code>/kiosko</code>.
                </p>
                {(allUsers || [])
                  .filter(u => !adminSearch ||
                    u.fullName.toLowerCase().includes(adminSearch.toLowerCase()) ||
                    u.id.toLowerCase().includes(adminSearch.toLowerCase()))
                  .map(u => (
                    <div key={u.id} className="flex items-center gap-2 p-2 border border-border rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.fullName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {u.id} · {u.position} · {u.department}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pins[u.id] ? <Badge variant="secondary">PIN: ••••</Badge> : <Badge variant="outline">Sin PIN</Badge>}
                      </div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="0000"
                        value={pinDrafts[u.id] || ""}
                        onChange={(e) => setPinDrafts({ ...pinDrafts, [u.id]: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        className="w-20 text-center"
                      />
                      <Button size="sm" onClick={() => savePin(u.id)}>Guardar</Button>
                    </div>
                  ))}
              </div>
            )}
            {adminTab === "compliance" && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  Estado de cumplimiento por empleado. Verde = todos los cursos completados.
                </p>
                <div className="space-y-1">
                  {(allUsers || [])
                    .filter(u => !adminSearch ||
                      u.fullName.toLowerCase().includes(adminSearch.toLowerCase()))
                    .map(u => {
                      const myEnrs = allEnrollments.filter(e => e.userId === u.id);
                      const myCerts = allCertificates.filter(c => c.userId === u.id);
                      // Un curso cuenta como completado si hay enrollment 'completado'
                      // o si existe certificado para ese curso (recupera estados perdidos).
                      const completedCourseIds = new Set<string>([
                        ...myEnrs.filter(e => e.status === "completado").map(e => e.courseId),
                        ...myCerts.map(c => c.courseId),
                      ]);
                      const completed = TRAINING_COURSES.filter(c => completedCourseIds.has(c.id)).length;
                      const total = TRAINING_COURSES.length;
                      const pct = Math.round((completed / total) * 100);
                      return (
                        <div key={u.id} className="flex items-center gap-3 p-2 border border-border rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.fullName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.position} · {u.department}</p>
                          </div>
                          <div className="w-32">
                            <Progress value={pct} className="h-1.5" />
                          </div>
                          <Badge className={completed === total ? "bg-green-600" : ""}>
                            {completed}/{total}
                          </Badge>
                          {myCerts.length > 0 && (
                            <Badge variant="outline">
                              <Award className="h-3 w-3 mr-1" />{myCerts.length}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Training;
