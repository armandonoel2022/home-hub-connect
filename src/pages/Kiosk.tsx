/**
 * /kiosko – Acceso público sin contraseña para agentes en puestos.
 * Login: código de empleado (USR-XXX) + PIN de 4 dígitos.
 * En este modo todas las evaluaciones son por confirmación de lectura.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/safeone-logo.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trainingApi, isApiConfigured } from "@/lib/api";
import { getAllCourses } from "@/lib/trainingCourses";
import type { TrainingCertificate, TrainingCourse, TrainingEnrollment } from "@/lib/trainingTypes";
import { downloadCertificatePdf, printCertificatePdf } from "@/lib/trainingCertificate";
import { toast } from "sonner";
import { GraduationCap, Lock, ChevronLeft, ChevronRight, CheckCircle2, Award, LogOut, Printer, Download, BookOpen, Clock } from "lucide-react";

interface KioskUser {
  id: string;
  fullName: string;
  position: string;
  department: string;
}

function renderRich(text: string) {
  return text.split(/\n\n+/).map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-base leading-relaxed text-foreground mb-3 whitespace-pre-line">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="text-foreground">{p.slice(2, -2)}</strong>
          ) : <span key={j}>{p}</span>
        )}
      </p>
    );
  });
}

const Kiosk = () => {
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [user, setUser] = useState<KioskUser | null>(null);
  const [loading, setLoading] = useState(false);

  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [certificates, setCertificates] = useState<TrainingCertificate[]>([]);
  const [activeCourse, setActiveCourse] = useState<TrainingCourse | null>(null);
  const [section, setSection] = useState(0);
  const [readSet, setReadSet] = useState<Set<number>>(new Set());
  const [evalOpen, setEvalOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const apiMode = isApiConfigured();

  // ─── Login
  const handleLogin = async () => {
    if (!employeeCode || pin.length !== 4) {
      toast.error("Ingresa tu código y un PIN de 4 dígitos");
      return;
    }
    setLoading(true);
    try {
      if (apiMode) {
        const res = await trainingApi.kioskLogin(employeeCode.toUpperCase(), pin);
        setUser(res.user);
        await loadUserData(res.user.id);
      } else {
        toast.error("El kiosko requiere conexión al servidor backend.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Código o PIN incorrecto");
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (uid: string) => {
    try {
      const [e, c] = await Promise.all([
        trainingApi.getEnrollments(uid),
        trainingApi.getCertificates(uid),
      ]);
      setEnrollments(e); setCertificates(c);
    } catch {}
  };

  const handleLogout = () => {
    setUser(null); setEmployeeCode(""); setPin("");
    setEnrollments([]); setCertificates([]); setActiveCourse(null);
  };

  // ─── Course navigation
  const enrollmentFor = (id: string) => enrollments.find(e => e.courseId === id);
  const certificateFor = (id: string) => certificates.find(c => c.courseId === id);

  const openCourse = (c: TrainingCourse) => {
    setActiveCourse(c);
    const enr = enrollmentFor(c.id);
    setSection(enr?.currentSection ?? 0);
    setReadSet(new Set(enr?.sectionsRead ?? []));
  };

  const persistProgress = async () => {
    if (!activeCourse || !user) return;
    try {
      await trainingApi.saveEnrollment({
        userId: user.id, courseId: activeCourse.id,
        currentSection: section, sectionsRead: Array.from(readSet),
        status: "en-progreso",
      });
    } catch {}
  };

  const goNext = () => {
    if (!activeCourse) return;
    setReadSet(prev => new Set(prev).add(section));
    if (section < activeCourse.sections.length - 1) {
      setSection(section + 1);
    } else {
      persistProgress();
      setConfirmChecked(false);
      setEvalOpen(true);
    }
  };

  const goPrev = () => { if (section > 0) setSection(section - 1); };

  const submitConfirmation = async () => {
    if (!activeCourse || !user || !confirmChecked) {
      toast.error("Debes confirmar la lectura del material.");
      return;
    }
    try {
      const result = await trainingApi.submitAttempt({
        userId: user.id, courseId: activeCourse.id, mode: "confirm",
        passed: true, score: null,
        fullName: user.fullName, position: user.position, department: user.department,
      });
      toast.success("¡Capacitación completada! Tu certificado se está descargando.");
      setEvalOpen(false);
      setActiveCourse(null);
      await loadUserData(user.id);
      if (result.certificate) await downloadCertificatePdf(result.certificate);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    }
  };

  // ═══════════════════════════════════════
  // RENDER: Login screen
  // ═══════════════════════════════════════
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal p-4" style={{ background: "var(--gradient-dark)" }}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="SafeOne" className="h-16 w-auto mx-auto mb-3" />
            <CardTitle className="text-2xl font-heading">
              SAFE<span className="gold-accent-text">ONE</span> · Kiosko de Capacitación
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Ingresa tu código de empleado y PIN para acceder a tus cursos BASC.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="kiosk-code">Código de empleado</Label>
              <Input
                id="kiosk-code"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="Ej. USR-130"
                className="mt-1 text-lg"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="kiosk-pin">PIN (4 dígitos)</Label>
              <Input
                id="kiosk-pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="mt-1 text-lg tracking-[0.5em] text-center"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full h-12 text-base">
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Verificando..." : "Ingresar"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Si no tienes PIN, solicítalo a Recursos Humanos (Dilia Aguasvivas).
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full text-xs text-muted-foreground hover:text-gold mt-2"
            >
              ¿Eres personal administrativo? Iniciar sesión normal
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: Course list
  // ═══════════════════════════════════════
  const completedCount = enrollments.filter(e => e.status === "completado").length;
  const totalCourses = getAllCourses().length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-charcoal text-white py-4 px-6 flex items-center justify-between" style={{ background: "var(--gradient-dark)" }}>
        <div className="flex items-center gap-3">
          <img src={logo} alt="SafeOne" className="h-10 w-auto" />
          <div>
            <h1 className="font-heading font-bold text-lg">Kiosko de Capacitación BASC</h1>
            <p className="text-xs text-muted-foreground">
              {user.fullName} · {user.position} · {user.department}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout} className="bg-transparent text-white border-white/30 hover:bg-white/10">
          <LogOut className="h-4 w-4 mr-2" /> Salir
        </Button>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Stats */}
        <Card className="mb-6">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Progreso general</p>
              <p className="text-3xl font-bold text-foreground">{completedCount} de {totalCourses}</p>
              <p className="text-xs text-muted-foreground">cursos completados</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Certificados</p>
              <p className="text-3xl font-bold text-gold flex items-center gap-2">
                <Award className="h-7 w-7" /> {certificates.length}
              </p>
            </div>
          </CardContent>
          <div className="px-6 pb-4">
            <Progress value={(completedCount / totalCourses) * 100} className="h-2" />
          </div>
        </Card>

        {/* Courses */}
        <h2 className="font-heading text-xl font-bold mb-3">Mis cursos</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {getAllCourses().map((c) => {
            const enr = enrollmentFor(c.id);
            const cert = certificateFor(c.id);
            const completed = enr?.status === "completado";
            return (
              <Card key={c.id} className={completed ? "border-green-500/40" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Badge className={c.bascRelated ? "bg-gold text-charcoal" : ""}>{c.code}</Badge>
                    {completed && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                  </div>
                  <CardTitle className="text-base mt-2">{c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">{c.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.durationMinutes} min</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{c.sections.length} secciones</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => openCourse(c)} className="flex-1 h-11">
                      {completed ? "Repasar" : enr ? "Continuar" : "Iniciar"}
                    </Button>
                    {cert && (
                      <>
                        <Button variant="outline" onClick={() => downloadCertificatePdf(cert)}><Download className="h-4 w-4" /></Button>
                        <Button variant="outline" onClick={() => printCertificatePdf(cert)}><Printer className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Course Reader */}
      <Dialog open={!!activeCourse} onOpenChange={(o) => !o && setActiveCourse(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {activeCourse && (
            <>
              <DialogHeader>
                <Badge className="w-fit bg-gold text-charcoal">{activeCourse.code}</Badge>
                <DialogTitle className="text-xl">{activeCourse.title}</DialogTitle>
                <Progress value={((section + 1) / activeCourse.sections.length) * 100} className="h-1.5 mt-2" />
                <p className="text-xs text-muted-foreground">
                  Sección {section + 1} de {activeCourse.sections.length}
                </p>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 py-2">
                <h3 className="font-heading font-bold text-xl mb-3">{activeCourse.sections[section].title}</h3>
                {renderRich(activeCourse.sections[section].content)}
              </div>
              <DialogFooter className="flex sm:justify-between gap-2">
                <Button variant="outline" onClick={goPrev} disabled={section === 0} className="h-11">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button onClick={goNext} className="h-11">
                  {section === activeCourse.sections.length - 1
                    ? "Finalizar y confirmar"
                    : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="max-w-lg">
          {activeCourse && (
            <>
              <DialogHeader>
                <DialogTitle>Confirmación de lectura</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm mb-4 text-foreground">{activeCourse.confirmStatement}</p>
                <div className="flex items-start gap-2 bg-muted/30 p-3 rounded-lg">
                  <Checkbox
                    id="kiosk-confirm"
                    checked={confirmChecked}
                    onCheckedChange={(v) => setConfirmChecked(v === true)}
                  />
                  <Label htmlFor="kiosk-confirm" className="text-sm cursor-pointer">
                    Confirmo que he leído y comprendido el material y me comprometo a aplicarlo.
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEvalOpen(false)}>Cancelar</Button>
                <Button onClick={submitConfirmation} disabled={!confirmChecked}>
                  Generar certificado
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kiosk;
