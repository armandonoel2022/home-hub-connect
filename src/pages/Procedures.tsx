import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartmentLeader, type DeletionRecord } from "@/hooks/useDepartmentLeader";
import { DEPARTMENTS } from "@/lib/types";
import { BookOpen, Plus, X, Search, Download, Trash2, Lock, Eye, Upload, File, Archive, UserCog } from "lucide-react";

interface Procedure {
  id: string;
  title: string;
  description: string;
  department: string;
  category: "general" | "departamental";
  createdBy: string;
  createdByUserId: string;
  createdAt: string;
  fileName: string;
  fileSize: string;
  accessType: "todos" | "departamento" | "personas";
  accessDepartment?: string;
  accessUserIds?: string[];
  deleted?: boolean;
  deletedBy?: string;
  deletedAt?: string;
  deleteReason?: string;
}

const INITIAL_PROCEDURES: Procedure[] = [
  { id: "PROC-001", title: "Procedimiento de Evacuación", description: "Protocolo de evacuación para emergencias", department: "Gerencia General", category: "general", createdBy: "Aurelio Pérez", createdByUserId: "USR-100", createdAt: "2026-01-15", fileName: "evacuacion.pdf", fileSize: "1.2 MB", accessType: "todos" },
  { id: "PROC-002", title: "Protocolo de Respuesta a Incidentes", description: "Pasos a seguir ante incidentes de seguridad", department: "Operaciones", category: "departamental", createdBy: "Remit López", createdByUserId: "USR-005", createdAt: "2026-02-01", fileName: "respuesta_incidentes.pdf", fileSize: "2.1 MB", accessType: "departamento", accessDepartment: "Operaciones" },
  { id: "PROC-003", title: "Proceso de Onboarding", description: "Guía para integración de nuevos empleados", department: "Recursos Humanos", category: "general", createdBy: "Dilia Aguasvivas", createdByUserId: "USR-006", createdAt: "2026-02-10", fileName: "onboarding.pdf", fileSize: "890 KB", accessType: "todos" },
];

const ProceduresPage = () => {
  const { user, allUsers } = useAuth();
  const { isLeader, canManageContent, departmentUsers } = useDepartmentLeader();
  const [procedures, setProcedures] = useState<Procedure[]>(INITIAL_PROCEDURES);
  const [deletionLog, setDeletionLog] = useState<DeletionRecord[]>([]);
  const [delegatedUsers, setDelegatedUsers] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Procedure | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Procedure | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeletionLog, setShowDeletionLog] = useState(false);
  const [showDelegation, setShowDelegation] = useState(false);
  const [showVisibility, setShowVisibility] = useState<Procedure | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general" as Procedure["category"],
    file: null as File | null,
    accessType: "todos" as Procedure["accessType"],
    accessDept: "",
    accessUsers: [] as string[],
  });

  const canManage = canManageContent || (user ? delegatedUsers.includes(user.id) : false);

  const canManageProc = (p: Procedure) => {
    if (user?.isAdmin) return true;
    if (p.createdByUserId === user?.id) return true;
    if (user?.isDepartmentLeader && user?.department === p.department) return true;
    if (user && delegatedUsers.includes(user.id) && user.department === p.department) return true;
    return false;
  };

  const activeProcs = procedures.filter((p) => !p.deleted);

  const visible = activeProcs.filter((p) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (p.createdByUserId === user.id) return true;
    if (p.accessType === "todos") return true;
    if (p.accessType === "departamento" && p.accessDepartment === user.department) return true;
    if (p.accessType === "personas" && p.accessUserIds?.includes(user.id)) return true;
    return false;
  });

  const filtered = visible.filter(
    (p) => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.title || !form.file) return;
    const newProc: Procedure = {
      id: `PROC-${String(procedures.length + 1).padStart(3, "0")}`,
      title: form.title,
      description: form.description,
      department: user?.department || "",
      category: form.category,
      createdBy: user?.fullName || "",
      createdByUserId: user?.id || "",
      createdAt: new Date().toISOString().split("T")[0],
      fileName: form.file.name,
      fileSize: `${(form.file.size / 1024).toFixed(0)} KB`,
      accessType: form.accessType,
      accessDepartment: form.accessType === "departamento" ? form.accessDept : undefined,
      accessUserIds: form.accessType === "personas" ? form.accessUsers : undefined,
    };
    setProcedures([newProc, ...procedures]);
    setShowCreate(false);
    setForm({ title: "", description: "", category: "general", file: null, accessType: "todos", accessDept: "", accessUsers: [] });
  };

  const handleSoftDelete = (proc: Procedure) => {
    if (!deleteReason.trim()) return;
    const now = new Date().toISOString().split("T")[0];
    setDeletionLog([
      { itemId: proc.id, itemTitle: proc.title, module: "Procedimientos", deletedBy: user?.fullName || "", deletedAt: now, reason: deleteReason },
      ...deletionLog,
    ]);
    setProcedures(procedures.map((p) => p.id === proc.id ? { ...p, deleted: true, deletedBy: user?.fullName, deletedAt: now, deleteReason: deleteReason } : p));
    setShowDeleteConfirm(null);
    setDeleteReason("");
    if (selected?.id === proc.id) setSelected(null);
  };

  const toggleUser = (userId: string) => {
    setForm((f) => ({ ...f, accessUsers: f.accessUsers.includes(userId) ? f.accessUsers.filter((id) => id !== userId) : [...f.accessUsers, userId] }));
  };

  const toggleVisibility = (procId: string, userId: string) => {
    setProcedures(procedures.map((p) => {
      if (p.id !== procId) return p;
      const current = p.accessUserIds || [];
      const updated = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
      return { ...p, accessType: "personas", accessUserIds: updated };
    }));
  };

  const toggleDelegation = (userId: string) => {
    setDelegatedUsers(delegatedUsers.includes(userId) ? delegatedUsers.filter((id) => id !== userId) : [...delegatedUsers, userId]);
  };

  const deletedCount = procedures.filter((p) => p.deleted).length;

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-7 w-7 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    Procedimientos <span className="gold-accent-text">Internos</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Protocolos y procedimientos organizacionales</p>
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
                  <button onClick={() => setShowCreate(true)} className="btn-gold flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Nuevo Procedimiento
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar procedimiento..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
          </div>
        </div>

        <div className="px-6 pb-8">
          {filtered.filter((p) => p.category === "general").length > 0 && (
            <div className="mb-6">
              <h2 className="font-heading font-bold text-card-foreground mb-3">Generales</h2>
              <div className="space-y-2">
                {filtered.filter((p) => p.category === "general").map((p) => (
                  <div key={p.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(p)}>
                    <div className="p-2 rounded-lg bg-emerald-50"><BookOpen className="h-5 w-5 text-emerald-600" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-card-foreground">{p.title}</h3>
                      <p className="text-xs text-muted-foreground">{p.department} · {p.createdBy} · {p.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Público</span>
                      {canManageProc(p) && (
                        <button onClick={(e) => { e.stopPropagation(); setShowVisibility(p); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Visibilidad">
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.filter((p) => p.category === "departamental").length > 0 && (
            <div>
              <h2 className="font-heading font-bold text-card-foreground mb-3">Departamentales</h2>
              <div className="space-y-2">
                {filtered.filter((p) => p.category === "departamental").map((p) => (
                  <div key={p.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(p)}>
                    <div className="p-2 rounded-lg bg-blue-50"><BookOpen className="h-5 w-5 text-blue-600" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-card-foreground">{p.title}</h3>
                      <p className="text-xs text-muted-foreground">{p.department} · {p.createdBy} · {p.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> {p.accessDepartment || "Restringido"}</span>
                      {canManageProc(p) && (
                        <button onClick={(e) => { e.stopPropagation(); setShowVisibility(p); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Visibilidad">
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No hay procedimientos disponibles</p>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.title}</h2>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-muted-foreground">{selected.description}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[["Departamento", selected.department], ["Creado por", selected.createdBy], ["Fecha", selected.createdAt], ["Tipo", selected.category === "general" ? "General" : "Departamental"], ["Archivo", selected.fileName], ["Tamaño", selected.fileSize]].map(([l, v]) => (
                    <div key={l} className="bg-muted rounded-lg p-3"><span className="text-xs text-muted-foreground block">{l}</span><span className="font-medium text-card-foreground">{v}</span></div>
                  ))}
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                {canManageProc(selected) && (
                  <button onClick={() => { setShowDeleteConfirm(selected); setDeleteReason(""); }} className="px-4 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"><Trash2 className="h-4 w-4" /> Eliminar</button>
                )}
                <button className="px-4 py-2 rounded-lg text-sm bg-muted text-card-foreground hover:bg-border transition-colors flex items-center gap-1"><Download className="h-4 w-4" /> Descargar</button>
                <button onClick={() => setSelected(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Delete Confirmation ══════ */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-destructive">Eliminar Procedimiento</h2>
                <button onClick={() => setShowDeleteConfirm(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-card-foreground">¿Está seguro de eliminar este procedimiento?</p>
                  <p className="text-xs text-muted-foreground mt-1"><strong>{showDeleteConfirm.title}</strong></p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Archive className="h-3 w-3" /> Quedará un registro permanente de esta eliminación.</p>
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
                  <p className="text-xs text-muted-foreground mt-1">Historial permanente — Procedimientos</p>
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
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Visibilidad</h2>
                  <p className="text-xs text-muted-foreground mt-1">{showVisibility.title}</p>
                </div>
                <button onClick={() => setShowVisibility(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex gap-2 mb-3">
                  {(["todos", "departamento", "personas"] as const).map((t) => (
                    <button key={t} onClick={() => setProcedures(procedures.map(p => p.id === showVisibility.id ? { ...p, accessType: t } : p))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showVisibility.accessType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>
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
                  <p className="text-xs text-muted-foreground mt-1">Seleccione quién puede agregar/eliminar procedimientos</p>
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

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nuevo Procedimiento</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Procedure["category"] })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="general">General (visible para todos)</option>
                    <option value="departamental">Departamental (acceso controlado)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Archivo *</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {form.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="h-5 w-5 text-gold" />
                        <span className="text-sm text-card-foreground">{form.file.name}</span>
                        <button onClick={() => setForm({ ...form, file: null })} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Haz clic para seleccionar</p>
                        <input type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setForm({ ...form, file: e.target.files[0] }); }} />
                      </label>
                    )}
                  </div>
                </div>
                {form.category === "departamental" && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-card-foreground block mb-1.5">Acceso</label>
                      <div className="flex gap-2">
                        {(["departamento", "personas"] as const).map((t) => (
                          <button key={t} onClick={() => setForm({ ...form, accessType: t })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.accessType === t ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>
                            {t === "departamento" ? "Por Departamento" : "Personas Específicas"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.accessType === "departamento" && (
                      <select value={form.accessDept} onChange={(e) => setForm({ ...form, accessDept: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                        <option value="">Seleccionar departamento...</option>
                        {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
                      </select>
                    )}
                    {form.accessType === "personas" && (
                      <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                        {allUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                            <input type="checkbox" checked={form.accessUsers.includes(u.id)} onChange={() => toggleUser(u.id)} className="rounded" />
                            <span className="text-card-foreground">{u.fullName}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{u.department}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleCreate} className="btn-gold text-sm">Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProceduresPage;
