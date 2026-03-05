import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { IntranetUser } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/types";

interface AuthContextType {
  user: IntranetUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  hasAccess: (department: string) => boolean;
  allUsers: IntranetUser[];
  addUser: (u: IntranetUser) => void;
  updateUser: (id: string, data: Partial<IntranetUser>) => void;
  deleteUser: (id: string) => void;
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

  // ═══════════════════════════════════════════
  // ADMINISTRACIÓN — Chrisnel Fabian (reporta a Aurelio)
  // ═══════════════════════════════════════════
  {
    id: "USR-101",
    fullName: "Chrisnel Fabian",
    email: "Cfabiancxc@safeone.com.do",
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

  // ═══════════════════════════════════════════
  // GERENCIA COMERCIAL — Samuel A. Pérez (reporta a Aurelio)
  // ═══════════════════════════════════════════
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

  // ═══════════════════════════════════════════
  // OPERADORES DE MONITOREO — Sede Central (bajo Armando Noel)
  // ═══════════════════════════════════════════
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

  // EQUIPO ALNAP (bajo Armando Noel)
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

  // EQUIPO BANCO CARIBE (bajo Armando Noel)
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

  // ═══════════════════════════════════════════
  // RECURSOS HUMANOS — Dilia Aguasvivas (reporta a Aurelio)
  // ═══════════════════════════════════════════
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

  // ═══════════════════════════════════════════
  // OPERACIONES — Remit López (reporta a Aurelio)
  // ═══════════════════════════════════════════
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

  // ═══════════════════════════════════════════
  // OTROS ROLES — Personal de apoyo
  // ═══════════════════════════════════════════
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
