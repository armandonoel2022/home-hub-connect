import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import BASCDepartmentObjectives from "@/components/BASCDepartmentObjectives";
import {
  INITIAL_OBJECTIVES, INITIAL_PROCEDURES, BASC_OBJECTIVE_CATEGORIES,
  type BASCObjective, type BASCProcedure, type BASCEvidence, type BASCSubItem,
  calcCompliance, calcStatus,
} from "@/lib/bascData";
import {
  type BASCManagedDocument, DEPARTMENT_PREFIXES, DOC_TYPE_PREFIXES,
  generateDocCode, getNextSequence, loadDocuments, saveDocuments,
  saveFileData, loadFileData, deleteFileData, getFileTypeFromName, getMimeType,
  calcDocCompliance,
} from "@/lib/bascDocuments";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  FolderOpen, FileText, Upload, ChevronRight, ChevronDown, X, File, Download, Trash2, Plus, Shield,
  Target, CheckCircle2, AlertTriangle, Clock, Eye, BarChart3, Link2, ClipboardCheck, TrendingUp,
  Bell, CheckSquare, Square, Paperclip, FileUp, Edit3, Save, Code, Tag, MessageSquare,
  Printer, CheckCircle, XCircle, FileWarning,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { toast } from "sonner";

const COLORS = ["hsl(160,60%,40%)", "hsl(42,100%,50%)", "hsl(200,70%,50%)", "hsl(0,60%,50%)", "hsl(280,50%,50%)"];
const AUDITOR_NAME = "Bilianny Fernández";
const ADMIN_EMAIL = "tecnologia@safeone.com.do";

type BASCTab = "documentos" | "objetivos" | "procedimientos" | "dept_objetivos";

// Legacy doc interface removed — using BASCManagedDocument from bascDocuments.ts

const statusConfig = {
  cumplido: { label: "Cumplido", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  en_progreso: { label: "En Progreso", color: "bg-amber-50 text-amber-700", icon: Clock },
  pendiente: { label: "Pendiente", color: "bg-gray-100 text-gray-600", icon: AlertTriangle },
  vencido: { label: "Vencido", color: "bg-red-50 text-red-700", icon: AlertTriangle },
};

const auditColors = {
  conforme: "bg-emerald-50 text-emerald-700",
  no_conforme: "bg-red-50 text-red-700",
  observación: "bg-amber-50 text-amber-700",
};

const STORAGE_KEY = "safeone-basc-objectives-v3";

const BASCPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<BASCTab>("dept_objetivos");
  const [managedDocs, setManagedDocs] = useState<BASCManagedDocument[]>(loadDocuments);
  const [objectives, setObjectives] = useState<BASCObjective[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_OBJECTIVES;
    } catch { return INITIAL_OBJECTIVES; }
  });
  const [procedures] = useState<BASCProcedure[]>(INITIAL_PROCEDURES);
  const [expandedDept, setExpandedDept] = useState<string | null>(user?.department || "Tecnología y Monitoreo");
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showObjectiveDetail, setShowObjectiveDetail] = useState<string | null>(null);
  const [showAddEvidence, setShowAddEvidence] = useState<{ objectiveId: string; subItemId?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({ title: "", description: "", type: "documento" as BASCEvidence["type"], file: null as File | null });
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocForm, setNewDocForm] = useState({
    name: "", type: "procedimiento" as BASCManagedDocument["type"],
    department: user?.department || "Tecnología y Monitoreo", file: null as File | null,
  });

  const isAdmin = user?.email === ADMIN_EMAIL;
  const isAuditor = user?.fullName === AUDITOR_NAME || isAdmin;

  // Persist objectives
  const saveObjectives = useCallback((objs: BASCObjective[]) => {
    setObjectives(objs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(objs)); } catch {}
  }, []);

  // Send notification to auditor
  const notifyAuditor = useCallback((title: string, message: string) => {
    addNotification({
      title: `🔔 BASC: ${title}`,
      message,
      type: "info",
      forUserId: "ALL",
      relatedId: "BASC",
      actionUrl: "/basc",
    });
    toast.success(`Notificación enviada a ${AUDITOR_NAME}`, { description: title });
  }, [addNotification]);

  // Toggle sub-item completion
  const toggleSubItem = useCallback((objectiveId: string, subItemId: string) => {
    const obj = objectives.find(o => o.id === objectiveId);
    if (!obj) return;
    const subItem = obj.subItems.find(s => s.id === subItemId);
    if (!subItem) return;

    // If requires evidence and not yet completed, prompt for evidence
    if (subItem.requiredEvidence && !subItem.completed) {
      const hasEvidence = obj.evidences.some(e => e.subItemId === subItemId);
      if (!hasEvidence) {
        setShowAddEvidence({ objectiveId, subItemId });
        toast.info("Debe cargar evidencia para completar este acápite");
        return;
      }
    }

    const updated = objectives.map(o => {
      if (o.id !== objectiveId) return o;
      const newSubItems = o.subItems.map(s =>
        s.id === subItemId
          ? { ...s, completed: !s.completed, completedBy: !s.completed ? (user?.fullName || "Usuario") : undefined, completedAt: !s.completed ? new Date().toISOString().split("T")[0] : undefined }
          : s
      );
      const newObj = { ...o, subItems: newSubItems };
      newObj.compliancePercent = calcCompliance(newObj);
      newObj.status = calcStatus(newObj);
      return newObj;
    });

    saveObjectives(updated);

    // Notify auditor
    const updatedObj = updated.find(o => o.id === objectiveId)!;
    if (!subItem.completed) {
      notifyAuditor(
        `Acápite completado — ${updatedObj.code}`,
        `${user?.fullName || "Usuario"} completó "${subItem.text}" en ${updatedObj.title}. Compliance: ${updatedObj.compliancePercent}%`
      );
    }

    // Refresh detail if open
    if (showObjectiveDetail === objectiveId) {
      // state already updated
    }
  }, [objectives, user, saveObjectives, notifyAuditor, showObjectiveDetail]);

  // Document logic
  const saveManagedDocs = useCallback((docs: BASCManagedDocument[]) => {
    setManagedDocs(docs);
    saveDocuments(docs);
  }, []);

  const filteredManagedDocs = managedDocs.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase());
    const matchDept = !filterDept || d.department === filterDept;
    return matchSearch && matchDept;
  });

  const groupedByDept: Record<string, Record<string, BASCManagedDocument[]>> = {};
  filteredManagedDocs.forEach((d) => {
    if (!groupedByDept[d.department]) groupedByDept[d.department] = {};
    const typeLabel = DOC_TYPE_PREFIXES[d.type] ? `${DOC_TYPE_PREFIXES[d.type]} — ${d.type.charAt(0).toUpperCase() + d.type.slice(1)}s` : d.type;
    if (!groupedByDept[d.department][typeLabel]) groupedByDept[d.department][typeLabel] = [];
    groupedByDept[d.department][typeLabel].push(d);
  });

  // File upload handler
  const handleFileUpload = useCallback((docId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const mimeType = getMimeType(file.name);
      saveFileData(docId, base64, mimeType);

      const updated = managedDocs.map(d =>
        d.id === docId ? {
          ...d,
          hasFile: true,
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(0)} KB`,
          fileType: getFileTypeFromName(file.name),
          fileMimeType: mimeType,
          reviewStatus: "pendiente" as const,
          reviewComment: undefined,
          reviewedBy: undefined,
          reviewedAt: undefined,
          updatedBy: user?.fullName || "Usuario",
          updatedAt: new Date().toISOString().split("T")[0],
        } : d
      );
      saveManagedDocs(updated);
      setUploadingDocId(null);
      toast.success(`Archivo "${file.name}" cargado`, { description: "Pendiente de revisión por " + AUDITOR_NAME });
      notifyAuditor("Documento cargado para revisión", `${user?.fullName || "Usuario"} subió "${file.name}" para ${managedDocs.find(d => d.id === docId)?.name}`);
    };
    reader.readAsDataURL(file);
  }, [managedDocs, saveManagedDocs, user, notifyAuditor]);

  // Review handlers
  const handleApprove = useCallback((docId: string) => {
    const updated = managedDocs.map(d =>
      d.id === docId ? {
        ...d,
        reviewStatus: "aprobado" as const,
        reviewComment: reviewComment || undefined,
        reviewedBy: user?.fullName || AUDITOR_NAME,
        reviewedAt: new Date().toISOString().split("T")[0],
        status: "vigente" as const,
      } : d
    );
    saveManagedDocs(updated);
    setReviewingDoc(null);
    setReviewComment("");
    const doc = managedDocs.find(d => d.id === docId);
    toast.success(`Documento ${doc?.code} aprobado`);
    addNotification({
      title: "✅ Documento BASC Aprobado",
      message: `${doc?.code} — ${doc?.name} fue aprobado por ${user?.fullName || AUDITOR_NAME}`,
      type: "success", forUserId: "ALL", relatedId: "BASC", actionUrl: "/basc",
    });
  }, [managedDocs, saveManagedDocs, reviewComment, user, addNotification]);

  const handleReject = useCallback((docId: string) => {
    if (!reviewComment.trim()) {
      toast.error("Debe indicar el motivo del rechazo");
      return;
    }
    const updated = managedDocs.map(d =>
      d.id === docId ? {
        ...d,
        reviewStatus: "rechazado" as const,
        reviewComment,
        reviewedBy: user?.fullName || AUDITOR_NAME,
        reviewedAt: new Date().toISOString().split("T")[0],
      } : d
    );
    saveManagedDocs(updated);
    setReviewingDoc(null);
    setReviewComment("");
    const doc = managedDocs.find(d => d.id === docId);
    toast.info(`Documento ${doc?.code} rechazado`);
    addNotification({
      title: "❌ Documento BASC Rechazado",
      message: `${doc?.code} — ${doc?.name} fue rechazado: "${reviewComment}"`,
      type: "warning", forUserId: "ALL", relatedId: "BASC", actionUrl: "/basc",
    });
  }, [managedDocs, saveManagedDocs, reviewComment, user, addNotification]);

  // Preview / Download
  const handlePreview = useCallback((docId: string) => {
    const fileInfo = loadFileData(docId);
    if (!fileInfo) { toast.error("No hay archivo cargado"); return; }
    setPreviewDoc(docId);
  }, []);

  const handleDownload = useCallback((docId: string) => {
    const doc = managedDocs.find(d => d.id === docId);
    const fileInfo = loadFileData(docId);
    if (!doc || !fileInfo) { toast.error("No hay archivo disponible"); return; }
    const byteChars = atob(fileInfo.data);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: fileInfo.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = doc.fileName || `${doc.code}.pdf`; a.click();
    URL.revokeObjectURL(url);
  }, [managedDocs]);

  const handlePrint = useCallback((docId: string) => {
    const fileInfo = loadFileData(docId);
    if (!fileInfo) { toast.error("No hay archivo para imprimir"); return; }
    const byteChars = atob(fileInfo.data);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: fileInfo.mimeType });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) { win.onload = () => { win.print(); }; }
    else { toast.error("Habilite ventanas emergentes para imprimir"); }
  }, []);

  const handleNewDoc = () => {
    if (!newDocForm.name || !newDocForm.department || !newDocForm.file) return;
    const deptPrefix = DEPARTMENT_PREFIXES[newDocForm.department] || "GEN";
    const seq = getNextSequence(managedDocs, newDocForm.type, deptPrefix);
    const code = generateDocCode(newDocForm.type, deptPrefix, seq);
    const now = new Date().toISOString().split("T")[0];
    const fileType = getFileTypeFromName(newDocForm.file.name);
    const mimeType = getMimeType(newDocForm.file.name);
    const newDoc: BASCManagedDocument = {
      id: `MDOC-${Date.now()}`, code, name: newDocForm.name,
      type: newDocForm.type, fileType, department: newDocForm.department, departmentPrefix: deptPrefix,
      version: "1.0", status: "borrador", createdBy: user?.fullName || "Usuario", createdAt: now,
      updatedBy: user?.fullName || "Usuario", updatedAt: now, hasFile: true,
      fileName: newDocForm.file.name, fileSize: `${(newDocForm.file.size / 1024).toFixed(0)} KB`,
      fileMimeType: mimeType, reviewStatus: "pendiente",
    };
    // Read file and save
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      saveFileData(newDoc.id, base64, mimeType);
      saveManagedDocs([newDoc, ...managedDocs]);
      setShowNewDoc(false);
      setNewDocForm({ name: "", type: "procedimiento", department: user?.department || "Tecnología y Monitoreo", file: null });
      toast.success(`Documento ${code} creado`, { description: newDoc.name });
      notifyAuditor("Nuevo documento para revisión", `${user?.fullName || "Usuario"} creó ${code} — ${newDoc.name}`);
    };
    reader.readAsDataURL(newDocForm.file);
  };

  const handleDeleteDoc = (id: string) => {
    saveManagedDocs(managedDocs.filter((d) => d.id !== id));
    deleteFileData(id);
  };

  const reviewStatusColors: Record<string, string> = {
    sin_archivo: "bg-muted text-muted-foreground",
    pendiente: "bg-amber-50 text-amber-700",
    aprobado: "bg-emerald-50 text-emerald-700",
    rechazado: "bg-red-50 text-red-700",
  };
  const reviewStatusLabels: Record<string, string> = {
    sin_archivo: "Sin archivo", pendiente: "Pendiente revisión",
    aprobado: "Aprobado", rechazado: "Rechazado",
  };

  const fileTypeColors: Record<string, string> = {
    pdf: "bg-red-50 text-red-700", word: "bg-blue-50 text-blue-700",
    excel: "bg-emerald-50 text-emerald-700", image: "bg-purple-50 text-purple-700",
    other: "bg-muted text-muted-foreground", none: "bg-muted text-muted-foreground",
  };
  const statusColors: Record<string, string> = {
    vigente: "bg-emerald-50 text-emerald-700", borrador: "bg-amber-50 text-amber-700",
    en_revisión: "bg-blue-50 text-blue-700", obsoleto: "bg-red-50 text-red-700",
  };

  // Add evidence with file upload
  const handleAddEvidence = () => {
    if (!showAddEvidence || !evidenceForm.title || !evidenceForm.file) return;
    const { objectiveId, subItemId } = showAddEvidence;
    const ev: BASCEvidence = {
      id: `EV-${Date.now()}`, objectiveId, title: evidenceForm.title,
      description: evidenceForm.description, type: evidenceForm.type,
      uploadedBy: user?.fullName || "Usuario", uploadedAt: new Date().toISOString().split("T")[0],
      fileName: evidenceForm.file.name, fileSize: `${(evidenceForm.file.size / 1024).toFixed(0)} KB`,
      subItemId,
    };

    const updated = objectives.map((o) => {
      if (o.id !== objectiveId) return o;
      const newEvidences = [...o.evidences, ev];
      let newSubItems = o.subItems;
      // Auto-complete sub-item if evidence uploaded for it
      if (subItemId) {
        newSubItems = o.subItems.map(s =>
          s.id === subItemId ? { ...s, completed: true, completedBy: user?.fullName || "Usuario", completedAt: new Date().toISOString().split("T")[0] } : s
        );
      }
      const newObj = { ...o, evidences: newEvidences, subItems: newSubItems };
      newObj.compliancePercent = calcCompliance(newObj);
      newObj.status = calcStatus(newObj);
      return newObj;
    });

    saveObjectives(updated);

    // Notify auditor
    const updatedObj = updated.find(o => o.id === objectiveId)!;
    notifyAuditor(
      `Nueva evidencia — ${updatedObj.code}`,
      `${user?.fullName || "Usuario"} cargó "${ev.title}" (${ev.fileName}) en ${updatedObj.title}. Compliance ahora: ${updatedObj.compliancePercent}%`
    );

    toast.success("Evidencia cargada exitosamente", {
      description: `${updatedObj.title} — ${updatedObj.compliancePercent}% completado`,
    });

    setShowAddEvidence(null);
    setEvidenceForm({ title: "", description: "", type: "documento", file: null });
  };

  // Objective stats (recalculated)
  const complianceAvg = objectives.length > 0 ? Math.round(objectives.reduce((a, o) => a + calcCompliance(o), 0) / objectives.length) : 0;
  const completedCount = objectives.filter((o) => calcCompliance(o) === 100).length;
  const inProgressCount = objectives.filter((o) => { const c = calcCompliance(o); return c > 0 && c < 100; }).length;
  const pendingCount = objectives.filter((o) => calcCompliance(o) === 0).length;

  const compliancePieData = [
    { name: "Cumplidos", value: completedCount },
    { name: "En Progreso", value: inProgressCount },
    { name: "Pendientes", value: pendingCount },
  ].filter((d) => d.value > 0);

  const tabs: { id: BASCTab; label: string; icon: any }[] = [
    { id: "dept_objetivos", label: "Objetivos Departamentales", icon: Target },
    { id: "objetivos", label: "Auditoría y Compliance", icon: Target },
    { id: "procedimientos", label: "Procedimientos", icon: ClipboardCheck },
    { id: "documentos", label: "Documentos", icon: FolderOpen },
  ];

  const detailObj = objectives.find(o => o.id === showObjectiveDetail) || null;

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="nav-corporate">
          <div className="gold-bar" />
          <div className="px-6 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-gold" />
                <div>
                  <h1 className="font-heading font-bold text-2xl text-secondary-foreground">
                    <span className="gold-accent-text">BASC</span> — Sistema de Gestión
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    Business Alliance for Secure Commerce — Objetivos, Procedimientos y Compliance
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-card rounded-lg border border-border px-4 py-2">
                  <TrendingUp className={`h-5 w-5 ${complianceAvg >= 80 ? "text-emerald-600" : complianceAvg >= 50 ? "text-amber-500" : "text-destructive"}`} />
                  <span className="text-sm text-muted-foreground">Compliance General:</span>
                  <span className={`text-xl font-heading font-bold ${complianceAvg >= 80 ? "text-emerald-600" : complianceAvg >= 50 ? "gold-accent-text" : "text-destructive"}`}>
                    {complianceAvg}%
                  </span>
                </div>
                {activeTab === "documentos" && (
                  <button onClick={() => setShowNewDoc(true)} className="btn-gold flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Nuevo Documento
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all ${activeTab === t.id ? "bg-card text-card-foreground border border-border border-b-card" : "text-muted-foreground hover:text-card-foreground"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ══════ DEPT OBJECTIVES TAB ══════ */}
        {activeTab === "dept_objetivos" && <BASCDepartmentObjectives />}

        {/* ══════ OBJECTIVES TAB ══════ */}
        {activeTab === "objetivos" && (
          <div className="px-6 py-4 space-y-4">
            {/* Compliance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-card rounded-xl border border-border p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground">Compliance General</p>
                <p className={`text-3xl font-heading font-bold ${complianceAvg >= 80 ? "text-emerald-600" : complianceAvg >= 50 ? "gold-accent-text" : "text-destructive"}`}>
                  {complianceAvg}%
                </p>
                <div className="w-full h-2 bg-muted rounded-full mt-2">
                  <div className={`h-full rounded-full transition-all duration-500 ${complianceAvg >= 80 ? "bg-emerald-500" : complianceAvg >= 50 ? "bg-gold" : "bg-destructive"}`}
                    style={{ width: `${complianceAvg}%` }} />
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Objetivos</p>
                <p className="text-2xl font-heading font-bold text-card-foreground">{objectives.length}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Cumplidos</p>
                <p className="text-2xl font-heading font-bold text-emerald-600">{completedCount}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">En Progreso</p>
                <p className="text-2xl font-heading font-bold gold-accent-text">{inProgressCount}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">Auditora</p>
                <div className="flex items-center gap-2 mt-1">
                  <Bell className="h-4 w-4 text-gold" />
                  <p className="text-sm font-medium text-card-foreground">{AUDITOR_NAME}</p>
                </div>
              </div>
            </div>

            {/* Pie + Objectives List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="font-heading font-bold text-card-foreground mb-3">Estado de Objetivos</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={compliancePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {compliancePieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  Total sub-acápites: {objectives.reduce((a, o) => a + o.subItems.length, 0)} · Completados: {objectives.reduce((a, o) => a + o.subItems.filter(s => s.completed).length, 0)}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-3">
                {objectives.map((obj) => {
                  const pct = calcCompliance(obj);
                  const st = calcStatus(obj);
                  const sc = statusConfig[st];
                  const completedSubs = obj.subItems.filter(s => s.completed).length;
                  return (
                    <div key={obj.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setShowObjectiveDetail(obj.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">{obj.code}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                            {obj.auditResult && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${auditColors[obj.auditResult]}`}>
                                {obj.auditResult === "conforme" ? "✓ Conforme" : obj.auditResult === "observación" ? "⚠ Observación" : "✗ No conforme"}
                              </span>
                            )}
                          </div>
                          <h4 className="font-heading font-bold text-sm text-card-foreground">{obj.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{obj.category} · {obj.responsible} · {obj.department}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> {completedSubs}/{obj.subItems.length} acápites</span>
                            <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {obj.evidences.length} evidencias</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xl font-heading font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "gold-accent-text" : "text-destructive"}`}>
                            {pct}%
                          </div>
                          <div className="w-20 h-2 bg-muted rounded-full mt-1">
                            <div className={`h-full rounded-full transition-all duration-500 ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-gold" : "bg-destructive"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════ PROCEDURES TAB ══════ */}
        {activeTab === "procedimientos" && (
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-card rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">Total Procedimientos</p>
                <p className="text-2xl font-heading font-bold text-card-foreground">{procedures.length}</p>
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">Vigentes</p>
                <p className="text-2xl font-heading font-bold text-emerald-600">{procedures.filter((p) => p.status === "vigente").length}</p>
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">En Revisión</p>
                <p className="text-2xl font-heading font-bold gold-accent-text">{procedures.filter((p) => p.status === "en_revisión").length}</p>
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">Objetivos Vinculados</p>
                <p className="text-2xl font-heading font-bold text-card-foreground">{new Set(procedures.flatMap((p) => p.linkedObjectives)).size}</p>
              </div>
            </div>

            {procedures.map((proc) => {
              const linkedObjs = objectives.filter((o) => proc.linkedObjectives.includes(o.id));
              const procStatusColor = proc.status === "vigente" ? "bg-emerald-50 text-emerald-700" : proc.status === "en_revisión" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
              return (
                <div key={proc.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{proc.code}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${procStatusColor}`}>{proc.status}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">v{proc.version}</span>
                      </div>
                      <h4 className="font-heading font-bold text-card-foreground">{proc.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{proc.category} · {proc.department}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Última revisión: {proc.lastReview}</span>
                        <span>Próxima: {proc.nextReview}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {linkedObjs.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Objetivos vinculados</p>
                          {linkedObjs.map((o) => {
                            const p = calcCompliance(o);
                            return (
                              <div key={o.id} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-gold" : "bg-destructive"}`} />
                                <span className="text-xs text-card-foreground">{p}%</span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{o.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════ DOCUMENTS TAB ══════ */}
        {activeTab === "documentos" && (
          <>
            <div className="px-6 py-4 flex flex-wrap gap-4">
              <div className="relative flex-1 max-w-md">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
              </div>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                <option value="">Todos los departamentos</option>
                {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>

            <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Documentos", value: managedDocs.length, color: "text-card-foreground" },
                { label: "Procedimientos", value: managedDocs.filter(d => d.type === "procedimiento").length, color: "gold-accent-text" },
                { label: "Matrices", value: managedDocs.filter(d => d.type === "matriz").length, color: "gold-accent-text" },
                { label: "Departamentos", value: new Set(managedDocs.map(d => d.department)).size, color: "text-card-foreground" },
              ].map((s) => (
                <div key={s.label} className="bg-card rounded-lg p-4 border border-border">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="px-6 pb-8">
              {Object.keys(groupedByDept).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No se encontraron documentos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedByDept).sort(([a], [b]) => a.localeCompare(b)).map(([dept, types]) => (
                    <div key={dept} className="bg-card rounded-lg border border-border overflow-hidden">
                      <button onClick={() => setExpandedDept(expandedDept === dept ? null : dept)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors">
                        {expandedDept === dept ? <ChevronDown className="h-4 w-4 text-gold shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <FolderOpen className="h-5 w-5 text-gold shrink-0" />
                        <span className="font-heading font-bold text-card-foreground">{dept}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground ml-2">{DEPARTMENT_PREFIXES[dept] || "—"}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{Object.values(types).flat().length} docs</span>
                      </button>
                      {expandedDept === dept && (
                        <div className="border-t border-border">
                          {Object.entries(types).sort(([a], [b]) => a.localeCompare(b)).map(([typeLabel, docs]) => (
                            <div key={typeLabel}>
                              <button onClick={() => setExpandedType(expandedType === `${dept}-${typeLabel}` ? null : `${dept}-${typeLabel}`)}
                                className="w-full flex items-center gap-3 pl-12 pr-5 py-3 text-left hover:bg-muted/30 transition-colors">
                                {expandedType === `${dept}-${typeLabel}` ? <ChevronDown className="h-3 w-3 text-gold shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium text-card-foreground">{typeLabel}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{docs.length}</span>
                              </button>
                              {expandedType === `${dept}-${typeLabel}` && (
                                <div className="pl-16 pr-5 pb-3 space-y-2">
                                  {docs.sort((a, b) => a.code.localeCompare(b.code)).map((doc) => (
                                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${fileTypeColors[doc.fileType]}`}>{doc.fileType.toUpperCase()}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-mono font-bold text-gold">{doc.code}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors[doc.status]}`}>{doc.status}</span>
                                          <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
                                        </div>
                                        <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                                        <p className="text-xs text-muted-foreground">{doc.updatedBy} · {doc.updatedAt} {doc.fileSize && `· ${doc.fileSize}`}</p>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingDoc(doc.id); setEditContent(doc.content); }}
                                          className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-card-foreground transition-colors" title="Editar contenido">
                                          <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => { setRenamingDoc(doc.id); setRenameForm({ code: doc.code, name: doc.name }); }}
                                          className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-card-foreground transition-colors" title="Cambiar código/nombre">
                                          <Tag className="h-4 w-4" />
                                        </button>
                                        <button className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-card-foreground transition-colors" title="Descargar">
                                          <Download className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDeleteDoc(doc.id)}
                                          className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════ NEW DOCUMENT MODAL ══════ */}
        {showNewDoc && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNewDoc(false)}>
            <div className="bg-card rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Nuevo Documento</h2>
                <button onClick={() => setShowNewDoc(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo de Documento *</label>
                    <select value={newDocForm.type} onChange={(e) => setNewDocForm({ ...newDocForm, type: e.target.value as BASCManagedDocument["type"] })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      <option value="procedimiento">PRO — Procedimiento</option>
                      <option value="formulario">F — Formulario</option>
                      <option value="matriz">M — Matriz</option>
                      <option value="politica">POL — Política</option>
                      <option value="registro">REG — Registro</option>
                      <option value="manual">MAN — Manual</option>
                      <option value="informe">INF — Informe</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento *</label>
                    <select value={newDocForm.department} onChange={(e) => setNewDocForm({ ...newDocForm, department: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                      {Object.entries(DEPARTMENT_PREFIXES).map(([dept, prefix]) => (
                        <option key={dept} value={dept}>{prefix} — {dept}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Code className="h-4 w-4 text-gold shrink-0" />
                  <span className="text-sm text-muted-foreground">Código automático:</span>
                  <span className="font-mono font-bold text-card-foreground">
                    {generateDocCode(newDocForm.type, DEPARTMENT_PREFIXES[newDocForm.department] || "GEN", getNextSequence(managedDocs, newDocForm.type, DEPARTMENT_PREFIXES[newDocForm.department] || "GEN"))}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Nombre del Documento *</label>
                  <input type="text" value={newDocForm.name} onChange={(e) => setNewDocForm({ ...newDocForm, name: e.target.value })}
                    placeholder="Ej: Procedimiento de Control de Acceso"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Contenido inicial</label>
                  <textarea value={newDocForm.content} onChange={(e) => setNewDocForm({ ...newDocForm, content: e.target.value })} rows={4}
                    placeholder="Escriba el contenido del documento o déjelo vacío para editar después..."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Archivo adjunto (opcional)</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    {newDocForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="h-5 w-5 text-gold" />
                        <span className="text-sm text-card-foreground font-medium truncate max-w-[200px]">{newDocForm.file.name}</span>
                        <button onClick={() => setNewDocForm({ ...newDocForm, file: null })} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground cursor-pointer hover:bg-border transition-colors">
                        <Upload className="h-4 w-4" /> Seleccionar archivo
                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) setNewDocForm({ ...newDocForm, file }); }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end shrink-0">
                <button onClick={() => setShowNewDoc(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleNewDoc} disabled={!newDocForm.name} className="btn-gold text-sm disabled:opacity-50">Crear Documento</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ EDIT CONTENT MODAL ══════ */}
        {editingDoc && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingDoc(null)}>
            <div className="bg-card rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{managedDocs.find(d => d.id === editingDoc)?.code}</p>
                  <h2 className="font-heading font-bold text-card-foreground">{managedDocs.find(d => d.id === editingDoc)?.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSaveContent(editingDoc)} className="btn-gold text-sm flex items-center gap-1">
                    <Save className="h-4 w-4" /> Guardar
                  </button>
                  <button onClick={() => setEditingDoc(null)} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[400px] px-4 py-3 rounded-lg bg-background border border-border text-foreground text-sm font-mono focus:ring-2 focus:ring-gold outline-none resize-none"
                  placeholder="Escriba el contenido del documento aquí..."
                />
              </div>
              <div className="p-3 border-t border-border shrink-0 flex items-center justify-between text-xs text-muted-foreground">
                <span>Puede usar HTML: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;</span>
                <span>{editContent.length} caracteres</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════ RENAME MODAL ══════ */}
        {renamingDoc && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setRenamingDoc(null)}>
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Cambiar Código / Nombre</h2>
                <button onClick={() => setRenamingDoc(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Código del Documento</label>
                  <input type="text" value={renameForm.code} onChange={(e) => setRenameForm({ ...renameForm, code: e.target.value })}
                    placeholder="Ej: PRO-IT-01"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm font-mono focus:ring-2 focus:ring-gold outline-none" />
                  <p className="text-xs text-muted-foreground mt-1">Formato: TIPO-DEPTO-## (PRO-IT-01, F-ADM-03, M-IT-02)</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Nombre del Documento</label>
                  <input type="text" value={renameForm.name} onChange={(e) => setRenameForm({ ...renameForm, name: e.target.value })}
                    placeholder="Nombre descriptivo..."
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setRenamingDoc(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={() => handleRename(renamingDoc)} className="btn-gold text-sm">Guardar Cambios</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ OBJECTIVE DETAIL MODAL ══════ */}
        {detailObj && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{detailObj.code}</p>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">{detailObj.title}</h2>
                </div>
                <button onClick={() => setShowObjectiveDetail(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-sm text-muted-foreground">{detailObj.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Compliance</p>
                    <p className={`text-xl font-bold ${calcCompliance(detailObj) >= 80 ? "text-emerald-600" : calcCompliance(detailObj) >= 50 ? "gold-accent-text" : "text-destructive"}`}>
                      {calcCompliance(detailObj)}%
                    </p>
                    <div className="w-full h-1.5 bg-card rounded-full mt-1">
                      <div className={`h-full rounded-full transition-all duration-500 ${calcCompliance(detailObj) >= 80 ? "bg-emerald-500" : calcCompliance(detailObj) >= 50 ? "bg-gold" : "bg-destructive"}`}
                        style={{ width: `${calcCompliance(detailObj)}%` }} />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Estado</p>
                    <p className="text-sm font-semibold text-card-foreground">{statusConfig[calcStatus(detailObj)].label}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Fecha Objetivo</p>
                    <p className="text-sm font-semibold text-card-foreground">{detailObj.targetDate}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Auditoría</p>
                    <p className="text-sm font-semibold text-card-foreground">
                      {detailObj.auditResult ? (detailObj.auditResult === "conforme" ? "✓ Conforme" : detailObj.auditResult === "observación" ? "⚠ Observación" : "✗ No conforme") : "Sin auditar"}
                    </p>
                  </div>
                </div>

                {/* ── Sub-Items Checklist ── */}
                <div>
                  <h4 className="text-sm font-heading font-bold text-card-foreground mb-3 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-gold" /> Acápites de Cumplimiento ({detailObj.subItems.filter(s => s.completed).length}/{detailObj.subItems.length})
                  </h4>
                  <div className="space-y-2">
                    {detailObj.subItems.map((sub) => {
                      const linkedEvidence = detailObj.evidences.filter(e => e.subItemId === sub.id);
                      return (
                        <div key={sub.id} className={`rounded-lg border p-3 transition-all ${sub.completed ? "bg-emerald-50/50 border-emerald-200" : "bg-muted/50 border-border"}`}>
                          <div className="flex items-start gap-3">
                            <button onClick={(e) => { e.stopPropagation(); toggleSubItem(detailObj.id, sub.id); }}
                              className="mt-0.5 shrink-0">
                              {sub.completed
                                ? <CheckSquare className="h-5 w-5 text-emerald-600" />
                                : <Square className="h-5 w-5 text-muted-foreground hover:text-card-foreground transition-colors" />
                              }
                            </button>
                            <div className="flex-1">
                              <p className={`text-sm ${sub.completed ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{sub.text}</p>
                              {sub.completed && sub.completedBy && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">✓ {sub.completedBy} · {sub.completedAt}</p>
                              )}
                              {linkedEvidence.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {linkedEvidence.map(ev => (
                                    <span key={ev.id} className="inline-flex items-center gap-1 text-[10px] bg-card px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                                      <Paperclip className="h-2.5 w-2.5" /> {ev.fileName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {!sub.completed && sub.requiredEvidence && (
                              <button onClick={(e) => { e.stopPropagation(); setShowAddEvidence({ objectiveId: detailObj.id, subItemId: sub.id }); }}
                                className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                                title="Cargar evidencia">
                                <FileUp className="h-3 w-3" /> Evidencia
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Linked Procedures */}
                <div>
                  <h4 className="text-sm font-heading font-bold text-card-foreground mb-2 flex items-center gap-2"><Link2 className="h-4 w-4" /> Procedimientos Vinculados</h4>
                  <div className="space-y-2">
                    {procedures.filter((p) => detailObj.linkedProcedures.includes(p.id)).map((p) => (
                      <div key={p.id} className="bg-muted rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                          <p className="text-sm text-card-foreground">{p.title}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "vigente" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidences */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-heading font-bold text-card-foreground flex items-center gap-2"><Eye className="h-4 w-4" /> Evidencias ({detailObj.evidences.length})</h4>
                    <button onClick={() => setShowAddEvidence({ objectiveId: detailObj.id })} className="text-xs gold-accent-text hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar Evidencia</button>
                  </div>
                  {detailObj.evidences.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">Sin evidencias registradas — cargue documentos para avanzar el compliance</p>
                  ) : (
                    <div className="space-y-2">
                      {detailObj.evidences.map((ev) => (
                        <div key={ev.id} className="bg-muted rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold bg-card px-1.5 py-0.5 rounded text-muted-foreground">{ev.type}</span>
                                <span className="text-sm font-medium text-card-foreground">{ev.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{ev.uploadedBy} · {ev.uploadedAt} · {ev.fileName} {ev.fileSize && `· ${ev.fileSize}`}</p>
                            </div>
                            <Download className="h-4 w-4 text-muted-foreground hover:text-card-foreground cursor-pointer" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-border flex justify-end">
                <button onClick={() => setShowObjectiveDetail(null)} className="btn-gold text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ ADD EVIDENCE MODAL ══════ */}
        {showAddEvidence && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddEvidence(null)}>
            <div className="bg-card rounded-xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading font-bold text-base text-card-foreground">Cargar Evidencia</h2>
                  {showAddEvidence.subItemId && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {objectives.find(o => o.id === showAddEvidence.objectiveId)?.subItems.find(s => s.id === showAddEvidence.subItemId)?.text}
                    </p>
                  )}
                </div>
                <button onClick={() => setShowAddEvidence(null)} className="p-2 hover:bg-muted rounded-lg shrink-0 ml-2"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1">Título *</label>
                  <input type="text" value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })}
                    placeholder="Ej: Acta de revisión firmada"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1">Descripción</label>
                  <textarea value={evidenceForm.description} onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })} rows={2}
                    placeholder="Detalle breve..."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1">Tipo</label>
                  <select value={evidenceForm.type} onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value as BASCEvidence["type"] })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="documento">Documento</option>
                    <option value="foto">Foto</option>
                    <option value="registro">Registro</option>
                    <option value="capacitación">Capacitación</option>
                    <option value="auditoría">Auditoría</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1">Archivo *</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    {evidenceForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <Paperclip className="h-4 w-4 text-gold shrink-0" />
                        <span className="text-sm text-card-foreground font-medium truncate max-w-[180px]">{evidenceForm.file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({(evidenceForm.file.size / 1024).toFixed(0)} KB)</span>
                        <button onClick={() => setEvidenceForm({ ...evidenceForm, file: null })} className="p-1 hover:bg-muted rounded shrink-0"><X className="h-3 w-3 text-muted-foreground" /></button>
                      </div>
                    ) : (
                      <>
                        <FileUp className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground mb-2">PDF, Word, Excel, Imagen</p>
                        <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium text-card-foreground cursor-pointer hover:bg-border transition-colors">
                          <Plus className="h-3 w-3" /> Seleccionar archivo
                          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.bmp" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) setEvidenceForm({ ...evidenceForm, file }); }} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 flex items-start gap-2">
                  <Bell className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-700">Se notificará a <strong>{AUDITOR_NAME}</strong> para revisión.</p>
                </div>
              </div>
              <div className="p-4 border-t border-border flex gap-3 justify-end shrink-0">
                <button onClick={() => setShowAddEvidence(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleAddEvidence} disabled={!evidenceForm.title || !evidenceForm.file}
                  className="btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <FileUp className="h-4 w-4 inline mr-1" /> Cargar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BASCPage;
