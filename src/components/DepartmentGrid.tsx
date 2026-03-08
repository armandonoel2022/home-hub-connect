import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";
import type { OffboardingReason } from "@/lib/types";
import {
  Building2,
  Briefcase,
  TrendingUp,
  Headphones,
  CheckCircle,
  DollarSign,
  Calculator,
  Monitor,
  Settings,
  Users,
  Shield,
  User,
  Phone,
  Mail,
  X,
  FolderOpen,
  FolderPlus,
  FileText,
  Upload,
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  File,
  UserMinus,
  UserX,
  Clock,
  RotateCcw,
} from "lucide-react";

interface DeptLeader {
  name: string;
  position: string;
  photo: string;
  fleetPhone: string;
  email: string;
}

interface DeptFolder {
  name: string;
  files: { name: string; size: string; uploadedAt: string }[];
}

interface Department {
  name: string;
  icon: any;
  description: string;
  color: string;
  leader: DeptLeader;
}

const departments: Department[] = [
  {
    name: "Administración",
    icon: Building2,
    description: "Gestión administrativa y recursos",
    color: "42 100% 50%",
    leader: { name: "Chrisnel Fabian", position: "Gerente Administrativo", photo: "", fleetPhone: "", email: "Cfabiancxc@safeone.com.do" },
  },
  {
    name: "Gerencia General",
    icon: Briefcase,
    description: "Dirección y estrategia corporativa",
    color: "220 15% 30%",
    leader: { name: "Aurelio Pérez", position: "Gerente General", photo: "", fleetPhone: "", email: "Aperez@safeone.com.do" },
  },
  {
    name: "Gerencia Comercial",
    icon: TrendingUp,
    description: "Ventas y desarrollo de negocio",
    color: "160 60% 40%",
    leader: { name: "Samuel A. Pérez", position: "Gerente Comercial", photo: "", fleetPhone: "", email: "Sperez@safeone.com.do" },
  },
  {
    name: "Recursos Humanos",
    icon: Users,
    description: "Gestión del talento y bienestar laboral",
    color: "330 60% 50%",
    leader: { name: "Dilia Aguasvivas", position: "Gerente de RRHH", photo: "", fleetPhone: "", email: "Daguasvivas@safeone.com.do" },
  },
  {
    name: "Operaciones",
    icon: Shield,
    description: "Logística y operaciones de campo",
    color: "100 50% 40%",
    leader: { name: "Remit López", position: "Gerente de Operaciones", photo: "", fleetPhone: "+1 809-555-0010", email: "Rlopez@safeone.com.do" },
  },
  {
    name: "Servicio al Cliente",
    icon: Headphones,
    description: "Atención y soporte al cliente",
    color: "200 70% 50%",
    leader: { name: "Perla González", position: "Encargada de Servicio al Cliente", photo: "", fleetPhone: "", email: "serviciocliente@safeone.com.do" },
  },
  {
    name: "Calidad",
    icon: CheckCircle,
    description: "Calidad, Cumplimiento y Mejora Continua",
    color: "280 50% 50%",
    leader: { name: "Bilianny Fernández", position: "Encargada CCM", photo: "", fleetPhone: "", email: "Bfernandez@safeone.com.do" },
  },
  {
    name: "Cuentas por Cobrar",
    icon: DollarSign,
    description: "Gestión de cobros y facturación",
    color: "15 80% 55%",
    leader: { name: "Christy Fernández", position: "Encargada de CxC", photo: "", fleetPhone: "", email: "Cxc@safeone.com.do" },
  },
  {
    name: "Contabilidad",
    icon: Calculator,
    description: "Finanzas y registros contables",
    color: "340 60% 50%",
    leader: { name: "Xuxa Lugo", position: "Contadora", photo: "", fleetPhone: "", email: "contabilidad@safeone.com.do" },
  },
  {
    name: "Tecnología y Monitoreo",
    icon: Monitor,
    description: "Sistemas, CCTV y monitoreo",
    color: "190 70% 45%",
    leader: { name: "Armando Noel", position: "Encargado de Tecnología y Monitoreo", photo: "", fleetPhone: "+1 809-555-0020", email: "Anoel@safeone.com.do" },
  },
  {
    name: "Seguridad Electrónica",
    icon: Settings,
    description: "Sistemas de seguridad y alarmas",
    color: "250 40% 45%",
    leader: { name: "Luis Ovalles", position: "Encargado de Seguridad Electrónica", photo: "", fleetPhone: "", email: "Lovalles@safeone.com.do" },
  },
];

const DEPT_ROUTES: Record<string, string> = {
  "Recursos Humanos": "/rrhh/formularios",
};

const DEPT_MULTI_ROUTES: Record<string, { label: string; route: string; icon: any }[]> = {
  "Tecnología y Monitoreo": [
    { label: "Tecnología", route: "/tickets", icon: Settings },
    { label: "Monitoreo", route: "/monitoreo", icon: Monitor },
  ],
};

const DepartmentGrid = () => {
  const { user, allUsers, activeUsers, inactiveUsers, offboardUser, reactivateUser } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [showLeader, setShowLeader] = useState<Department | null>(null);
  const [showFiles, setShowFiles] = useState<string | null>(null);
  const [showTeam, setShowTeam] = useState<string | null>(null);
  const [showExEmployees, setShowExEmployees] = useState<string | null>(null);
  const [showOffboarding, setShowOffboarding] = useState<string | null>(null); // user ID
  const [offboardReason, setOffboardReason] = useState<OffboardingReason>("Renuncia");
  const [offboardNotes, setOffboardNotes] = useState("");
  const [deptFolders, setDeptFolders] = useState<Record<string, DeptFolder[]>>(() => {
    const init: Record<string, DeptFolder[]> = {};
    departments.forEach((d) => {
      init[d.name] = [
        { name: "General", files: [] },
      ];
    });
    return init;
  });
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showDeptMenu, setShowDeptMenu] = useState<string | null>(null);

  const handleOffboard = () => {
    if (!showOffboarding) return;
    const targetUser = allUsers.find((u) => u.id === showOffboarding);
    if (!targetUser) return;

    offboardUser(showOffboarding, offboardReason, offboardNotes);

    // Notify HR
    addNotification({
      type: "info",
      title: "Baja de Personal",
      message: `${targetUser.fullName} (${targetUser.department}) ha sido dado de baja. Motivo: ${offboardReason}`,
      relatedId: targetUser.id,
      forUserId: "USR-006", // Dilia - RRHH
      actionUrl: "/",
    });

    // Notify IT
    addNotification({
      type: "info",
      title: "Retiro de Equipos - Baja de Personal",
      message: `${targetUser.fullName} (${targetUser.department}) ha sido dado de baja. Verificar y retirar equipos asignados.`,
      relatedId: targetUser.id,
      forUserId: "USR-002", // Armando - IT
      actionUrl: "/inventario",
    });

    setShowOffboarding(null);
    setOffboardReason("Renuncia");
    setOffboardNotes("");
  };

  const handleAddFolder = (dept: string) => {
    if (!newFolderName.trim()) return;
    setDeptFolders((prev) => ({
      ...prev,
      [dept]: [...(prev[dept] || []), { name: newFolderName.trim(), files: [] }],
    }));
    setNewFolderName("");
    setShowNewFolder(false);
  };

  const handleUploadFile = (dept: string, folderIdx: number, fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map((f) => ({
      name: f.name,
      size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`,
      uploadedAt: new Date().toISOString().split("T")[0],
    }));
    setDeptFolders((prev) => {
      const folders = [...(prev[dept] || [])];
      folders[folderIdx] = { ...folders[folderIdx], files: [...folders[folderIdx].files, ...newFiles] };
      return { ...prev, [dept]: folders };
    });
  };

  const handleDeleteFile = (dept: string, folderIdx: number, fileIdx: number) => {
    setDeptFolders((prev) => {
      const folders = [...(prev[dept] || [])];
      folders[folderIdx] = { ...folders[folderIdx], files: folders[folderIdx].files.filter((_, i) => i !== fileIdx) };
      return { ...prev, [dept]: folders };
    });
  };

  const handleDeleteFolder = (dept: string, folderIdx: number) => {
    setDeptFolders((prev) => ({
      ...prev,
      [dept]: (prev[dept] || []).filter((_, i) => i !== folderIdx),
    }));
  };

  const totalFiles = (dept: string) => (deptFolders[dept] || []).reduce((sum, f) => sum + f.files.length, 0);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-8 rounded-full" style={{ background: "var(--gradient-gold)" }} />
        <h2 className="section-title text-foreground">Departamentos</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept) => {
          const Icon = dept.icon;
          const leaderUser = activeUsers.find((u) => u.department === dept.name && u.isDepartmentLeader);
          const teamMembers = activeUsers.filter((u) => u.department === dept.name && !u.isDepartmentLeader);
          const exEmployees = inactiveUsers.filter((u) => u.department === dept.name);
          const reportsToUser = leaderUser?.reportsTo ? allUsers.find((u) => u.id === leaderUser.reportsTo) : null;
          const isLeaderOrAdmin = user?.isAdmin || (user?.isDepartmentLeader && user?.department === dept.name);
          return (
            <div key={dept.name} className="card-department group border-2" style={{ borderColor: "hsl(220 15% 30%)" }} id={`dept-${dept.name.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="px-5 py-4 flex items-center gap-4" style={{ background: "hsl(220 15% 30%)" }}>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={cn("font-heading font-bold text-white text-base leading-tight", (DEPT_ROUTES[dept.name] || DEPT_MULTI_ROUTES[dept.name]) && "cursor-pointer hover:underline")}
                    onClick={() => {
                      if (DEPT_ROUTES[dept.name]) navigate(DEPT_ROUTES[dept.name]);
                      else if (DEPT_MULTI_ROUTES[dept.name]) setShowDeptMenu(showDeptMenu === dept.name ? null : dept.name);
                    }}
                  >
                    {dept.name}
                  </h3>
                  <p className="text-white/75 text-sm mt-0.5 truncate">{dept.description}</p>
                  {/* Multi-route popup */}
                  {DEPT_MULTI_ROUTES[dept.name] && showDeptMenu === dept.name && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 mx-4 flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {DEPT_MULTI_ROUTES[dept.name].map((r) => {
                        const RIcon = r.icon;
                        return (
                          <button
                            key={r.route}
                            onClick={(e) => { e.stopPropagation(); navigate(r.route); setShowDeptMenu(null); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-card border border-border text-card-foreground text-xs font-semibold hover:bg-muted transition-colors shadow-lg"
                          >
                            <RIcon className="h-4 w-4" />
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div></div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => setShowLeader(dept)}
                    className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-muted hover:bg-border transition-colors text-card-foreground"
                  >
                    <User className="h-3.5 w-3.5" />
                    Ver Líder del Departamento
                  </button>
                  <button
                    onClick={() => setShowTeam(showTeam === dept.name ? null : dept.name)}
                    className="flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg bg-muted hover:bg-border transition-colors text-card-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Equipo de Trabajo
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/20 gold-accent-text">
                      {teamMembers.length + (leaderUser ? 1 : 0)}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowFiles(showFiles === dept.name ? null : dept.name)}
                    className="flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg bg-muted hover:bg-border transition-colors text-card-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5" />
                      Documentos
                    </span>
                    {totalFiles(dept.name) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/20 gold-accent-text">{totalFiles(dept.name)}</span>
                    )}
                  </button>
                  {exEmployees.length > 0 && (
                    <button
                      onClick={() => setShowExEmployees(showExEmployees === dept.name ? null : dept.name)}
                      className="flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors text-muted-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <UserX className="h-3.5 w-3.5" />
                        Ex-Empleados
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        {exEmployees.length}
                      </span>
                    </button>
                  )}
                </div>

                {/* Expandable team section */}
                {showTeam === dept.name && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    {reportsToUser && (
                      <div className="flex items-center gap-2 text-[11px] bg-muted/50 rounded-lg px-3 py-2 mb-2">
                        <ChevronRight className="h-3 w-3 text-gold" />
                        <span className="text-muted-foreground">Reporta a:</span>
                        <span className="font-semibold text-card-foreground">{reportsToUser.fullName}</span>
                        <span className="text-muted-foreground">({reportsToUser.position})</span>
                      </div>
                    )}
                    {leaderUser && (
                      <div className="flex items-center gap-2 text-[11px] bg-gold/10 rounded-lg px-3 py-2">
                        <Shield className="h-3 w-3 text-gold" />
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {leaderUser.photoUrl ? <img src={leaderUser.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <span className="font-semibold text-card-foreground">{leaderUser.fullName}</span>
                        <span className="text-gold text-[10px] font-medium ml-auto">Líder</span>
                      </div>
                    )}
                    {teamMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-[11px] px-3 py-1.5 group/member">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {m.photoUrl ? <img src={m.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <span className="text-card-foreground">{m.fullName}</span>
                        {m.extension && (
                          <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Ext.{m.extension}</span>
                        )}
                        {m.team && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 gold-accent-text">{m.team}</span>
                        )}
                        {m.shift && (
                          <span className="text-[9px] text-muted-foreground italic">{m.shift}</span>
                        )}
                        <span className="text-muted-foreground ml-auto truncate max-w-[100px]">{m.position}</span>
                        {isLeaderOrAdmin && (
                          <button
                            onClick={() => setShowOffboarding(m.id)}
                            className="opacity-0 group-hover/member:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            title="Dar de Baja"
                          >
                            <UserMinus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!leaderUser && teamMembers.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-2">No hay miembros registrados</p>
                    )}
                  </div>
                )}

                {/* Inline file manager */}
                {showFiles === dept.name && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    {(deptFolders[dept.name] || []).map((folder, fIdx) => (
                      <FolderItem
                        key={folder.name}
                        folder={folder}
                        onUpload={(files) => handleUploadFile(dept.name, fIdx, files)}
                        onDeleteFile={(fileIdx) => handleDeleteFile(dept.name, fIdx, fileIdx)}
                        onDeleteFolder={fIdx > 0 ? () => handleDeleteFolder(dept.name, fIdx) : undefined}
                      />
                    ))}
                    {showNewFolder ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nombre de carpeta"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddFolder(dept.name)}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-gold outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleAddFolder(dept.name)} className="text-xs gold-accent-text font-medium hover:underline">Crear</button>
                        <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewFolder(true)}
                        className="flex items-center gap-1.5 text-[11px] font-medium gold-accent-text hover:underline"
                      >
                        <FolderPlus className="h-3 w-3" /> Nueva Carpeta
                      </button>
                    )}
                  </div>
                )}

                {/* Ex-employees section */}
                {showExEmployees === dept.name && exEmployees.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-3">Ex-Empleados</p>
                    {exEmployees.map((ex) => (
                      <div key={ex.id} className="bg-muted/30 rounded-lg px-3 py-2 space-y-1">
                        <div className="flex items-center gap-2 text-[11px]">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 opacity-60">
                            {ex.photoUrl ? <img src={ex.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <span className="text-card-foreground font-medium">{ex.fullName}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">{ex.offboardingReason}</span>
                          {user?.isAdmin && (
                            <button
                              onClick={() => reactivateUser(ex.id)}
                              className="ml-auto p-1 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                              title="Reactivar"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pl-8">
                          <span>{ex.position}</span>
                          {ex.offboardingDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Salida: {ex.offboardingDate}
                            </span>
                          )}
                        </div>
                        {ex.offboardingNotes && (
                          <p className="text-[10px] text-muted-foreground pl-8 italic">"{ex.offboardingNotes}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leader Modal */}
      {showLeader && (() => {
        const leaderUser = allUsers.find((u) => u.department === showLeader.name && u.isDepartmentLeader);
        const leader = leaderUser
          ? { name: leaderUser.fullName, position: leaderUser.position, photo: leaderUser.photoUrl, fleetPhone: leaderUser.fleetPhone || "", email: leaderUser.email }
          : showLeader.leader;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="h-2 w-full" style={{ background: "hsl(220 15% 30%)" }} />
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{showLeader.name}</h2>
                <button onClick={() => setShowLeader(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4 overflow-hidden border-4 border-border">
                  {leader.photo ? (
                    <img src={leader.photo} alt={leader.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-heading font-bold text-xl text-card-foreground">{leader.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{leader.position}</p>
                <div className="mt-4 w-full space-y-3">
                  <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
                    <Phone className="h-4 w-4 text-gold shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] text-muted-foreground">Flota</p>
                      <p className="text-sm font-medium text-card-foreground">{leader.fleetPhone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
                    <Mail className="h-4 w-4 text-gold shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] text-muted-foreground">Correo</p>
                      <p className="text-sm font-medium text-card-foreground">{leader.email}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowLeader(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Offboarding Modal */}
      {showOffboarding && (() => {
        const target = allUsers.find((u) => u.id === showOffboarding);
        if (!target) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-destructive" />
                  Dar de Baja
                </h2>
                <button onClick={() => setShowOffboarding(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {target.photoUrl ? <img src={target.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground text-sm">{target.fullName}</p>
                    <p className="text-xs text-muted-foreground">{target.position} — {target.department}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Motivo *</label>
                  <select
                    value={offboardReason}
                    onChange={(e) => setOffboardReason(e.target.value as OffboardingReason)}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none"
                  >
                    <option value="Renuncia">Renuncia</option>
                    <option value="Despido">Despido</option>
                    <option value="Fin de Contrato">Fin de Contrato</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Notas</label>
                  <textarea
                    value={offboardNotes}
                    onChange={(e) => setOffboardNotes(e.target.value)}
                    placeholder="Detalles adicionales sobre la salida..."
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none h-20"
                  />
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
                  <p className="font-semibold mb-1">Al dar de baja:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Se notificará a RRHH y Tecnología</li>
                    <li>IT verificará equipos asignados para retiro</li>
                    <li>Equipos asignados quedarán disponibles para reasignación</li>
                    <li>El empleado aparecerá en la sección "Ex-Empleados"</li>
                  </ul>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowOffboarding(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={handleOffboard} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                  Confirmar Baja
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};

// Folder sub-component
const FolderItem = ({
  folder,
  onUpload,
  onDeleteFile,
  onDeleteFolder,
}: {
  folder: DeptFolder;
  onUpload: (files: FileList | null) => void;
  onDeleteFile: (idx: number) => void;
  onDeleteFolder?: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-muted/50 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors">
        {expanded ? <ChevronDown className="h-3 w-3 text-gold" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <FolderOpen className="h-3.5 w-3.5 text-gold" />
        <span className="text-xs font-medium text-card-foreground flex-1">{folder.name}</span>
        <span className="text-[10px] text-muted-foreground">{folder.files.length}</span>
        {onDeleteFolder && (
          <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(); }} className="p-0.5 hover:text-destructive text-muted-foreground">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {folder.files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-1 group/file">
              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="flex-1 text-card-foreground truncate">{file.name}</span>
              <span className="text-muted-foreground shrink-0">{file.size}</span>
              <button onClick={() => onDeleteFile(i)} className="opacity-0 group-hover/file:opacity-100 text-destructive p-0.5">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="flex items-center gap-1.5 text-[11px] font-medium gold-accent-text cursor-pointer hover:underline mt-1">
            <Upload className="h-3 w-3" /> Subir archivo
            <input type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
          </label>
        </div>
      )}
    </div>
  );
};

export default DepartmentGrid;
