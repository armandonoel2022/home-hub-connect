import { useAuth } from "@/contexts/AuthContext";
import { AUTHORIZED_EMAILS } from "@/lib/techTaskTypes";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAuthorized = user && AUTHORIZED_EMAILS.includes(user.email.toLowerCase());

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Acceso No Autorizado</h2>
        <p className="text-muted-foreground max-w-md">
          Este módulo está restringido al equipo de Coordinación de Tecnología.
          Si necesitas acceso, contacta al administrador del sistema.
        </p>
        <Button onClick={() => navigate("/")} variant="outline">
          Volver al Inicio
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
