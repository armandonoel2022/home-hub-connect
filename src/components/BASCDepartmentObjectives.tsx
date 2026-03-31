import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { DEPARTMENT_PREFIXES } from "@/lib/bascDocuments";
import {
  Target, Plus, X, CheckCircle2, XCircle, Clock, MessageSquare, Send, Eye,
  FileText, ClipboardCheck, ChevronDown, ChevronRight, Edit3, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export type DeptObjectiveStatus = "borrador" | "pendiente_revision" | "aprobado" | "rechazado" | "requiere_cambios";

export interface DeptObjectiveLinkedDoc {
  id: string;
  code: string;
  name: string;
  type: "procedimiento" | "formulario";
}

export interface ReviewComment {
  id: string;
  author: string;
  text: string;
  date: string;
  action?: "aprobado" | "rechazado" | "requiere_cambios" | "comentario";
}

export interface DeptBASCObjective {
  id: string;
  department: string;
  title: string;
  description: string;
  indicator: string; // how it will be measured
  targetDate: string;
  linkedProcedures: DeptObjectiveLinkedDoc[];
  linkedForms: DeptObjectiveLinkedDoc[];
  status: DeptObjectiveStatus;
  submittedBy: string;
  submittedAt: string;
  reviewComments: ReviewComment[];
  reviewedBy?: string;
  reviewedAt?: string;
}

const STORAGE_KEY = "safeone-basc-dept-objectives-v1";
const MAX_OBJ_KEY = "safeone-basc-max-objectives";
const AUDITOR_NAME = "Bilianny Fernández";

function getMaxObjectives(): number {
  try {
    const saved = localStorage.getItem(MAX_OBJ_KEY);
    return saved ? parseInt(saved, 10) : 0; // 0 = unlimited
  } catch { return 0; }
}
function saveMaxObjectives(n: number) {
  try { localStorage.setItem(MAX_OBJ_KEY, JSON.stringify(n)); } catch {}
}

const statusConfig: Record<DeptObjectiveStatus, { label: string; color: string; icon: any }> = {
  borrador: { label: "Borrador", color: "bg-muted text-muted-foreground", icon: Edit3 },
  pendiente_revision: { label: "Pendiente de Revisión", color: "bg-amber-50 text-amber-700", icon: Clock },
  aprobado: { label: "Aprobado", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  rechazado: { label: "Rechazado", color: "bg-red-50 text-red-700", icon: XCircle },
  requiere_cambios: { label: "Requiere Cambios", color: "bg-orange-50 text-orange-700", icon: AlertTriangle },
};

function loadDeptObjectives(): DeptBASCObjective[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveDeptObjectives(objs: DeptBASCObjective[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(objs)); } catch {}
}

const BASCDepartmentObjectives = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [objectives, setObjectives] = useState<DeptBASCObjective[]>(loadDeptObjectives);
  const [showNewObjective, setShowNewObjective] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "pending">("all");
  const [newForm, setNewForm] = useState({
    title: "", description: "", indicator: "", targetDate: "",
    department: user?.department || "",
    procedures: [] as DeptObjectiveLinkedDoc[],
    forms: [] as DeptObjectiveLinkedDoc[],
    tempProcCode: "", tempProcName: "",
    tempFormCode: "", tempFormName: "",
  });

  const isReviewer = user?.isAdmin || user?.fullName === AUDITOR_NAME || user?.department === "Calidad";

  const save = useCallback((objs: DeptBASCObjective[]) => {
    setObjectives(objs);
    saveDeptObjectives(objs);
  }, []);

  const deptObjectives = objectives.filter(o => o.department === user?.department);
  const canAddMore = deptObjectives.filter(o => o.status !== "rechazado").length < MAX_OBJECTIVES_PER_DEPT;

  // Group by department for reviewer
  const byDepartment: Record<string, DeptBASCObjective[]> = {};
  const displayed = viewMode === "pending"
    ? objectives.filter(o => o.status === "pendiente_revision" || o.status === "requiere_cambios")
    : objectives;
  displayed.forEach(o => {
    if (!byDepartment[o.department]) byDepartment[o.department] = [];
    byDepartment[o.department].push(o);
  });

  const handleSaveObjective = () => {
    if (!newForm.title || !newForm.description || !newForm.indicator || !newForm.targetDate) {
      toast.error("Complete todos los campos obligatorios");
      return;
    }

    const now = new Date().toISOString().split("T")[0];

    if (editingId) {
      save(objectives.map(o => o.id === editingId ? {
        ...o,
        title: newForm.title,
        description: newForm.description,
        indicator: newForm.indicator,
        targetDate: newForm.targetDate,
        linkedProcedures: newForm.procedures,
        linkedForms: newForm.forms,
        status: "borrador" as DeptObjectiveStatus,
        submittedBy: user?.fullName || "Usuario",
        submittedAt: now,
      } : o));
      setEditingId(null);
      toast.success("Objetivo actualizado");
    } else {
      const obj: DeptBASCObjective = {
        id: `DOBJ-${Date.now()}`,
        department: newForm.department || user?.department || "",
        title: newForm.title,
        description: newForm.description,
        indicator: newForm.indicator,
        targetDate: newForm.targetDate,
        linkedProcedures: newForm.procedures,
        linkedForms: newForm.forms,
        status: "borrador",
        submittedBy: user?.fullName || "Usuario",
        submittedAt: now,
        reviewComments: [],
      };
      save([...objectives, obj]);
      toast.success("Objetivo creado como borrador");
    }

    resetForm();
  };

  const handleSubmitForReview = (id: string) => {
    save(objectives.map(o => o.id === id ? { ...o, status: "pendiente_revision" as DeptObjectiveStatus } : o));
    const obj = objectives.find(o => o.id === id);
    addNotification({
      title: "🔔 BASC: Objetivo enviado a revisión",
      message: `${user?.fullName} (${obj?.department}) envió "${obj?.title}" para revisión de formato.`,
      type: "info",
      forUserId: "ALL",
      relatedId: "BASC",
      actionUrl: "/basc",
    });
    toast.success("Objetivo enviado a revisión");
  };

  const handleReviewAction = (id: string, action: "aprobado" | "rechazado" | "requiere_cambios") => {
    if (!reviewComment.trim() && action !== "aprobado") {
      toast.error("Debe dejar un comentario al rechazar o solicitar cambios");
      return;
    }
    const now = new Date().toISOString().split("T")[0];
    const comment: ReviewComment = {
      id: `RC-${Date.now()}`,
      author: user?.fullName || "Revisor",
      text: reviewComment || (action === "aprobado" ? "Formato correcto. Aprobado." : ""),
      date: now,
      action,
    };

    save(objectives.map(o => o.id === id ? {
      ...o,
      status: action as DeptObjectiveStatus,
      reviewedBy: user?.fullName,
      reviewedAt: now,
      reviewComments: [...o.reviewComments, comment],
    } : o));

    const obj = objectives.find(o => o.id === id);
    const actionLabel = action === "aprobado" ? "✅ aprobado" : action === "rechazado" ? "❌ rechazado" : "⚠️ requiere cambios";
    addNotification({
      title: `BASC: Objetivo ${actionLabel}`,
      message: `${user?.fullName} ${actionLabel}: "${obj?.title}" (${obj?.department})${reviewComment ? ` — ${reviewComment}` : ""}`,
      type: "info",
      forUserId: "ALL",
      relatedId: "BASC",
      actionUrl: "/basc",
    });

    toast.success(`Objetivo ${actionLabel}`);
    setReviewingId(null);
    setReviewComment("");
  };

  const handleDelete = (id: string) => {
    save(objectives.filter(o => o.id !== id));
    toast.success("Objetivo eliminado");
  };

  const handleEdit = (obj: DeptBASCObjective) => {
    setNewForm({
      title: obj.title, description: obj.description, indicator: obj.indicator,
      targetDate: obj.targetDate, department: obj.department,
      procedures: obj.linkedProcedures, forms: obj.linkedForms,
      tempProcCode: "", tempProcName: "", tempFormCode: "", tempFormName: "",
    });
    setEditingId(obj.id);
    setShowNewObjective(true);
  };

  const resetForm = () => {
    setShowNewObjective(false);
    setEditingId(null);
    setNewForm({
      title: "", description: "", indicator: "", targetDate: "",
      department: user?.department || "",
      procedures: [], forms: [],
      tempProcCode: "", tempProcName: "", tempFormCode: "", tempFormName: "",
    });
  };

  const addLinkedDoc = (type: "procedures" | "forms") => {
    const code = type === "procedures" ? newForm.tempProcCode : newForm.tempFormCode;
    const name = type === "procedures" ? newForm.tempProcName : newForm.tempFormName;
    if (!code || !name) return;
    const doc: DeptObjectiveLinkedDoc = {
      id: `LD-${Date.now()}`, code, name,
      type: type === "procedures" ? "procedimiento" : "formulario",
    };
    setNewForm(prev => ({
      ...prev,
      [type]: [...prev[type], doc],
      ...(type === "procedures" ? { tempProcCode: "", tempProcName: "" } : { tempFormCode: "", tempFormName: "" }),
    }));
  };

  const removeLinkedDoc = (type: "procedures" | "forms", docId: string) => {
    setNewForm(prev => ({ ...prev, [type]: prev[type].filter(d => d.id !== docId) }));
  };

  const pendingCount = objectives.filter(o => o.status === "pendiente_revision").length;

  const renderObjectiveCard = (obj: DeptBASCObjective, showDept = false) => {
    const sc = statusConfig[obj.status];
    const StatusIcon = sc.icon;
    const canEdit = (obj.status === "borrador" || obj.status === "requiere_cambios") &&
      (obj.submittedBy === user?.fullName || user?.department === obj.department);

    return (
      <div key={obj.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {showDept && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {DEPARTMENT_PREFIXES[obj.department] || obj.department}
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${sc.color}`}>
                <StatusIcon className="h-3 w-3" /> {sc.label}
              </span>
            </div>
            <h4 className="font-heading font-bold text-sm text-card-foreground">{obj.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{obj.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span>📏 {obj.indicator}</span>
              <span>📅 {obj.targetDate}</span>
              <span>👤 {obj.submittedBy}</span>
            </div>
            {/* Linked docs */}
            {(obj.linkedProcedures.length > 0 || obj.linkedForms.length > 0) && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {obj.linkedProcedures.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    <ClipboardCheck className="h-2.5 w-2.5" /> {p.code}
                  </span>
                ))}
                {obj.linkedForms.map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    <FileText className="h-2.5 w-2.5" /> {f.code}
                  </span>
                ))}
              </div>
            )}
            {/* Review comments */}
            {obj.reviewComments.length > 0 && (
              <div className="mt-2 space-y-1">
                {obj.reviewComments.slice(-2).map(rc => {
                  const actionColor = rc.action === "aprobado" ? "border-emerald-200 bg-emerald-50/50"
                    : rc.action === "rechazado" ? "border-red-200 bg-red-50/50"
                    : rc.action === "requiere_cambios" ? "border-orange-200 bg-orange-50/50"
                    : "border-border bg-muted/50";
                  return (
                    <div key={rc.id} className={`text-[11px] px-3 py-1.5 rounded-lg border ${actionColor}`}>
                      <span className="font-semibold text-card-foreground">{rc.author}</span>
                      <span className="text-muted-foreground"> · {rc.date}</span>
                      <p className="text-card-foreground mt-0.5">{rc.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {canEdit && (
              <>
                <button onClick={() => handleEdit(obj)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Editar">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => handleSubmitForReview(obj.id)} className="p-1.5 rounded-lg hover:bg-gold/10 text-gold transition-colors" title="Enviar a revisión">
                  <Send className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(obj.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            {isReviewer && obj.status === "pendiente_revision" && (
              <button onClick={() => setReviewingId(obj.id)} className="p-1.5 rounded-lg hover:bg-gold/10 text-gold transition-colors" title="Revisar">
                <Eye className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-heading font-bold text-lg text-card-foreground">Objetivos por Departamento</h3>
          <p className="text-xs text-muted-foreground">Cada departamento debe definir 2 objetivos con sus procedimientos y formularios vinculados</p>
        </div>
        <div className="flex items-center gap-2">
          {isReviewer && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button onClick={() => setViewMode("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "all" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground"}`}>
                Todos
              </button>
              <button onClick={() => setViewMode("pending")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative ${viewMode === "pending" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground"}`}>
                Pendientes
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-[10px] font-bold flex items-center justify-center text-primary-foreground">{pendingCount}</span>
                )}
              </button>
            </div>
          )}
          {canAddMore && !isReviewer && (
            <button onClick={() => setShowNewObjective(true)} className="btn-gold flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Nuevo Objetivo ({deptObjectives.filter(o => o.status !== "rechazado").length}/{MAX_OBJECTIVES_PER_DEPT})
            </button>
          )}
          {isReviewer && (
            <button onClick={() => setShowNewObjective(true)} className="btn-gold flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Crear Objetivo
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Objetivos</p>
          <p className="text-2xl font-heading font-bold text-card-foreground">{objectives.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Aprobados</p>
          <p className="text-2xl font-heading font-bold text-emerald-600">{objectives.filter(o => o.status === "aprobado").length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-heading font-bold gold-accent-text">{objectives.filter(o => o.status === "pendiente_revision").length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Rechazados</p>
          <p className="text-2xl font-heading font-bold text-destructive">{objectives.filter(o => o.status === "rechazado").length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">Departamentos</p>
          <p className="text-2xl font-heading font-bold text-card-foreground">{new Set(objectives.map(o => o.department)).size}</p>
        </div>
      </div>

      {/* Objectives grouped by department */}
      {Object.keys(byDepartment).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay objetivos registrados</p>
          <p className="text-xs mt-1">Los departamentos deben crear sus 2 objetivos BASC</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(byDepartment).sort(([a], [b]) => a.localeCompare(b)).map(([dept, objs]) => (
            <div key={dept} className="bg-card/50 rounded-lg border border-border overflow-hidden">
              <button onClick={() => setExpandedDept(expandedDept === dept ? null : dept)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/50 transition-colors">
                {expandedDept === dept ? <ChevronDown className="h-4 w-4 text-gold" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <Target className="h-4 w-4 text-gold" />
                <span className="font-heading font-bold text-card-foreground">{dept}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{DEPARTMENT_PREFIXES[dept] || "—"}</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{objs.length} objetivo(s)</span>
                  {objs.some(o => o.status === "pendiente_revision") && (
                    <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  )}
                  {objs.every(o => o.status === "aprobado") && objs.length >= 2 && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
              </button>
              {expandedDept === dept && (
                <div className="px-5 pb-4 space-y-3 border-t border-border pt-3">
                  {objs.map(obj => renderObjectiveCard(obj, false))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════ NEW/EDIT OBJECTIVE MODAL ══════ */}
      {showNewObjective && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <h2 className="font-heading font-bold text-lg text-card-foreground">
                {editingId ? "Editar Objetivo" : "Nuevo Objetivo Departamental"}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {isReviewer && (
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento *</label>
                  <select value={newForm.department} onChange={e => setNewForm({ ...newForm, department: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {Object.entries(DEPARTMENT_PREFIXES).map(([dept, prefix]) => (
                      <option key={dept} value={dept}>{prefix} — {dept}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Título del Objetivo *</label>
                <input type="text" value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                  placeholder="Ej: Fortalecer la seguridad de la información"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción *</label>
                <textarea value={newForm.description} onChange={e => setNewForm({ ...newForm, description: e.target.value })} rows={3}
                  placeholder="Describa el objetivo con detalle..."
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Indicador de Medición *</label>
                  <input type="text" value={newForm.indicator} onChange={e => setNewForm({ ...newForm, indicator: e.target.value })}
                    placeholder="Ej: % de cumplimiento de políticas"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Fecha Objetivo *</label>
                  <input type="date" value={newForm.targetDate} onChange={e => setNewForm({ ...newForm, targetDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
              </div>

              {/* Linked Procedures */}
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-600" /> Procedimientos Vinculados
                </label>
                {newForm.procedures.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newForm.procedures.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                        <span className="font-mono font-bold">{p.code}</span> {p.name}
                        <button onClick={() => removeLinkedDoc("procedures", p.id)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={newForm.tempProcCode} onChange={e => setNewForm({ ...newForm, tempProcCode: e.target.value })}
                    placeholder="PRO-IT-01" className="w-28 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:ring-2 focus:ring-gold outline-none" />
                  <input type="text" value={newForm.tempProcName} onChange={e => setNewForm({ ...newForm, tempProcName: e.target.value })}
                    placeholder="Nombre del procedimiento" className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-gold outline-none" />
                  <button onClick={() => addLinkedDoc("procedures")} className="px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Linked Forms */}
              <div>
                <label className="text-sm font-medium text-card-foreground block mb-1.5 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600" /> Formularios Vinculados
                </label>
                {newForm.forms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newForm.forms.map(f => (
                      <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                        <span className="font-mono font-bold">{f.code}</span> {f.name}
                        <button onClick={() => removeLinkedDoc("forms", f.id)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={newForm.tempFormCode} onChange={e => setNewForm({ ...newForm, tempFormCode: e.target.value })}
                    placeholder="F-IT-01" className="w-28 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs font-mono focus:ring-2 focus:ring-gold outline-none" />
                  <input type="text" value={newForm.tempFormName} onChange={e => setNewForm({ ...newForm, tempFormName: e.target.value })}
                    placeholder="Nombre del formulario" className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-gold outline-none" />
                  <button onClick={() => addLinkedDoc("forms")} className="px-2 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border flex gap-3 justify-end shrink-0">
              <button onClick={resetForm} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={handleSaveObjective} className="btn-gold text-sm">
                {editingId ? "Guardar Cambios" : "Crear Borrador"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ REVIEW MODAL ══════ */}
      {reviewingId && (() => {
        const obj = objectives.find(o => o.id === reviewingId);
        if (!obj) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => { setReviewingId(null); setReviewComment(""); }}>
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">{obj.department} · {DEPARTMENT_PREFIXES[obj.department]}</p>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">Revisar Objetivo</h2>
                </div>
                <button onClick={() => { setReviewingId(null); setReviewComment(""); }} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <h4 className="font-heading font-bold text-card-foreground">{obj.title}</h4>
                  <p className="text-sm text-muted-foreground">{obj.description}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Indicador</p>
                      <p className="text-sm text-card-foreground">{obj.indicator}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Fecha Objetivo</p>
                      <p className="text-sm text-card-foreground">{obj.targetDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Enviado por</p>
                      <p className="text-sm text-card-foreground">{obj.submittedBy} · {obj.submittedAt}</p>
                    </div>
                  </div>
                </div>

                {/* Linked docs */}
                {obj.linkedProcedures.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-card-foreground mb-1.5 flex items-center gap-1">
                      <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" /> Procedimientos
                    </p>
                    <div className="space-y-1">
                      {obj.linkedProcedures.map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-xs bg-blue-50 rounded-lg px-3 py-2 text-blue-700">
                          <span className="font-mono font-bold">{p.code}</span>
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {obj.linkedForms.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-card-foreground mb-1.5 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-purple-600" /> Formularios
                    </p>
                    <div className="space-y-1">
                      {obj.linkedForms.map(f => (
                        <div key={f.id} className="flex items-center gap-2 text-xs bg-purple-50 rounded-lg px-3 py-2 text-purple-700">
                          <span className="font-mono font-bold">{f.code}</span>
                          <span>{f.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous comments */}
                {obj.reviewComments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-card-foreground mb-1.5">Historial de Revisiones</p>
                    <div className="space-y-1.5">
                      {obj.reviewComments.map(rc => (
                        <div key={rc.id} className="text-xs bg-muted rounded-lg px-3 py-2">
                          <span className="font-semibold">{rc.author}</span>
                          <span className="text-muted-foreground"> · {rc.date}</span>
                          {rc.action && <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            rc.action === "aprobado" ? "bg-emerald-100 text-emerald-700" :
                            rc.action === "rechazado" ? "bg-red-100 text-red-700" :
                            "bg-orange-100 text-orange-700"
                          }`}>{rc.action}</span>}
                          <p className="text-card-foreground mt-0.5">{rc.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review comment input */}
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> Comentario de Revisión
                  </label>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3}
                    placeholder="Observaciones sobre el formato, contenido, procedimientos vinculados..."
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-2 justify-end shrink-0 flex-wrap">
                <button onClick={() => { setReviewingId(null); setReviewComment(""); }}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={() => handleReviewAction(obj.id, "rechazado")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-1">
                  <XCircle className="h-4 w-4" /> Rechazar
                </button>
                <button onClick={() => handleReviewAction(obj.id, "requiere_cambios")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Requiere Cambios
                </button>
                <button onClick={() => handleReviewAction(obj.id, "aprobado")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Aprobar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default BASCDepartmentObjectives;
