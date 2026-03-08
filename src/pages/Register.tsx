import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/safeone-logo.png";
import { User, Mail, Building2, Briefcase, Send, ArrowLeft } from "lucide-react";
import { DEPARTMENTS } from "@/lib/types";
import type { RegistrationRequest } from "@/lib/registrationTypes";

const STORAGE_KEY = "safeone_registration_requests";

function getRequests(): RegistrationRequest[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function saveRequest(req: RegistrationRequest) {
  const all = getRequests();
  all.unshift(req);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

const RegisterPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [position, setPosition] = useState("");
  const [justification, setJustification] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Nombre y correo son obligatorios");
      return;
    }

    const existing = getRequests();
    if (existing.some((r) => r.email.toLowerCase() === email.trim().toLowerCase() && r.status === "pendiente")) {
      setError("Ya existe una solicitud pendiente con este correo");
      return;
    }

    const req: RegistrationRequest = {
      id: `REG-${Date.now()}`,
      fullName: fullName.trim(),
      email: email.trim(),
      department,
      position: position.trim(),
      birthday: "",
      justification: justification.trim(),
      status: "pendiente",
      requestedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    };

    saveRequest(req);

    // Queue email notification for department leader
    import("@/lib/emailService").then(({ notifyRegistrationRequest }) => {
      notifyRegistrationRequest("lider@safeone.com.do", fullName.trim(), department);
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-dark)" }}>
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center mb-6">
            <img src={logo} alt="SafeOne" className="h-16 w-auto mb-3" />
          </div>
          <div className="bg-card rounded-xl p-6 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Send className="h-7 w-7 text-green-500" />
            </div>
            <h2 className="font-heading font-bold text-lg text-card-foreground mb-2">Solicitud Enviada</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tu solicitud de acceso ha sido enviada al líder de <strong>{department}</strong> para aprobación.
              Recibirás una notificación cuando sea procesada.
            </p>
            <Link to="/login" className="btn-gold inline-flex items-center gap-2 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Volver al Inicio de Sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-dark)" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="SafeOne" className="h-16 w-auto mb-3" />
          <h1 className="font-heading font-bold text-xl text-secondary-foreground">
            Solicitud de <span className="gold-accent-text">Acceso</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Completa el formulario para solicitar acceso a la intranet</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 shadow-2xl space-y-4">
          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Nombre Completo *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="Tu nombre completo"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Correo Electrónico *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="tucorreo@safeone.com.do"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none appearance-none"
              >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Cargo / Posición</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="Tu cargo en la empresa"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Justificación</label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none"
              placeholder="¿Por qué necesitas acceso a la intranet?"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-gold w-full flex items-center justify-center gap-2 text-sm">
            <Send className="h-4 w-4" />
            Enviar Solicitud
          </button>

          <p className="text-xs text-muted-foreground text-center mt-2">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="gold-accent-text hover:underline font-medium">Iniciar Sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
