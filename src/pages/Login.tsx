import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/safeone-logo.png";
import { Lock, User, LogIn } from "lucide-react";

const LoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Ingresa tu usuario o correo");
      return;
    }
    setError("");
    setLoading(true);
    const ok = await login(username.trim(), password);
    setLoading(false);
    if (ok) {
      navigate("/", { replace: true });
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-dark)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="SafeOne" className="h-20 w-auto mb-4" />
          <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
            SAFE<span className="gold-accent-text">ONE</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Intranet Corporativa</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 shadow-2xl space-y-4">
          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Usuario o Correo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="admin@safeone.com"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-card-foreground block mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full flex items-center justify-center gap-2 text-sm"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="gold-accent-text hover:underline font-medium">Solicitar Acceso</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
