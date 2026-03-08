import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartmentLeader, type DeletionRecord } from "@/hooks/useDepartmentLeader";
import { DEPARTMENTS } from "@/lib/types";
import { FolderOpen, Upload, Download, Trash2, X, File, Search, Lock, Archive, UserCog, Eye, EyeOff } from "lucide-react";

interface SharedFile {
  id: string;
  name: string;
  size: string;
  uploadedBy: string;
  uploadedByUserId: string;
  uploadedAt: string;
  department: string;
  accessType: "todos" | "departamento" | "personas";
  accessDepartment?: string;
  accessUserIds?: string[];
  deleted?: boolean;
  deletedBy?: string;
  deletedAt?: string;
  deleteReason?: string;
}

const INITIAL_FILES: SharedFile[] = [
  { id: "SF-001", name: "Manual de Identidad Corporativa.pdf", size: "5.2 MB", uploadedBy: "Aurelio Pérez", uploadedByUserId: "USR-100", uploadedAt: "2026-02-01", department: "Gerencia General", accessType: "todos" },
  { id: "SF-002", name: "Plantilla de Informes.docx", size: "320 KB", uploadedBy: "Chrisnel Fabian", uploadedByUserId: "USR-101", uploadedAt: "2026-02-15", department: "Administración", accessType: "departamento", accessDepartment: "Administración" },
  { id: "SF-003", name: "Calendario Feriados 2026.xlsx", size: "145 KB", uploadedBy: "Dilia Aguasvivas", uploadedByUserId: "USR-006", uploadedAt: "2026-01-10", department: "Recursos Humanos", accessType: "todos" },
  { id: "SF-004", name: "Protocolo de Rondas.pdf", size: "1.8 MB", uploadedBy: "Remit López", uploadedByUserId: "USR-005", uploadedAt: "2026-02-20", department: "Operaciones", accessType: "departamento", accessDepartment: "Operaciones" },
];

const SharedFilesPage = () => {
  const { user, allUsers } = useAuth();
  const { isLeader, canManageContent, departmentUsers } = useDepartmentLeader();
  const [files, setFiles] = useState<SharedFile[]>(INITIAL_FILES);
  const [deletionLog, setDeletionLog] = useState<DeletionRecord[]>([]);
  const [delegatedUsers, setDelegatedUsers] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<SharedFile | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeletionLog, setShowDeletionLog] = useState(false);
  const [showDelegation, setShowDelegation] = useState(false);
  const [showVisibility, setShowVisibility] = useState<SharedFile | null>(null);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    accessType: "todos" as SharedFile["accessType"],
    accessDept: "",
    accessUsers: [] as string[],
  });

  const canManage = canManageContent || (user ? delegatedUsers.includes(user.id) : false);

  // Can user manage this specific file? Leader of file's department or admin
  const canManageFile = (f: SharedFile) => {
    if (user?.isAdmin) return true;
    if (f.uploadedByUserId === user?.id) return true;
    if (user?.isDepartmentLeader && user?.department === f.department) return true;
    if (user && delegatedUsers.includes(user.id) && user.department === f.department) return true;
    return false;
  };

  const activeFiles = files.filter((f) => !f.deleted);

  const visibleFiles = activeFiles.filter((f) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (f.uploadedByUserId === user.id) return true;
    if (f.accessType === "todos") return true;
    if (f.accessType === "departamento" && f.accessDepartment === user.department) return true;
    if (f.accessType === "personas" && f.accessUserIds?.includes(user.id)) return true;
    return false;
  });

  const filtered = visibleFiles.filter(
    (f) => !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = () => {
    if (!uploadForm.file) return;
    const newFile: SharedFile = {
      id: `SF-${String(files.length + 1).padStart(3, "0")}`,
      name: uploadForm.file.name,
      size: `${(uploadForm.file.size / 1024).toFixed(0)} KB`,
      uploadedBy: user?.fullName || "",
      uploadedByUserId: user?.id || "",
      uploadedAt: new Date().toISOString().split("T")[0],
      department: user?.department || "",
      accessType: uploadForm.accessType,
      accessDepartment: uploadForm.accessType === "departamento" ? uploadForm.accessDept : undefined,
      accessUserIds: uploadForm.accessType === "personas" ? uploadForm.accessUsers : undefined,
    };
    setFiles([newFile, ...files]);
    setShowUpload(false);
    setUploadForm({ file: null, accessType: "todos", accessDept: "", accessUsers: [] });
  };

  const handleSoftDelete = (file: SharedFile) => {
    if (!deleteReason.trim()) return;
    const now = new Date().toISOString().split("T")[0];
    setDeletionLog([
      { itemId: file.id, itemTitle: file.name, module: "Archivos Compartidos", deletedBy: user?.fullName || "", deletedAt: now, reason: deleteReason },
      ...deletionLog,
    ]);
    setFiles(files.map((f) => f.id === file.id ? { ...f, deleted: true, deletedBy: user?.fullName, deletedAt: now, deleteReason: deleteReason } : f));
    setShowDeleteConfirm(null);
    setDeleteReason("");
  };

  const toggleUser = (userId: string) => {
    setUploadForm((f) => ({
      ...f,
      accessUsers: f.accessUsers.includes(userId) ? f.accessUsers.filter((id) => id !== userId) : [...f.accessUsers, userId],
    }));
  };

  const toggleVisibility = (fileId: string, userId: string) => {
    setFiles(files.map((f) => {
      if (f.id !== fileId) return f;
      const current = f.accessUserIds || [];
      const updated = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
      return { ...f, accessType: "personas", accessUserIds: updated };
    }));
  };

  const toggleDelegation = (userId: string) => {
    setDelegatedUsers(delegatedUsers.includes(userId) ? delegatedUsers.filter((id) => id !== userId) : [...delegatedUsers, userId]);
  };

  const deletedCount = files.filter((f) => f.deleted).length;

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Archivos <span className="gold-accent-text">Compartidos</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Documentos compartidos con control de acceso</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLeader && (
                  <button onClick={() => setShowDelegation(true)} className="p-2.5 rounded-lg border border-border text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors" title="Gestionar delegados">
                    <UserCog className="h-4 w-4" />
                  </button>
                )}
                {isLeader && (
                  <button onClick={() => setShowDeletionLog(true)} className="p-2.5 rounded-lg border border-border text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors relative" title="Registro de eliminaciones">
                    <Archive className="h-4 w-4" />
                    {deletedCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{deletedCount}</span>}
                  </button>
                )}
                {canManage && (
                  <button onClick={() => setShowUpload(true)} className="btn-gold flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Subir Archivo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar archivo..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
          </div>
        </div>

        <div className="px-6 pb-8 space-y-2">
          {filtered.map((f) => (
            <div key={f.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-muted"><File className="h-5 w-5 text-gold" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-card-foreground truncate">{f.name}</h3>
                <p className="text-xs text-muted-foreground">{f.uploadedBy} · {f.uploadedAt} · {f.size}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {f.accessType === "todos" ? "Todos" : f.accessType === "departamento" ? f.accessDepartment : "Restringido"}
                </span>
                {canManageFile(f) && (
                  <button onClick={() => setShowVisibility(f)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Gestionar visibilidad">
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Descargar">
                  <Download className="h-4 w-4" />
                </button>
                {canManageFile(f) && (
                  <button onClick={() => { setShowDeleteConfirm(f); setDeleteReason(""); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No hay archivos compartidos disponibles</p>
            </div>
          )}
        </div>

        {/* ══════ Delete Confirmation ══════ */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-destructive">Eliminar Archivo</h2>
                <button onClick={() => setShowDeleteConfirm(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-card-foreground">¿Está seguro de eliminar este archivo?</p>
                  <p className="text-xs text-muted-foreground mt-1"><strong>{showDeleteConfirm.name}</strong></p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Archive className="h-3 w-3" /> El archivo será archivado y quedará un registro permanente.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Motivo de eliminación *</label>
                  <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={2} placeholder="Indique el motivo..." className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-destructive outline-none resize-none" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={() => handleSoftDelete(showDeleteConfirm)} disabled={!deleteReason.trim()} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Deletion Log ══════ */}
        {showDeletionLog && isLeader && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Registro de Eliminaciones</h2>
                  <p className="text-xs text-muted-foreground mt-1">Historial permanente — Archivos Compartidos</p>
                </div>
                <button onClick={() => setShowDeletionLog(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-3">
                {deletionLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay registros de eliminaciones.</p>
                ) : (
                  deletionLog.map((r, i) => (
                    <div key={i} className="bg-muted rounded-lg p-4 space-y-1">
                      <p className="text-sm font-medium text-card-foreground">{r.itemTitle}</p>
                      <p className="text-xs text-muted-foreground">Eliminado por: <strong>{r.deletedBy}</strong> · {r.deletedAt}</p>
                      <p className="text-xs text-muted-foreground">Motivo: {r.reason}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowDeletionLog(false)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Visibility Management ══════ */}
        {showVisibility && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Visibilidad del Archivo</h2>
                  <p className="text-xs text-muted-foreground mt-1">{showVisibility.name}</p>
                </div>
                <button onClick={() => setShowVisibility(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex gap-2 mb-3">
                  {(["todos", "departamento", "personas"] as const).map((t) => (
                    <button key={t} onClick={() => setFiles(files.map(f => f.id === showVisibility.id ? { ...f, accessType: t } : f))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showVisibility.accessType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>
                      {t === "todos" ? "Todos" : t === "departamento" ? "Departamento" : "Personas"}
                    </button>
                  ))}
                </div>
                {showVisibility.accessType === "personas" && (
                  <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                    {allUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <input type="checkbox" checked={showVisibility.accessUserIds?.includes(u.id) || false} onChange={() => toggleVisibility(showVisibility.id, u.id)} className="rounded" />
                        <span className="text-card-foreground">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.department}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowVisibility(null)} className="btn-gold text-sm">Listo</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Delegation ══════ */}
        {showDelegation && isLeader && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Delegar Gestión</h2>
                  <p className="text-xs text-muted-foreground mt-1">Seleccione quién puede agregar/eliminar archivos</p>
                </div>
                <button onClick={() => setShowDelegation(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-2">
                {departmentUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={delegatedUsers.includes(u.id)} onChange={() => toggleDelegation(u.id)} className="rounded" />
                    <div>
                      <span className="text-sm font-medium text-card-foreground">{u.fullName}</span>
                      <span className="text-xs text-muted-foreground block">{u.position}</span>
                    </div>
                  </label>
                ))}
                {departmentUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No hay otros miembros en su departamento.</p>}
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowDelegation(false)} className="btn-gold text-sm">Listo</button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Subir Archivo</h2>
                <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Archivo *</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="h-5 w-5 text-gold" />
                        <span className="text-sm text-card-foreground">{uploadForm.file.name}</span>
                        <button onClick={() => setUploadForm({ ...uploadForm, file: null })} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Haz clic para seleccionar</p>
                        <input type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setUploadForm({ ...uploadForm, file: e.target.files[0] }); }} />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Acceso</label>
                  <div className="flex gap-2">
                    {(["todos", "departamento", "personas"] as const).map((t) => (
                      <button key={t} onClick={() => setUploadForm({ ...uploadForm, accessType: t })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${uploadForm.accessType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>
                        {t === "todos" ? "Todos" : t === "departamento" ? "Departamento" : "Personas"}
                      </button>
                    ))}
                  </div>
                </div>
                {uploadForm.accessType === "departamento" && (
                  <select value={uploadForm.accessDept} onChange={(e) => setUploadForm({ ...uploadForm, accessDept: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar departamento...</option>
                    {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                )}
                {uploadForm.accessType === "personas" && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                    {allUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <input type="checkbox" checked={uploadForm.accessUsers.includes(u.id)} onChange={() => toggleUser(u.id)} className="rounded" />
                        <span className="text-card-foreground">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.department}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowUpload(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleUpload} className="btn-gold text-sm">Subir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SharedFilesPage;
