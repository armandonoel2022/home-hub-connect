import { useState } from "react";
import { Mail, X, CheckCircle, AlertTriangle } from "lucide-react";

interface ForgotPasswordModalProps {
  onClose: () => void;
  onSubmit: (email: string, fullName: string) => void;
}

const ForgotPasswordModal = ({ onClose, onSubmit }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() && !fullName.trim()) {
      setError("Ingresa tu correo o nombre completo");
      return;
    }

    onSubmit(email.trim(), fullName.trim());
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-heading font-bold text-lg text-card-foreground">
            Recuperar Acceso
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-heading font-bold text-lg text-card-foreground">
              Solicitud Enviada
            </h3>
            <p className="text-sm text-muted-foreground">
              Se ha generado un ticket de soporte de alta prioridad asignado al departamento de Tecnología.
              Un administrador revisará tu solicitud y restablecerá tu contraseña.
            </p>
            <p className="text-xs text-muted-foreground">
              Contacto directo: <span className="gold-accent-text">tecnologia@safeone.com.do</span>
            </p>
            <button onClick={onClose} className="btn-gold text-sm mx-auto">
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <p className="text-sm text-card-foreground">
                Se generará un ticket de soporte de alta prioridad para que el equipo de Tecnología restablezca tu contraseña.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground block mb-1.5">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  placeholder="usuario@safeone.com.do"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground block mb-1.5">Nombre Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="Tu nombre completo"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="submit" className="btn-gold text-sm">
                Solicitar Restablecimiento
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
