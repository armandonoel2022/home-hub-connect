import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
    leader: { name: "Pendiente", position: "Gerente Administrativo", photo: "", fleetPhone: "", email: "admin@safeone.com.do" },
  },
  {
    name: "Gerencia General",
    icon: Briefcase,
    description: "Dirección y estrategia corporativa",
    color: "220 15% 30%",
    leader: { name: "Pendiente", position: "Gerente General", photo: "", fleetPhone: "", email: "gerencia@safeone.com.do" },
  },
  {
    name: "Gerencia Comercial",
    icon: TrendingUp,
    description: "Ventas y desarrollo de negocio",
    color: "160 60% 40%",
    leader: { name: "Pendiente", position: "Gerente Comercial", photo: "", fleetPhone: "", email: "comercial@safeone.com.do" },
  },
  {
    name: "Recursos Humanos",
    icon: Users,
    description: "Gestión del talento y bienestar laboral",
    color: "330 60% 50%",
    leader: { name: "Pendiente", position: "Gerente de RRHH", photo: "", fleetPhone: "", email: "rrhh@safeone.com.do" },
  },
  {
    name: "Operaciones",
    icon: Shield,
    description: "Logística y operaciones de campo",
    color: "100 50% 40%",
    leader: { name: "Remit", position: "Gerente de Operaciones", photo: "", fleetPhone: "+1 809-555-0010", email: "remit@safeone.com.do" },
  },
  {
    name: "Servicio al Cliente",
    icon: Headphones,
    description: "Atención y soporte al cliente",
    color: "200 70% 50%",
    leader: { name: "Pendiente", position: "Gerente de Servicio", photo: "", fleetPhone: "", email: "servicio@safeone.com.do" },
  },
  {
    name: "Calidad",
    icon: CheckCircle,
    description: "Control y aseguramiento de calidad",
    color: "280 50% 50%",
    leader: { name: "Pendiente", position: "Gerente de Calidad", photo: "", fleetPhone: "", email: "calidad@safeone.com.do" },
  },
  {
    name: "Cuentas por Cobrar",
    icon: DollarSign,
    description: "Gestión de cobros y facturación",
    color: "15 80% 55%",
    leader: { name: "Pendiente", position: "Encargado de Cobros", photo: "", fleetPhone: "", email: "cobros@safeone.com.do" },
  },
  {
    name: "Contabilidad",
    icon: Calculator,
    description: "Finanzas y registros contables",
    color: "340 60% 50%",
    leader: { name: "Pendiente", position: "Contador General", photo: "", fleetPhone: "", email: "contabilidad@safeone.com.do" },
  },
  {
    name: "Tecnología y Monitoreo",
    icon: Monitor,
    description: "Sistemas, CCTV y monitoreo",
    color: "190 70% 45%",
    leader: { name: "Anoel", position: "IT Manager", photo: "", fleetPhone: "+1 809-555-0020", email: "anoel@safeone.com.do" },
  },
  {
    name: "Seguridad Electrónica",
    icon: Settings,
    description: "Sistemas de seguridad y alarmas",
    color: "250 40% 45%",
    leader: { name: "Pendiente", position: "Gerente de Seguridad Electrónica", photo: "", fleetPhone: "", email: "seguridad.electronica@safeone.com.do" },
  },
];

const DEPT_ROUTES: Record<string, string> = {
  "Recursos Humanos": "/rrhh/formularios",
};

const DepartmentGrid = () => {
  const { allUsers } = useAuth();
  const navigate = useNavigate();
  const [showLeader, setShowLeader] = useState<Department | null>(null);
  const [showFiles, setShowFiles] = useState<string | null>(null);
  const [showTeam, setShowTeam] = useState<string | null>(null);
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
          const leaderUser = allUsers.find((u) => u.department === dept.name && u.isDepartmentLeader);
          const teamMembers = allUsers.filter((u) => u.department === dept.name && !u.isDepartmentLeader);
          const reportsToUser = leaderUser?.reportsTo ? allUsers.find((u) => u.id === leaderUser.reportsTo) : null;
          return (
            <div key={dept.name} className="card-department group border-2" style={{ borderColor: "hsl(220 15% 30%)" }} id={`dept-${dept.name.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="px-5 py-4 flex items-center gap-4" style={{ background: "hsl(220 15% 30%)" }}>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={cn("font-heading font-bold text-white text-base leading-tight", DEPT_ROUTES[dept.name] && "cursor-pointer hover:underline")}
                    onClick={() => DEPT_ROUTES[dept.name] && navigate(DEPT_ROUTES[dept.name])}
                  >
                    {dept.name}
                  </h3>
                  <p className="text-white/75 text-sm mt-0.5 truncate">{dept.description}</p>
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
                      <div key={m.id} className="flex items-center gap-2 text-[11px] px-3 py-1.5">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {m.photoUrl ? <img src={m.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <span className="text-card-foreground">{m.fullName}</span>
                        <span className="text-muted-foreground ml-auto truncate max-w-[100px]">{m.position}</span>
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
