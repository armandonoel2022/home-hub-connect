import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useEquipment, usePhones, useVehicles, useArmedPersonnel } from "@/hooks/useApiHooks";
import { getUserAssignedAssets, generateOffboardingTicketDescription } from "@/lib/assetLinking";
import type { UserAssetSummary } from "@/lib/assetLinking";
import AssetReturnOverlay from "@/components/AssetReturnOverlay";
import { cn } from "@/lib/utils";
import { isApiConfigured, departmentFoldersApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
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
  Package,
  AlertTriangle,
} from "lucide-react";

interface DeptFolder {
  id: string;
  name: string;
  department: string;
  files: { id: string; name: string; size: string; uploadedAt: string; uploadedBy?: string }[];
}

interface DepartmentMeta {
  name: string;
  icon: any;
  description: string;
  color: string;
}

const departmentsMeta: DepartmentMeta[] = [
  { name: "Administración", icon: Building2, description: "Gestión administrativa y recursos", color: "42 100% 50%" },
  { name: "Gerencia General", icon: Briefcase, description: "Dirección y estrategia corporativa", color: "220 15% 30%" },
  { name: "Gerencia Comercial", icon: TrendingUp, description: "Ventas y desarrollo de negocio", color: "160 60% 40%" },
  { name: "Recursos Humanos", icon: Users, description: "Gestión del talento y bienestar laboral", color: "330 60% 50%" },
  { name: "Operaciones", icon: Shield, description: "Logística y operaciones de campo", color: "100 50% 40%" },
  { name: "Servicio al Cliente", icon: Headphones, description: "Atención y soporte al cliente", color: "200 70% 50%" },
  { name: "Calidad", icon: CheckCircle, description: "Calidad, Cumplimiento y Mejora Continua", color: "280 50% 50%" },
  { name: "Cuentas por Cobrar", icon: DollarSign, description: "Gestión de cobros y facturación", color: "15 80% 55%" },
  { name: "Contabilidad", icon: Calculator, description: "Finanzas y registros contables", color: "340 60% 50%" },
  { name: "Tecnología y Monitoreo", icon: Monitor, description: "Sistemas, CCTV y monitoreo", color: "190 70% 45%" },
  { name: "Seguridad Electrónica", icon: Settings, description: "Sistemas de seguridad y alarmas", color: "250 40% 45%" },
];

// Departamentos cuyo header del recuadro es un enlace directo a un módulo.
// Administración tiene control de acceso (solo el propio dpto + admins); el resto es libre.
const DEPT_ROUTES: Record<string, string> = {
  "Administración": "/admin/hub",
  "Contabilidad": "/gastos-menores",
};

// Departamentos que requieren pertenecer al área (o ser admin) para acceder al enlace del header.
const RESTRICTED_DEPT_ROUTES = new Set<string>(["Administración"]);

// Emails con acceso especial a módulos restringidos por departamento (además del propio dpto y admins).
const HR_EXTRA_ACCESS = new Set<string>(["anoel@safeone.com.do", "admin@safeone.com.do"]);

const DEPT_MULTI_ROUTES: Record<string, { label: string; route: string; icon: any }[]> = {
  "Recursos Humanos": [
    { label: "Solicitudes", route: "/rrhh/formularios", icon: FileText },
    { label: "Empleados", route: "/rrhh/empleados", icon: Users },
    { label: "Nómina", route: "/rrhh/consolidado-nomina", icon: DollarSign },
  ],
  "Tecnología y Monitoreo": [
    { label: "Tecnología", route: "/tickets", icon: Settings },
    { label: "Monitoreo", route: "/monitoreo", icon: Monitor },
    { label: "Seguimiento Clientes", route: "/seguimiento-clientes", icon: Users },
  ],
  "Operaciones": [
    { label: "Personal Armado", route: "/operaciones", icon: Shield },
    { label: "Centro de Operaciones", route: "/centro-operaciones", icon: Users },
  ],
};

// Departamentos cuyos sub-módulos (DEPT_MULTI_ROUTES) requieren pertenecer al área.
const RESTRICTED_DEPT_MULTI = new Set<string>(["Recursos Humanos"]);

const DepartmentGrid = () => {
  const { user, allUsers, activeUsers, inactiveUsers, offboardUser, reactivateUser } = useAuth();
  const { addNotification } = useNotifications();
  const { data: equipment } = useEquipment();
  const { data: phones } = usePhones();
  const { data: vehicles } = useVehicles();
  const { data: armedPersonnel } = useArmedPersonnel();
  const navigate = useNavigate();
  const apiMode = isApiConfigured();
  const [showLeader, setShowLeader] = useState<DepartmentMeta | null>(null);
  const [showFiles, setShowFiles] = useState<string | null>(null);
  const [showTeam, setShowTeam] = useState<string | null>(null);
  const [showExEmployees, setShowExEmployees] = useState<string | null>(null);
  const [showOffboarding, setShowOffboarding] = useState<string | null>(null);
  const [offboardReason, setOffboardReason] = useState<OffboardingReason>("Renuncia");
  const [offboardNotes, setOffboardNotes] = useState("");
  const [deptFolders, setDeptFolders] = useState<Record<string, DeptFolder[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showDeptMenu, setShowDeptMenu] = useState<string | null>(null);
  const [offboardAssetSummary, setOffboardAssetSummary] = useState<UserAssetSummary | null>(null);
  const [showAssetReturnOverlay, setShowAssetReturnOverlay] = useState<{ userName: string; assets: UserAssetSummary } | null>(null);

  // Check if user belongs to a department
  const userBelongsToDept = useCallback((deptName: string) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    return user.department === deptName;
  }, [user]);

  // Load folders from API when a department's files section is opened
  const loadFolders = useCallback(async (deptName: string) => {
    if (!apiMode || loadingFolders[deptName]) return;
    setLoadingFolders(prev => ({ ...prev, [deptName]: true }));
    try {
      const folders = await departmentFoldersApi.getFolders(deptName);
      setDeptFolders(prev => ({ ...prev, [deptName]: folders }));
    } catch (err: any) {
      if (err?.message?.includes("403") || err?.message?.includes("acceso")) {
        toast({ title: "Acceso denegado", description: "Solo los miembros de este departamento pueden ver sus carpetas.", variant: "destructive" });
      } else {
        // Fallback to local empty state
        setDeptFolders(prev => ({ ...prev, [deptName]: prev[deptName] || [{ id: 'local-gen', name: 'General', department: deptName, files: [] }] }));
      }
    } finally {
      setLoadingFolders(prev => ({ ...prev, [deptName]: false }));
    }
  }, [apiMode, loadingFolders]);

  // Calculate assets when offboarding modal opens
  useEffect(() => {
    if (showOffboarding) {
      const targetUser = allUsers.find((u) => u.id === showOffboarding);
      if (targetUser) {
        const summary = getUserAssignedAssets(targetUser.fullName, targetUser.id, equipment, phones, vehicles, armedPersonnel);
        setOffboardAssetSummary(summary);
      }
    } else {
      setOffboardAssetSummary(null);
    }
  }, [showOffboarding, allUsers, equipment, phones, vehicles, armedPersonnel]);

  const handleOffboard = () => {
    if (!showOffboarding) return;
    const targetUser = allUsers.find((u) => u.id === showOffboarding);
    if (!targetUser) return;

    const assetSummary = offboardAssetSummary || getUserAssignedAssets(targetUser.fullName, targetUser.id, equipment, phones, vehicles, armedPersonnel);

    offboardUser(showOffboarding, offboardReason, offboardNotes);

    // Notify HR
    addNotification({
      type: "info",
      title: "Baja de Personal",
      message: `${targetUser.fullName} (${targetUser.department}) ha sido dado de baja. Motivo: ${offboardReason}. ${assetSummary.totalCount > 0 ? `Tiene ${assetSummary.totalCount} activo(s) asignado(s) pendientes de devolución.` : "No tiene activos asignados."}`,
      relatedId: targetUser.id,
      forUserId: "USR-006", // Dilia - RRHH
      actionUrl: "/",
    });

    // Notify IT with asset details
    addNotification({
      type: "info",
      title: "🔴 Retiro de Equipos - Baja de Personal",
      message: `${targetUser.fullName} (${targetUser.department}) ha sido dado de baja (${offboardReason}). ${assetSummary.totalCount > 0 ? `URGENTE: Tiene ${assetSummary.totalCount} activo(s) asignado(s) que deben ser recuperados.` : "No tiene activos asignados."}`,
      relatedId: targetUser.id,
      forUserId: "USR-002", // Armando - IT
      actionUrl: "/inventario",
    });

    // Notify all IT department members
    const itMembers = allUsers.filter((u) => u.department === "Tecnología y Monitoreo" && u.id !== "USR-002" && u.employeeStatus !== "Inactivo");
    itMembers.forEach((itUser) => {
      addNotification({
        type: "info",
        title: "Retiro de Equipos - Baja de Personal",
        message: `${targetUser.fullName} ha sido desvinculado. ${assetSummary.totalCount > 0 ? `Tiene ${assetSummary.totalCount} activo(s) por recuperar.` : ""}`,
        relatedId: targetUser.id,
        forUserId: itUser.id,
        actionUrl: "/inventario",
      });
    });

    // Notify all HR department members
    const hrMembers = allUsers.filter((u) => u.department === "Recursos Humanos" && u.id !== "USR-006" && u.employeeStatus !== "Inactivo");
    hrMembers.forEach((hrUser) => {
      addNotification({
        type: "info",
        title: "Baja de Personal",
        message: `${targetUser.fullName} (${targetUser.department}) ha sido dado de baja. Motivo: ${offboardReason}.`,
        relatedId: targetUser.id,
        forUserId: hrUser.id,
        actionUrl: "/",
      });
    });

    // Auto-create IT ticket for offboarding
    const ticketDescription = generateOffboardingTicketDescription(targetUser.fullName, targetUser.department, offboardReason, assetSummary);
    const now = new Date();
    const existingTickets = JSON.parse(localStorage.getItem("safeone_tickets") || "[]");
    const offboardTicket = {
      id: `TK-${String(Date.now()).slice(-6)}`,
      title: `Desvinculación: ${targetUser.fullName} — Retiro de equipos y accesos`,
      description: ticketDescription,
      category: "Movimientos de Equipos",
      priority: offboardReason === "Despido" ? "Crítica" : "Alta",
      status: "Abierto",
      createdBy: user?.fullName || "Sistema",
      createdById: user?.id,
      assignedTo: "Tecnología y Monitoreo",
      assignedToId: "USR-002",
      department: "Tecnología y Monitoreo",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      slaHours: offboardReason === "Despido" ? 2 : 8,
      slaDeadline: new Date(now.getTime() + (offboardReason === "Despido" ? 2 : 8) * 60 * 60 * 1000).toISOString(),
      attachments: [],
      comments: [],
    };
    existingTickets.push(offboardTicket);
    localStorage.setItem("safeone_tickets", JSON.stringify(existingTickets));

    // If resignation, show asset return overlay to the person (only if they have assets)
    if (offboardReason === "Renuncia" && assetSummary.totalCount > 0) {
      setShowAssetReturnOverlay({ userName: targetUser.fullName, assets: assetSummary });
    }

    toast({
      title: "✅ Baja procesada",
      description: `${targetUser.fullName} ha sido dado de baja. Se generó ticket de IT automáticamente.${assetSummary.totalCount > 0 ? ` ${assetSummary.totalCount} activo(s) pendientes de devolución.` : ""}`,
    });

    setShowOffboarding(null);
    setOffboardReason("Renuncia");
    setOffboardNotes("");
  };

  const handleAddFolder = async (dept: string) => {
    if (!newFolderName.trim()) return;
    if (apiMode) {
      try {
        const folder = await departmentFoldersApi.createFolder(dept, newFolderName.trim());
        setDeptFolders(prev => ({ ...prev, [dept]: [...(prev[dept] || []), folder] }));
        toast({ title: "✅ Carpeta creada", description: `"${newFolderName.trim()}" creada correctamente.` });
      } catch (err: any) {
        toast({ title: "Error", description: err?.message || "No se pudo crear la carpeta.", variant: "destructive" });
      }
    } else {
      const newFolder: DeptFolder = { id: `local-${Date.now()}`, name: newFolderName.trim(), department: dept, files: [] };
      setDeptFolders(prev => ({ ...prev, [dept]: [...(prev[dept] || []), newFolder] }));
    }
    setNewFolderName("");
    setShowNewFolder(false);
  };

  const handleUploadFile = async (dept: string, folderId: string, fileList: FileList | null) => {
    if (!fileList) return;
    for (const f of Array.from(fileList)) {
      const size = f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`;
      if (apiMode) {
        try {
          const savedFile = await departmentFoldersApi.addFile(dept, folderId, { name: f.name, size });
          setDeptFolders(prev => {
            const folders = (prev[dept] || []).map(folder =>
              folder.id === folderId ? { ...folder, files: [...folder.files, savedFile] } : folder
            );
            return { ...prev, [dept]: folders };
          });
        } catch {
          toast({ title: "Error", description: `No se pudo subir ${f.name}`, variant: "destructive" });
        }
      } else {
        const newFile = { id: `file-${Date.now()}`, name: f.name, size, uploadedAt: new Date().toISOString().split("T")[0] };
        setDeptFolders(prev => {
          const folders = (prev[dept] || []).map(folder =>
            folder.id === folderId ? { ...folder, files: [...folder.files, newFile] } : folder
          );
          return { ...prev, [dept]: folders };
        });
      }
    }
  };

  const handleDeleteFile = async (dept: string, folderId: string, fileId: string) => {
    if (apiMode) {
      try {
        await departmentFoldersApi.deleteFile(dept, folderId, fileId);
      } catch {
        toast({ title: "Error", description: "No se pudo eliminar el archivo.", variant: "destructive" });
        return;
      }
    }
    setDeptFolders(prev => {
      const folders = (prev[dept] || []).map(folder =>
        folder.id === folderId ? { ...folder, files: folder.files.filter(f => f.id !== fileId) } : folder
      );
      return { ...prev, [dept]: folders };
    });
  };

  const handleDeleteFolder = async (dept: string, folderId: string) => {
    if (apiMode) {
      try {
        await departmentFoldersApi.deleteFolder(dept, folderId);
      } catch (err: any) {
        toast({ title: "Error", description: err?.message || "No se pudo eliminar la carpeta.", variant: "destructive" });
        return;
      }
    }
    setDeptFolders(prev => ({
      ...prev,
      [dept]: (prev[dept] || []).filter(f => f.id !== folderId),
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
        {departmentsMeta.map((dept) => {
          const Icon = dept.icon;
          const leaderUser = activeUsers.find((u) => u.department === dept.name && u.isDepartmentLeader);
          const teamMembers = activeUsers.filter((u) => u.department === dept.name && !u.isDepartmentLeader);
          const exEmployees = inactiveUsers.filter((u) => u.department === dept.name);
          const reportsToUser = leaderUser?.reportsTo ? allUsers.find((u) => u.id === leaderUser.reportsTo) : null;
          const isLeaderOrAdmin = user?.isAdmin || (user?.isDepartmentLeader && user?.department === dept.name);
          return (
            <div key={dept.name} className="card-department group border-2 relative" style={{ borderColor: "hsl(220 15% 30%)" }} id={`dept-${dept.name.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="px-5 py-4 flex items-center gap-4 relative" style={{ background: "hsl(220 15% 30%)" }}>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={cn("font-heading font-bold text-white text-base leading-tight", (DEPT_ROUTES[dept.name] || DEPT_MULTI_ROUTES[dept.name]) && "cursor-pointer hover:underline")}
                    onClick={() => {
                      if (DEPT_ROUTES[dept.name]) {
                        // Bloqueo de acceso para departamentos restringidos (ej: Administración)
                        if (RESTRICTED_DEPT_ROUTES.has(dept.name) && !user?.isAdmin && user?.department !== dept.name) {
                          toast({
                            title: "🔒 Acceso restringido",
                            description: `El acceso al módulo de ${dept.name} está restringido a su personal. Solicita acceso a Chrisnel Fabián si lo necesitas.`,
                            variant: "destructive",
                          });
                          return;
                        }
                        navigate(DEPT_ROUTES[dept.name]);
                      } else if (DEPT_MULTI_ROUTES[dept.name]) setShowDeptMenu(showDeptMenu === dept.name ? null : dept.name);
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
                    onClick={() => {
                      if (!userBelongsToDept(dept.name)) {
                        toast({ title: "Acceso denegado", description: "Solo los miembros de este departamento pueden ver sus carpetas.", variant: "destructive" });
                        return;
                      }
                      if (showFiles === dept.name) {
                        setShowFiles(null);
                      } else {
                        setShowFiles(dept.name);
                        loadFolders(dept.name);
                      }
                    }}
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
                    {loadingFolders[dept.name] ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Cargando carpetas...</p>
                    ) : (deptFolders[dept.name] || []).map((folder) => (
                      <FolderItem
                        key={folder.id}
                        folder={folder}
                        deptName={dept.name}
                        onUpload={(files) => handleUploadFile(dept.name, folder.id, files)}
                        onDeleteFile={(fileId) => handleDeleteFile(dept.name, folder.id, fileId)}
                        onDeleteFolder={folder.name !== 'General' ? () => handleDeleteFolder(dept.name, folder.id) : undefined}
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
          : { name: "Sin asignar", position: "—", photo: "", fleetPhone: "", email: "—" };
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
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {target.photoUrl ? <img src={target.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground text-sm">{target.fullName}</p>
                    <p className="text-xs text-muted-foreground">{target.position} — {target.department}</p>
                  </div>
                </div>

                {/* Assets assigned to this user */}
                {offboardAssetSummary && offboardAssetSummary.totalCount > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-semibold text-destructive">
                        {offboardAssetSummary.totalCount} activo(s) asignado(s)
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {offboardAssetSummary.assets.map((asset) => (
                        <div key={asset.id} className="flex items-center gap-2 text-xs bg-background/50 rounded-lg px-2.5 py-1.5">
                          <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium text-card-foreground">[{asset.typeLabel}]</span>
                          <span className="text-card-foreground">{asset.description}</span>
                          <span className="text-muted-foreground ml-auto font-mono">{asset.id}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Se generará un ticket automático para la recuperación de estos equipos.
                    </p>
                  </div>
                )}
                {offboardAssetSummary && offboardAssetSummary.totalCount === 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">No se encontraron activos asignados a este usuario.</p>
                  </div>
                )}

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
                    <li>Se notificará a todos los miembros de RRHH y Tecnología</li>
                    <li>Se generará un ticket automático de IT para retiro de equipos</li>
                    {offboardReason === "Renuncia" && offboardAssetSummary && offboardAssetSummary.totalCount > 0 && (
                      <li className="font-medium">Se mostrará al empleado un aviso de devolución de activos</li>
                    )}
                    {offboardReason !== "Renuncia" && (
                      <li>No se notificará al empleado (desvinculación directa)</li>
                    )}
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

      {/* Asset Return Overlay — shown only for resignations */}
      {showAssetReturnOverlay && (
        <AssetReturnOverlay
          userName={showAssetReturnOverlay.userName}
          assets={showAssetReturnOverlay.assets.assets}
          onClose={() => setShowAssetReturnOverlay(null)}
        />
      )}
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
  deptName?: string;
  onUpload: (files: FileList | null) => void;
  onDeleteFile: (fileId: string) => void;
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
          {folder.files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 text-[11px] py-1 group/file">
              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="flex-1 text-card-foreground truncate">{file.name}</span>
              <span className="text-muted-foreground shrink-0">{file.size}</span>
              {file.uploadedBy && <span className="text-muted-foreground shrink-0 text-[10px]">{file.uploadedBy}</span>}
              <button onClick={() => onDeleteFile(file.id)} className="opacity-0 group-hover/file:opacity-100 text-destructive p-0.5">
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
