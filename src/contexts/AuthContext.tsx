import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { IntranetUser, OffboardingReason } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";
import { isApiConfigured, authApi, usersApi } from "@/lib/api";

// Simple hash for local mode (not cryptographically secure, but sufficient for mock)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return "h_" + Math.abs(hash).toString(36);
};

interface AuthContextType {
  user: IntranetUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  hasAccess: (department: string) => boolean;
  allUsers: IntranetUser[];
  activeUsers: IntranetUser[];
  inactiveUsers: IntranetUser[];
  addUser: (u: IntranetUser) => void;
  updateUser: (id: string, data: Partial<IntranetUser>) => void;
  deleteUser: (id: string) => void;
  offboardUser: (id: string, reason: OffboardingReason, notes: string) => void;
  reactivateUser: (id: string) => void;
  mustChangePassword: boolean;
  changePassword: (newPassword: string) => void;
  resetUserPassword: (userId: string) => void;
  createForgotPasswordTicket: (email: string, fullName: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_VERSION = "v2-full-roster";

const INITIAL_USERS: IntranetUser[] = [
  // ═══════════════════════════════════════════
  // GERENCIA GENERAL — Aurelio Pérez (CEO)
  // ═══════════════════════════════════════════
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
    extension: "",
  },
  {
    id: "USR-100",
    fullName: "Aurelio Pérez",
    email: "Aperez@safeone.com.do",
    department: "Gerencia General",
    position: "Gerente General",
    birthday: "",
    photoUrl: "",
    allowedDepartments: DEPARTMENTS,
    isAdmin: true,
    isDepartmentLeader: true,
    reportsTo: "",
    extension: "201",
  },
  {
    id: "USR-101",
    fullName: "Chrisnel Fabian",
    email: "cfabian@safeone.com.do",
    department: "Administración",
    position: "Gerente Administrativo",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Administración", "Cuentas por Cobrar", "Contabilidad", "Calidad"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-100",
    extension: "204",
  },
  {
    id: "USR-102",
    fullName: "Xuxa Lugo",
    email: "contabilidad@safeone.com.do",
    department: "Contabilidad",
    position: "Contadora",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Contabilidad"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-101",
    extension: "206",
  },
  {
    id: "USR-103",
    fullName: "Christy Fernández",
    email: "Cxc@safeone.com.do",
    department: "Cuentas por Cobrar",
    position: "Encargada de Cuentas por Cobrar",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Cuentas por Cobrar"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-101",
    extension: "203",
  },
  {
    id: "USR-104",
    fullName: "Bilianny Fernández",
    email: "Bfernandez@safeone.com.do",
    department: "Calidad",
    position: "Encargada de Calidad, Cumplimiento y Mejora Continua",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Calidad"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-101",
    extension: "217",
  },
  {
    id: "USR-110",
    fullName: "Samuel A. Pérez",
    email: "Sperez@safeone.com.do",
    department: "Gerencia Comercial",
    position: "Gerente Comercial",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Gerencia Comercial", "Servicio al Cliente", "Tecnología y Monitoreo", "Seguridad Electrónica"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-100",
    extension: "215",
  },
  {
    id: "USR-002",
    fullName: "Armando Noel",
    email: "Anoel@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "Encargado de Tecnología y Monitoreo",
    birthday: "07-15",
    photoUrl: "",
    allowedDepartments: DEPARTMENTS,
    isAdmin: true,
    isDepartmentLeader: true,
    reportsTo: "USR-110",
    fleetPhone: "+1 809-555-0020",
    extension: "216",
  },
  {
    id: "USR-111",
    fullName: "Luis Ovalles",
    email: "Lovalles@safeone.com.do",
    department: "Seguridad Electrónica",
    position: "Encargado de Seguridad Electrónica",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Seguridad Electrónica"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-110",
    extension: "202",
  },
  {
    id: "USR-112",
    fullName: "Perla González",
    email: "serviciocliente@safeone.com.do",
    department: "Servicio al Cliente",
    position: "Encargada de Servicio al Cliente",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Servicio al Cliente"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-110",
    extension: "200",
  },
  {
    id: "USR-113",
    fullName: "Leonela Báez",
    email: "Lbaez@safeone.com.do",
    department: "Gerencia Comercial",
    position: "Departamento Comercial",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Gerencia Comercial"],
    isAdmin: false,
    reportsTo: "USR-110",
    extension: "212",
  },
  {
    id: "USR-120",
    fullName: "Brandon Díaz",
    email: "Monitoreo@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    extension: "207",
    shift: "Turno día",
    team: "Sede Central",
  },
  {
    id: "USR-121",
    fullName: "César Reyes",
    email: "Monitoreo@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    extension: "207",
    shift: "Turno día",
    team: "Sede Central",
  },
  {
    id: "USR-122",
    fullName: "Bradelin Almonte",
    email: "Monitoreo@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    extension: "207",
    shift: "Turno noche",
    team: "Sede Central",
  },
  {
    id: "USR-123",
    fullName: "Alejandro Alcántara",
    email: "Monitoreo@safeone.com.do",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    extension: "207",
    shift: "Turno noche",
    team: "Sede Central",
  },
  {
    id: "USR-130",
    fullName: "Rusbert Michel",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - ALNAP",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Mañana",
    team: "ALNAP",
  },
  {
    id: "USR-131",
    fullName: "Raúl Moreta",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - ALNAP",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Mañana",
    team: "ALNAP",
  },
  {
    id: "USR-132",
    fullName: "Frederlin Peguero",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - ALNAP",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Tarde",
    team: "ALNAP",
  },
  {
    id: "USR-133",
    fullName: "Diego Guzmán",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - ALNAP",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Tarde",
    team: "ALNAP",
  },
  {
    id: "USR-134",
    fullName: "Luis Rosario",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - ALNAP",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Noche",
    team: "ALNAP",
  },
  {
    id: "USR-140",
    fullName: "Eduardo Serrano",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - Banco Caribe",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Turno noche",
    team: "Banco Caribe",
  },
  {
    id: "USR-141",
    fullName: "Yunior Manzanillo",
    email: "",
    department: "Tecnología y Monitoreo",
    position: "Operador de Monitoreo - Banco Caribe",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Tecnología y Monitoreo"],
    isAdmin: false,
    reportsTo: "USR-002",
    shift: "Turno día",
    team: "Banco Caribe",
  },
  {
    id: "USR-006",
    fullName: "Dilia Aguasvivas",
    email: "Daguasvivas@safeone.com.do",
    department: "Recursos Humanos",
    position: "Gerente de RRHH",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Recursos Humanos"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-100",
    extension: "211",
  },
  {
    id: "USR-007",
    fullName: "Alexandra Lira",
    email: "Alira@safeone.com.do",
    department: "Recursos Humanos",
    position: "Relaciones Laborales",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Recursos Humanos"],
    isAdmin: false,
    reportsTo: "USR-006",
    extension: "219",
  },
  {
    id: "USR-150",
    fullName: "Noemi Pérez",
    email: "nperez@safeone.com.do",
    department: "Recursos Humanos",
    position: "Reclutamiento y Selección",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Recursos Humanos"],
    isAdmin: false,
    reportsTo: "USR-006",
    extension: "218",
  },
  {
    id: "USR-151",
    fullName: "Paula Félix",
    email: "Rrhh2@safeone.com.do",
    department: "Recursos Humanos",
    position: "Auxiliar de RRHH",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Recursos Humanos"],
    isAdmin: false,
    reportsTo: "USR-006",
    extension: "213",
  },
  {
    id: "USR-005",
    fullName: "Remit López",
    email: "Rlopez@safeone.com.do",
    department: "Operaciones",
    position: "Gerente de Operaciones",
    birthday: "01-10",
    photoUrl: "",
    allowedDepartments: ["Operaciones"],
    isAdmin: false,
    isDepartmentLeader: true,
    reportsTo: "USR-100",
    extension: "220",
    fleetPhone: "+1 809-555-0010",
  },
  {
    id: "USR-160",
    fullName: "Carmen Sosa",
    email: "",
    department: "Administración",
    position: "Cocina",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Administración"],
    isAdmin: false,
    reportsTo: "USR-101",
    extension: "205",
  },
  {
    id: "USR-161",
    fullName: "Jefferson Constanza",
    email: "",
    department: "Administración",
    position: "Recepción",
    birthday: "",
    photoUrl: "",
    allowedDepartments: ["Administración"],
    isAdmin: false,
    reportsTo: "USR-101",
    extension: "208",
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IntranetUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const apiMode = isApiConfigured();

  const [allUsers, setAllUsers] = useState<IntranetUser[]>(() => {
    if (apiMode) return []; // Will load from API
    const storedVersion = localStorage.getItem("safeone_users_version");
    if (storedVersion === USERS_VERSION) {
      const stored = localStorage.getItem("safeone_all_users");
      if (stored) {
        try { return JSON.parse(stored); } catch {}
      }
    }
    localStorage.setItem("safeone_users_version", USERS_VERSION);
    localStorage.removeItem("safeone_all_users");
    return INITIAL_USERS;
  });

  // Persist users list (mock mode only)
  useEffect(() => {
    if (!apiMode) {
      localStorage.setItem("safeone_all_users", JSON.stringify(allUsers));
    }
  }, [allUsers, apiMode]);

  // Initialize: check for existing session
  useEffect(() => {
    const init = async () => {
      if (apiMode) {
        // API mode: validate token with server
        const token = localStorage.getItem("safeone_token");
        if (token) {
          try {
            const currentUser = await authApi.me();
            setUser(currentUser);
          } catch {
            localStorage.removeItem("safeone_token");
            localStorage.removeItem("safeone_user");
          }
        }
        // Load all users from API only if we have a token
        const hasToken = !!localStorage.getItem("safeone_token");
        if (hasToken) {
          try {
            const users = await usersApi.getAll();
            setAllUsers(users);
          } catch {
            setAllUsers(INITIAL_USERS);
          }
        } else {
          setAllUsers(INITIAL_USERS);
        }
      } else {
        // Mock mode: restore from localStorage
        const stored = localStorage.getItem("safeone_user");
        if (stored) {
          try { setUser(JSON.parse(stored)); } catch {}
        }
      }
      setIsLoading(false);
    };
    init();
  }, [apiMode]);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (apiMode) {
      // API mode: authenticate with server
      try {
        const result = await authApi.login(username.trim(), password);
        localStorage.setItem("safeone_token", result.token);
        localStorage.setItem("safeone_user", JSON.stringify(result.user));
        setUser(result.user);
        // Refresh users list
        try {
          const users = await usersApi.getAll();
          setAllUsers(users);
        } catch {}
        return true;
      } catch {
        // If API fails, try local fallback
        console.warn("API login failed, trying local fallback...");
        return localLogin(username, password);
      }
    } else {
      return localLogin(username, password);
    }
  };

  const localLogin = (username: string, password: string): boolean => {
    const q = username.trim().toLowerCase();
    const found = allUsers.find(
      (u) =>
        (u.email || "").toLowerCase() === q ||
        u.fullName.toLowerCase() === q ||
        (u.id || "").toLowerCase() === q ||
        (u.employeeCode || "").toLowerCase() === q ||
        (u.cedula || "").toLowerCase() === q
    );
    if (!found) return false;

    // Check password: if user has a custom password hash, verify against it
    if (found.passwordHash) {
      const inputHash = simpleHash(password.trim());
      if (inputHash !== found.passwordHash) return false;
    } else {
      // No custom password set = still using default "safeone"
      if (password.trim().toLowerCase() !== "safeone") return false;
    }

    setUser(found);
    localStorage.setItem("safeone_user", JSON.stringify(found));
    localStorage.setItem("safeone_token", "mock-token-" + found.id);

    // Check if must change password: default password or flagged
    const isDefaultPassword = !found.passwordHash || password.trim().toLowerCase() === "safeone";
    if (isDefaultPassword || found.mustChangePassword) {
      setMustChangePassword(true);
    } else {
      setMustChangePassword(false);
    }

    return true;
  };

  const logout = () => {
    setUser(null);
    authApi.logout();
  };

  const hasAccess = (department: string) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    return user.allowedDepartments.includes(department);
  };

  const addUser = async (u: IntranetUser) => {
    if (apiMode) {
      try {
        const created = await usersApi.create(u);
        setAllUsers((prev) => [...prev, created]);
      } catch (err) {
        console.error("Error creating user:", err);
      }
    } else {
      setAllUsers((prev) => [...prev, { ...u, employeeStatus: "Activo" }]);
    }
  };

  const updateUser = async (id: string, data: Partial<IntranetUser>) => {
    if (apiMode) {
      try {
        const updated = await usersApi.update(id, data);
        setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
        if (user?.id === id) {
          const updatedUser = { ...user, ...updated };
          setUser(updatedUser);
          localStorage.setItem("safeone_user", JSON.stringify(updatedUser));
        }
      } catch (err) {
        console.error("Error updating user:", err);
      }
    } else {
      setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
      if (user?.id === id) {
        const updated = { ...user, ...data };
        setUser(updated);
        localStorage.setItem("safeone_user", JSON.stringify(updated));
      }
    }
  };

  const deleteUser = async (id: string) => {
    if (apiMode) {
      try {
        await usersApi.delete(id);
        setAllUsers((prev) => prev.filter((u) => u.id !== id));
      } catch (err) {
        console.error("Error deleting user:", err);
      }
    } else {
      setAllUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const offboardUser = async (id: string, reason: OffboardingReason, notes: string) => {
    if (apiMode) {
      try {
        const updated = await usersApi.offboard(id, { reason, notes });
        setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      } catch (err) {
        console.error("Error offboarding user:", err);
      }
    } else {
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                employeeStatus: "Inactivo" as const,
                offboardingDate: new Date().toISOString().split("T")[0],
                offboardingReason: reason,
                offboardingNotes: notes,
                offboardingBy: user?.id || "",
              }
            : u
        )
      );
    }
  };

  const reactivateUser = async (id: string) => {
    if (apiMode) {
      try {
        const updated = await usersApi.reactivate(id);
        setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      } catch (err) {
        console.error("Error reactivating user:", err);
      }
    } else {
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                employeeStatus: "Activo" as const,
                offboardingDate: undefined,
                offboardingReason: undefined,
                offboardingNotes: undefined,
                offboardingBy: undefined,
              }
            : u
        )
      );
    }
  };

  const activeUsers = allUsers.filter((u) => u.employeeStatus !== "Inactivo");
  const inactiveUsers = allUsers.filter((u) => u.employeeStatus === "Inactivo");

  const changePassword = (newPassword: string) => {
    if (!user) return;
    const hash = simpleHash(newPassword);
    const updates: Partial<IntranetUser> = {
      passwordHash: hash,
      mustChangePassword: false,
      lastPasswordChange: new Date().toISOString(),
    };
    // Update in allUsers
    setAllUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updates } : u)));
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem("safeone_user", JSON.stringify(updatedUser));
    setMustChangePassword(false);
  };

  const resetUserPassword = (userId: string) => {
    const updates: Partial<IntranetUser> = {
      passwordHash: undefined,
      mustChangePassword: true,
      lastPasswordChange: undefined,
    };
    setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
  };

  const createForgotPasswordTicket = (email: string, fullName: string) => {
    // Create a high-priority ticket in localStorage
    const existingTickets = JSON.parse(localStorage.getItem("safeone_tickets") || "[]");
    const now = new Date();
    const newTicket = {
      id: `TK-${String(Date.now()).slice(-6)}`,
      title: `Restablecimiento de contraseña: ${fullName || email}`,
      description: `El usuario ${fullName || "N/A"} (${email || "N/A"}) ha solicitado el restablecimiento de su contraseña a través del formulario de recuperación.`,
      category: "Otros",
      priority: "Alta",
      status: "Abierto",
      createdBy: fullName || email || "Usuario sin identificar",
      assignedTo: "Tecnología y Monitoreo",
      assignedToId: "USR-002",
      department: "Tecnología y Monitoreo",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      slaHours: 8,
      slaDeadline: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      attachments: [],
      comments: [],
    };
    existingTickets.push(newTicket);
    localStorage.setItem("safeone_tickets", JSON.stringify(existingTickets));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasAccess, allUsers, activeUsers, inactiveUsers, addUser, updateUser, deleteUser, offboardUser, reactivateUser, mustChangePassword, changePassword, resetUserPassword, createForgotPasswordTicket }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
