import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DEPARTMENTS } from "@/lib/types";
import {
  INITIAL_OBJECTIVES, INITIAL_PROCEDURES, BASC_OBJECTIVE_CATEGORIES,
  type BASCObjective, type BASCProcedure, type BASCEvidence,
} from "@/lib/bascData";
import {
  FolderOpen, FileText, Upload, ChevronRight, ChevronDown, X, File, Download, Trash2, Plus, Shield,
  Target, CheckCircle2, AlertTriangle, Clock, Eye, BarChart3, Link2, ClipboardCheck, TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["hsl(160,60%,40%)", "hsl(42,100%,50%)", "hsl(200,70%,50%)", "hsl(0,60%,50%)", "hsl(280,50%,50%)"];

// Tabs
type BASCTab = "documentos" | "objetivos" | "procedimientos";

interface BASCDocument {
  id: string; name: string; type: "pdf" | "word" | "excel" | "other";
  category: string; department: string; uploadedBy: string; uploadedAt: string; size: string;
}

const BASC_CATEGORIES = ["Procedimientos", "Formularios", "Matriz de Riesgos", "Políticas", "Registros", "Manuales", "Auditorías"];

const fileTypeColors: Record<string, string> = {
  pdf: "bg-red-50 text-red-700", word: "bg-blue-50 text-blue-700",
  excel: "bg-emerald-50 text-emerald-700", other: "bg-gray-100 text-gray-600",
};

const initialDocs: BASCDocument[] = [
  { id: "DOC-001", name: "Procedimiento de Control de Acceso.pdf", type: "pdf", category: "Procedimientos", department: "Operaciones", uploadedBy: "Anoel", uploadedAt: "2026-02-15", size: "2.4 MB" },
  { id: "DOC-002", name: "Formulario de Inspección Vehicular.pdf", type: "pdf", category: "Formularios", department: "Operaciones", uploadedBy: "Remit", uploadedAt: "2026-02-20", size: "1.1 MB" },
  { id: "DOC-003", name: "Matriz de Riesgos General.xlsx", type: "excel", category: "Matriz de Riesgos", department: "Administración", uploadedBy: "Anoel", uploadedAt: "2026-03-01", size: "890 KB" },
  { id: "DOC-004", name: "Política de Seguridad Física.pdf", type: "pdf", category: "Políticas", department: "Gerencia General", uploadedBy: "Anoel", uploadedAt: "2026-01-10", size: "3.2 MB" },
  { id: "DOC-005", name: "Registro de Capacitaciones.docx", type: "word", category: "Registros", department: "Administración", uploadedBy: "Anoel", uploadedAt: "2026-02-28", size: "560 KB" },
  { id: "DOC-006", name: "Procedimiento de Manejo de Armas.pdf", type: "pdf", category: "Procedimientos", department: "Operaciones", uploadedBy: "Remit", uploadedAt: "2026-03-03", size: "1.8 MB" },
];

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

const BASCPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<BASCTab>("objetivos");
  const [documents, setDocuments] = useState<BASCDocument[]>(initialDocs);
  const [objectives, setObjectives] = useState<BASCObjective[]>(INITIAL_OBJECTIVES);
  const [procedures] = useState<BASCProcedure[]>(INITIAL_PROCEDURES);
  const [expandedDept, setExpandedDept] = useState<string | null>(user?.department || "Operaciones");
  const [expandedCat, setExpandedCat] = useState<string | null>("Procedimientos");
  const [showUpload, setShowUpload] = useState(false);
  const [showObjectiveDetail, setShowObjectiveDetail] = useState<BASCObjective | null>(null);
  const [showAddEvidence, setShowAddEvidence] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({ department: user?.department || "", category: "", file: null as File | null });
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({ title: "", description: "", type: "documento" as BASCEvidence["type"], fileName: "" });

  // Document logic
  const accessibleDocs = user?.isAdmin ? documents : documents.filter((d) => d.department === user?.department);
  const filteredDocs = accessibleDocs.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchDept = !filterDept || d.department === filterDept;
    return matchSearch && matchDept;
  });

  const grouped: Record<string, Record<string, BASCDocument[]>> = {};
  filteredDocs.forEach((d) => {
    if (!grouped[d.department]) grouped[d.department] = {};
    if (!grouped[d.department][d.category]) grouped[d.department][d.category] = [];
    grouped[d.department][d.category].push(d);
  });

  const handleUpload = () => {
    if (!uploadForm.file || !uploadForm.department || !uploadForm.category) return;
    const ext = uploadForm.file.name.split(".").pop()?.toLowerCase();
    let type: BASCDocument["type"] = "other";
    if (ext === "pdf") type = "pdf"; else if (ext === "doc" || ext === "docx") type = "word"; else if (ext === "xls" || ext === "xlsx") type = "excel";
    const newDoc: BASCDocument = {
      id: `DOC-${String(documents.length + 1).padStart(3, "0")}`, name: uploadForm.file.name, type,
      category: uploadForm.category, department: uploadForm.department, uploadedBy: user?.fullName || "Usuario",
      uploadedAt: new Date().toISOString().split("T")[0], size: `${(uploadForm.file.size / 1024).toFixed(0)} KB`,
    };
    setDocuments([newDoc, ...documents]);
    setShowUpload(false);
    setUploadForm({ department: "", category: "", file: null });
  };

  const handleDelete = (id: string) => setDocuments(documents.filter((d) => d.id !== id));
  const getFileExtension = (name: string) => name.split(".").pop()?.toUpperCase() || "";

  // Objective stats
  const complianceAvg = objectives.length > 0 ? Math.round(objectives.reduce((a, o) => a + o.compliancePercent, 0) / objectives.length) : 0;
  const completedCount = objectives.filter((o) => o.status === "cumplido").length;
  const inProgressCount = objectives.filter((o) => o.status === "en_progreso").length;
  const pendingCount = objectives.filter((o) => o.status === "pendiente" || o.status === "vencido").length;

  const compliancePieData = [
    { name: "Cumplidos", value: completedCount },
    { name: "En Progreso", value: inProgressCount },
    { name: "Pendientes/Vencidos", value: pendingCount },
  ].filter((d) => d.value > 0);

  // Add evidence
  const handleAddEvidence = (objectiveId: string) => {
    if (!evidenceForm.title || !evidenceForm.fileName) return;
    const ev: BASCEvidence = {
      id: `EV-${Date.now()}`, objectiveId, title: evidenceForm.title,
      description: evidenceForm.description, type: evidenceForm.type,
      uploadedBy: user?.fullName || "Usuario", uploadedAt: new Date().toISOString().split("T")[0],
      fileName: evidenceForm.fileName,
    };
    setObjectives(objectives.map((o) => o.id === objectiveId ? { ...o, evidences: [...o.evidences, ev] } : o));
    setShowAddEvidence(null);
    setEvidenceForm({ title: "", description: "", type: "documento", fileName: "" });
  };

  const tabs: { id: BASCTab; label: string; icon: any }[] = [
    { id: "objetivos", label: "Objetivos y Compliance", icon: Target },
    { id: "procedimientos", label: "Procedimientos", icon: ClipboardCheck },
    { id: "documentos", label: "Documentos", icon: FolderOpen },
  ];

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
              {activeTab === "documentos" && (
                <button onClick={() => setShowUpload(true)} className="btn-gold flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Subir Documento
                </button>
              )}
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
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-heading font-bold text-destructive">{pendingCount}</p>
              </div>
            </div>

            {/* Compliance Pie + Objectives List */}
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
              </div>

              <div className="lg:col-span-2 space-y-3">
                {objectives.map((obj) => {
                  const sc = statusConfig[obj.status];
                  const proc = procedures.filter((p) => obj.linkedProcedures.includes(p.id));
                  return (
                    <div key={obj.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setShowObjectiveDetail(obj)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
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
                          {proc.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                              {proc.map((p) => (
                                <span key={p.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{p.code}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xl font-heading font-bold ${obj.compliancePercent >= 80 ? "text-emerald-600" : obj.compliancePercent >= 50 ? "gold-accent-text" : "text-destructive"}`}>
                            {obj.compliancePercent}%
                          </div>
                          <div className="w-20 h-2 bg-muted rounded-full mt-1">
                            <div className={`h-full rounded-full transition-all ${obj.compliancePercent >= 80 ? "bg-emerald-500" : obj.compliancePercent >= 50 ? "bg-gold" : "bg-destructive"}`}
                              style={{ width: `${obj.compliancePercent}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{obj.evidences.length} evidencias</p>
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
                          {linkedObjs.map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${o.compliancePercent >= 80 ? "bg-emerald-500" : o.compliancePercent >= 50 ? "bg-gold" : "bg-destructive"}`} />
                              <span className="text-xs text-card-foreground">{o.compliancePercent}%</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{o.title}</span>
                            </div>
                          ))}
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
                <input type="text" placeholder="Buscar documento..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                { label: "Total Documentos", value: documents.length, color: "text-card-foreground" },
                { label: "Procedimientos", value: documents.filter((d) => d.category === "Procedimientos").length, color: "gold-accent-text" },
                { label: "Formularios", value: documents.filter((d) => d.category === "Formularios").length, color: "gold-accent-text" },
                { label: "Departamentos", value: new Set(documents.map((d) => d.department)).size, color: "text-card-foreground" },
              ].map((s) => (
                <div key={s.label} className="bg-card rounded-lg p-4 border border-border">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="px-6 pb-8">
              {Object.keys(grouped).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No se encontraron documentos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([dept, cats]) => (
                    <div key={dept} className="bg-card rounded-lg border border-border overflow-hidden">
                      <button onClick={() => setExpandedDept(expandedDept === dept ? null : dept)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors">
                        {expandedDept === dept ? <ChevronDown className="h-4 w-4 text-gold shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <FolderOpen className="h-5 w-5 text-gold shrink-0" />
                        <span className="font-heading font-bold text-card-foreground">{dept}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{Object.values(cats).flat().length} documentos</span>
                      </button>
                      {expandedDept === dept && (
                        <div className="border-t border-border">
                          {Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, docs]) => (
                            <div key={cat}>
                              <button onClick={() => setExpandedCat(expandedCat === `${dept}-${cat}` ? null : `${dept}-${cat}`)}
                                className="w-full flex items-center gap-3 pl-12 pr-5 py-3 text-left hover:bg-muted/30 transition-colors">
                                {expandedCat === `${dept}-${cat}` ? <ChevronDown className="h-3 w-3 text-gold shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium text-card-foreground">{cat}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{docs.length}</span>
                              </button>
                              {expandedCat === `${dept}-${cat}` && (
                                <div className="pl-20 pr-5 pb-3 space-y-2">
                                  {docs.map((doc) => (
                                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                                      <span className={`text-xs font-bold px-2 py-1 rounded ${fileTypeColors[doc.type]}`}>{getFileExtension(doc.name)}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                                        <p className="text-xs text-muted-foreground">{doc.uploadedBy} · {doc.uploadedAt} · {doc.size}</p>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-card-foreground transition-colors" title="Descargar"><Download className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-destructive transition-colors" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
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

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Subir Documento</h2>
                <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Departamento *</label>
                  <select value={uploadForm.department} onChange={(e) => setUploadForm({ ...uploadForm, department: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {DEPARTMENTS.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Categoría *</label>
                  <select value={uploadForm.category} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="">Seleccionar...</option>
                    {BASC_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Archivo *</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="h-5 w-5 text-gold" />
                        <span className="text-sm text-card-foreground font-medium">{uploadForm.file.name}</span>
                        <button onClick={() => setUploadForm({ ...uploadForm, file: null })} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4 text-muted-foreground" /></button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">PDF, Word o Excel</p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm font-medium text-card-foreground cursor-pointer hover:bg-border transition-colors">
                          <Plus className="h-4 w-4" /> Seleccionar archivo
                          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUploadForm({ ...uploadForm, file }); }} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowUpload(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleUpload} className="btn-gold text-sm">Subir</button>
              </div>
            </div>
          </div>
        )}

        {/* Objective Detail Modal */}
        {showObjectiveDetail && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{showObjectiveDetail.code}</p>
                  <h2 className="font-heading font-bold text-lg text-card-foreground">{showObjectiveDetail.title}</h2>
                </div>
                <button onClick={() => setShowObjectiveDetail(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-sm text-muted-foreground">{showObjectiveDetail.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Compliance</p>
                    <p className={`text-xl font-bold ${showObjectiveDetail.compliancePercent >= 80 ? "text-emerald-600" : showObjectiveDetail.compliancePercent >= 50 ? "gold-accent-text" : "text-destructive"}`}>
                      {showObjectiveDetail.compliancePercent}%
                    </p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Estado</p>
                    <p className="text-sm font-semibold text-card-foreground">{statusConfig[showObjectiveDetail.status].label}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Fecha Objetivo</p>
                    <p className="text-sm font-semibold text-card-foreground">{showObjectiveDetail.targetDate}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Auditoría</p>
                    <p className="text-sm font-semibold text-card-foreground">
                      {showObjectiveDetail.auditResult ? (showObjectiveDetail.auditResult === "conforme" ? "✓ Conforme" : showObjectiveDetail.auditResult === "observación" ? "⚠ Observación" : "✗ No conforme") : "Sin auditar"}
                    </p>
                  </div>
                </div>

                {/* Linked Procedures */}
                <div>
                  <h4 className="text-sm font-heading font-bold text-card-foreground mb-2 flex items-center gap-2"><Link2 className="h-4 w-4" /> Procedimientos Vinculados</h4>
                  <div className="space-y-2">
                    {procedures.filter((p) => showObjectiveDetail.linkedProcedures.includes(p.id)).map((p) => (
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
                    <h4 className="text-sm font-heading font-bold text-card-foreground flex items-center gap-2"><Eye className="h-4 w-4" /> Evidencias ({showObjectiveDetail.evidences.length})</h4>
                    <button onClick={() => setShowAddEvidence(showObjectiveDetail.id)} className="text-xs gold-accent-text hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar Evidencia</button>
                  </div>
                  {showObjectiveDetail.evidences.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">Sin evidencias registradas</p>
                  ) : (
                    <div className="space-y-2">
                      {showObjectiveDetail.evidences.map((ev) => (
                        <div key={ev.id} className="bg-muted rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold bg-card px-1.5 py-0.5 rounded text-muted-foreground">{ev.type}</span>
                                <span className="text-sm font-medium text-card-foreground">{ev.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{ev.uploadedBy} · {ev.uploadedAt} · {ev.fileName}</p>
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

        {/* Add Evidence Modal */}
        {showAddEvidence && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-heading font-bold text-lg text-card-foreground">Agregar Evidencia</h2>
                <button onClick={() => setShowAddEvidence(null)} className="p-1 hover:bg-muted rounded-lg"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Título *</label>
                  <input type="text" value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Descripción</label>
                  <textarea value={evidenceForm.description} onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })} rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Tipo de Evidencia</label>
                  <select value={evidenceForm.type} onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value as BASCEvidence["type"] })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none">
                    <option value="documento">Documento</option>
                    <option value="foto">Foto</option>
                    <option value="registro">Registro</option>
                    <option value="capacitación">Capacitación</option>
                    <option value="auditoría">Auditoría</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground block mb-1.5">Nombre del archivo *</label>
                  <input type="text" value={evidenceForm.fileName} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileName: e.target.value })} placeholder="ejemplo.pdf"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-gold outline-none" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3 justify-end">
                <button onClick={() => setShowAddEvidence(null)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={() => handleAddEvidence(showAddEvidence)} className="btn-gold text-sm">Guardar Evidencia</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BASCPage;
