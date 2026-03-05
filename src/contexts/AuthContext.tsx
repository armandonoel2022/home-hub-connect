import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { IntranetUser } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";

interface AuthContextType {
  user: IntranetUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  hasAccess: (department: string) => boolean;
  // User management
  allUsers: IntranetUser[];
  addUser: (u: IntranetUser) => void;
  updateUser: (id: string, data: Partial<IntranetUser>) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INITIAL_USERS: IntranetUser[] = [
  {
    id: "USR-001",
    fullName: "Administrador SafeOne",
    email: "tecnologia@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "Administrador IT",
    birthday: "03-05",
    photoUrl: "",
    allowedDepartments: DEPARTMENTS,
    isAdmin: true,
  },
  {
    id: "USR-002",
    fullName: "Anoel",
    email: "anoel@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "IT Manager",
    birthday: "07-15",
    photoUrl: "",
    allowedDepartments: DEPARTMENTS,
    isAdmin: true,
  },
  {
    id: "USR-005",
    fullName: "Remit López",
    email: "rlopez@safeone.com.do",
    department: "Operaciones",
    position: "Gerente de Operaciones",
    birthday: "01-10",
    photoUrl: "",
    allowedDepartments: ["Operaciones"],
    isAdmin: false,
  },
  {
    id: "USR-003",
    fullName: "María López",
    email: "maria.lopez@safeone.com.do",
    department: "Servicio al Cliente",
    position: "Coordinadora",
    birthday: "07-15",
    photoUrl: "",
    allowedDepartments: ["Servicio al Cliente"],
    isAdmin: false,
  },
  {
    id: "USR-004",
    fullName: "Carlos Méndez",
    email: "carlos.mendez@safeone.com.do",
    department: "Contabilidad",
    position: "Contador",
    birthday: "03-05",
    photoUrl: "",
    allowedDepartments: ["Contabilidad", "Cuentas por Cobrar"],
    isAdmin: false,
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IntranetUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<IntranetUser[]>(() => {
    const stored = localStorage.getItem("safeone_all_users");
    if (stored) {
      try { return JSON.parse(stored); } catch {}
    }
    return INITIAL_USERS;
  });

  // Persist users list
  useEffect(() => {
    localStorage.setItem("safeone_all_users", JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    const stored = localStorage.getItem("safeone_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (password.trim().toLowerCase() !== "safeone") return false;
    const found = allUsers.find(
      (u) => u.email.toLowerCase() === username.trim().toLowerCase() || u.fullName.toLowerCase() === username.trim().toLowerCase()
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

  const addUser = (u: IntranetUser) => setAllUsers((prev) => [...prev, u]);

  const updateUser = (id: string, data: Partial<IntranetUser>) => {
    setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
    // If editing the currently logged in user, update session
    if (user?.id === id) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem("safeone_user", JSON.stringify(updated));
    }
  };

  const deleteUser = (id: string) => {
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasAccess, allUsers, addUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
