import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canView, type ModuleKey } from "@/lib/permissions";
import { toast } from "@/hooks/use-toast";

interface RouteGuardProps {
  module: ModuleKey;
  children: ReactNode;
}

/**
 * Bloquea acceso directo por URL a módulos para los que el usuario no tiene permiso.
 * Redirige a `/` y muestra un toast.
 */
const RouteGuard = ({ module, children }: RouteGuardProps) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <>{children}</>; // ProtectedRoutes ya maneja el login

  if (!canView(module, user)) {
    toast({
      title: "Acceso restringido",
      description: "No tienes permiso para ver este módulo.",
      variant: "destructive",
    });
    return <Navigate to="/" replace state={{ blocked: location.pathname }} />;
  }

  return <>{children}</>;
};

export default RouteGuard;
