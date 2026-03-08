import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartmentLeader, type DeletionRecord } from "@/hooks/useDepartmentLeader";
import { BookOpen, Plus, X, Search, Edit3, Save, Trash2, Clock, User, Tag, Archive, UserCog } from "lucide-react";

interface WikiArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  department: string;
  createdBy: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  deleted?: boolean;
  deletedBy?: string;
  deletedAt?: string;
  deleteReason?: string;
}

const CATEGORIES = ["General", "Políticas", "Guías", "FAQ", "Procesos", "Tecnología"];

const INITIAL_ARTICLES: WikiArticle[] = [
  {
    id: "WIKI-001", title: "Cómo conectarse a la VPN corporativa",
    content: "## Requisitos\n- Tener instalado el cliente FortiClient\n- Credenciales de acceso proporcionadas por IT\n\n## Pasos\n1. Abrir FortiClient VPN\n2. Ingresar la dirección del servidor: vpn.safeone.com.do\n3. Introducir usuario y contraseña\n4. Hacer clic en \"Conectar\"\n\n## Solución de Problemas\n- Si no puede conectarse, verifique que tiene acceso a internet\n- Contacte a IT al ext. 216 si el problema persiste",
    category: "Tecnología", department: "Tecnología y Monitoreo", createdBy: "Armando Noel", createdByUserId: "USR-002", createdAt: "2026-02-15", updatedAt: "2026-02-15", tags: ["VPN", "Conectividad", "IT"],
  },
  {
    id: "WIKI-002", title: "Procedimiento para solicitar vacaciones",
    content: "## Proceso\n1. Acceder al módulo de RRHH > Formularios > Vacaciones\n2. Completar el formulario con las fechas deseadas\n3. Seleccionar modalidad: Imprimir o Virtual\n4. Obtener aprobación del supervisor directo\n5. Entregar a RRHH para registro\n\n## Consideraciones\n- Solicitar con mínimo 15 días de anticipación\n- Verificar disponibilidad con el supervisor\n- Tener días disponibles según antigüedad",
    category: "Procesos", department: "Recursos Humanos", createdBy: "Dilia Aguasvivas", createdByUserId: "USR-006", createdAt: "2026-01-20", updatedAt: "2026-03-01", tags: ["Vacaciones", "RRHH", "Formularios"],
  },
  {
    id: "WIKI-003", title: "Política de uso de equipos corporativos",
    content: "## Alcance\nAplica a todos los colaboradores que tengan equipos asignados.\n\n## Lineamientos\n- Los equipos son para uso exclusivamente laboral\n- No instalar software no autorizado\n- Reportar inmediatamente cualquier daño o pérdida\n- Devolver equipos al finalizar la relación laboral\n\n## Sanciones\nEl incumplimiento puede resultar en acciones disciplinarias según el reglamento interno.",
    category: "Políticas", department: "Gerencia General", createdBy: "Aurelio Pérez", createdByUserId: "USR-100", createdAt: "2026-01-05", updatedAt: "2026-01-05", tags: ["Equipos", "Política", "General"],
  },
];

const WikiPage = () => {
  const { user } = useAuth();
  const { isLeader, canManageContent, departmentUsers } = useDepartmentLeader();
  const [articles, setArticles] = useState<WikiArticle[]>(INITIAL_ARTICLES);
  const [deletionLog, setDeletionLog] = useState<DeletionRecord[]>([]);
  const [delegatedUsers, setDelegatedUsers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [selected, setSelected] = useState<WikiArticle | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<WikiArticle | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeletionLog, setShowDeletionLog] = useState(false);
  const [showDelegation, setShowDelegation] = useState(false);

  const [form, setForm] = useState({ title: "", content: "", category: "General", tags: "" });

  const canManage = canManageContent || (user ? delegatedUsers.includes(user.id) : false);

  const canManageArticle = (a: WikiArticle) => {
    if (user?.isAdmin) return true;
    if (a.createdByUserId === user?.id) return true;
    if (user?.isDepartmentLeader && user?.department === a.department) return true;
    if (user && delegatedUsers.includes(user.id) && user.department === a.department) return true;
    return false;
  };

  const activeArticles = articles.filter((a) => !a.deleted);

  const filtered = activeArticles.filter((a) => {
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      a.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || a.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleCreate = () => {
    if (!form.title || !form.content) return;
    const newArticle: WikiArticle = {
      id: `WIKI-${String(articles.length + 1).padStart(3, "0")}`,
      title: form.title, content: form.content, category: form.category,
      department: user?.department || "", createdBy: user?.fullName || "", createdByUserId: user?.id || "",
      createdAt: new Date().toISOString().split("T")[0], updatedAt: new Date().toISOString().split("T")[0],
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    setArticles([newArticle, ...articles]);
    setShowCreate(false);
    setForm({ title: "", content: "", category: "General", tags: "" });
  };

  const handleSaveEdit = () => {
    if (!selected) return;
    setArticles(articles.map((a) => a.id === selected.id ? { ...a, content: editContent, updatedAt: new Date().toISOString().split("T")[0] } : a));
    setSelected({ ...selected, content: editContent, updatedAt: new Date().toISOString().split("T")[0] });
    setEditing(false);
  };

  const handleSoftDelete = (article: WikiArticle) => {
    if (!deleteReason.trim()) return;
    const now = new Date().toISOString().split("T")[0];
    setDeletionLog([
      { itemId: article.id, itemTitle: article.title, module: "Wiki", deletedBy: user?.fullName || "", deletedAt: now, reason: deleteReason },
      ...deletionLog,
    ]);
    setArticles(articles.map((a) => a.id === article.id ? { ...a, deleted: true, deletedBy: user?.fullName, deletedAt: now, deleteReason: deleteReason } : a));
    setShowDeleteConfirm(null);
    setDeleteReason("");
    if (selected?.id === article.id) setSelected(null);
  };

  const toggleDelegation = (userId: string) => {
    setDelegatedUsers(delegatedUsers.includes(userId) ? delegatedUsers.filter((id) => id !== userId) : [...delegatedUsers, userId]);
  };

  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h3 key={i} className="font-heading font-bold text-card-foreground mt-4 mb-2">{line.slice(3)}</h3>;
      if (line.startsWith("- ")) return <li key={i} className="text-sm text-muted-foreground ml-4">{line.slice(2)}</li>;
      if (line.match(/^\d+\. /)) return <li key={i} className="text-sm text-muted-foreground ml-4 list-decimal">{line.replace(/^\d+\. /, "")}</li>;
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
    });
  };

  const deletedCount = articles.filter((a) => a.deleted).length;

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
                    Base de <span className="gold-accent-text">Conocimiento</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Wiki interna — artículos, guías y procedimientos</p>
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
                    <Plus className="h-4 w-4" /> Nuevo Artículo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar artículo, tag o contenido..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCat("")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!filterCat ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>Todos</button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterCat === c ? "bg-gold text-charcoal-dark" : "bg-muted text-muted-foreground"}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <div key={a.id} onClick={() => { setSelected(a); setEditing(false); }} className="bg-card rounded-xl border border-border p-5 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{a.category}</span>
              </div>
              <h3 className="font-heading font-bold text-card-foreground text-sm mb-2">{a.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-3">{a.content.replace(/##\s/g, "").replace(/- /g, "").substring(0, 150)}...</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a.createdBy}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.updatedAt}</span>
              </div>
              {a.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No se encontraron artículos</p>
            </div>
          )}
        </div>

        {/* Article View */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">{selected.title}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{selected.category}</span>
                    <span>{selected.department}</span>
                    <span>Actualizado: {selected.updatedAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManageArticle(selected) && !editing && (
                    <button onClick={() => { setEditing(true); setEditContent(selected.content); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Editar">
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="p-5">
                {editing ? (
                  <div className="space-y-3">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={15} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none font-mono" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                      <button onClick={handleSaveEdit} className="btn-gold text-sm flex items-center gap-1"><Save className="h-4 w-4" /> Guardar</button>
                    </div>
                  </div>
                ) : (
                  <div className="prose-sm">{renderContent(selected.content)}</div>
                )}
              </div>
              {selected.tags.length > 0 && (
                <div className="px-5 pb-5 flex items-center gap-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {selected.tags.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold font-medium">{t}</span>
                  ))}
                </div>
              )}
              <div className="p-5 border-t border-border flex justify-between">
                {canManageArticle(selected) && (
                  <button onClick={() => { setShowDeleteConfirm(selected); setDeleteReason(""); }} className="px-4 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"><Trash2 className="h-4 w-4" /> Eliminar</button>
                )}
                <button onClick={() => setSelected(null)} className="btn-gold text-sm ml-auto">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Delete Confirmation ══════ */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-destructive">Eliminar Artículo</h2>
                <button onClick={() => setShowDeleteConfirm(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="text-sm font-medium text-card-foreground">¿Está seguro de eliminar este artículo?</p>
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
                  <p className="text-xs text-muted-foreground mt-1">Historial permanente — Wiki</p>
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

        {/* ══════ Delegation ══════ */}
        {showDelegation && isLeader && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Delegar Gestión</h2>
                  <p className="text-xs text-muted-foreground mt-1">Seleccione quién puede agregar/eliminar artículos</p>
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
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nuevo Artículo</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Categoría</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Contenido * (soporta formato Markdown básico)</label>
                  <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none font-mono" placeholder="## Sección&#10;Contenido...&#10;- Item 1&#10;- Item 2" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Tags (separados por coma)</label>
                  <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" placeholder="VPN, IT, Guía" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleCreate} className="btn-gold text-sm">Publicar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default WikiPage;
