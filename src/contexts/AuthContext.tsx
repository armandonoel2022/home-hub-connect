import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { IntranetUser } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";

interface AuthContextType {
  user: IntranetUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  hasAccess: (department: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock users for development — replace with SQL Server auth tomorrow
const MOCK_USERS: IntranetUser[] = [
  {
    id: "USR-001",
    fullName: "Administrador SafeOne",
    email: "admin@safeone.com",
    department: "Tecnología y Monitoreo",
    position: "Administrador IT",
    birthday: "03-05",
    photoUrl: "",
    allowedDepartments: DEPARTMENTS,
    isAdmin: true,
  },
  {
    id: "USR-002",
    fullName: "María López",
    email: "maria.lopez@safeone.com",
    department: "Servicio al Cliente",
    position: "Coordinadora",
    birthday: "07-15",
    photoUrl: "",
    allowedDepartments: ["Servicio al Cliente"],
    isAdmin: false,
  },
  {
    id: "USR-003",
    fullName: "Carlos Méndez",
    email: "carlos.mendez@safeone.com",
    department: "Contabilidad",
    position: "Contador",
    birthday: "03-05", // Today for demo
    photoUrl: "",
    allowedDepartments: ["Contabilidad", "Cuentas por Cobrar"],
    isAdmin: false,
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IntranetUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("safeone_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, _password: string): Promise<boolean> => {
    // TODO: Replace with SQL Server API call
    // const res = await authApi.login(username, password);
    const found = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === username.toLowerCase() || u.fullName.toLowerCase() === username.toLowerCase()
    );
    if (found) {
      setUser(found);
      localStorage.setItem("safeone_user", JSON.stringify(found));
      localStorage.setItem("safeone_token", "mock-token-" + found.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("safeone_user");
    localStorage.removeItem("safeone_token");
  };

  const hasAccess = (department: string) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    return user.allowedDepartments.includes(department);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
