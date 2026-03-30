import { useState } from "react";
import { Lock, X, AlertTriangle } from "lucide-react";

interface ChangePasswordModalProps {
  isForced: boolean;
  onChangePassword: (newPassword: string) => void;
  onClose?: () => void;
}

const ChangePasswordModal = ({ isForced, onChangePassword, onClose }: ChangePasswordModalProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword.toLowerCase() === "safeone") {
      setError("No puedes usar la contraseña por defecto");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    onChangePassword(newPassword);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            {isForced && <AlertTriangle className="h-5 w-5 text-gold" />}
            <h2 className="font-heading font-bold text-lg text-card-foreground">
              {isForced ? "Cambio de Contraseña Obligatorio" : "Cambiar Contraseña"}
            </h2>
          </div>
          {!isForced && onClose && (
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isForced && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3">
              <p className="text-sm text-card-foreground">
                Debes cambiar tu contraseña antes de continuar. Utiliza una contraseña segura de al menos 8 caracteres.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Nueva Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="Mínimo 8 caracteres"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Confirmar Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="Repite la contraseña"
              />
            </div>
          </div>

          {/* Password strength indicator */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Requisitos:</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${newPassword.length >= 8 ? "bg-green-500" : "bg-muted"}`} />
              <span className={`text-xs ${newPassword.length >= 8 ? "text-green-500" : "text-muted-foreground"}`}>
                Al menos 8 caracteres
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${newPassword.toLowerCase() !== "safeone" && newPassword.length > 0 ? "bg-green-500" : "bg-muted"}`} />
              <span className={`text-xs ${newPassword.toLowerCase() !== "safeone" && newPassword.length > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                No puede ser "safeone"
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${confirmPassword.length > 0 && newPassword === confirmPassword ? "bg-green-500" : "bg-muted"}`} />
              <span className={`text-xs ${confirmPassword.length > 0 && newPassword === confirmPassword ? "text-green-500" : "text-muted-foreground"}`}>
                Las contraseñas coinciden
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            className="btn-gold w-full flex items-center justify-center gap-2 text-sm"
          >
            <Lock className="h-4 w-4" />
            Cambiar Contraseña
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
